import type { EnrichmentProvider, ProviderResult, SchoolsData, SchoolEntry } from "../types";

// NCES School Locations via ArcGIS REST — free, no API key required
// Note: The 2023-24 ArcGIS layer only provides location data (name, address, lat/lon).
// Enrollment, grade range, and school type fields are not available in this layer.

const NCES_URL =
  "https://nces.ed.gov/opengis/rest/services/K12_School_Locations/EDGE_GEOCODE_PUBLICSCH_2324/MapServer/0/query";

/** Haversine distance in miles */
function distanceMiles(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 3959;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function formatLocale(locale: string | null): string {
  if (!locale) return "Public";
  const code = locale.charAt(0);
  const localeMap: Record<string, string> = {
    "1": "City",
    "2": "Suburb",
    "3": "Town",
    "4": "Rural",
  };
  return localeMap[code] || "Public";
}

export const ncesProvider: EnrichmentProvider<SchoolsData> = {
  name: "nces",
  enabled: true, // No API key needed

  async fetch(lat: number, lng: number): Promise<ProviderResult<SchoolsData>> {
    try {
      // Use JSON geometry format with meters — required by this ArcGIS layer
      const params = new URLSearchParams({
        where: "1=1",
        geometry: JSON.stringify({ x: lng, y: lat }),
        geometryType: "esriGeometryPoint",
        inSR: "4326",
        spatialRel: "esriSpatialRelIntersects",
        distance: "8047",
        units: "esriSRUnit_Meter",
        outFields: "NAME,STREET,CITY,STATE,ZIP,LAT,LON,LOCALE",
        returnGeometry: "false",
        f: "json",
        resultRecordCount: "30",
      });

      const res = await fetch(`${NCES_URL}?${params}`, {
        signal: AbortSignal.timeout(15000),
      });

      if (!res.ok) {
        return { provider: "nces", success: false, error: `NCES HTTP ${res.status}` };
      }

      const json = await res.json();

      if (json.error) {
        return { provider: "nces", success: false, error: json.error.message || "NCES API error" };
      }

      if (!json.features || json.features.length === 0) {
        return {
          provider: "nces",
          success: true,
          data: { nearby: [], source: "nces" },
        };
      }

      const schools: SchoolEntry[] = json.features.map(
        (f: {
          attributes: Record<string, string | number | null>;
        }) => {
          const a = f.attributes;

          // Calculate distance using LAT/LON attribute fields
          const schoolLat = a.LAT ? Number(a.LAT) : null;
          const schoolLng = a.LON ? Number(a.LON) : null;
          let dist = 0;
          if (schoolLat && schoolLng) {
            dist = distanceMiles(lat, lng, schoolLat, schoolLng);
          }

          const entry: SchoolEntry = {
            name: String(a.NAME || "Unknown"),
            type: formatLocale(a.LOCALE ? String(a.LOCALE) : null),
            grades: "Public School",
            distance_miles: Math.round(dist * 10) / 10,
          };

          return entry;
        }
      );

      // Sort by distance
      schools.sort((a, b) => a.distance_miles - b.distance_miles);

      return {
        provider: "nces",
        success: true,
        data: {
          nearby: schools.slice(0, 15),
          source: "nces",
        },
      };
    } catch (err) {
      return { provider: "nces", success: false, error: err instanceof Error ? err.message : "Unknown error" };
    }
  },
};
