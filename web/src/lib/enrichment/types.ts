// PropertyEnrichment — shape of the enrichment_data JSONB column on properties

export interface WalkScoreData {
  walk_score: number;
  walk_description: string;
  transit_score: number | null;
  transit_description: string | null;
  bike_score: number | null;
  bike_description: string | null;
  ws_link: string; // Walk Score attribution URL
}

export interface FloodZoneData {
  zone: string; // e.g. "X", "AE", "VE", "A", "V"
  risk_level: "minimal" | "moderate" | "high";
  description: string;
  source: string;
}

export interface SchoolEntry {
  name: string;
  type: "elementary" | "middle" | "high" | "private" | "charter" | "other";
  grade_range: string;
  enrollment: number | null;
  distance_miles: number | null;
  rating: number | null;
  source: string; // 'nces', 'greatschools'
}

export interface CrimeData {
  violent_crime_rate: number; // per 100K
  property_crime_rate: number; // per 100K
  jurisdiction: string;
  data_year: number;
  risk_level: "low" | "medium" | "high";
  source: string; // 'fbi_ucr'
}

export interface BroadbandProvider {
  name: string;
  max_speed: number; // Mbps download
  technology: string;
}

export interface BroadbandData {
  max_download_speed: number;
  max_upload_speed: number | null;
  fiber_available: boolean;
  providers: BroadbandProvider[];
  source: string;
}

export interface DemographicsData {
  median_household_income: number | null;
  median_home_value: number | null;
  owner_occupied_pct: number | null;
  renter_occupied_pct: number | null;
  population: number | null;
  source: string;
}

export interface AirQualityData {
  aqi: number;
  category: string; // "Good", "Moderate", "Unhealthy for Sensitive Groups", etc.
  source: string;
}

export interface AmenityCategory {
  count: number;
  nearest_distance_miles: number | null;
}

export interface NearbyAmenitiesData {
  grocery: AmenityCategory;
  restaurants: AmenityCategory;
  parks: AmenityCategory;
  source: string;
}

export interface PropertyEnrichment {
  walk_score?: WalkScoreData;
  flood_zone?: FloodZoneData;
  schools?: SchoolEntry[];
  crime?: CrimeData;
  broadband?: BroadbandData;
  demographics?: DemographicsData;
  air_quality?: AirQualityData;
  nearby_amenities?: NearbyAmenitiesData;
  enriched_at: string; // ISO timestamp
  enrichment_sources: string[];
}

// Helper to check if any enrichment data is available
export function hasEnrichmentData(data: unknown): data is PropertyEnrichment {
  if (!data || typeof data !== "object") return false;
  const d = data as Record<string, unknown>;
  return !!(
    d.walk_score ||
    d.flood_zone ||
    d.schools ||
    d.crime ||
    d.broadband ||
    d.demographics ||
    d.air_quality ||
    d.nearby_amenities
  );
}

// Derive crime risk level from rate vs national average (~380 violent per 100K)
export function deriveCrimeRiskLevel(violentRate: number): "low" | "medium" | "high" {
  if (violentRate < 200) return "low";
  if (violentRate < 400) return "medium";
  return "high";
}

// Walk score color thresholds
export function walkScoreColor(score: number): "green" | "yellow" | "red" {
  if (score >= 70) return "green";
  if (score >= 50) return "yellow";
  return "red";
}

// Flood zone risk classification
const HIGH_RISK_ZONES = new Set(["A", "AE", "AH", "AO", "AR", "V", "VE"]);
const MODERATE_RISK_ZONES = new Set(["B", "X500", "0.2 PCT"]);

export function classifyFloodZone(zone: string): "minimal" | "moderate" | "high" {
  const upper = zone.toUpperCase().trim();
  if (HIGH_RISK_ZONES.has(upper)) return "high";
  if (MODERATE_RISK_ZONES.has(upper)) return "moderate";
  return "minimal";
}
