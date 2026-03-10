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
import { hasEnrichmentData, walkScoreColor } from "@/lib/enrichment/types";

interface EnrichmentBadgesProps {
  enrichmentData: unknown;
  /** Also read legacy columns when available */
  walkScore?: number | null;
  transitScore?: number | null;
}

const WALK_SCORE_STYLES: Record<string, string> = {
  green: "bg-green-100 text-green-800 border-green-200",
  yellow: "bg-yellow-100 text-yellow-800 border-yellow-200",
  red: "bg-red-100 text-red-800 border-red-200",
};

const FLOOD_STYLES: Record<string, string> = {
  minimal: "bg-green-100 text-green-800 border-green-200",
  moderate: "bg-orange-100 text-orange-800 border-orange-200",
  high: "bg-red-100 text-red-800 border-red-200",
};

const CRIME_STYLES: Record<string, string> = {
  low: "bg-green-100 text-green-800 border-green-200",
  medium: "bg-yellow-100 text-yellow-800 border-yellow-200",
  high: "bg-red-100 text-red-800 border-red-200",
};

export function EnrichmentBadges({
  enrichmentData,
  walkScore,
  transitScore,
}: EnrichmentBadgesProps) {
  const enrichment = hasEnrichmentData(enrichmentData)
    ? (enrichmentData as PropertyEnrichment)
    : null;

  // Resolve walk score: prefer enrichment_data, fall back to legacy column
  const wsScore = enrichment?.walk_score?.walk_score ?? walkScore;
  const wsLink = enrichment?.walk_score?.ws_link;

  const flood = enrichment?.flood_zone;
  const schools = enrichment?.schools;
  const crime = enrichment?.crime;
  const broadband = enrichment?.broadband;

  const hasBadges = wsScore != null || flood || schools?.length || crime || broadband;
  if (!hasBadges) return null;

  return (
    <div className="flex flex-wrap gap-1.5">
      {/* Walk Score badge */}
      {wsScore != null && (
        <Badge
          variant="outline"
          className={`text-xs border ${WALK_SCORE_STYLES[walkScoreColor(wsScore)]}`}
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
          className={`text-xs border ${FLOOD_STYLES[flood.risk_level]}`}
        >
          <Droplets className="h-3 w-3 mr-1" />
          {flood.risk_level === "minimal"
            ? "No Flood Risk"
            : `Flood Zone ${flood.zone}`}
        </Badge>
      )}

      {/* Schools badge */}
      {schools && schools.length > 0 && (
        <Badge variant="outline" className="text-xs">
          <GraduationCap className="h-3 w-3 mr-1" />
          {schools.length} school{schools.length !== 1 ? "s" : ""} nearby
          {schools[0].enrollment != null && (
            <span className="ml-1 text-muted-foreground">
              ({schools[0].enrollment.toLocaleString()} enrolled)
            </span>
          )}
        </Badge>
      )}

      {/* Crime badge */}
      {crime && (
        <Badge
          variant="outline"
          className={`text-xs border ${CRIME_STYLES[crime.risk_level]}`}
        >
          <ShieldAlert className="h-3 w-3 mr-1" />
          {crime.risk_level === "low"
            ? "Low Crime"
            : crime.risk_level === "medium"
              ? "Medium Crime"
              : "High Crime"}
        </Badge>
      )}

      {/* Broadband badge */}
      {broadband && (
        <Badge variant="outline" className="text-xs">
          <Wifi className="h-3 w-3 mr-1" />
          {broadband.fiber_available
            ? "Fiber Available"
            : `${broadband.max_download_speed} Mbps`}
        </Badge>
      )}
    </div>
  );
}
