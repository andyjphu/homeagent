"use client";

import type { ReactNode } from "react";
import { type PropertyEnrichment, hasEnrichmentData } from "@/lib/enrichment/types";
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
  const enrichment = hasEnrichmentData(enrichmentData)
    ? (enrichmentData as PropertyEnrichment)
    : null;

  // Resolve scores: prefer enrichment_data, fall back to legacy columns
  const ws = enrichment?.walk_score;
  const resolvedWalkScore = ws?.walk_score ?? walkScore;
  const resolvedTransitScore = ws?.transit_score ?? transitScore;
  const bikeScore = ws?.bike_score;
  const wsLink = ws?.ws_link;

  const flood = enrichment?.flood_zone;
  const schools = enrichment?.schools;
  const crime = enrichment?.crime;
  const broadband = enrichment?.broadband;
  const demographics = enrichment?.demographics;
  const airQuality = enrichment?.air_quality;
  const amenities = enrichment?.nearby_amenities;

  const hasAnyData =
    resolvedWalkScore != null ||
    resolvedTransitScore != null ||
    flood ||
    schools?.length ||
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
              flood.risk_level === "minimal"
                ? "bg-green-50 border-green-200 text-green-800"
                : flood.risk_level === "moderate"
                  ? "bg-orange-50 border-orange-200 text-orange-800"
                  : "bg-red-50 border-red-200 text-red-800"
            }`}
          >
            <span className="font-medium">
              Zone {flood.zone}
              {flood.risk_level === "minimal" && " — Minimal Risk"}
              {flood.risk_level === "moderate" && " — Moderate Risk"}
              {flood.risk_level === "high" && " — High Risk"}
            </span>
            <p className="text-xs mt-1 opacity-80">{flood.description}</p>
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
            {demographics.median_household_income != null && (
              <div>
                <p className="text-xs text-muted-foreground">Median Income</p>
                <p className="font-medium">
                  ${demographics.median_household_income.toLocaleString()}
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
                  {demographics.renter_occupied_pct ?? 100 - demographics.owner_occupied_pct}% renter
                </p>
              </div>
            )}
          </div>
          <p className="text-[10px] text-muted-foreground mt-1">
            Source: {demographics.source}
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
              count={amenities.grocery.count}
              distance={amenities.grocery.nearest_distance_miles}
            />
            <AmenityItem
              icon={<UtensilsCrossed className="h-3.5 w-3.5" />}
              label="Restaurants"
              count={amenities.restaurants.count}
              distance={amenities.restaurants.nearest_distance_miles}
            />
            <AmenityItem
              icon={<TreePine className="h-3.5 w-3.5" />}
              label="Parks"
              count={amenities.parks.count}
              distance={amenities.parks.nearest_distance_miles}
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
                {broadband.max_download_speed} Mbps
              </span>
              {broadband.fiber_available && (
                <span className="ml-2 text-green-600 font-medium">
                  Fiber available
                </span>
              )}
            </p>
            {broadband.providers.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {broadband.providers.map((p) => (
                  <span
                    key={p.name}
                    className="text-xs bg-muted px-2 py-0.5 rounded"
                  >
                    {p.name} ({p.max_speed} Mbps, {p.technology})
                  </span>
                ))}
              </div>
            )}
          </div>
          <p className="text-[10px] text-muted-foreground mt-1">
            Source: {broadband.source}
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
            Source: {airQuality.source}
          </p>
        </div>
      )}

      {/* Schools */}
      {schools && schools.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <GraduationCap className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Schools ({schools.length} within 5 miles)
            </span>
          </div>
          <div className="space-y-1.5">
            {schools.map((school, i) => (
              <div
                key={`${school.name}-${i}`}
                className="flex items-center justify-between text-sm border-b last:border-b-0 pb-1.5 last:pb-0"
              >
                <div className="min-w-0">
                  <p className="font-medium truncate">{school.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {school.type} · {school.grade_range}
                    {school.enrollment != null &&
                      ` · ${school.enrollment.toLocaleString()} students`}
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
          {schools[0]?.source === "nces" && (
            <p className="text-[10px] text-muted-foreground mt-1.5">
              Source: NCES · Ratings available in a future update
            </p>
          )}
          {schools[0]?.source && schools[0].source !== "nces" && (
            <p className="text-[10px] text-muted-foreground mt-1.5">
              Source: {schools[0].source}
            </p>
          )}
        </div>
      )}

      {/* Crime stats */}
      {crime && (
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <ShieldAlert className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Crime
            </span>
          </div>
          <div className="text-sm space-y-0.5">
            <p>
              Crime in{" "}
              <span className="font-medium">{crime.jurisdiction}</span>:{" "}
              <span className="font-medium">
                {crime.violent_crime_rate.toLocaleString()}
              </span>{" "}
              violent crimes per 100K
            </p>
            <p>
              <span className="font-medium">
                {crime.property_crime_rate.toLocaleString()}
              </span>{" "}
              property crimes per 100K
            </p>
          </div>
          <p className="text-[10px] text-muted-foreground mt-1">
            Source: {crime.source === "fbi_ucr" ? "FBI UCR" : crime.source} ·{" "}
            {crime.data_year} data
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
