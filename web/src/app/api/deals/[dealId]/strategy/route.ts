import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { llmJSON } from "@/lib/llm/router";
import { OFFER_STRATEGY_PROMPT } from "@/lib/llm/prompts/offer-strategy";
import { createActivityEntry } from "@/lib/supabase/activity";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ dealId: string }> }
) {
  const { dealId } = await params;
  const supabase = await createClient() as any;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Fetch full deal context
  const { data: deal } = await supabase
    .from("deals")
    .select("*, buyers(*), properties(*)")
    .eq("id", dealId)
    .single();

  if (!deal) {
    return NextResponse.json({ error: "Deal not found" }, { status: 404 });
  }

  const buyer = deal.buyers as any;
  const property = deal.properties as any;

  // Fetch scoring data
  const { data: score } = await supabase
    .from("buyer_property_scores")
    .select("*")
    .eq("buyer_id", buyer.id)
    .eq("property_id", property.id)
    .single();

  // Fetch listing agent if available
  let listingAgent: any = null;
  if (property.listing_agent_id) {
    const { data } = await supabase
      .from("listing_agents")
      .select("*")
      .eq("id", property.listing_agent_id)
      .single();
    listingAgent = data;
  }

  // Build context for LLM
  const context = `
BUYER PROFILE:
- Name: ${buyer.full_name}
- Budget: $${(buyer.intent_profile as any)?.budget_min?.toLocaleString() ?? "?"} - $${(buyer.intent_profile as any)?.budget_max?.toLocaleString() ?? "?"}
- Intent Profile: ${JSON.stringify(buyer.intent_profile)}

PROPERTY:
- Address: ${property.address}
- Listing Price: $${property.listing_price?.toLocaleString()}
- Beds/Baths: ${property.beds}/${property.baths}
- Sqft: ${property.sqft?.toLocaleString()}
- Year Built: ${property.year_built}
- Days on Market: ${property.days_on_market}
- HOA: $${property.hoa_monthly ?? 0}/month
- Tax Assessed Value: $${property.tax_assessed_value?.toLocaleString() ?? "unknown"}
- Price History: ${JSON.stringify(property.price_history)}
- Seller Motivation Score: ${property.seller_motivation_score ?? "unknown"}/100
- Seller Motivation Reasoning: ${property.seller_motivation_reasoning ?? "N/A"}

${score ? `MATCH SCORE: ${score.match_score}/100
Reasoning: ${score.score_reasoning}
Buyer-favorable comps: ${JSON.stringify(score.buyer_favorable_comps)}
Seller-favorable comps: ${JSON.stringify(score.seller_favorable_comps)}
Fair market value: $${score.fair_market_value_low?.toLocaleString()} - $${score.fair_market_value_high?.toLocaleString()}` : ""}

${listingAgent ? `LISTING AGENT:
- Name: ${listingAgent.name}
- Active Listings: ${listingAgent.active_listing_count}
- Avg DOM: ${listingAgent.avg_days_on_market}
- Avg List-to-Sale Ratio: ${listingAgent.avg_list_to_sale_ratio}
- Avg Counter Rounds: ${listingAgent.avg_counter_rounds}
- Typical First Counter Drop: ${listingAgent.typical_first_counter_drop}` : ""}
`;

  const strategy = await llmJSON<any>(
    "offer_strategy",
    OFFER_STRATEGY_PROMPT,
    context
  );

  // Save strategy to deal
  await supabase
    .from("deals")
    .update({
      offer_strategy_brief: strategy,
      deal_probability: strategy.deal_probability,
    })
    .eq("id", dealId);

  // Log activity
  const { data: agentData } = await supabase
    .from("agents")
    .select("id")
    .eq("user_id", user.id)
    .single();

  if (agentData) {
    await createActivityEntry(
      agentData.id,
      "offer_submitted",
      `Offer strategy generated for ${property.address}`,
      `Deal probability: ${strategy.deal_probability ?? "N/A"}%`,
      { deal_probability: strategy.deal_probability },
      { dealId, buyerId: buyer.id, propertyId: property.id }
    );
  }

  return NextResponse.json({ strategy });
}
