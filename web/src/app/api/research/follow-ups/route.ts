import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateFollowUp, type FollowUpTrigger } from "@/lib/research/follow-ups";
import { getAuthedClient } from "@/lib/gmail/tokens";
import { createGmailDraft } from "@/lib/gmail/drafts";
import { createActivityEntry } from "@/lib/supabase/activity";

export const maxDuration = 120;

interface PendingFollowUp {
  agentId: string;
  buyerId: string;
  buyerName: string;
  buyerEmail: string | null;
  trigger: FollowUpTrigger;
}

/**
 * Cron endpoint — checks for follow-up triggers and creates Gmail drafts.
 * POST /api/research/follow-ups
 */
export async function POST() {
  const admin = createAdminClient() as any;
  const pending: PendingFollowUp[] = [];

  // --- 1. Post-showing: calendar events that ended in the last 2 hours ---
  try {
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    const now = new Date().toISOString();

    const { data: recentEvents } = await admin
      .from("calendar_events")
      .select("id, agent_id, deal_id, summary, event_date, event_type")
      .gte("event_date", twoHoursAgo)
      .lte("event_date", now)
      .in("event_type", ["showing", "tour", "open_house"]);

    if (recentEvents?.length) {
      for (const event of recentEvents) {
        // Get deal → buyer
        if (!event.deal_id) continue;
        const { data: deal } = await admin
          .from("deals")
          .select("buyer_id, property_id, buyers:buyer_id(id, full_name, email), properties:property_id(address)")
          .eq("id", event.deal_id)
          .single();

        if (!deal?.buyers) continue;

        pending.push({
          agentId: event.agent_id,
          buyerId: deal.buyers.id,
          buyerName: deal.buyers.full_name,
          buyerEmail: deal.buyers.email,
          trigger: {
            type: "post_showing",
            propertyAddress: deal.properties?.address || event.summary || "a property",
          },
        });
      }
    }
  } catch (err) {
    console.error("[follow-ups] Post-showing check failed:", err);
  }

  // --- 2. Inactive buyers: no activity in 5+ days ---
  try {
    const fiveDaysAgo = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString();

    // Find buyers whose last dashboard session or last property score update is > 5 days ago
    const { data: buyers } = await admin
      .from("buyers")
      .select("id, full_name, email, agent_id, intake_answers")
      .eq("status", "active");

    if (buyers?.length) {
      for (const buyer of buyers) {
        // Check latest dashboard session
        const { data: lastSession } = await admin
          .from("dashboard_sessions")
          .select("started_at")
          .eq("buyer_id", buyer.id)
          .order("started_at", { ascending: false })
          .limit(1)
          .single();

        // Check latest property score activity
        const { data: lastScore } = await admin
          .from("buyer_property_scores")
          .select("updated_at")
          .eq("buyer_id", buyer.id)
          .order("updated_at", { ascending: false })
          .limit(1)
          .single();

        const lastActivity = [
          lastSession?.started_at,
          lastScore?.updated_at,
        ]
          .filter(Boolean)
          .sort()
          .pop();

        if (!lastActivity || new Date(lastActivity) < new Date(fiveDaysAgo)) {
          const daysSince = lastActivity
            ? Math.floor(
                (Date.now() - new Date(lastActivity).getTime()) /
                  (24 * 60 * 60 * 1000)
              )
            : 7;

          // Try to get their preferred area from intake
          const areas =
            buyer.intake_answers?.preferred_areas ||
            buyer.intake_answers?.areas ||
            [];
          const area = Array.isArray(areas) && areas.length > 0 ? areas[0] : undefined;

          pending.push({
            agentId: buyer.agent_id,
            buyerId: buyer.id,
            buyerName: buyer.full_name,
            buyerEmail: buyer.email,
            trigger: {
              type: "inactive_buyer",
              daysSinceActivity: daysSince,
              area,
            },
          });
        }
      }
    }
  } catch (err) {
    console.error("[follow-ups] Inactive buyer check failed:", err);
  }

  // --- 3. Similar favorites: 3+ favorites in the same area ---
  try {
    const { data: favoritedScores } = await admin
      .from("buyer_property_scores")
      .select(
        "buyer_id, property_id, properties:property_id(address, city, zip_code)"
      )
      .eq("is_favorited", true);

    if (favoritedScores?.length) {
      // Group by buyer + city/zip
      const byBuyerArea = new Map<string, { buyerId: string; area: string; count: number }>();

      for (const score of favoritedScores) {
        const area =
          score.properties?.city || score.properties?.zip_code || null;
        if (!area) continue;

        const key = `${score.buyer_id}:${area}`;
        const existing = byBuyerArea.get(key);
        if (existing) {
          existing.count++;
        } else {
          byBuyerArea.set(key, {
            buyerId: score.buyer_id,
            area,
            count: 1,
          });
        }
      }

      for (const entry of byBuyerArea.values()) {
        if (entry.count >= 3) {
          const { data: buyer } = await admin
            .from("buyers")
            .select("id, full_name, email, agent_id")
            .eq("id", entry.buyerId)
            .single();

          if (buyer) {
            pending.push({
              agentId: buyer.agent_id,
              buyerId: buyer.id,
              buyerName: buyer.full_name,
              buyerEmail: buyer.email,
              trigger: {
                type: "similar_favorites",
                area: entry.area,
                newListingCount: entry.count,
              },
            });
          }
        }
      }
    }
  } catch (err) {
    console.error("[follow-ups] Similar favorites check failed:", err);
  }

  // --- Deduplicate: skip if a follow-up was already created in the last 7 days ---
  const results: Array<{ buyerId: string; type: string; status: string }> = [];

  for (const item of pending) {
    try {
      const sevenDaysAgo = new Date(
        Date.now() - 7 * 24 * 60 * 60 * 1000
      ).toISOString();

      // Check activity_feed for recent follow-up of same type+buyer
      const { data: existing } = await admin
        .from("activity_feed")
        .select("id")
        .eq("agent_id", item.agentId)
        .eq("event_type", "follow_up_created")
        .gte("created_at", sevenDaysAgo)
        .contains("metadata", { buyer_id: item.buyerId, trigger_type: item.trigger.type })
        .limit(1);

      if (existing?.length) {
        results.push({
          buyerId: item.buyerId,
          type: item.trigger.type,
          status: "skipped_duplicate",
        });
        continue;
      }

      // Get agent settings
      const { data: agentData } = await admin
        .from("agents")
        .select("voice_tone, gmail_connected")
        .eq("id", item.agentId)
        .single();

      const voiceTone = agentData?.voice_tone || "professional";

      // Generate the follow-up
      const draft = await generateFollowUp(
        { full_name: item.buyerName, email: item.buyerEmail },
        item.trigger,
        voiceTone
      );

      // Create Gmail draft if connected and buyer has email
      let draftId: string | null = null;
      if (agentData?.gmail_connected && item.buyerEmail) {
        try {
          const auth = await getAuthedClient(item.agentId);
          draftId = await createGmailDraft(auth, {
            to: item.buyerEmail,
            subject: draft.subject,
            htmlBody: draft.body.replace(/\n/g, "<br>"),
          });
        } catch (err) {
          console.error("[follow-ups] Gmail draft creation failed:", err);
        }
      }

      // Log to activity feed
      await createActivityEntry(
        item.agentId,
        "follow_up_created" as any,
        `Follow-up draft: ${draft.subject}`,
        `${item.trigger.type} follow-up for ${item.buyerName}`,
        {
          buyer_id: item.buyerId,
          trigger_type: item.trigger.type,
          gmail_draft_id: draftId,
          subject: draft.subject,
        },
        { buyerId: item.buyerId, skipNotification: true }
      );

      results.push({
        buyerId: item.buyerId,
        type: item.trigger.type,
        status: draftId ? "draft_created" : "generated_no_gmail",
      });
    } catch (err) {
      console.error("[follow-ups] Failed for buyer:", item.buyerId, err);
      results.push({
        buyerId: item.buyerId,
        type: item.trigger.type,
        status: "error",
      });
    }
  }

  return NextResponse.json({
    checked: pending.length,
    results,
  });
}
