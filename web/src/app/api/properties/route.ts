import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createActivityEntry } from "@/lib/supabase/activity";

export async function POST(request: Request) {
  try {
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
      // Import-specific fields
      photos,
      latitude,
      longitude,
      daysOnMarket,
      imported,
      agentNotes,
    } = body;

    if (!address) {
      return NextResponse.json(
        { error: "Address is required" },
        { status: 400 }
      );
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

    // Log activity for imports
    if (imported) {
      await createActivityEntry(
        agent.id,
        "property_imported",
        `Property imported: ${address}`,
        city && state ? `${city}, ${state}` : undefined,
        { source: "listing_search" },
        {
          propertyId: property.id,
          buyerId: buyerIds[0],
        }
      );
    }

    return NextResponse.json({ property });
  } catch (err: unknown) {
    console.error("[properties] Error:", err);
    return NextResponse.json(
      { error: "Failed to create property" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const supabase = (await createClient()) as any;
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { propertyId, ...updates } = body;

    if (!propertyId) {
      return NextResponse.json(
        { error: "propertyId is required" },
        { status: 400 }
      );
    }

    // Map camelCase to snake_case for allowed fields
    const fieldMap: Record<string, string> = {
      address: "address",
      city: "city",
      state: "state",
      zip: "zip",
      listingPrice: "listing_price",
      beds: "beds",
      baths: "baths",
      sqft: "sqft",
      lotSqft: "lot_sqft",
      yearBuilt: "year_built",
      hoaMonthly: "hoa_monthly",
      propertyType: "property_type",
      listingDescription: "listing_description",
      listingUrl: "zillow_url",
      photos: "photos",
      listingStatus: "listing_status",
    };

    const dbUpdates: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(updates)) {
      if (fieldMap[key]) {
        dbUpdates[fieldMap[key]] = value ?? null;
      }
    }

    if (Object.keys(dbUpdates).length === 0) {
      return NextResponse.json(
        { error: "No valid fields to update" },
        { status: 400 }
      );
    }

    const { data: property, error } = await supabase
      .from("properties")
      .update(dbUpdates)
      .eq("id", propertyId)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ property });
  } catch (err: unknown) {
    console.error("[properties PATCH] Error:", err);
    return NextResponse.json(
      { error: "Failed to update property" },
      { status: 500 }
    );
  }
}
