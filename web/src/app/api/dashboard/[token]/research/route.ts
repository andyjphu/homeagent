import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { searchListings } from "@/lib/listings";
import {
  saveProperty,
  linkPropertyToBuyer,
  logEvent,
  updateTaskStatus,
} from "@/lib/browser-use/save-results";
import { createActivityEntry } from "@/lib/supabase/activity";
import type { ListingSearchParams } from "@/lib/listings";

/**
 * POST /api/dashboard/[token]/research
 *
 * Buyer-triggered AI research. Similar to /api/research/trigger but uses
 * dashboard token for auth instead of agent user session.
 * Searches listings based on intent profile, saves properties, and kicks
 * off the enrichment + scoring pipeline.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    const supabase = createAdminClient() as any;

    // Validate dashboard token and get buyer + agent info
    const { data: buyer } = await supabase
      .from("buyers")
      .select("id, agent_id, full_name, intent_profile")
      .eq("dashboard_token", token)
      .single();

    if (!buyer) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    const intentProfile = buyer.intent_profile || {};

    // Build search params from buyer intent profile
    const location =
      intentProfile?.preferred_areas?.[0] ??
      intentProfile?.location ??
      intentProfile?.areas?.[0] ??
      "";

    if (!location) {
      return NextResponse.json({
        error:
          "No preferred location set in your profile. Complete the intake form first so we know where to search.",
      });
    }

    // Create task record
    const { data: task, error: taskError } = await supabase
      .from("agent_tasks")
      .insert({
        agent_id: buyer.agent_id,
        buyer_id: buyer.id,
        task_type: "full_research_pipeline",
        input_params: {
          intent_profile: intentProfile,
          triggered_by: "buyer",
        },
      })
      .select()
      .single();

    if (taskError) {
      return NextResponse.json(
        { error: taskError.message },
        { status: 500 }
      );
    }

    // Log activity so agent sees buyer initiated research
    await createActivityEntry(
      buyer.agent_id,
      "research_started",
      `${buyer.full_name} initiated their own property research`,
      "Buyer-triggered AI research from dashboard",
      undefined,
      { buyerId: buyer.id, taskId: task.id }
    );

    await logEvent(task.id, "pipeline_start", {
      ...intentProfile,
      triggered_by: "buyer",
    });

    const searchParams: ListingSearchParams = {
      location,
      price_min:
        intentProfile?.budget_min ?? intentProfile?.price_min ?? undefined,
      price_max:
        intentProfile?.budget_max ?? intentProfile?.price_max ?? undefined,
      beds_min:
        intentProfile?.beds_min ?? intentProfile?.min_beds ?? undefined,
      baths_min:
        intentProfile?.baths_min ?? intentProfile?.min_baths ?? undefined,
      limit: 20,
    };

    // Search for listings
    await logEvent(task.id, "stage_zillow_start");
    await updateTaskStatus(task.id, "running", {
      output_data: {
        pipeline_stage: "searching",
        intent_profile: intentProfile,
        buyer_id: buyer.id,
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
        ? "Property search is not configured yet. Your agent will set this up."
        : `Search failed: ${err.message}`;

      await logEvent(task.id, "stage_zillow_failed", { error: errorMsg });
      await updateTaskStatus(task.id, "failed", {
        output_data: {
          pipeline_stage: "complete",
          properties_found: 0,
          error: errorMsg,
        },
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
          properties_saved: 0,
        },
      });
      return NextResponse.json({
        task,
        properties_found: 0,
        properties_saved: 0,
      });
    }

    await logEvent(task.id, "stage_zillow_done", {
      property_count: listings.length,
    });

    // Rank by budget fit and take top 10 (slightly fewer for buyer-triggered)
    const budgetMin = searchParams.price_min ?? 0;
    const budgetMax = searchParams.price_max ?? Infinity;
    const budgetMid =
      budgetMin && budgetMax !== Infinity
        ? (budgetMin + budgetMax) / 2
        : 500000;

    const ranked = [...listings]
      .sort((a, b) => {
        const priceA = a.price ?? 0;
        const priceB = b.price ?? 0;
        return Math.abs(priceA - budgetMid) - Math.abs(priceB - budgetMid);
      })
      .slice(0, 10);

    // Save each property and link to buyer
    const savedIds: string[] = [];
    for (const listing of ranked) {
      try {
        const propId = await saveProperty(buyer.agent_id, task.id, {
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
        await logEvent(task.id, "property_saved", {
          property_id: propId,
          address: listing.address,
        });
        await linkPropertyToBuyer(buyer.id, propId);
      } catch (err: any) {
        await logEvent(task.id, "property_save_error", {
          error: err.message,
          address: listing.address,
        });
      }
    }

    // Set stage to enrichment for the pipeline poller
    await updateTaskStatus(task.id, "running", {
      output_data: {
        pipeline_stage: "enrichment",
        intent_profile: intentProfile,
        buyer_id: buyer.id,
        property_ids: savedIds,
        properties_found: listings.length,
        properties_saved: savedIds.length,
        enrichment_index: 0,
        listing_source: listingSource,
      },
    });

    return NextResponse.json({
      task,
      properties_found: listings.length,
      properties_saved: savedIds.length,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Research failed";
    console.error("[dashboard/research] Error:", message);
    return NextResponse.json(
      { error: "Research unavailable — please try again later." },
      { status: 500 }
    );
  }
}

/**
 * GET /api/dashboard/[token]/research
 *
 * Returns recent research tasks for the buyer (both agent-triggered and
 * buyer-triggered) so the buyer can see shared research history.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    const supabase = createAdminClient() as any;

    const { data: buyer } = await supabase
      .from("buyers")
      .select("id, agent_id")
      .eq("dashboard_token", token)
      .single();

    if (!buyer) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    // Fetch recent research tasks for this buyer
    const { data: tasks } = await supabase
      .from("agent_tasks")
      .select("id, task_type, status, created_at, output_data, error_message, input_params")
      .eq("buyer_id", buyer.id)
      .eq("task_type", "full_research_pipeline")
      .order("created_at", { ascending: false })
      .limit(10);

    return NextResponse.json({ tasks: tasks ?? [] });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to fetch";
    console.error("[dashboard/research] GET Error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
