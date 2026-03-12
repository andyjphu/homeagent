import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createActivityEntry } from "@/lib/supabase/activity";
import { enrichProperty } from "@/lib/enrichment/service";
import { geocodeAddress } from "@/lib/enrichment/providers/google-maps";
import { isLLMAvailable, llmJSON } from "@/lib/llm/router";
import { PROPERTY_SCORING_PROMPT } from "@/lib/llm/prompts/property-scoring";
import type { AgentPreferences } from "@/types/database";
import { DEFAULT_PREFERENCES } from "@/types/database";

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
      .select("id, notification_preferences")
      .eq("user_id", user.id)
      .single();

    if (!agent) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }

    const prefs: AgentPreferences = {
      ...DEFAULT_PREFERENCES,
      ...((agent.notification_preferences as Partial<AgentPreferences>) || {}),
    };

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

    // Fire-and-forget: auto-enrich if preference is on
    if (prefs.auto_enrich_properties) {
      autoEnrichProperty(property.id, address, city, state, zip, latitude, longitude).catch((err) => {
        console.error("[auto-enrich] Error:", err);
      });
    }

    // Fire-and-forget: auto-score if preference is on, LLM available, and buyer has intent profile
    if (prefs.ai_property_scoring && isLLMAvailable("property_scoring")) {
      autoScoreProperty(property.id, buyerIds).catch((err) => {
        console.error("[auto-score] Error:", err);
      });
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

/**
 * Auto-enrich a property in the background.
 * Geocodes if needed, then runs enrichment providers.
 */
async function autoEnrichProperty(
  propertyId: string,
  address: string,
  city?: string,
  state?: string,
  zip?: string,
  lat?: number | null,
  lng?: number | null
) {
  const admin = createAdminClient() as any;
  const fullAddress = [address, city, state, zip].filter(Boolean).join(", ");

  // Geocode if needed
  if (!lat || !lng) {
    const coords = await geocodeAddress(fullAddress);
    if (coords) {
      lat = coords.lat;
      lng = coords.lng;
      await admin
        .from("properties")
        .update({ latitude: lat, longitude: lng })
        .eq("id", propertyId);
    } else {
      return; // Can't enrich without coordinates
    }
  }

  const result = await enrichProperty(lat, lng, fullAddress);

  const { error: updateErr } = await admin
    .from("properties")
    .update({ enrichment_data: result.enrichment })
    .eq("id", propertyId);

  if (updateErr) {
    if (updateErr.message?.includes("does not exist")) {
      console.warn("[auto-enrich] enrichment_data column missing — run migration 00003");
    } else {
      console.error("[auto-enrich] Failed to store enrichment:", updateErr.message);
    }
  }
}

/**
 * Auto-score a property against each linked buyer in the background.
 */
async function autoScoreProperty(propertyId: string, buyerIds: string[]) {
  const admin = createAdminClient() as any;

  // Get property
  const { data: property } = await admin
    .from("properties")
    .select("*")
    .eq("id", propertyId)
    .single();

  if (!property) return;

  for (const buyerId of buyerIds) {
    // Get buyer intent profile
    const { data: buyer } = await admin
      .from("buyers")
      .select("intent_profile")
      .eq("id", buyerId)
      .single();

    if (!buyer?.intent_profile || Object.keys(buyer.intent_profile).length === 0) {
      continue;
    }

    const enrichment = property.enrichment_data ?? {};
    const context = `
BUYER INTENT PROFILE:
${JSON.stringify(buyer.intent_profile, null, 2)}

PROPERTY:
Address: ${property.address}
Price: $${property.listing_price?.toLocaleString() ?? "N/A"}
Beds: ${property.beds ?? "N/A"}
Baths: ${property.baths ?? "N/A"}
Sqft: ${property.sqft?.toLocaleString() ?? "N/A"}
Year Built: ${property.year_built ?? "N/A"}
HOA: $${property.hoa_monthly ?? 0}/month
Days on Market: ${property.days_on_market ?? "N/A"}
Walk Score: ${enrichment.walkability?.walk_score ?? property.walk_score ?? "N/A"}
Transit Score: ${enrichment.walkability?.transit_score ?? property.transit_score ?? "N/A"}
Schools: ${JSON.stringify(enrichment.schools?.nearby?.slice(0, 3) ?? property.school_ratings ?? {})}
Description: ${property.listing_description ?? "N/A"}
`;

    try {
      const result = await llmJSON<{
        match_score: number;
        score_reasoning: string;
        score_breakdown: any;
      }>("property_scoring", PROPERTY_SCORING_PROMPT, context);

      if (typeof result.match_score !== "number") continue;

      await admin
        .from("buyer_property_scores")
        .upsert(
          {
            buyer_id: buyerId,
            property_id: propertyId,
            match_score: result.match_score,
            score_reasoning: result.score_reasoning ?? "",
            score_breakdown: { ...result.score_breakdown, source: "ai" },
          },
          { onConflict: "buyer_id,property_id" }
        );
    } catch (err) {
      console.error(`[auto-score] Failed to score property ${propertyId} for buyer ${buyerId}:`, err);
    }
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
