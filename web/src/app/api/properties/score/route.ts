import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { llmJSON } from "@/lib/llm/router";
import { PROPERTY_SCORING_PROMPT } from "@/lib/llm/prompts/property-scoring";

export async function POST(request: Request) {
  const supabase = await createClient() as any;
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { buyerId, propertyIds } = await request.json();

  // Fetch buyer
  const { data: buyer } = await supabase
    .from("buyers")
    .select("*")
    .eq("id", buyerId)
    .single();

  if (!buyer) {
    return NextResponse.json({ error: "Buyer not found" }, { status: 404 });
  }

  // Fetch properties
  const { data: properties } = await supabase
    .from("properties")
    .select("*")
    .in("id", propertyIds);

  if (!properties || properties.length === 0) {
    return NextResponse.json({ error: "No properties found" }, { status: 404 });
  }

  const scores: any[] = [];

  for (const property of properties) {
    const context = `
BUYER INTENT PROFILE:
${JSON.stringify(buyer.intent_profile, null, 2)}

PROPERTY:
Address: ${property.address}
Price: $${property.listing_price?.toLocaleString()}
Beds: ${property.beds}
Baths: ${property.baths}
Sqft: ${property.sqft?.toLocaleString()}
Year Built: ${property.year_built}
HOA: $${property.hoa_monthly ?? 0}/month
Days on Market: ${property.days_on_market}
Walk Score: ${property.walk_score ?? "N/A"}
School Ratings: ${JSON.stringify(property.school_ratings)}
Amenities: ${JSON.stringify(property.amenities)}
Description: ${property.listing_description ?? "N/A"}
`;

    const result = await llmJSON<{
      match_score: number;
      score_reasoning: string;
      score_breakdown: any;
    }>("property_scoring", PROPERTY_SCORING_PROMPT, context);

    // Upsert score
    const { data: score } = await supabase
      .from("buyer_property_scores")
      .upsert(
        {
          buyer_id: buyerId,
          property_id: property.id,
          match_score: result.match_score,
          score_reasoning: result.score_reasoning,
          score_breakdown: result.score_breakdown,
        },
        { onConflict: "buyer_id,property_id" }
      )
      .select()
      .single();

    scores.push(score);
  }

  return NextResponse.json({ scores });
}
