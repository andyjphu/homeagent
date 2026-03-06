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

  // "City, ST" pattern
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

export async function searchRapidAPI(
  params: ListingSearchParams,
  apiKey: string
): Promise<{ listings: NormalizedListing[]; total: number }> {
  const location = parseLocation(params.location);
  const limit = params.limit || 20;

  // Build request body for the v3 POST endpoint
  const body: Record<string, unknown> = {
    limit,
    offset: params.offset || 0,
    status: ["for_sale"],
    sort: {
      direction: "desc",
      field: "list_date",
    },
  };

  if (location.postal_code) body.postal_code = location.postal_code;
  if (location.city) body.city = location.city;
  if (location.state_code) body.state_code = location.state_code;
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

  // v3 response: data.home_search.results
  const rawResults =
    data.data?.home_search?.results || data.properties || [];
  const total =
    data.data?.home_search?.total ||
    data.meta?.matching_rows ||
    rawResults.length;

  const listings = rawResults.map(normalizeListing);

  return { listings, total };
}
