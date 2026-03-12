import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { searchListings, getApiUsage } from "@/lib/listings";
import type { ListingSearchParams } from "@/lib/listings";

export async function POST(request: Request) {
  try {
    const supabase = (await createClient()) as any;
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify agent exists
    const { data: agent } = await supabase
      .from("agents")
      .select("id")
      .eq("user_id", user.id)
      .single();

    if (!agent) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }

    // Check if RAPIDAPI_KEY is configured
    if (!process.env.RAPIDAPI_KEY) {
      return NextResponse.json(
        { error: "Listing search is not configured. RAPIDAPI_KEY is missing." },
        { status: 503 }
      );
    }

    const body = await request.json();
    const { location, price_min, price_max, beds_min, baths_min, property_type } = body;

    if (!location || typeof location !== "string" || !location.trim()) {
      return NextResponse.json(
        { error: "Location is required (city, zip, or address)" },
        { status: 400 }
      );
    }

    const params: ListingSearchParams = {
      location: location.trim(),
      price_min: price_min || undefined,
      price_max: price_max || undefined,
      beds_min: beds_min || undefined,
      baths_min: baths_min || undefined,
      property_type: property_type || undefined,
      limit: 20,
    };

    const result = await searchListings(params);
    const usage = getApiUsage();

    return NextResponse.json({
      listings: result.listings,
      total: result.total,
      cached: result.cached,
      source: result.source,
      api_usage: usage,
    });
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Search failed";

    if (message === "RATE_LIMITED") {
      return NextResponse.json(
        {
          error:
            "Search unavailable — API rate limit reached. You can still add properties manually.",
        },
        { status: 429 }
      );
    }

    console.error("[properties/search] Error:", message);
    return NextResponse.json(
      {
        error:
          "Search unavailable — please try again later. You can still add properties manually.",
      },
      { status: 500 }
    );
  }
}
