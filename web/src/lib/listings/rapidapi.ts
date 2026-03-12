import type { ListingSearchParams, NormalizedListing } from "./types";

const RAPIDAPI_HOST = "realty-in-us.p.rapidapi.com";

interface RapidAPIPropertyResult {
  property_id?: string;
  list_price?: number;
  description?: {
    beds?: number;
    baths?: number;
    baths_full?: number;
    baths_half?: number;
    baths_full_calc?: number;
    baths_partial_calc?: number;
    sqft?: number;
    lot_sqft?: number;
    year_built?: number;
    type?: string;
    sub_type?: string;
    text?: string;
  };
  location?: {
    address?: {
      line?: string;
      city?: string;
      state_code?: string;
      postal_code?: string;
      coordinate?: {
        lat?: number;
        lon?: number;
      };
    };
  };
  primary_photo?: {
    href?: string;
  };
  photos?: Array<{ href?: string }>;
  href?: string;
  list_date?: string;
  last_update_date?: string;
  photo_count?: number;
}

interface RapidAPIResponse {
  data?: {
    home_search?: {
      results?: RapidAPIPropertyResult[];
      total?: number;
    };
  };
  // v2 response format
  properties?: RapidAPIPropertyResult[];
  meta?: {
    returned_rows?: number;
    matching_rows?: number;
  };
}

/**
 * Detect whether the location string is a zip code, city/state, or address.
 * Falls back to location autocomplete API if the simple parser can't
 * determine a clear city/state combo.
 */
function parseLocation(location: string): {
  city?: string;
  state_code?: string;
  postal_code?: string;
} {
  const trimmed = location.trim();

  // ZIP code (5 digits)
  if (/^\d{5}$/.test(trimmed)) {
    return { postal_code: trimmed };
  }

  // "City, ST" pattern  (e.g., "Dallas, TX")
  const cityStateMatch = trimmed.match(/^(.+),\s*([A-Za-z]{2})$/);
  if (cityStateMatch) {
    return {
      city: cityStateMatch[1].trim(),
      state_code: cityStateMatch[2].toUpperCase(),
    };
  }

  // Default: treat as city search
  return { city: trimmed };
}

/**
 * Use the RapidAPI location autocomplete endpoint to resolve
 * a freeform location string (e.g. "North Dallas") into a
 * structured city/state/zip.
 */
async function resolveLocation(
  input: string,
  apiKey: string
): Promise<{ city?: string; state_code?: string; postal_code?: string } | null> {
  try {
    const url = `https://${RAPIDAPI_HOST}/locations/v2/auto-complete?input=${encodeURIComponent(input)}&limit=1`;
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "x-rapidapi-key": apiKey,
        "x-rapidapi-host": RAPIDAPI_HOST,
      },
    });
    if (!response.ok) return null;
    const data = await response.json();

    // The autocomplete returns { autocomplete: [ { _id, area_type, ... } ] }
    const suggestions = data?.autocomplete ?? [];
    if (suggestions.length === 0) return null;

    const first = suggestions[0];
    // Extract city/state from the suggestion
    const city = first.city;
    const stateCode = first.state_code;
    const postalCode = first.postal_code;

    if (city || postalCode) {
      return {
        city: city || undefined,
        state_code: stateCode || undefined,
        postal_code: postalCode || undefined,
      };
    }
    return null;
  } catch {
    return null;
  }
}

function normalizeListing(raw: RapidAPIPropertyResult): NormalizedListing {
  const addr = raw.location?.address;
  const desc = raw.description;
  const photos: string[] = [];

  if (raw.photos?.length) {
    for (const p of raw.photos.slice(0, 10)) {
      if (p.href) photos.push(p.href);
    }
  } else if (raw.primary_photo?.href) {
    photos.push(raw.primary_photo.href);
  }

  // Calculate days on market from list_date
  let daysOnMarket: number | null = null;
  if (raw.list_date) {
    const listDate = new Date(raw.list_date);
    if (!isNaN(listDate.getTime())) {
      daysOnMarket = Math.floor(
        (Date.now() - listDate.getTime()) / (1000 * 60 * 60 * 24)
      );
    }
  }

  return {
    address: addr?.line || "Unknown Address",
    city: addr?.city || null,
    state: addr?.state_code || null,
    zip: addr?.postal_code || null,
    price: raw.list_price || null,
    beds: desc?.beds ?? null,
    baths: desc?.baths ?? desc?.baths_full_calc ?? desc?.baths_full ?? null,
    sqft: desc?.sqft ?? null,
    lot_sqft: desc?.lot_sqft ?? null,
    year_built: desc?.year_built ?? null,
    property_type: desc?.type || null,
    photos,
    listing_url: raw.href || null,
    lat: addr?.coordinate?.lat ?? null,
    lng: addr?.coordinate?.lon ?? null,
    days_on_market: daysOnMarket,
    description: desc?.text || null,
    source: "rapidapi_realty_us",
    source_id: raw.property_id || null,
  };
}

// Simple in-memory rate limit tracker
let apiCallCount = 0;
let apiCallResetAt = Date.now() + 30 * 24 * 60 * 60 * 1000; // ~30 days

export function getApiUsage(): { calls: number; warning: boolean } {
  if (Date.now() > apiCallResetAt) {
    apiCallCount = 0;
    apiCallResetAt = Date.now() + 30 * 24 * 60 * 60 * 1000;
  }
  return {
    calls: apiCallCount,
    warning: apiCallCount >= 80, // warn at 80% of 100 free calls
  };
}

/**
 * Execute the v3/list search with the given location params.
 */
async function executeSearch(
  locationParams: { city?: string; state_code?: string; postal_code?: string },
  params: ListingSearchParams,
  apiKey: string
): Promise<{ listings: NormalizedListing[]; total: number }> {
  const limit = params.limit || 20;

  const body: Record<string, unknown> = {
    limit,
    offset: params.offset || 0,
    status: ["for_sale"],
    sort: {
      direction: "desc",
      field: "list_date",
    },
  };

  if (locationParams.postal_code) body.postal_code = locationParams.postal_code;
  if (locationParams.city) body.city = locationParams.city;
  if (locationParams.state_code) body.state_code = locationParams.state_code;
  if (params.price_min || params.price_max) {
    body.list_price = {};
    if (params.price_min) (body.list_price as Record<string, number>).min = params.price_min;
    if (params.price_max) (body.list_price as Record<string, number>).max = params.price_max;
  }
  if (params.beds_min) body.beds_min = params.beds_min;
  if (params.baths_min) body.baths_min = params.baths_min;

  const url = `https://${RAPIDAPI_HOST}/properties/v3/list`;

  apiCallCount++;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "x-rapidapi-key": apiKey,
      "x-rapidapi-host": RAPIDAPI_HOST,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (response.status === 429) {
    throw new Error("RATE_LIMITED");
  }

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(
      `RapidAPI request failed (${response.status}): ${text.slice(0, 200)}`
    );
  }

  const data: RapidAPIResponse = await response.json();
  const rawResults =
    data.data?.home_search?.results || data.properties || [];
  const total =
    data.data?.home_search?.total ||
    data.meta?.matching_rows ||
    rawResults.length;

  return { listings: rawResults.map(normalizeListing), total };
}

export async function searchRapidAPI(
  params: ListingSearchParams,
  apiKey: string
): Promise<{ listings: NormalizedListing[]; total: number }> {
  let location = parseLocation(params.location);

  // First attempt with the parsed location
  let result = await executeSearch(location, params, apiKey);

  // If no results and we only had a city (no state_code, no postal_code),
  // the user may have typed a neighborhood name (e.g. "North Dallas").
  // Try the location autocomplete API to resolve it to a proper city/state.
  if (result.total === 0 && location.city && !location.state_code && !location.postal_code) {
    console.log(`[listings] No results for "${location.city}", trying autocomplete to resolve location...`);
    const resolved = await resolveLocation(params.location, apiKey);
    if (resolved && (resolved.city !== location.city || resolved.state_code || resolved.postal_code)) {
      console.log(`[listings] Autocomplete resolved to:`, resolved);
      location = resolved;
      result = await executeSearch(location, params, apiKey);
    }
  }

  return result;
}
