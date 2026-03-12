import type { EnrichmentProvider, ProviderResult, AmenitiesData } from "../types";
import { geocodeWithNominatim } from "./nominatim";

const API_KEY = process.env.GOOGLE_MAPS_API_KEY;

interface NearbyPlace {
  types: string[];
  geometry: { location: { lat: number; lng: number } };
}

/** Haversine distance in miles */
function distanceMiles(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 3959; // Earth radius in miles
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export const googleMapsProvider: EnrichmentProvider<AmenitiesData> = {
  name: "google_maps",
  enabled: !!API_KEY,

  async fetch(lat: number, lng: number): Promise<ProviderResult<AmenitiesData>> {
    if (!API_KEY) {
      return { provider: "google_maps", success: false, error: "GOOGLE_MAPS_API_KEY not configured" };
    }

    try {
      // Search for amenities in parallel — each type in a separate Nearby Search call
      // Radius: 5 miles (~8047 meters), but API max is 50000m so we're fine
      const radius = 8047; // ~5 miles in meters
      const types = ["supermarket", "restaurant", "park", "hospital"];

      const results = await Promise.allSettled(
        types.map((type) =>
          fetchNearby(lat, lng, radius, type, API_KEY!)
        )
      );

      const counts: Record<string, number> = {
        supermarket: 0,
        restaurant: 0,
        park: 0,
        hospital: 0,
      };

      let nearestGroceryMiles = 999;

      for (let i = 0; i < types.length; i++) {
        const result = results[i];
        if (result.status === "fulfilled" && result.value) {
          counts[types[i]] = result.value.length;

          // Find nearest grocery store
          if (types[i] === "supermarket") {
            for (const place of result.value) {
              const dist = distanceMiles(
                lat,
                lng,
                place.geometry.location.lat,
                place.geometry.location.lng
              );
              if (dist < nearestGroceryMiles) nearestGroceryMiles = dist;
            }
          }
        }
      }

      return {
        provider: "google_maps",
        success: true,
        data: {
          grocery_count: counts.supermarket,
          restaurant_count: Math.min(counts.restaurant, 60), // Cap at 60 (API returns max 60)
          park_count: counts.park,
          hospital_count: counts.hospital,
          nearest_grocery_miles: nearestGroceryMiles === 999 ? -1 : Math.round(nearestGroceryMiles * 10) / 10,
        },
      };
    } catch (err) {
      return { provider: "google_maps", success: false, error: err instanceof Error ? err.message : "Unknown error" };
    }
  },
};

async function fetchNearby(
  lat: number,
  lng: number,
  radius: number,
  type: string,
  apiKey: string
): Promise<NearbyPlace[]> {
  const params = new URLSearchParams({
    location: `${lat},${lng}`,
    radius: radius.toString(),
    type,
    key: apiKey,
  });

  const res = await fetch(
    `https://maps.googleapis.com/maps/api/place/nearbysearch/json?${params}`,
    { signal: AbortSignal.timeout(10000) }
  );

  if (!res.ok) return [];

  const json = await res.json();

  if (json.status !== "OK" && json.status !== "ZERO_RESULTS") {
    console.warn(`[google-maps] Nearby Search (${type}): ${json.status} - ${json.error_message || ""}`);
    return [];
  }

  return json.results || [];
}

/**
 * Geocode an address to lat/lng.
 * Tries Google Maps first (if API key configured), then falls back to
 * free OpenStreetMap Nominatim so enrichment works even without paid keys.
 */
export async function geocodeAddress(
  address: string
): Promise<{ lat: number; lng: number } | null> {
  // Try Google Maps first if key is available
  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (key) {
    try {
      const params = new URLSearchParams({ address, key });
      const res = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?${params}`,
        { signal: AbortSignal.timeout(10000) }
      );

      if (res.ok) {
        const json = await res.json();
        if (json.status === "OK" && json.results?.[0]) {
          const loc = json.results[0].geometry.location;
          return { lat: loc.lat, lng: loc.lng };
        }
      }
    } catch {
      // Fall through to Nominatim
    }
  }

  // Fallback: free Nominatim geocoding (no API key required)
  return geocodeWithNominatim(address);
}
