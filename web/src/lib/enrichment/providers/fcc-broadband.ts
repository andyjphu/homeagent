import type { EnrichmentProvider, ProviderResult, BroadbandData } from "../types";

// FCC Broadband Data via the BroadbandMap API — free, no key required.
//
// STATUS (March 2026): DISABLED — the FCC BDC public API returns 405 on ALL
// endpoints (listAvailableFixedProvidersByLocation, listFixedAvailabilityByLocation,
// listMobileAvailabilityByLocation, location-summary). The FCC geocoder still
// works but the broadband data layer is completely locked down.
//
// TO RE-ENABLE: If FCC restores public API access, set enabled back to true.
// The code below is fully functional and tested — it just needs a working API.

const BDC_URL = "https://broadbandmap.fcc.gov/api/public/map/listAvailableFixedProvidersByLocation";

export const fccBroadbandProvider: EnrichmentProvider<BroadbandData> = {
  name: "fcc_broadband",
  enabled: false, // Disabled — FCC BDC API returns 405 as of March 2026

  async fetch(lat: number, lng: number): Promise<ProviderResult<BroadbandData>> {
    try {
      // Query BDC for available providers at this location
      const params = new URLSearchParams({
        latitude: lat.toString(),
        longitude: lng.toString(),
        category: "fixed",
        speed: "25",
        tech_code: "0",
      });

      const res = await fetch(`${BDC_URL}?${params}`, {
        signal: AbortSignal.timeout(15000),
        headers: { Accept: "application/json" },
      });

      if (!res.ok) {
        // Try fallback endpoint
        return await fetchFallback(lat, lng);
      }

      const json = await res.json();

      if (!json.data || !Array.isArray(json.data)) {
        return await fetchFallback(lat, lng);
      }

      return parseProviderData(json.data);
    } catch (err) {
      return { provider: "fcc_broadband", success: false, error: err instanceof Error ? err.message : "Unknown error" };
    }
  },
};

function parseProviderData(data: Array<Record<string, unknown>>): ProviderResult<BroadbandData> {
  let fiberAvailable = false;
  let maxDownload = 0;
  const providerNames: string[] = [];

  for (const p of data) {
    const name = (p.brand_name || p.holding_company_name || p.provider_name || "Unknown") as string;
    if (!providerNames.includes(name)) {
      providerNames.push(name);
    }

    const speed = (p.max_advertised_download_speed || 0) as number;
    if (speed > maxDownload) maxDownload = speed;

    const techCode = (p.technology_code || 0) as number;
    if (techCode === 50) fiberAvailable = true;
  }

  return {
    provider: "fcc_broadband",
    success: true,
    data: {
      fiber_available: fiberAvailable,
      max_download_mbps: maxDownload,
      isp_count: providerNames.length,
      providers: providerNames.slice(0, 10),
    },
  };
}

/** Fallback using older FCC Area API */
async function fetchFallback(
  lat: number,
  lng: number,
): Promise<ProviderResult<BroadbandData>> {
  try {
    // Get state FIPS from FCC geocoder
    const geoRes = await fetch(
      `https://geo.fcc.gov/api/census/block/find?latitude=${lat}&longitude=${lng}&censusYear=2020&format=json`,
      { signal: AbortSignal.timeout(10000) }
    );

    if (!geoRes.ok) {
      return { provider: "fcc_broadband", success: false, error: "FCC geocoder unavailable" };
    }

    const geoJson = await geoRes.json();
    const blockFips = geoJson?.Block?.FIPS;
    if (!blockFips) {
      return { provider: "fcc_broadband", success: false, error: "Could not determine census block" };
    }

    const stateCode = blockFips.substring(0, 2);
    const res = await fetch(
      `https://broadbandmap.fcc.gov/api/public/map/listFixedAvailabilityByLocation?latitude=${lat}&longitude=${lng}&state_fips=${stateCode}&f=json`,
      { signal: AbortSignal.timeout(10000) }
    );

    if (!res.ok) {
      return { provider: "fcc_broadband", success: false, error: `FCC BDC API unavailable (HTTP ${res.status})` };
    }

    const json = await res.json();
    const records = json.data || [];

    if (!Array.isArray(records) || records.length === 0) {
      return { provider: "fcc_broadband", success: false, error: "No broadband data returned from FCC" };
    }

    return parseProviderData(records);
  } catch {
    return { provider: "fcc_broadband", success: false, error: "FCC broadband API unavailable" };
  }
}
