"use client";

import { Badge } from "@/components/ui/badge";
import {
  Footprints,
  Droplets,
  GraduationCap,
  ShieldAlert,
  Wifi,
} from "lucide-react";
import type { PropertyEnrichment } from "@/lib/enrichment/types";

interface EnrichmentBadgesProps {
  enrichmentData: unknown;
  /** Also read legacy columns when available */
  walkScore?: number | null;
  transitScore?: number | null;
}

function isEnrichment(data: unknown): data is PropertyEnrichment {
  if (!data || typeof data !== "object") return false;
  const d = data as Record<string, unknown>;
  return !!(
    d.walkability || d.flood || d.schools || d.crime || d.broadband ||
    d.demographics || d.air_quality || d.amenities
  );
}

function wsColor(score: number): "green" | "yellow" | "red" {
  if (score >= 70) return "green";
  if (score >= 50) return "yellow";
  return "red";
}

const WALK_SCORE_STYLES: Record<string, string> = {
  green: "bg-green-100 text-green-800 border-green-200",
  yellow: "bg-yellow-100 text-yellow-800 border-yellow-200",
  red: "bg-red-100 text-red-800 border-red-200",
};

const FLOOD_STYLES: Record<string, string> = {
  low: "bg-green-100 text-green-800 border-green-200",
  moderate: "bg-orange-100 text-orange-800 border-orange-200",
  high: "bg-red-100 text-red-800 border-red-200",
  very_high: "bg-red-100 text-red-800 border-red-200",
  undetermined: "bg-gray-100 text-gray-800 border-gray-200",
};

function crimeLabel(crime: PropertyEnrichment["crime"]): { text: string; style: string } | null {
  if (!crime) return null;
  if (crime.safety_score != null) {
    if (crime.safety_score >= 70) return { text: "Low Crime", style: "bg-green-100 text-green-800 border-green-200" };
    if (crime.safety_score >= 40) return { text: "Medium Crime", style: "bg-yellow-100 text-yellow-800 border-yellow-200" };
    return { text: "High Crime", style: "bg-red-100 text-red-800 border-red-200" };
  }
  if (crime.violent_crime_rate != null) {
    if (crime.violent_crime_rate < 200) return { text: "Low Crime", style: "bg-green-100 text-green-800 border-green-200" };
    if (crime.violent_crime_rate < 400) return { text: "Medium Crime", style: "bg-yellow-100 text-yellow-800 border-yellow-200" };
    return { text: "High Crime", style: "bg-red-100 text-red-800 border-red-200" };
  }
  return null;
}

export function EnrichmentBadges({
  enrichmentData,
  walkScore,
  transitScore,
}: EnrichmentBadgesProps) {
  const enrichment = isEnrichment(enrichmentData)
    ? (enrichmentData as PropertyEnrichment)
    : null;

  // Resolve walk score: prefer enrichment_data, fall back to legacy column
  const wsScore = enrichment?.walkability?.walk_score ?? walkScore;
  const wsLink = enrichment?.walkability?.ws_link;

  const flood = enrichment?.flood;
  const schools = enrichment?.schools;
  const crime = enrichment?.crime;
  const broadband = enrichment?.broadband;

  const hasBadges = wsScore != null || flood || schools?.nearby?.length || crime || broadband;
  if (!hasBadges) return null;

  const crimeBadge = crimeLabel(crime);

  return (
    <div className="flex flex-wrap gap-1.5">
      {/* Walk Score badge */}
      {wsScore != null && (
        <Badge
          variant="outline"
          className={`text-xs border ${WALK_SCORE_STYLES[wsColor(wsScore)]}`}
        >
          <Footprints className="h-3 w-3 mr-1" />
          {wsLink ? (
            <a
              href={wsLink}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:underline"
              onClick={(e) => e.stopPropagation()}
            >
              Walk Score: {wsScore}
            </a>
          ) : (
            <>Walk Score: {wsScore}</>
          )}
        </Badge>
      )}

      {/* Flood zone badge */}
      {flood && (
        <Badge
          variant="outline"
          className={`text-xs border ${FLOOD_STYLES[flood.risk_level] ?? FLOOD_STYLES.undetermined}`}
        >
          <Droplets className="h-3 w-3 mr-1" />
          {flood.risk_level === "low"
            ? "No Flood Risk"
            : `Flood Zone ${flood.zone}`}
        </Badge>
      )}

      {/* Schools badge */}
      {schools && schools.nearby.length > 0 && (
        <Badge variant="outline" className="text-xs">
          <GraduationCap className="h-3 w-3 mr-1" />
          {schools.nearby.length} school{schools.nearby.length !== 1 ? "s" : ""} nearby
          {schools.nearby[0].student_count != null && (
            <span className="ml-1 text-muted-foreground">
              ({schools.nearby[0].student_count.toLocaleString()} enrolled)
            </span>
          )}
        </Badge>
      )}

      {/* Crime badge */}
      {crimeBadge && (
        <Badge
          variant="outline"
          className={`text-xs border ${crimeBadge.style}`}
        >
          <ShieldAlert className="h-3 w-3 mr-1" />
          {crimeBadge.text}
        </Badge>
      )}

      {/* Broadband badge */}
      {broadband && (
        <Badge variant="outline" className="text-xs">
          <Wifi className="h-3 w-3 mr-1" />
          {broadband.fiber_available
            ? "Fiber Available"
            : `${broadband.max_download_mbps} Mbps`}
        </Badge>
      )}
    </div>
  );
}
