import type { EnrichmentProvider, ProviderResult, AirQualityData } from "../types";

const API_KEY = process.env.AIRNOW_API_KEY;

export const airNowProvider: EnrichmentProvider<AirQualityData> = {
  name: "airnow",
  enabled: !!API_KEY,

  async fetch(lat: number, lng: number): Promise<ProviderResult<AirQualityData>> {
    if (!API_KEY) {
      return { provider: "airnow", success: false, error: "AIRNOW_API_KEY not configured" };
    }

    try {
      const params = new URLSearchParams({
        format: "application/json",
        latitude: lat.toString(),
        longitude: lng.toString(),
        distance: "25", // 25-mile radius
        API_KEY: API_KEY,
      });

      const res = await fetch(
        `https://www.airnowapi.org/aq/observation/latLong/current/?${params}`,
        { signal: AbortSignal.timeout(10000) }
      );

      if (!res.ok) {
        return { provider: "airnow", success: false, error: `AirNow HTTP ${res.status}` };
      }

      const json = await res.json();

      if (!Array.isArray(json) || json.length === 0) {
        return { provider: "airnow", success: false, error: "No air quality data for this location" };
      }

      // AirNow returns multiple readings (PM2.5, Ozone, etc.)
      // Use the highest AQI value (worst air quality) for the overall score
      let maxAqi = 0;
      let category = "Good";

      for (const reading of json) {
        const aqi = reading.AQI ?? 0;
        if (aqi > maxAqi) {
          maxAqi = aqi;
          category = reading.Category?.Name ?? categorizeAqi(aqi);
        }
      }

      return {
        provider: "airnow",
        success: true,
        data: {
          aqi: maxAqi,
          category,
        },
      };
    } catch (err) {
      return { provider: "airnow", success: false, error: err instanceof Error ? err.message : "Unknown error" };
    }
  },
};

function categorizeAqi(aqi: number): string {
  if (aqi <= 50) return "Good";
  if (aqi <= 100) return "Moderate";
  if (aqi <= 150) return "Unhealthy for Sensitive Groups";
  if (aqi <= 200) return "Unhealthy";
  if (aqi <= 300) return "Very Unhealthy";
  return "Hazardous";
}
