import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { searchListings } from "@/lib/listings";
import {
  saveProperty,
  linkPropertyToBuyer,
  logEvent,
  updateTaskStatus,
} from "@/lib/browser-use/save-results";
import { createActivityEntry } from "@/lib/supabase/activity";
import type { ListingSearchParams } from "@/lib/listings";

export async function POST(request: Request) {
  const supabase = (await createClient()) as any;
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { buyerId, agentId, intentProfile, taskType } = await request.json();

  // Create task record
  const { data: task, error } = await supabase
    .from("agent_tasks")
    .insert({
      agent_id: agentId,
      buyer_id: buyerId,
      task_type: taskType || "full_research_pipeline",
      input_params: {
        intent_profile: intentProfile,
      },
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Add activity feed entry
  await createActivityEntry(
    agentId,
    "research_started",
    "Research started",
    "Property research pipeline triggered",
    undefined,
    { buyerId, taskId: task.id }
  );

  await logEvent(task.id, "pipeline_start", intentProfile);

  // Build search params from buyer intent profile
  const location =
    intentProfile?.preferred_areas?.[0] ??
    intentProfile?.location ??
    intentProfile?.areas?.[0] ??
    "";

  if (!location) {
    await logEvent(task.id, "no_properties_found", { reason: "No location in buyer profile" });
    await updateTaskStatus(task.id, "failed", {
      output_data: { pipeline_stage: "complete", properties_found: 0 },
      error_message: "No location specified in buyer profile. Update the buyer's preferred areas first.",
    });
    return NextResponse.json({
      task,
      error: "No location specified in buyer profile. Update the buyer's preferred areas first.",
    });
  }

  const searchParams: ListingSearchParams = {
    location,
    price_min: intentProfile?.budget_min ?? intentProfile?.price_min ?? undefined,
    price_max: intentProfile?.budget_max ?? intentProfile?.price_max ?? undefined,
    beds_min: intentProfile?.beds_min ?? intentProfile?.min_beds ?? undefined,
    baths_min: intentProfile?.baths_min ?? intentProfile?.min_baths ?? undefined,
    limit: 20,
  };

  // Search for listings
  await logEvent(task.id, "stage_zillow_start");
  await updateTaskStatus(task.id, "running", {
    output_data: {
      pipeline_stage: "searching",
      intent_profile: intentProfile,
      buyer_id: buyerId,
    },
  });

  let listings;
  let listingSource: "live" | "mock" = "live";
  try {
    const result = await searchListings(searchParams);
    listings = result.listings;
    listingSource = result.source;
    await logEvent(task.id, "search_complete", {
      total_listings: listings.length,
      source: listingSource,
    });
  } catch (err: any) {
    const errorMsg = err.message?.includes("RAPIDAPI_KEY")
      ? "Property search not configured. Set RAPIDAPI_KEY in your environment."
      : `Search failed: ${err.message}`;

    await logEvent(task.id, "stage_zillow_failed", { error: errorMsg });
    await updateTaskStatus(task.id, "failed", {
      output_data: { pipeline_stage: "complete", properties_found: 0, error: errorMsg },
      error_message: errorMsg,
    });
    return NextResponse.json({ task, error: errorMsg });
  }

  if (!listings || listings.length === 0) {
    await logEvent(task.id, "no_properties_found");
    await updateTaskStatus(task.id, "completed", {
      output_data: {
        pipeline_stage: "complete",
        properties_found: 0,
        properties_enriched: 0,
        properties_scored: 0,
        property_ids: [],
      },
    });
    return NextResponse.json({ task });
  }

  await logEvent(task.id, "stage_zillow_done", { property_count: listings.length });

  // Rank by budget fit and take top 15
  const budgetMin = searchParams.price_min ?? 0;
  const budgetMax = searchParams.price_max ?? Infinity;
  const budgetMid = budgetMin && budgetMax !== Infinity ? (budgetMin + budgetMax) / 2 : 500000;
  const maxCandidates = 15;

  const ranked = [...listings]
    .sort((a, b) => {
      const priceA = a.price ?? 0;
      const priceB = b.price ?? 0;
      return Math.abs(priceA - budgetMid) - Math.abs(priceB - budgetMid);
    })
    .slice(0, maxCandidates);

  await logEvent(task.id, "candidates_selected", { count: ranked.length });

  // Save each property and link to buyer
  const savedIds: string[] = [];
  for (const listing of ranked) {
    try {
      const propId = await saveProperty(agentId, task.id, {
        address: listing.address,
        city: listing.city,
        state: listing.state,
        zip: listing.zip,
        listing_price: listing.price,
        beds: listing.beds,
        baths: listing.baths,
        sqft: listing.sqft,
        lot_sqft: listing.lot_sqft,
        year_built: listing.year_built,
        property_type: listing.property_type,
        photos: listing.photos,
        listing_url: listing.listing_url,
        listing_description: listing.description,
        days_on_market: listing.days_on_market,
        latitude: listing.lat,
        longitude: listing.lng,
      });

      savedIds.push(propId);
      await logEvent(task.id, "property_saved", { property_id: propId, address: listing.address });

      if (buyerId) {
        await linkPropertyToBuyer(buyerId, propId);
      }
    } catch (err: any) {
      await logEvent(task.id, "property_save_error", {
        error: err.message,
        address: listing.address,
      });
    }
  }

  if (savedIds.length === 0) {
    await updateTaskStatus(task.id, "completed", {
      output_data: {
        pipeline_stage: "complete",
        properties_found: listings.length,
        properties_saved: 0,
        properties_enriched: 0,
        properties_scored: 0,
        property_ids: [],
      },
    });
    return NextResponse.json({ task });
  }

  // Set stage to enrichment — the /api/research/process polling will handle enrichment + scoring
  await logEvent(task.id, "stage_crossref_start", { property_count: savedIds.length });
  await updateTaskStatus(task.id, "running", {
    output_data: {
      pipeline_stage: "enrichment",
      intent_profile: intentProfile,
      buyer_id: buyerId,
      property_ids: savedIds,
      properties_found: listings.length,
      properties_saved: savedIds.length,
      enrichment_index: 0,
      listing_source: listingSource,
    },
  });

  return NextResponse.json({ task });
}
