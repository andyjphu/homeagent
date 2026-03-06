export type { NormalizedListing, ListingSearchParams, ListingSearchResult } from "./types";
import type { ListingSearchParams, ListingSearchResult } from "./types";
import { searchRapidAPI, getApiUsage } from "./rapidapi";
import { searchMock } from "./mock";
import { buildCacheKey, getCached, setCache } from "./cache";

/**
 * Search listings via the active provider.
 * Handles caching (1 hour TTL) and graceful degradation.
 *
 * Provider priority:
 * 1. If RAPIDAPI_USE_MOCK=true → use mock data (for dev/testing)
 * 2. Otherwise → call RapidAPI, fall back to mock if API returns 403 (not subscribed)
 */
export async function searchListings(
  params: ListingSearchParams
): Promise<ListingSearchResult> {
  const apiKey = process.env.RAPIDAPI_KEY;
  const useMock = process.env.RAPIDAPI_USE_MOCK === "true";

  if (!apiKey && !useMock) {
    throw new Error("RAPIDAPI_KEY is not configured");
  }

  // Check cache first
  const cacheKey = buildCacheKey(params as unknown as Record<string, unknown>);
  const cached = getCached(cacheKey);
  if (cached) {
    return cached;
  }

  let listings;
  let total;

  if (useMock) {
    // Use mock data directly
    const mockResult = searchMock(params);
    listings = mockResult.listings;
    total = mockResult.total;
    console.log("[listings] Using mock data provider");
  } else {
    try {
      const apiResult = await searchRapidAPI(params, apiKey!);
      listings = apiResult.listings;
      total = apiResult.total;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "";
      // If the API returns 403 (not subscribed), fall back to mock data
      // so the app is still testable during development
      if (message.includes("403")) {
        console.warn(
          "[listings] RapidAPI returned 403 (not subscribed). Falling back to mock data. " +
            "Subscribe to the API at https://rapidapi.com/apidojo/api/realty-in-us to use real data."
        );
        const mockResult = searchMock(params);
        listings = mockResult.listings;
        total = mockResult.total;
      } else {
        throw err;
      }
    }
  }

  const result: ListingSearchResult = {
    listings,
    total,
    cached: false,
  };

  // Cache the result
  setCache(cacheKey, result);

  return result;
}

export { getApiUsage } from "./rapidapi";
