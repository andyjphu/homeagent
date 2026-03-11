import type { EnrichmentProvider, ProviderResult, FloodData } from "../types";

// FEMA National Flood Hazard Layer — free, no API key required
// Uses the NFHL ArcGIS REST service

const NFHL_URL =
  "https://hazards.fema.gov/arcgis/rest/services/public/NFHL/MapServer/28/query";

// Map FEMA flood zone codes to risk levels
function classifyFloodZone(zone: string): {
  risk_level: FloodData["risk_level"];
  insurance_required: boolean;
} {
  const z = zone.toUpperCase().trim();

  // High risk — Special Flood Hazard Areas (mandatory insurance)
  if (z.startsWith("V") || z === "A" || z.startsWith("AE") || z.startsWith("AH") || z.startsWith("AO") || z.startsWith("AR")) {
    return { risk_level: z.startsWith("V") ? "very_high" : "high", insurance_required: true };
  }

  // Moderate risk
  if (z.startsWith("B") || (z.startsWith("X") && z.includes("SHADED"))) {
    return { risk_level: "moderate", insurance_required: false };
  }

  // Low risk
  if (z.startsWith("C") || z === "X" || z.startsWith("X")) {
    return { risk_level: "low", insurance_required: false };
  }

  // Undetermined
  if (z === "D") {
    return { risk_level: "undetermined", insurance_required: false };
  }

  return { risk_level: "undetermined", insurance_required: false };
}

export const femaProvider: EnrichmentProvider<FloodData> = {
  name: "fema",
  enabled: true, // No API key needed

  async fetch(lat: number, lng: number): Promise<ProviderResult<FloodData>> {
    try {
      const params = new URLSearchParams({
        geometry: `${lng},${lat}`,
        geometryType: "esriGeometryPoint",
        inSR: "4326",
        spatialRel: "esriSpatialRelIntersects",
        outFields: "FLD_ZONE,ZONE_SUBTY,SFHA_TF",
        returnGeometry: "false",
        f: "json",
      });

      const res = await fetch(`${NFHL_URL}?${params}`, {
        signal: AbortSignal.timeout(15000),
      });

      if (!res.ok) {
        return { provider: "fema", success: false, error: `HTTP ${res.status}` };
      }

      const json = await res.json();

      if (json.error) {
        return { provider: "fema", success: false, error: json.error.message || "FEMA API error" };
      }

      if (!json.features || json.features.length === 0) {
        return {
          provider: "fema",
          success: true,
          data: {
            zone: "X",
            risk_level: "low",
            insurance_required: false,
          },
        };
      }

      // Use the first matching flood zone
      const attrs = json.features[0].attributes;
      const zone = attrs.FLD_ZONE || "X";
      const classification = classifyFloodZone(zone);

      return {
        provider: "fema",
        success: true,
        data: {
          zone,
          ...classification,
        },
      };
    } catch (err) {
      return { provider: "fema", success: false, error: err instanceof Error ? err.message : "Unknown error" };
    }
  },
};
