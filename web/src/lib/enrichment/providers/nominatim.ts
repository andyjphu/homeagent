/**
 * Free geocoding via OpenStreetMap Nominatim API.
 * Used as a fallback when GOOGLE_MAPS_API_KEY is not configured.
 * Rate limit: 1 request/second (we only call this once per property).
 * See: https://nominatim.org/release-docs/develop/api/Search/
 */
export async function geocodeWithNominatim(
  address: string
): Promise<{ lat: number; lng: number } | null> {
  try {
    const params = new URLSearchParams({
      q: address,
      format: "json",
      limit: "1",
      countrycodes: "us",
    });

    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?${params}`,
      {
        headers: {
          "User-Agent": "FoyerFind/1.0 (property-enrichment)",
        },
        signal: AbortSignal.timeout(10000),
      }
    );

    if (!res.ok) return null;

    const results = await res.json();
    if (!results?.[0]) return null;

    return {
      lat: parseFloat(results[0].lat),
      lng: parseFloat(results[0].lon),
    };
  } catch {
    return null;
  }
}
