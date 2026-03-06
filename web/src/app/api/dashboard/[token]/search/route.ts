import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { searchListings, getApiUsage } from "@/lib/listings";
import type { ListingSearchParams } from "@/lib/listings";

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
      .select("id, agent_id")
      .eq("dashboard_token", token)
      .single();

    if (!buyer) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    if (!process.env.RAPIDAPI_KEY) {
      return NextResponse.json(
        { error: "Listing search is not configured." },
        { status: 503 }
      );
    }

    const body = await request.json();
    const { location, price_min, price_max, beds_min, baths_min, property_type } = body;

    if (!location || typeof location !== "string" || !location.trim()) {
      return NextResponse.json(
        { error: "Location is required" },
        { status: 400 }
      );
    }

    const searchParams: ListingSearchParams = {
      location: location.trim(),
      price_min: price_min || undefined,
      price_max: price_max || undefined,
      beds_min: beds_min || undefined,
      baths_min: baths_min || undefined,
      property_type: property_type || undefined,
      limit: 20,
    };

    const result = await searchListings(searchParams);
    const usage = getApiUsage();

    return NextResponse.json({
      listings: result.listings,
      total: result.total,
      cached: result.cached,
      api_usage: usage,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Search failed";

    if (message === "RATE_LIMITED") {
      return NextResponse.json(
        { error: "Search unavailable — API rate limit reached. Please try again later." },
        { status: 429 }
      );
    }

    console.error("[dashboard/search] Error:", message);
    return NextResponse.json(
      { error: "Search unavailable — please try again later." },
      { status: 500 }
    );
  }
}
