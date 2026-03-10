import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createActivityEntry } from "@/lib/supabase/activity";

/**
 * Buyer suggests a property from listing search.
 * Creates the property record and links it to the buyer,
 * then notifies the agent so they can review it.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    const supabase = createAdminClient() as any;

    // Validate dashboard token
    const { data: buyer } = await supabase
      .from("buyers")
      .select("id, agent_id, full_name")
      .eq("dashboard_token", token)
      .single();

    if (!buyer) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    const body = await request.json();
    const {
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
      propertyType,
      listingDescription,
      listingUrl,
      photos,
      latitude,
      longitude,
      daysOnMarket,
    } = body;

    if (!address) {
      return NextResponse.json(
        { error: "Address is required" },
        { status: 400 }
      );
    }

    // Insert property (owned by the buyer's agent)
    const { data: property, error: propError } = await supabase
      .from("properties")
      .insert({
        agent_id: buyer.agent_id,
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
        property_type: propertyType || null,
        listing_description: listingDescription || null,
        zillow_url: listingUrl || null, // DB column stores any listing URL
        listing_status: "active",
        photos: photos || [],
        latitude: latitude || null,
        longitude: longitude || null,
        days_on_market: daysOnMarket || null,
      })
      .select()
      .single();

    if (propError) {
      return NextResponse.json({ error: propError.message }, { status: 500 });
    }

    // Link to buyer (score 0 until agent reviews)
    // NOT sent to buyer yet — agent reviews first
    const { error: scoreError } = await supabase
      .from("buyer_property_scores")
      .insert({
        buyer_id: buyer.id,
        property_id: property.id,
        match_score: 0,
        is_sent_to_buyer: false,
      });

    if (scoreError) {
      return NextResponse.json({ error: scoreError.message }, { status: 500 });
    }

    // Notify agent — buyer suggested a property, needs review
    await createActivityEntry(
      buyer.agent_id,
      "property_imported",
      `${buyer.full_name} suggested a property: ${address}`,
      city && state ? `${city}, ${state} — $${listingPrice?.toLocaleString() ?? "N/A"}` : undefined,
      { source: "buyer_dashboard_search", suggested_by: "buyer" },
      {
        buyerId: buyer.id,
        propertyId: property.id,
        isActionRequired: true,
      }
    );

    // Update buyer last activity
    await supabase
      .from("buyers")
      .update({ last_activity_at: new Date().toISOString() })
      .eq("id", buyer.id);

    return NextResponse.json({ property });
  } catch (err: unknown) {
    console.error("[dashboard/suggest] Error:", err);
    return NextResponse.json(
      { error: "Failed to suggest property" },
      { status: 500 }
    );
  }
}
