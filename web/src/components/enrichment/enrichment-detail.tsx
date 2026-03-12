"use client";

import type { ReactNode } from "react";
import type { PropertyEnrichment } from "@/lib/enrichment/types";
import {
  Footprints,
  Droplets,
  GraduationCap,
  ShieldAlert,
  Wifi,
  Wind,
  ShoppingCart,
  UtensilsCrossed,
  TreePine,
  Users,
  ExternalLink,
} from "lucide-react";

function isEnrichment(data: unknown): data is PropertyEnrichment {
  if (!data || typeof data !== "object") return false;
  const d = data as Record<string, unknown>;
  return !!(
    d.walkability || d.flood || d.schools || d.crime || d.broadband ||
    d.demographics || d.air_quality || d.amenities
  );
}

function ScoreBar({
  label,
  value,
  max = 100,
}: {
  label: string;
  value: number;
  max?: number;
}) {
  const pct = Math.min((value / max) * 100, 100);
  const barColor =
    value >= 70
      ? "bg-green-500"
      : value >= 40
        ? "bg-yellow-500"
        : "bg-orange-500";
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium">{value}</span>
      </div>
      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${barColor}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

interface EnrichmentDetailProps {
  enrichmentData: unknown;
  /** Legacy columns for backward compat */
  walkScore?: number | null;
  transitScore?: number | null;
}

export function EnrichmentDetail({
  enrichmentData,
  walkScore,
  transitScore,
}: EnrichmentDetailProps) {
  const enrichment = isEnrichment(enrichmentData)
    ? (enrichmentData as PropertyEnrichment)
    : null;

  // Resolve scores: prefer enrichment_data, fall back to legacy columns
  const walk = enrichment?.walkability;
  const resolvedWalkScore = walk?.walk_score ?? walkScore;
  const resolvedTransitScore = walk?.transit_score ?? transitScore;
  const bikeScore = walk?.bike_score;
  const wsLink = walk?.ws_link;

  const flood = enrichment?.flood;
  const schools = enrichment?.schools;
  const crime = enrichment?.crime;
  const broadband = enrichment?.broadband;
  const demographics = enrichment?.demographics;
  const airQuality = enrichment?.air_quality;
  const amenities = enrichment?.amenities;

  const hasAnyData =
    resolvedWalkScore != null ||
    resolvedTransitScore != null ||
    flood ||
    schools?.nearby?.length ||
    crime ||
    broadband ||
    demographics ||
    airQuality ||
    amenities;

  if (!hasAnyData) return null;

  return (
    <div className="space-y-4">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
        Neighborhood
      </p>

      {/* Walk / Transit / Bike scores */}
      {(resolvedWalkScore != null ||
        resolvedTransitScore != null ||
        bikeScore != null) && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Footprints className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Walkability & Transit
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {resolvedWalkScore != null && (
              <ScoreBar label="Walk Score" value={resolvedWalkScore} />
            )}
            {resolvedTransitScore != null && (
              <ScoreBar label="Transit Score" value={resolvedTransitScore} />
            )}
            {bikeScore != null && (
              <ScoreBar label="Bike Score" value={bikeScore} />
            )}
          </div>
          {wsLink && (
            <a
              href={wsLink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[10px] text-muted-foreground hover:text-primary mt-1.5"
              onClick={(e) => e.stopPropagation()}
            >
              <ExternalLink className="h-2.5 w-2.5" />
              Walk Score
            </a>
          )}
        </div>
      )}

      {/* Flood risk */}
      {flood && (
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <Droplets className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Flood Risk
            </span>
          </div>
          <div
            className={`text-sm p-2.5 rounded-lg border ${
              flood.risk_level === "low"
                ? "bg-green-50 border-green-200 text-green-800"
                : flood.risk_level === "moderate"
                  ? "bg-orange-50 border-orange-200 text-orange-800"
                  : "bg-red-50 border-red-200 text-red-800"
            }`}
          >
            <span className="font-medium">
              Zone {flood.zone}
              {flood.risk_level === "low" && " — Low Risk"}
              {flood.risk_level === "moderate" && " — Moderate Risk"}
              {flood.risk_level === "high" && " — High Risk"}
              {flood.risk_level === "very_high" && " — Very High Risk"}
              {flood.risk_level === "undetermined" && " — Undetermined"}
            </span>
            {flood.insurance_required && (
              <p className="text-xs mt-1 opacity-80">Flood insurance required</p>
            )}
          </div>
        </div>
      )}

      {/* Demographics */}
      {demographics && (
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <Users className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Demographics
            </span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-sm">
            {demographics.median_income != null && (
              <div>
                <p className="text-xs text-muted-foreground">Median Income</p>
                <p className="font-medium">
                  ${demographics.median_income.toLocaleString()}
                </p>
              </div>
            )}
            {demographics.median_home_value != null && (
              <div>
                <p className="text-xs text-muted-foreground">
                  Median Home Value
                </p>
                <p className="font-medium">
                  ${demographics.median_home_value.toLocaleString()}
                </p>
              </div>
            )}
            {demographics.owner_occupied_pct != null && (
              <div>
                <p className="text-xs text-muted-foreground">
                  Owner vs. Renter
                </p>
                <p className="font-medium">
                  {demographics.owner_occupied_pct}% owner /{" "}
                  {100 - demographics.owner_occupied_pct}% renter
                </p>
              </div>
            )}
          </div>
          <p className="text-[10px] text-muted-foreground mt-1">
            Source: US Census ACS
          </p>
        </div>
      )}

      {/* Nearby amenities */}
      {amenities && (
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <ShoppingCart className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Nearby Amenities
            </span>
          </div>
          <div className="flex flex-wrap gap-4 text-sm">
            <AmenityItem
              icon={<ShoppingCart className="h-3.5 w-3.5" />}
              label="Grocery"
              count={amenities.grocery_count}
              distance={amenities.nearest_grocery_miles}
            />
            <AmenityItem
              icon={<UtensilsCrossed className="h-3.5 w-3.5" />}
              label="Restaurants"
              count={amenities.restaurant_count}
              distance={null}
            />
            <AmenityItem
              icon={<TreePine className="h-3.5 w-3.5" />}
              label="Parks"
              count={amenities.park_count}
              distance={null}
            />
          </div>
        </div>
      )}

      {/* Internet */}
      {broadband && (
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <Wifi className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Internet
            </span>
          </div>
          <div className="text-sm space-y-1">
            <p>
              <span className="text-muted-foreground">Max speed: </span>
              <span className="font-medium">
                {broadband.max_download_mbps} Mbps
              </span>
              {broadband.fiber_available && (
                <span className="ml-2 text-green-600 font-medium">
                  Fiber available
                </span>
              )}
            </p>
            {broadband.providers.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {broadband.providers.map((name) => (
                  <span
                    key={name}
                    className="text-xs bg-muted px-2 py-0.5 rounded"
                  >
                    {name}
                  </span>
                ))}
              </div>
            )}
          </div>
          <p className="text-[10px] text-muted-foreground mt-1">
            Source: FCC Broadband Map
          </p>
        </div>
      )}

      {/* Air quality */}
      {airQuality && (
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <Wind className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Air Quality
            </span>
          </div>
          <p className="text-sm">
            <span className="font-medium">AQI {airQuality.aqi}</span>
            <span className="text-muted-foreground">
              {" "}
              — {airQuality.category}
            </span>
          </p>
          <p className="text-[10px] text-muted-foreground mt-1">
            Source: EPA AirNow
          </p>
        </div>
      )}

      {/* Schools */}
      {schools && schools.nearby.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <GraduationCap className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Schools ({schools.nearby.length} within 5 miles)
            </span>
          </div>
          <div className="space-y-1.5">
            {schools.nearby.map((school, i) => (
              <div
                key={`${school.name}-${i}`}
                className="flex items-center justify-between text-sm border-b last:border-b-0 pb-1.5 last:pb-0"
              >
                <div className="min-w-0">
                  <p className="font-medium truncate">{school.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {school.type} · {school.grades}
                    {school.student_count != null &&
                      ` · ${school.student_count.toLocaleString()} students`}
                  </p>
                </div>
                {school.distance_miles != null && (
                  <span className="text-xs text-muted-foreground shrink-0 ml-2">
                    {school.distance_miles.toFixed(1)} mi
                  </span>
                )}
              </div>
            ))}
          </div>
          <p className="text-[10px] text-muted-foreground mt-1.5">
            Source: {schools.source === "nces" ? "NCES" : "GreatSchools"}
          </p>
        </div>
      )}

      {/* Crime stats */}
      {crime && (crime.violent_crime_rate != null || crime.safety_score != null) && (
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <ShieldAlert className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Crime
            </span>
          </div>
          <div className="text-sm space-y-0.5">
            {crime.jurisdiction && crime.violent_crime_rate != null && (
              <p>
                Crime in{" "}
                <span className="font-medium">{crime.jurisdiction}</span>:{" "}
                <span className="font-medium">
                  {crime.violent_crime_rate.toLocaleString()}
                </span>{" "}
                violent crimes per 100K
              </p>
            )}
            {crime.property_crime_rate != null && (
              <p>
                <span className="font-medium">
                  {crime.property_crime_rate.toLocaleString()}
                </span>{" "}
                property crimes per 100K
              </p>
            )}
            {crime.safety_score != null && (
              <p>
                Safety score:{" "}
                <span className="font-medium">{crime.safety_score}</span> / 100
              </p>
            )}
          </div>
          <p className="text-[10px] text-muted-foreground mt-1">
            Source: {crime.source === "fbi_ucr" ? "FBI UCR" : "Crimeometer"}
            {crime.data_year && ` · ${crime.data_year} data`}
            {crime.source === "fbi_ucr" && " · County-level data"}
          </p>
        </div>
      )}
    </div>
  );
}

function AmenityItem({
  icon,
  label,
  count,
  distance,
}: {
  icon: ReactNode;
  label: string;
  count: number;
  distance: number | null;
}) {
  return (
    <div className="flex items-center gap-1.5 text-muted-foreground">
      {icon}
      <span>
        {count} {label}
        {distance != null && (
          <span className="text-xs"> (nearest: {distance.toFixed(1)} mi)</span>
        )}
      </span>
    </div>
  );
}
