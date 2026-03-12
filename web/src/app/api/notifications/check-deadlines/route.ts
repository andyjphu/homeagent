import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createActivityEntry } from "@/lib/supabase/activity";

/**
 * GET /api/notifications/check-deadlines
 *
 * Scans all active deals for approaching deadlines (within 48 hours).
 * Creates activity_feed entries (which trigger notifications) for each.
 *
 * Intended to be called by a cron job (e.g., every hour via Vercel Cron).
 * Protected by CRON_SECRET header to prevent unauthorized access.
 */
export async function GET(request: Request) {
  // Verify cron secret if set
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = request.headers.get("authorization");
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    const admin = createAdminClient() as any;
    const now = new Date();
    const in48Hours = new Date(now.getTime() + 48 * 60 * 60 * 1000);

    // Get all active deals with contingency deadlines
    const activeDealStages = [
      "under_contract",
      "inspection",
      "appraisal",
      "closing",
    ];

    const { data: deals, error } = await admin
      .from("deals")
      .select(`
        id,
        agent_id,
        buyer_id,
        property_id,
        stage,
        closing_date,
        contingencies,
        properties!inner(address, city, state),
        buyers!inner(full_name)
      `)
      .in("stage", activeDealStages);

    if (error) {
      console.error("[check-deadlines] Query error:", error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!deals || deals.length === 0) {
      return NextResponse.json({ checked: 0, alerts: 0 });
    }

    let alertCount = 0;

    for (const deal of deals) {
      const contingencies = (deal.contingencies || {}) as Record<string, string>;
      const deadlines: { type: string; date: string }[] = [];

      // Check contingency deadlines
      for (const [key, dateStr] of Object.entries(contingencies)) {
        if (dateStr && typeof dateStr === "string") {
          deadlines.push({
            type: key.replace(/_/g, " ").replace(/deadline$/, "").trim(),
            date: dateStr,
          });
        }
      }

      // Check closing date
      if (deal.closing_date) {
        deadlines.push({ type: "closing", date: deal.closing_date });
      }

      for (const deadline of deadlines) {
        const deadlineDate = new Date(deadline.date);
        if (isNaN(deadlineDate.getTime())) continue;

        // Only alert if deadline is within 48 hours AND in the future
        if (deadlineDate > now && deadlineDate <= in48Hours) {
          const hoursRemaining = Math.round(
            (deadlineDate.getTime() - now.getTime()) / (60 * 60 * 1000)
          );

          // Check if we already sent a deadline alert for this deal+type today
          const todayStart = new Date(now);
          todayStart.setHours(0, 0, 0, 0);

          const { data: existing } = await admin
            .from("activity_feed")
            .select("id")
            .eq("agent_id", deal.agent_id)
            .eq("deal_id", deal.id)
            .eq("event_type", "deadline_approaching")
            .gte("occurred_at", todayStart.toISOString())
            .limit(1);

          if (existing && existing.length > 0) continue; // Already alerted today

          const propertyAddress = [
            deal.properties?.address,
            deal.properties?.city,
            deal.properties?.state,
          ]
            .filter(Boolean)
            .join(", ");
          const buyerName = deal.buyers?.full_name || "Unknown buyer";

          await createActivityEntry(
            deal.agent_id,
            "deadline_approaching",
            `${deadline.type} deadline in ${hoursRemaining}h`,
            `${deadline.type} deadline for ${propertyAddress} (${buyerName}) is due ${deadline.date}`,
            {
              deadlineType: deadline.type,
              deadlineDate: deadline.date,
              hoursRemaining,
              buyerName,
              propertyAddress,
            },
            {
              buyerId: deal.buyer_id,
              propertyId: deal.property_id,
              dealId: deal.id,
              isActionRequired: true,
            }
          );

          alertCount++;
        }
      }
    }

    return NextResponse.json({
      checked: deals.length,
      alerts: alertCount,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    console.error("[check-deadlines] Error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
