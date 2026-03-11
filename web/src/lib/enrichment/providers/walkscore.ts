import type { EnrichmentProvider, ProviderResult, WalkabilityData } from "../types";

const API_KEY = process.env.WALKSCORE_API_KEY;

export const walkScoreProvider: EnrichmentProvider<WalkabilityData> = {
  name: "walkscore",
  enabled: !!API_KEY,

  async fetch(lat: number, lng: number, address: string): Promise<ProviderResult<WalkabilityData>> {
    if (!API_KEY) {
      return { provider: "walkscore", success: false, error: "WALKSCORE_API_KEY not configured" };
    }

    try {
      const params = new URLSearchParams({
        format: "json",
        address: address,
        lat: lat.toString(),
        lon: lng.toString(),
        transit: "1",
        bike: "1",
        wsapikey: API_KEY,
      });

      const res = await fetch(`https://api.walkscore.com/score?${params}`, {
        signal: AbortSignal.timeout(10000),
      });

      if (!res.ok) {
        return { provider: "walkscore", success: false, error: `HTTP ${res.status}` };
      }

      const json = await res.json();

      if (json.status !== 1) {
        return { provider: "walkscore", success: false, error: `Walk Score status: ${json.status} - ${json.description || "unknown"}` };
      }

      return {
        provider: "walkscore",
        success: true,
        data: {
          walk_score: json.walkscore ?? 0,
          transit_score: json.transit?.score ?? 0,
          bike_score: json.bike?.score ?? 0,
          description: json.description ?? "",
          ws_link: json.ws_link ?? "",
        },
      };
    } catch (err) {
      return { provider: "walkscore", success: false, error: err instanceof Error ? err.message : "Unknown error" };
    }
  },
};
