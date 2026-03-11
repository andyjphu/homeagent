// Property enrichment types — all data sourced from free public APIs

export interface WalkabilityData {
  walk_score: number;
  transit_score: number;
  bike_score: number;
  description: string;
  ws_link: string;
}

export interface FloodData {
  zone: string;
  risk_level: "high" | "very_high" | "moderate" | "low" | "undetermined";
  insurance_required: boolean;
}

export interface DemographicsData {
  median_income: number;
  median_home_value: number;
  population: number;
  owner_occupied_pct: number;
  median_age: number;
}

export interface BroadbandData {
  fiber_available: boolean;
  max_download_mbps: number;
  isp_count: number;
  providers: string[];
}

export interface AirQualityData {
  aqi: number;
  category: string;
}

export interface AmenitiesData {
  grocery_count: number;
  restaurant_count: number;
  park_count: number;
  hospital_count: number;
  nearest_grocery_miles: number;
}

export interface SchoolEntry {
  name: string;
  type: string;
  grades: string;
  distance_miles: number;
  student_count?: number;
  student_teacher_ratio?: number;
}

export interface SchoolsData {
  nearby: SchoolEntry[];
  source: "nces" | "greatschools";
}

export interface CrimeData {
  violent_crime_rate?: number;
  property_crime_rate?: number;
  total_incidents?: number;
  jurisdiction?: string;
  data_year?: number;
  safety_score?: number;
  source: "fbi_ucr" | "crimeometer";
}

export interface PropertyEnrichment {
  enriched_at: string;
  walkability?: WalkabilityData;
  flood?: FloodData;
  demographics?: DemographicsData;
  broadband?: BroadbandData;
  air_quality?: AirQualityData;
  amenities?: AmenitiesData;
  schools?: SchoolsData;
  crime?: CrimeData;
}

export interface ProviderResult<T = unknown> {
  provider: string;
  success: boolean;
  data?: T;
  error?: string;
}

export interface EnrichmentProvider<T = unknown> {
  name: string;
  enabled: boolean;
  fetch(lat: number, lng: number, address: string): Promise<ProviderResult<T>>;
}

export interface EnrichmentCacheRow {
  id: string;
  address_normalized: string;
  lat: number | null;
  lng: number | null;
  provider: string;
  data: Record<string, unknown>;
  fetched_at: string;
  expires_at: string;
}
