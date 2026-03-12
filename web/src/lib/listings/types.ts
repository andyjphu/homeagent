/**
 * Normalized listing type — provider-agnostic.
 * All listing providers (RapidAPI, SimplyRETS, MLS) normalize to this shape.
 */
export interface NormalizedListing {
  address: string;
  city: string | null;
  state: string | null;
  zip: string | null;
  price: number | null;
  beds: number | null;
  baths: number | null;
  sqft: number | null;
  lot_sqft: number | null;
  year_built: number | null;
  property_type: string | null;
  photos: string[];
  listing_url: string | null;
  lat: number | null;
  lng: number | null;
  days_on_market: number | null;
  description: string | null;
  source: string;
  source_id: string | null;
}

export interface ListingSearchParams {
  location: string; // city, zip, or address
  price_min?: number;
  price_max?: number;
  beds_min?: number;
  baths_min?: number;
  property_type?: string;
  limit?: number;
  offset?: number;
}

export interface ListingSearchResult {
  listings: NormalizedListing[];
  total: number;
  cached: boolean;
  source: "live" | "mock";
}
