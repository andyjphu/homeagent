import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { llmComplete } from "@/lib/llm/router";
import { EMAIL_COMPOSITION_PROMPT } from "@/lib/llm/prompts/email-analysis";

export async function POST(request: Request) {
  const supabase = await createClient() as any;
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { buyerId } = await request.json();

  if (!buyerId) {
    return NextResponse.json({ error: "buyerId required" }, { status: 400 });
  }

  const admin = createAdminClient() as any;

  // Fetch agent
  const { data: agent } = await admin
    .from("agents")
    .select("id, full_name, email, email_signature")
    .eq("user_id", user.id)
    .single();

  if (!agent) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }

  // Fetch buyer
  const { data: buyer } = await admin
    .from("buyers")
    .select("*")
    .eq("id", buyerId)
    .eq("agent_id", agent.id)
    .single();

  if (!buyer) {
    return NextResponse.json({ error: "Buyer not found" }, { status: 404 });
  }

  // Fetch sent properties with scores
  const { data: scores } = await admin
    .from("buyer_property_scores")
    .select("match_score, score_reasoning, is_favorited, properties(address, listing_price, beds, baths, sqft)")
    .eq("buyer_id", buyerId)
    .eq("is_sent_to_buyer", true)
    .order("match_score", { ascending: false })
    .limit(10);

  // Fetch active deal
  const { data: deals } = await admin
    .from("deals")
    .select("stage, current_offer_price, closing_date, properties(address)")
    .eq("buyer_id", buyerId)
    .not("stage", "in", "(closed,dead)")
    .limit(1);

  // Fetch recent comments
  const { data: comments } = await admin
    .from("buyer_comments")
    .select("comment, created_at, buyer_property_scores(properties(address))")
    .eq("buyer_id", buyerId)
    .order("created_at", { ascending: false })
    .limit(5);

  const intent = (buyer.intent_profile || {}) as any;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const dashboardUrl = `${appUrl}/d/${buyer.dashboard_token}`;

  // Build context for LLM
  const propertyLines = (scores || []).map((s: any, i: number) => {
    const p = s.properties;
    return `${i + 1}. ${p?.address} — $${p?.listing_price?.toLocaleString()}, ${p?.beds}bd/${p?.baths}ba, ${p?.sqft?.toLocaleString()} sqft, Match: ${s.match_score}/100${s.is_favorited ? " (FAVORITED)" : ""}${s.score_reasoning ? ` — ${s.score_reasoning}` : ""}`;
  }).join("\n");

  const activeDeal = deals?.[0];
  const dealSection = activeDeal
    ? `\nActive Deal: ${(activeDeal as any).properties?.address}, Stage: ${activeDeal.stage.replace(/_/g, " ")}, Offer: $${activeDeal.current_offer_price?.toLocaleString() || "TBD"}${activeDeal.closing_date ? `, Closing: ${new Date(activeDeal.closing_date).toLocaleDateString()}` : ""}`
    : "";

  const commentLines = (comments || []).slice(0, 3).map((c: any) =>
    `- "${c.comment}" on ${(c.buyer_property_scores as any)?.properties?.address || "a property"}`
  ).join("\n");

  const favCount = (scores || []).filter((s: any) => s.is_favorited).length;

  const context = `
Agent: ${agent.full_name}
Buyer: ${buyer.full_name}
Buyer Email: ${buyer.email}
Dashboard Link: ${dashboardUrl}

Search Criteria:
- Budget: ${intent.budget_min ? `$${intent.budget_min.toLocaleString()}` : "?"} - ${intent.budget_max ? `$${intent.budget_max.toLocaleString()}` : "?"}
- Beds: ${intent.beds_min || "?"}+, Baths: ${intent.baths_min || "?"}+
- Areas: ${intent.preferred_areas?.join(", ") || "not specified"}
- Timeline: ${intent.timeline || "not specified"}

Properties Sent (${scores?.length || 0} total, ${favCount} favorited):
${propertyLines || "No properties sent yet."}
${dealSection}
${commentLines ? `\nRecent Buyer Feedback:\n${commentLines}` : ""}
${agent.email_signature ? `\nAgent Signature:\n${agent.email_signature}` : `\nSign off as: ${agent.full_name}`}

Purpose: Write a personalized property update email to the buyer. Include the dashboard link so they can review all properties. Highlight top matches and any favorited properties. If there's an active deal, mention the progress.`.trim();

  try {
    const body = await llmComplete(
      "email_composition",
      EMAIL_COMPOSITION_PROMPT,
      context
    );

    const buyerFirst = buyer.full_name.split(" ")[0];

    return NextResponse.json({
      to: buyer.email,
      subject: `Property Update for ${buyerFirst} — ${scores?.length || 0} Matches`,
      body,
    });
  } catch (err: any) {
    console.error("[buyer-summary] LLM error:", err);
    // Fallback: return a basic template without LLM
    const buyerFirst = buyer.full_name.split(" ")[0];
    const fallback = [
      `Hi ${buyerFirst},`,
      "",
      `I've curated ${scores?.length || 0} properties matched to your criteria. You can review them all on your private dashboard:`,
      "",
      dashboardUrl,
      "",
      propertyLines ? `Here are your top matches:\n${propertyLines}` : "",
      activeDeal ? `\nDeal update: ${(activeDeal as any).properties?.address} is in the ${activeDeal.stage.replace(/_/g, " ")} stage.` : "",
      "",
      "Let me know if you'd like to schedule any tours or have questions about any of these properties.",
      "",
      agent.email_signature || `Best,\n${agent.full_name}`,
    ].filter(Boolean).join("\n");

    return NextResponse.json({
      to: buyer.email,
      subject: `Property Update for ${buyerFirst} — ${scores?.length || 0} Matches`,
      body: fallback,
    });
  }
}
