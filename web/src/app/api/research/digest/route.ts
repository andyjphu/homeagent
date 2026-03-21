import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getMarketStats } from "@/lib/rentcast/client";
import { llmComplete, isLLMAvailable } from "@/lib/llm/router";
import { getAuthedClient } from "@/lib/gmail/tokens";
import { createGmailDraft } from "@/lib/gmail/drafts";
import { createActivityEntry } from "@/lib/supabase/activity";

export const maxDuration = 120;

interface ZipStats {
  zipCode: string;
  medianPrice: number | null;
  medianRent: number | null;
  averageDaysOnMarket: number | null;
  totalListings: number | null;
  medianPricePerSqft: number | null;
}

/**
 * Weekly market digest — runs Monday 9am (or on demand).
 * For each agent: gathers active ZIP codes, fetches RentCast stats,
 * generates a digest email, and creates a Gmail draft.
 *
 * POST /api/research/digest
 */
export async function POST() {
  const admin = createAdminClient() as any;

  // Get all agents
  const { data: agents, error: agentsErr } = await admin
    .from("agents")
    .select("id, full_name, email, voice_tone, gmail_connected");

  if (agentsErr) {
    console.error("[digest] Failed to query agents:", agentsErr.message);
    return NextResponse.json({ message: "Failed to query agents", error: agentsErr.message }, { status: 500 });
  }

  if (!agents?.length) {
    return NextResponse.json({ message: "No agents found" });
  }

  const results: Array<{ agentId: string; status: string; zips: number }> = [];

  for (const agent of agents) {
    try {
      // Get active ZIP codes from the agent's buyers' properties
      const { data: scores } = await admin
        .from("buyer_property_scores")
        .select("properties:property_id(zip_code)")
        .eq("buyers:buyer_id.agent_id", agent.id);

      // Also get ZIP codes from properties directly linked to this agent's buyers
      const { data: buyerProps } = await admin
        .from("buyers")
        .select("id")
        .eq("agent_id", agent.id);

      const buyerIds = buyerProps?.map((b: any) => b.id) || [];

      let zipSet = new Set<string>();

      if (buyerIds.length > 0) {
        const { data: propScores } = await admin
          .from("buyer_property_scores")
          .select("properties:property_id(zip_code)")
          .in("buyer_id", buyerIds);

        for (const s of propScores || []) {
          const zip = s.properties?.zip_code;
          if (zip) zipSet.add(zip);
        }
      }

      // Also check properties table directly
      const { data: agentProperties } = await admin
        .from("properties")
        .select("zip_code")
        .eq("agent_id", agent.id)
        .not("zip_code", "is", null);

      for (const p of agentProperties || []) {
        if (p.zip_code) zipSet.add(p.zip_code);
      }

      const zips = Array.from(zipSet).slice(0, 10); // Cap at 10 ZIPs

      if (zips.length === 0) {
        results.push({ agentId: agent.id, status: "no_zips", zips: 0 });
        continue;
      }

      // Fetch market stats for each ZIP
      const zipStats: ZipStats[] = [];
      for (const zip of zips) {
        const stats = await getMarketStats(zip);
        if (stats) {
          zipStats.push({
            zipCode: zip,
            medianPrice: stats.medianPrice,
            medianRent: stats.medianRent,
            averageDaysOnMarket: stats.averageDaysOnMarket,
            totalListings: stats.totalListings,
            medianPricePerSqft: stats.medianPricePerSqft,
          });
        }
      }

      if (zipStats.length === 0) {
        results.push({
          agentId: agent.id,
          status: "no_market_data",
          zips: zips.length,
        });
        continue;
      }

      // Check for buyer activity trends (showing_feedback if exists)
      let activitySummary = "";
      try {
        const { data: recentFavorites, count: favCount } = await admin
          .from("buyer_property_scores")
          .select("id", { count: "exact" })
          .in("buyer_id", buyerIds)
          .eq("is_favorited", true);

        const { data: recentViews } = await admin
          .from("buyer_property_scores")
          .select("view_count")
          .in("buyer_id", buyerIds)
          .gt("view_count", 0);

        const totalViews = (recentViews || []).reduce(
          (sum: number, r: any) => sum + (r.view_count || 0),
          0
        );

        if (favCount || totalViews) {
          activitySummary = `Buyer activity this period: ${favCount || 0} properties favorited, ${totalViews} total property views across ${buyerIds.length} active buyers.`;
        }
      } catch {
        // Buyer activity data not critical
      }

      // Generate digest content
      const dateStr = new Date().toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
      });

      const digestContent = await generateDigestContent(
        agent.full_name,
        dateStr,
        zipStats,
        activitySummary,
        agent.voice_tone || "professional"
      );

      const subject = `Your Market Intel for ${new Date().toLocaleDateString("en-US", { month: "long", day: "numeric" })}`;

      // Create Gmail draft
      let draftId: string | null = null;
      if (agent.gmail_connected) {
        try {
          const auth = await getAuthedClient(agent.id);
          draftId = await createGmailDraft(auth, {
            to: agent.email,
            subject,
            htmlBody: digestContent.replace(/\n/g, "<br>"),
          });
        } catch (err) {
          console.error("[digest] Gmail draft failed for agent:", agent.id, err);
        }
      }

      // Log activity
      await createActivityEntry(
        agent.id,
        "market_digest_created" as any,
        subject,
        `Weekly digest covering ${zipStats.length} ZIP codes`,
        {
          zip_codes: zips,
          gmail_draft_id: draftId,
        },
        { skipNotification: true }
      );

      results.push({
        agentId: agent.id,
        status: draftId ? "draft_created" : "generated_no_gmail",
        zips: zipStats.length,
      });
    } catch (err) {
      console.error("[digest] Failed for agent:", agent.id, err);
      results.push({ agentId: agent.id, status: "error", zips: 0 });
    }
  }

  return NextResponse.json({ results });
}

async function generateDigestContent(
  agentName: string,
  dateStr: string,
  zipStats: ZipStats[],
  activitySummary: string,
  voiceTone: string
): Promise<string> {
  // Build market data summary
  const statsLines = zipStats
    .map((z) => {
      const parts = [`ZIP ${z.zipCode}`];
      if (z.medianPrice != null)
        parts.push(`Median Price: $${z.medianPrice.toLocaleString()}`);
      if (z.medianPricePerSqft != null)
        parts.push(`$/sqft: $${z.medianPricePerSqft.toLocaleString()}`);
      if (z.averageDaysOnMarket != null)
        parts.push(`Avg DOM: ${z.averageDaysOnMarket} days`);
      if (z.totalListings != null)
        parts.push(`Active Listings: ${z.totalListings}`);
      if (z.medianRent != null)
        parts.push(`Median Rent: $${z.medianRent.toLocaleString()}/mo`);
      return parts.join(" | ");
    })
    .join("\n");

  if (!isLLMAvailable("market_digest")) {
    // Fallback: structured text
    let content = `Market Intel for ${dateStr}\n\n`;
    content += `Hi ${agentName},\n\n`;
    content += `Here's your weekly market snapshot:\n\n`;
    content += statsLines + "\n\n";
    if (activitySummary) content += activitySummary + "\n\n";
    content += "Review your active deals and buyer dashboards for the latest updates.\n\n";
    content += "---\nPowered by FoyerFind";
    return content;
  }

  const prompt = `Generate a concise weekly market digest email for a real estate agent.

Agent name: ${agentName}
Date: ${dateStr}

MARKET DATA:
${statsLines}

${activitySummary ? `BUYER ACTIVITY:\n${activitySummary}` : ""}

Write a brief, scannable email (200-300 words) that:
1. Opens with a greeting using the agent's first name
2. Highlights key market trends (price changes, DOM shifts, inventory)
3. ${activitySummary ? "Mentions buyer engagement trends" : "Skips buyer activity section"}
4. Ends with a quick actionable takeaway

Do NOT include a subject line. Start with the greeting.
End with "---\nPowered by FoyerFind"`;

  try {
    return await llmComplete("market_digest", prompt, `Generate the digest.`, {
      maxTokens: 768,
    });
  } catch {
    // Fallback
    let content = `Hi ${agentName.split(" ")[0]},\n\n`;
    content += `Here's your weekly market snapshot for ${dateStr}:\n\n`;
    content += statsLines + "\n\n";
    if (activitySummary) content += activitySummary + "\n\n";
    content += "---\nPowered by FoyerFind";
    return content;
  }
}
