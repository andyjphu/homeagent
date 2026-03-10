import type {
  PropertyEnrichment,
  ProviderResult,
  WalkabilityData,
  FloodData,
  DemographicsData,
  BroadbandData,
  AirQualityData,
  AmenitiesData,
  SchoolsData,
  CrimeData,
} from "./types";
import { getCachedAll, setCache } from "./cache";
import { walkScoreProvider } from "./providers/walkscore";
import { femaProvider } from "./providers/fema";
import { censusProvider } from "./providers/census";
import { fccBroadbandProvider } from "./providers/fcc-broadband";
import { airNowProvider } from "./providers/airnow";
import { googleMapsProvider } from "./providers/google-maps";
import { ncesProvider } from "./providers/nces";
import { fbiCrimeProvider } from "./providers/fbi-crime";

const ALL_PROVIDERS = [
  walkScoreProvider,
  femaProvider,
  censusProvider,
  fccBroadbandProvider,
  airNowProvider,
  googleMapsProvider,
  ncesProvider,
  fbiCrimeProvider,
] as const;

interface EnrichmentResult {
  enrichment: PropertyEnrichment;
  providerResults: {
    succeeded: string[];
    failed: Array<{ provider: string; error: string }>;
    cached: string[];
  };
}

/**
 * Main enrichment orchestrator.
 * Runs all enabled providers in parallel, caches results, returns unified result.
 * Uses Promise.allSettled — one provider failing won't block others.
 */
export async function enrichProperty(
  lat: number,
  lng: number,
  address: string
): Promise<EnrichmentResult> {
  const succeeded: string[] = [];
  const failed: Array<{ provider: string; error: string }> = [];
  const cached: string[] = [];

  // Check cache for all providers at this address
  const cachedResults = await getCachedAll(address);

  // Determine which providers need fresh data
  const enabledProviders = ALL_PROVIDERS.filter((p) => p.enabled);
  const providersToFetch = enabledProviders.filter(
    (p) => !cachedResults.has(p.name)
  );

  // Mark cached providers
  for (const [name] of cachedResults) {
    cached.push(name);
  }

  // Fetch from providers that aren't cached — all in parallel
  const fetchResults = await Promise.allSettled(
    providersToFetch.map(async (provider) => {
      const result = await provider.fetch(lat, lng, address);

      if (result.success && result.data) {
        // Cache the successful result
        await setCache(
          address,
          lat,
          lng,
          provider.name,
          result.data as unknown as Record<string, unknown>
        );
        succeeded.push(provider.name);
      } else {
        failed.push({
          provider: provider.name,
          error: result.error || "Unknown error",
        });
      }

      return result;
    })
  );

  // Merge cached + fresh results into a single map
  const allResults = new Map<string, ProviderResult>();

  // Add cached results
  for (const [name, result] of cachedResults) {
    allResults.set(name, result);
  }

  // Add fresh results
  for (let i = 0; i < providersToFetch.length; i++) {
    const settledResult = fetchResults[i];
    if (settledResult.status === "fulfilled" && settledResult.value.success) {
      allResults.set(providersToFetch[i].name, settledResult.value);
    }
  }

  // Log disabled providers
  const disabledProviders = ALL_PROVIDERS.filter((p) => !p.enabled);
  for (const p of disabledProviders) {
    failed.push({ provider: p.name, error: "Provider not enabled (missing API key)" });
  }

  // Assemble the enrichment result
  const enrichment: PropertyEnrichment = {
    enriched_at: new Date().toISOString(),
  };

  const ws = allResults.get("walkscore");
  if (ws?.data) enrichment.walkability = ws.data as WalkabilityData;

  const fema = allResults.get("fema");
  if (fema?.data) enrichment.flood = fema.data as FloodData;

  const census = allResults.get("census");
  if (census?.data) enrichment.demographics = census.data as DemographicsData;

  const broadband = allResults.get("fcc_broadband");
  if (broadband?.data) enrichment.broadband = broadband.data as BroadbandData;

  const air = allResults.get("airnow");
  if (air?.data) enrichment.air_quality = air.data as AirQualityData;

  const amenities = allResults.get("google_maps");
  if (amenities?.data) enrichment.amenities = amenities.data as AmenitiesData;

  const schools = allResults.get("nces");
  if (schools?.data) enrichment.schools = schools.data as SchoolsData;

  const crime = allResults.get("fbi_crime");
  if (crime?.data) enrichment.crime = crime.data as CrimeData;

  console.log(
    `[enrichment] Address: "${address}" | Succeeded: [${succeeded.join(", ")}] | Cached: [${cached.join(", ")}] | Failed: [${failed.map((f) => f.provider).join(", ")}]`
  );

  return {
    enrichment,
    providerResults: { succeeded, failed, cached },
  };
}

/** Check which providers are currently enabled (have API keys configured) */
export function getEnabledProviders(): string[] {
  return ALL_PROVIDERS.filter((p) => p.enabled).map((p) => p.name);
}
