import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthedClient } from "@/lib/gmail/tokens";
import { fetchRecentEmails } from "@/lib/gmail/client";
import { extractAddresses } from "@/lib/research/address-extractor";
import { processAddress } from "@/lib/research/pipeline";
import { getMarketStats } from "@/lib/rentcast/client";
import { createGmailDraft } from "@/lib/gmail/drafts";
import { createActivityEntry } from "@/lib/supabase/activity";

/**
 * POST /api/research/wow
 *
 * "First-day WOW" trigger — called after onboarding completes.
 * Scans agent's recent emails (7 days) for property addresses,
 * picks the best one, runs the full pipeline, and also generates
 * a market insight for the agent's primary ZIP code.
 *
 * Goal: 3 deliverables in agent's Gmail within 60 seconds.
 */
export async function POST(request: Request) {
  const supabase = await createClient() as any;
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient() as any;
  const { data: agent } = await admin
    .from("agents")
    .select("id, email, voice_tone")
    .eq("user_id", user.id)
    .single();

  if (!agent) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }

  const results: { type: string; status: string; detail?: string }[] = [];

  try {
    // 1. Scan recent emails for property addresses
    let auth;
    try {
      auth = await getAuthedClient(agent.id);
    } catch {
      return NextResponse.json({
        error: "Gmail not connected",
        results,
      }, { status: 400 });
    }

    const after = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const emails = await fetchRecentEmails(auth, agent.email, 30, after);

    // Extract addresses from all emails
    const addressCandidates: { address: string; context: string; emailDate: string }[] = [];

    for (const email of emails) {
      const addresses = await extractAddresses(email.subject, email.body);
      for (const addr of addresses) {
        addressCandidates.push({
          address: addr.address,
          context: addr.context,
          emailDate: email.date,
        });
      }
    }

    // 2. Pick the best address (most recent, showing/listing_alert preferred)
    const sorted = addressCandidates.sort((a, b) => {
      // Prefer showing/listing_alert context
      const contextPriority: Record<string, number> = { showing: 0, listing_alert: 1, offer: 2, general: 3 };
      const contextDiff = (contextPriority[a.context] ?? 3) - (contextPriority[b.context] ?? 3);
      if (contextDiff !== 0) return contextDiff;
      // Then by recency
      return new Date(b.emailDate).getTime() - new Date(a.emailDate).getTime();
    });

    if (sorted.length > 0) {
      // Run full research pipeline on the best address
      try {
        const briefId = await processAddress({
          agentId: agent.id,
          address: { address: sorted[0].address, context: sorted[0].context as any },
          triggerType: "email",
        });
        results.push({
          type: "property_brief",
          status: briefId ? "success" : "failed",
          detail: sorted[0].address,
        });
      } catch (err) {
        console.error("[wow] Property brief failed:", err);
        results.push({ type: "property_brief", status: "failed", detail: sorted[0].address });
      }

      // If there's a second good address, research it too
      if (sorted.length > 1) {
        try {
          const briefId2 = await processAddress({
            agentId: agent.id,
            address: { address: sorted[1].address, context: sorted[1].context as any },
            triggerType: "email",
          });
          results.push({
            type: "property_brief_2",
            status: briefId2 ? "success" : "failed",
            detail: sorted[1].address,
          });
        } catch (err) {
          console.error("[wow] Second property brief failed:", err);
          results.push({ type: "property_brief_2", status: "failed", detail: sorted[1].address });
        }
      }
    } else {
      results.push({ type: "property_brief", status: "skipped", detail: "No addresses found in recent emails" });
    }

    // 3. Generate market insight for agent's primary area
    // Try to extract a ZIP from the first address, or use agent's addresses
    let zipCode: string | null = null;
    if (sorted.length > 0) {
      const zipMatch = sorted[0].address.match(/\b(\d{5})\b/);
      if (zipMatch) zipCode = zipMatch[1];
    }

    if (zipCode) {
      try {
        const marketData = await getMarketStats(zipCode);
        if (marketData) {
          const marketHtml = buildMarketInsightEmail(marketData, zipCode);

          await createGmailDraft(auth, {
            to: agent.email,
            subject: `Market Snapshot: ${zipCode}`,
            htmlBody: marketHtml,
            from: agent.email,
          });

          results.push({ type: "market_insight", status: "success", detail: zipCode });
        } else {
          results.push({ type: "market_insight", status: "skipped", detail: "No market data available" });
        }
      } catch (err) {
        console.error("[wow] Market insight failed:", err);
        results.push({ type: "market_insight", status: "failed", detail: zipCode });
      }
    } else {
      results.push({ type: "market_insight", status: "skipped", detail: "No ZIP code found" });
    }

    // Log WOW completion
    await createActivityEntry(
      agent.id,
      "research_completed",
      "Welcome research completed",
      `${results.filter((r) => r.status === "success").length} deliverables created`,
      { results },
      { skipNotification: true }
    );

    return NextResponse.json({
      success: true,
      deliverables: results.filter((r) => r.status === "success").length,
      results,
    });
  } catch (err) {
    console.error("[wow] WOW trigger error:", err);
    return NextResponse.json(
      { error: "WOW trigger failed", results },
      { status: 500 }
    );
  }
}

function buildMarketInsightEmail(
  market: { medianPrice: number | null; medianRent: number | null; averageDaysOnMarket: number | null; totalListings: number | null; medianPricePerSqft: number | null },
  zipCode: string
): string {
  const stats: string[] = [];

  if (market.medianPrice != null) {
    stats.push(`<tr><td style="padding: 8px 0; color: #666;">Median Sale Price</td><td style="padding: 8px 0; font-weight: 600; text-align: right;">$${market.medianPrice.toLocaleString()}</td></tr>`);
  }
  if (market.medianRent != null) {
    stats.push(`<tr><td style="padding: 8px 0; color: #666;">Median Rent</td><td style="padding: 8px 0; font-weight: 600; text-align: right;">$${market.medianRent.toLocaleString()}/mo</td></tr>`);
  }
  if (market.averageDaysOnMarket != null) {
    stats.push(`<tr><td style="padding: 8px 0; color: #666;">Avg Days on Market</td><td style="padding: 8px 0; font-weight: 600; text-align: right;">${market.averageDaysOnMarket} days</td></tr>`);
  }
  if (market.totalListings != null) {
    stats.push(`<tr><td style="padding: 8px 0; color: #666;">Active Listings</td><td style="padding: 8px 0; font-weight: 600; text-align: right;">${market.totalListings}</td></tr>`);
  }
  if (market.medianPricePerSqft != null) {
    stats.push(`<tr><td style="padding: 8px 0; color: #666;">Price per Sqft</td><td style="padding: 8px 0; font-weight: 600; text-align: right;">$${market.medianPricePerSqft}</td></tr>`);
  }

  return `
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; color: #1a1a1a;">
  <div style="padding: 24px 0; border-bottom: 1px solid #e5e5e5;">
    <h2 style="margin: 0 0 4px; font-size: 18px; font-weight: 600;">Market Snapshot</h2>
    <p style="margin: 0; color: #666; font-size: 14px;">ZIP Code ${zipCode}</p>
  </div>

  <div style="padding: 20px 0;">
    <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
      ${stats.join("\n")}
    </table>
  </div>

  <div style="padding: 12px 0; color: #999; font-size: 12px; border-top: 1px solid #e5e5e5;">
    Data from RentCast · Generated by FoyerFind
  </div>
</div>`.trim();
}
