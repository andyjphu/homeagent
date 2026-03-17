import type { EnrichmentProvider, ProviderResult, CrimeData } from "../types";

// STATUS (March 2026): DISABLED — the FBI CDE (Crime Data Explorer) has moved
// to a new authentication system. The old Data.gov API key no longer works;
// both api.usa.gov/crime and cde.ucr.cjis.gov return 403 "Missing Authentication Token".
//
// TO RE-ENABLE:
// 1. Register for a new FBI CDE API key at https://cde.ucr.cjis.gov/
// 2. Set the key as FBI_CDE_API_KEY in .env.local
// 3. Update the endpoints below with the new auth format
// 4. Set enabled back to true
//
// The code below is fully functional — it just needs working API credentials.

const API_KEY = process.env.DATAGOV_API_KEY;

// State FIPS to abbreviation mapping (used for FBI API)
const FIPS_TO_STATE: Record<string, string> = {
  "01": "AL", "02": "AK", "04": "AZ", "05": "AR", "06": "CA",
  "08": "CO", "09": "CT", "10": "DE", "11": "DC", "12": "FL",
  "13": "GA", "15": "HI", "16": "ID", "17": "IL", "18": "IN",
  "19": "IA", "20": "KS", "21": "KY", "22": "LA", "23": "ME",
  "24": "MD", "25": "MA", "26": "MI", "27": "MN", "28": "MS",
  "29": "MO", "30": "MT", "31": "NE", "32": "NV", "33": "NH",
  "34": "NJ", "35": "NM", "36": "NY", "37": "NC", "38": "ND",
  "39": "OH", "40": "OK", "41": "OR", "42": "PA", "44": "RI",
  "45": "SC", "46": "SD", "47": "TN", "48": "TX", "49": "UT",
  "50": "VT", "51": "VA", "53": "WA", "54": "WV", "55": "WI",
  "56": "WY",
};

interface GeoResult {
  stateAbbr: string;
  county: string;
  stateFips: string;
  countyFips: string;
}

async function getGeoInfo(lat: number, lng: number): Promise<GeoResult | null> {
  try {
    const url = `https://geo.fcc.gov/api/census/block/find?latitude=${lat}&longitude=${lng}&censusYear=2020&format=json`;
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) return null;

    const json = await res.json();
    const fips = json.Block?.FIPS;
    const countyName = json.County?.name;
    if (!fips) return null;

    const stateFips = fips.substring(0, 2);
    const countyFips = fips.substring(2, 5);
    const stateAbbr = FIPS_TO_STATE[stateFips];

    if (!stateAbbr) return null;

    return {
      stateAbbr,
      county: countyName || "",
      stateFips,
      countyFips,
    };
  } catch {
    return null;
  }
}

export const fbiCrimeProvider: EnrichmentProvider<CrimeData> = {
  name: "fbi_crime",
  enabled: false, // Disabled — FBI CDE API returns 403 as of March 2026 (see comment above)

  async fetch(lat: number, lng: number): Promise<ProviderResult<CrimeData>> {
    if (!API_KEY) {
      return { provider: "fbi_crime", success: false, error: "DATAGOV_API_KEY not configured" };
    }

    try {
      // Step 1: Get state/county from coordinates
      const geo = await getGeoInfo(lat, lng);
      if (!geo) {
        return { provider: "fbi_crime", success: false, error: "Could not determine jurisdiction" };
      }

      // Step 2: Query FBI UCR data for this state
      // The FBI API provides state-level summarized data
      // Try to get the most recent year available (data is 1-2 years behind)
      const currentYear = new Date().getFullYear();
      let crimeData: StateCrimeResult | null = null;
      let dataYear = 0;

      // Try recent years, data is usually 1-2 years behind
      for (let year = currentYear - 1; year >= currentYear - 3; year--) {
        const result = await fetchStateCrimeData(geo.stateAbbr, year);
        if (result) {
          crimeData = result;
          dataYear = year;
          break;
        }
      }

      if (!crimeData) {
        return { provider: "fbi_crime", success: false, error: `No FBI crime data available for ${geo.stateAbbr}` };
      }

      // Calculate per-capita rates (per 100k population)
      const population = crimeData.population || 1;
      const violentRate = crimeData.violent
        ? Math.round((crimeData.violent / population) * 100000)
        : undefined;
      const propertyRate = crimeData.property
        ? Math.round((crimeData.property / population) * 100000)
        : undefined;
      const totalIncidents =
        (crimeData.violent || 0) + (crimeData.property || 0);

      // Safety score: inverse of combined crime rate (0-100, higher = safer)
      const combinedRate = (violentRate || 0) + (propertyRate || 0);
      const safetyScore = Math.max(0, Math.min(100, Math.round(100 - (combinedRate / 80))));

      return {
        provider: "fbi_crime",
        success: true,
        data: {
          violent_crime_rate: violentRate,
          property_crime_rate: propertyRate,
          total_incidents: totalIncidents,
          jurisdiction: `${geo.county}, ${geo.stateAbbr}`,
          data_year: dataYear,
          safety_score: safetyScore,
          source: "fbi_ucr",
        },
      };
    } catch (err) {
      return { provider: "fbi_crime", success: false, error: err instanceof Error ? err.message : "Unknown error" };
    }
  },
};

interface StateCrimeResult {
  violent: number;
  property: number;
  population: number;
}

async function fetchStateCrimeData(
  stateAbbr: string,
  year: number
): Promise<StateCrimeResult | null> {
  // Try multiple API endpoints — the FBI has migrated between these
  const endpoints = [
    `https://api.usa.gov/crime/fbi/sapi/api/estimates/states/${stateAbbr}/${year}/${year}?api_key=${API_KEY}`,
    `https://cde.ucr.cjis.gov/LATEST/webapp/api/estimates/states/${stateAbbr}/${year}/${year}?API_KEY=${API_KEY}`,
  ];

  for (const url of endpoints) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
      if (!res.ok) continue;

      const json = await res.json();
      const results = json.results;

      if (!results || results.length === 0) continue;

      const entry = results[0];
      return {
        violent: entry.violent_crime || 0,
        property: entry.property_crime || 0,
        population: entry.population || 0,
      };
    } catch {
      continue;
    }
  }

  return null;
}
