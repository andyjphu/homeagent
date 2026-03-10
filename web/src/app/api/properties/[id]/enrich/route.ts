import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createActivityEntry } from "@/lib/supabase/activity";
import type { PropertyEnrichment } from "@/lib/enrichment/types";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: propertyId } = await params;
    const supabase = (await createClient()) as any;
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: agent } = await supabase
      .from("agents")
      .select("id")
      .eq("user_id", user.id)
      .single();

    if (!agent) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }

    // Fetch property
    const { data: property, error: propError } = await supabase
      .from("properties")
      .select("*")
      .eq("id", propertyId)
      .eq("agent_id", agent.id)
      .single();

    if (propError || !property) {
      return NextResponse.json(
        { error: "Property not found" },
        { status: 404 }
      );
    }

    // Build enrichment data from available sources
    const enrichment: PropertyEnrichment = {
      enriched_at: new Date().toISOString(),
      enrichment_sources: [],
    };

    // Migrate existing walk_score / transit_score into enrichment structure
    if (property.walk_score != null || property.transit_score != null) {
      enrichment.walk_score = {
        walk_score: property.walk_score ?? 0,
        walk_description: walkScoreLabel(property.walk_score ?? 0),
        transit_score: property.transit_score ?? null,
        transit_description: property.transit_score != null
          ? transitScoreLabel(property.transit_score)
          : null,
        bike_score: null,
        bike_description: null,
        ws_link: `https://www.walkscore.com/score/${encodeURIComponent(property.address)}`,
      };
      enrichment.enrichment_sources.push("walkscore");
    }

    // Migrate existing school_ratings into enrichment structure
    if (property.school_ratings && typeof property.school_ratings === "object") {
      const ratings = property.school_ratings as Record<string, { name?: string; rating?: number }>;
      const schoolEntries = Object.entries(ratings)
        .filter(([, data]) => data && typeof data === "object")
        .map(([type, data]) => ({
          name: data.name || type,
          type: mapSchoolType(type),
          grade_range: type,
          enrollment: null as number | null,
          distance_miles: null as number | null,
          rating: data.rating ?? null,
          source: "greatschools",
        }));

      if (schoolEntries.length > 0) {
        enrichment.schools = schoolEntries;
        enrichment.enrichment_sources.push("schools");
      }
    }

    // TODO: Add real API integrations here in future phases:
    // - FEMA flood zone API → enrichment.flood_zone
    // - FBI UCR API → enrichment.crime
    // - FCC broadband API → enrichment.broadband
    // - Census API → enrichment.demographics
    // - AirNow API → enrichment.air_quality
    // - Google Places / Overpass API → enrichment.nearby_amenities

    // Save enrichment_data to property
    const { error: updateError } = await supabase
      .from("properties")
      .update({ enrichment_data: enrichment })
      .eq("id", propertyId);

    if (updateError) {
      console.error("[enrich] Update error:", updateError);
      return NextResponse.json(
        { error: "Failed to save enrichment data" },
        { status: 500 }
      );
    }

    // Log activity
    await createActivityEntry(
      agent.id,
      "research_completed",
      `Enrichment completed: ${property.address}`,
      `Sources: ${enrichment.enrichment_sources.join(", ") || "none available"}`,
      { propertyId, sources: enrichment.enrichment_sources },
      { propertyId }
    );

    return NextResponse.json({ enrichment });
  } catch (err: unknown) {
    console.error("[enrich] Error:", err);
    return NextResponse.json(
      { error: "Failed to enrich property" },
      { status: 500 }
    );
  }
}

function walkScoreLabel(score: number): string {
  if (score >= 90) return "Walker's Paradise";
  if (score >= 70) return "Very Walkable";
  if (score >= 50) return "Somewhat Walkable";
  if (score >= 25) return "Car-Dependent";
  return "Almost All Errands Require a Car";
}

function transitScoreLabel(score: number): string {
  if (score >= 90) return "Rider's Paradise";
  if (score >= 70) return "Excellent Transit";
  if (score >= 50) return "Good Transit";
  if (score >= 25) return "Some Transit";
  return "Minimal Transit";
}

function mapSchoolType(
  type: string
): "elementary" | "middle" | "high" | "private" | "charter" | "other" {
  const lower = type.toLowerCase();
  if (lower.includes("elementary") || lower === "elementary") return "elementary";
  if (lower.includes("middle") || lower === "middle") return "middle";
  if (lower.includes("high") || lower === "high") return "high";
  if (lower.includes("private")) return "private";
  if (lower.includes("charter")) return "charter";
  return "other";
}
