import type { EnrichmentProvider, ProviderResult, DemographicsData } from "../types";

const API_KEY = process.env.CENSUS_API_KEY;

// Step 1: Geocode lat/lng to FIPS codes (state + county + tract) via FCC API
// Step 2: Query Census ACS 5-year estimates for that tract

async function getGeoFIPS(lat: number, lng: number): Promise<{ state: string; county: string; tract: string } | null> {
  const url = `https://geo.fcc.gov/api/census/block/find?latitude=${lat}&longitude=${lng}&censusYear=2020&format=json`;

  const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
  if (!res.ok) return null;

  const json = await res.json();
  if (!json.Block?.FIPS) return null;

  const fips = json.Block.FIPS;
  // FIPS format: SS CCC TTTTTT BBBB (state 2, county 3, tract 6, block 4)
  return {
    state: fips.substring(0, 2),
    county: fips.substring(2, 5),
    tract: fips.substring(5, 11),
  };
}

export const censusProvider: EnrichmentProvider<DemographicsData> = {
  name: "census",
  enabled: !!API_KEY,

  async fetch(lat: number, lng: number): Promise<ProviderResult<DemographicsData>> {
    if (!API_KEY) {
      return { provider: "census", success: false, error: "CENSUS_API_KEY not configured" };
    }

    try {
      // Get FIPS codes from coordinates
      const fips = await getGeoFIPS(lat, lng);
      if (!fips) {
        return { provider: "census", success: false, error: "Could not geocode coordinates to FIPS" };
      }

      // ACS 5-Year variables:
      // B19013_001E = Median household income
      // B25077_001E = Median home value
      // B01003_001E = Total population
      // B25003_001E = Total occupied housing units
      // B25003_002E = Owner-occupied housing units
      // B01002_001E = Median age
      const variables = "B19013_001E,B25077_001E,B01003_001E,B25003_001E,B25003_002E,B01002_001E";

      const url =
        `https://api.census.gov/data/2022/acs/acs5?get=${variables}` +
        `&for=tract:${fips.tract}` +
        `&in=state:${fips.state}+county:${fips.county}` +
        `&key=${API_KEY}`;

      const res = await fetch(url, { signal: AbortSignal.timeout(15000) });

      if (!res.ok) {
        return { provider: "census", success: false, error: `Census API HTTP ${res.status}` };
      }

      const json = await res.json();

      // Census API returns [headers, ...rows]
      if (!json || json.length < 2) {
        return { provider: "census", success: false, error: "No census data for this tract" };
      }

      const row = json[1];
      const medianIncome = parseInt(row[0], 10);
      const medianHomeValue = parseInt(row[1], 10);
      const population = parseInt(row[2], 10);
      const totalOccupied = parseInt(row[3], 10);
      const ownerOccupied = parseInt(row[4], 10);
      const medianAge = parseFloat(row[5]);

      const ownerPct =
        totalOccupied > 0
          ? Math.round((ownerOccupied / totalOccupied) * 100)
          : 0;

      return {
        provider: "census",
        success: true,
        data: {
          median_income: isNaN(medianIncome) ? 0 : medianIncome,
          median_home_value: isNaN(medianHomeValue) ? 0 : medianHomeValue,
          population: isNaN(population) ? 0 : population,
          owner_occupied_pct: ownerPct,
          median_age: isNaN(medianAge) ? 0 : medianAge,
        },
      };
    } catch (err) {
      return { provider: "census", success: false, error: err instanceof Error ? err.message : "Unknown error" };
    }
  },
};
