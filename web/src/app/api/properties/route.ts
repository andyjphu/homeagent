import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createActivityEntry } from "@/lib/supabase/activity";

export async function POST(request: Request) {
  const supabase = (await createClient()) as any;
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: agent } = await supabase
    .from("agents")
    .select("id")
    .eq("user_id", user.id)
    .single();

  if (!agent) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }

  const body = await request.json();
  const {
    buyerIds,
    address,
    city,
    state,
    zip,
    listingPrice,
    beds,
    baths,
    sqft,
    lotSqft,
    yearBuilt,
    hoaMonthly,
    propertyType,
    listingDescription,
    listingUrl,
  } = body;

  if (!address) {
    return NextResponse.json({ error: "Address is required" }, { status: 400 });
  }

  if (!buyerIds || buyerIds.length === 0) {
    return NextResponse.json(
      { error: "At least one buyer is required" },
      { status: 400 }
    );
  }

  // Insert property
  const { data: property, error: propError } = await supabase
    .from("properties")
    .insert({
      agent_id: agent.id,
      address,
      city: city || null,
      state: state || null,
      zip: zip || null,
      listing_price: listingPrice || null,
      beds: beds || null,
      baths: baths || null,
      sqft: sqft || null,
      lot_sqft: lotSqft || null,
      year_built: yearBuilt || null,
      hoa_monthly: hoaMonthly || null,
      property_type: propertyType || null,
      listing_description: listingDescription || null,
      zillow_url: listingUrl || null,
      listing_status: "active",
    })
    .select()
    .single();

  if (propError) {
    return NextResponse.json({ error: propError.message }, { status: 500 });
  }

  // Link to each buyer
  const scoreInserts = buyerIds.map((buyerId: string) => ({
    buyer_id: buyerId,
    property_id: property.id,
    match_score: 0,
  }));

  const { error: scoreError } = await supabase
    .from("buyer_property_scores")
    .insert(scoreInserts);

  if (scoreError) {
    return NextResponse.json({ error: scoreError.message }, { status: 500 });
  }

  // Log activity
  await createActivityEntry(
    agent.id,
    "properties_sent",
    `Property added: ${address}`,
    `Linked to ${buyerIds.length} buyer(s)`,
    { address, listing_price: listingPrice },
    { propertyId: property.id }
  );

  return NextResponse.json({ property });
}
