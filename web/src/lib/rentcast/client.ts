// RentCast API client — property data, AVM, market stats
// https://api.rentcast.io/v1/

export interface RentCastProperty {
  id: string;
  formattedAddress: string;
  addressLine1: string;
  city: string;
  state: string;
  zipCode: string;
  county: string;
  latitude: number;
  longitude: number;
  propertyType: string;
  bedrooms: number;
  bathrooms: number;
  squareFootage: number;
  lotSize: number;
  yearBuilt: number;
  lastSaleDate: string | null;
  lastSalePrice: number | null;
  ownerOccupied: boolean | null;
  taxAssessedValue: number | null;
  legalDescription: string | null;
  features: Record<string, unknown>;
}

export interface RentCastValuation {
  price: number;
  priceRangeLow: number;
  priceRangeHigh: number;
  confidenceScore: number;
  comparables: RentCastComparable[];
  address: string;
}

export interface RentCastComparable {
  formattedAddress: string;
  price: number;
  squareFootage: number;
  bedrooms: number;
  bathrooms: number;
  distance: number;
  daysOld: number;
}

export interface RentCastMarket {
  zipCode: string;
  medianPrice: number | null;
  medianRent: number | null;
  averageDaysOnMarket: number | null;
  totalListings: number | null;
  medianPricePerSqft: number | null;
}

const BASE_URL = "https://api.rentcast.io/v1";

function getApiKey(): string | null {
  return process.env.RENTCAST_API_KEY || null;
}

async function rentcastFetch<T>(path: string, params: Record<string, string>): Promise<T | null> {
  const apiKey = getApiKey();
  if (!apiKey) {
    console.warn("[rentcast] No RENTCAST_API_KEY configured");
    return null;
  }

  const url = new URL(`${BASE_URL}${path}`);
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }

  try {
    const res = await fetch(url.toString(), {
      headers: { "X-Api-Key": apiKey, Accept: "application/json" },
    });

    if (res.status === 429) {
      console.warn("[rentcast] Rate limited");
      return null;
    }

    if (!res.ok) {
      console.warn(`[rentcast] ${path} returned ${res.status}: ${res.statusText}`);
      return null;
    }

    return (await res.json()) as T;
  } catch (err) {
    console.error("[rentcast] Fetch error:", err);
    return null;
  }
}

/**
 * Get property structural data by address.
 * Returns attributes, tax data, owner info.
 */
export async function getPropertyByAddress(address: string): Promise<RentCastProperty | null> {
  const result = await rentcastFetch<RentCastProperty[]>("/properties", { address });
  // API returns an array; take the first match
  return result && result.length > 0 ? result[0] : null;
}

/**
 * Get AVM (Automated Valuation Model) estimate for a property.
 * Returns price estimate, confidence range, and comparable sales.
 */
export async function getValueEstimate(address: string): Promise<RentCastValuation | null> {
  return rentcastFetch<RentCastValuation>("/avm/value", { address });
}

/**
 * Get market statistics for a zip code.
 * Returns median price, rent, days on market, listing volume.
 */
export async function getMarketStats(zipCode: string): Promise<RentCastMarket | null> {
  return rentcastFetch<RentCastMarket>("/markets", { zipCode });
}
