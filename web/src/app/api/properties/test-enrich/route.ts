import { NextResponse } from "next/server";
import { enrichProperty } from "@/lib/enrichment/service";
import { getEnabledProviders } from "@/lib/enrichment/service";

/**
 * Temporary test endpoint for enrichment service.
 * GET /api/properties/test-enrich?lat=37.7749&lng=-122.4194&address=123+Main+St+San+Francisco+CA
 * No auth required — remove after testing.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const lat = parseFloat(url.searchParams.get("lat") || "");
  const lng = parseFloat(url.searchParams.get("lng") || "");
  const address = url.searchParams.get("address") || "";

  if (isNaN(lat) || isNaN(lng) || !address) {
    return NextResponse.json(
      {
        error: "Missing required query params: lat, lng, address",
        example:
          "/api/properties/test-enrich?lat=37.7749&lng=-122.4194&address=123+Main+St+San+Francisco+CA",
        enabledProviders: getEnabledProviders(),
      },
      { status: 400 }
    );
  }

  try {
    const result = await enrichProperty(lat, lng, address);
    return NextResponse.json(result);
  } catch (err: unknown) {
    console.error("[test-enrich] Error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
