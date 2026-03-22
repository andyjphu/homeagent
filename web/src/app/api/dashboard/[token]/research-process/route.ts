import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  logEvent,
  updateTaskStatus,
  getTask,
} from "@/lib/browser-use/save-results";
import { enrichProperty } from "@/lib/enrichment/service";
import { geocodeAddress } from "@/lib/enrichment/providers/google-maps";
import { llmJSON, isLLMAvailable } from "@/lib/llm/router";
import { PROPERTY_SCORING_PROMPT } from "@/lib/llm/prompts/property-scoring";
import { createActivityEntry } from "@/lib/supabase/activity";

/**
 * POST /api/dashboard/[token]/research-process
 *
 * Token-authenticated version of /api/research/process.
 * Called by the buyer dashboard polling loop to advance the enrichment/scoring pipeline.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const supabase = createAdminClient() as any;

  // Validate dashboard token
  const { data: buyer } = await supabase
    .from("buyers")
    .select("id, agent_id")
    .eq("dashboard_token", token)
    .single();

  if (!buyer) {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }

  const { taskId } = await request.json();
  if (!taskId) {
    return NextResponse.json({ error: "taskId required" }, { status: 400 });
  }

  const task = await getTask(taskId);
  if (!task || task.status !== "running") {
    return NextResponse.json({
      stage: task?.output_data?.pipeline_stage ?? "unknown",
      status: task?.status ?? "unknown",
    });
  }

  // Verify task belongs to this buyer
  if (task.buyer_id !== buyer.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const outputData = task.output_data ?? {};
  const stage = outputData.pipeline_stage;

  try {
    switch (stage) {
      case "enrichment":
        return NextResponse.json(
          await handleEnrichmentStage(taskId, buyer.id, outputData)
        );
      case "scoring":
        return NextResponse.json(
          await handleScoringStage(taskId, buyer.id, outputData)
        );
      default:
        return NextResponse.json({
          stage: stage ?? "pending",
          status: task.status,
        });
    }
  } catch (err: any) {
    await logEvent(taskId, "pipeline_error", { error: err.message });
    await updateTaskStatus(taskId, "failed", {
      output_data: { ...outputData, error: err.message },
      error_message: err.message,
    });
    return NextResponse.json({
      stage,
      status: "failed",
      error: err.message,
    });
  }
}

// ---------- Stage: API Enrichment ----------

async function handleEnrichmentStage(
  taskId: string,
  buyerId: string,
  outputData: Record<string, any>
) {
  const propertyIds: string[] = outputData.property_ids ?? [];
  const currentIndex: number = outputData.enrichment_index ?? 0;

  if (currentIndex >= propertyIds.length) {
    return startScoringStage(taskId, buyerId, outputData);
  }

  const propId = propertyIds[currentIndex];
  const adminSupabase = createAdminClient() as any;

  const { data: prop } = await adminSupabase
    .from("properties")
    .select("id, address, city, state, zip, latitude, longitude")
    .eq("id", propId)
    .single();

  if (!prop) {
    await logEvent(taskId, "property_not_found", { property_id: propId });
    await updateTaskStatus(taskId, "running", {
      output_data: { ...outputData, enrichment_index: currentIndex + 1 },
    });
    return { stage: "enrichment", status: "running" };
  }

  const fullAddress = [prop.address, prop.city, prop.state, prop.zip]
    .filter(Boolean)
    .join(", ");

  await logEvent(taskId, "crossref_start", {
    index: currentIndex + 1,
    total: propertyIds.length,
    address: fullAddress,
  });

  let lat = prop.latitude;
  let lng = prop.longitude;

  if (!lat || !lng) {
    const coords = await geocodeAddress(fullAddress);
    if (coords) {
      lat = coords.lat;
      lng = coords.lng;
      await adminSupabase
        .from("properties")
        .update({ latitude: lat, longitude: lng })
        .eq("id", propId);
    }
  }

  if (lat && lng) {
    try {
      const result = await enrichProperty(lat, lng, fullAddress);

      const { error: enrichUpdateErr } = await adminSupabase
        .from("properties")
        .update({ enrichment_data: result.enrichment })
        .eq("id", propId);

      if (enrichUpdateErr) {
        console.error(`[process] Failed to store enrichment for ${propId}:`, enrichUpdateErr.message);
      }

      await logEvent(taskId, "property_enriched", {
        property_id: propId,
        fields_updated: [
          ...result.providerResults.succeeded,
          ...result.providerResults.cached,
        ],
      });
    } catch (err: any) {
      await logEvent(taskId, "property_no_enrichment", {
        property_id: propId,
        error: err.message,
      });
    }
  } else {
    await logEvent(taskId, "property_no_enrichment", {
      property_id: propId,
      error: "Could not geocode address",
    });
  }

  const nextIndex = currentIndex + 1;
  if (nextIndex >= propertyIds.length) {
    return startScoringStage(taskId, buyerId, {
      ...outputData,
      enrichment_index: nextIndex,
    });
  }

  await updateTaskStatus(taskId, "running", {
    output_data: { ...outputData, enrichment_index: nextIndex },
  });

  return { stage: "enrichment", status: "running" };
}

// ---------- Stage: LLM Scoring ----------

async function startScoringStage(
  taskId: string,
  buyerId: string,
  outputData: Record<string, any>
) {
  const propertyIds: string[] = outputData.property_ids ?? [];

  if (!buyerId || propertyIds.length === 0 || !isLLMAvailable("property_scoring")) {
    return finishPipeline(taskId, outputData, 0);
  }

  await logEvent(taskId, "stage_scoring_start", { property_count: propertyIds.length });
  await updateTaskStatus(taskId, "running", {
    output_data: { ...outputData, pipeline_stage: "scoring" },
  });

  return { stage: "scoring", status: "running" };
}

async function handleScoringStage(
  taskId: string,
  buyerId: string,
  outputData: Record<string, any>
) {
  const propertyIds: string[] = outputData.property_ids ?? [];
  const adminSupabase = createAdminClient() as any;

  const { data: buyer } = await adminSupabase
    .from("buyers")
    .select("intent_profile")
    .eq("id", buyerId)
    .single();

  const intentProfile = buyer?.intent_profile;
  if (!intentProfile) {
    await logEvent(taskId, "stage_scoring_failed", { error: "No buyer intent profile" });
    return finishPipeline(taskId, outputData, 0);
  }

  const { data: properties } = await adminSupabase
    .from("properties")
    .select("*")
    .in("id", propertyIds);

  if (!properties || properties.length === 0) {
    await logEvent(taskId, "stage_scoring_failed", { error: "No properties to score" });
    return finishPipeline(taskId, outputData, 0);
  }

  const scoreResults: { property_id: string; match_score: number }[] = [];

  const scorePromises = properties.map(async (property: any) => {
    const enrichment = property.enrichment_data ?? {};
    const context = `
BUYER INTENT PROFILE:
${JSON.stringify(intentProfile, null, 2)}

PROPERTY:
Address: ${property.address}
Price: $${property.listing_price?.toLocaleString() ?? "N/A"}
Beds: ${property.beds ?? "N/A"}
Baths: ${property.baths ?? "N/A"}
Sqft: ${property.sqft?.toLocaleString() ?? "N/A"}
Year Built: ${property.year_built ?? "N/A"}
HOA: $${property.hoa_monthly ?? 0}/month
Days on Market: ${property.days_on_market ?? "N/A"}
Walk Score: ${enrichment.walkability?.walk_score ?? property.walk_score ?? "N/A"}
Transit Score: ${enrichment.walkability?.transit_score ?? property.transit_score ?? "N/A"}
Flood Risk: ${enrichment.flood ? `${enrichment.flood.zone} (${enrichment.flood.risk_level})` : "N/A"}
Schools: ${JSON.stringify(enrichment.schools?.nearby?.slice(0, 3) ?? property.school_ratings ?? {})}
Demographics: ${enrichment.demographics ? `Median income $${enrichment.demographics.median_income?.toLocaleString()}, ${enrichment.demographics.owner_occupied_pct}% owner-occupied` : "N/A"}
Air Quality: ${enrichment.air_quality ? `AQI ${enrichment.air_quality.aqi} (${enrichment.air_quality.category})` : "N/A"}
Amenities: ${enrichment.amenities ? `${enrichment.amenities.grocery_count} groceries, ${enrichment.amenities.park_count} parks, ${enrichment.amenities.restaurant_count} restaurants nearby` : "N/A"}
Description: ${property.listing_description ?? "N/A"}
`;

    try {
      const result = await llmJSON<{
        match_score: number;
        score_reasoning: string;
        score_breakdown: any;
      }>("property_scoring", PROPERTY_SCORING_PROMPT, context);

      if (typeof result.match_score !== "number") return;

      await adminSupabase
        .from("buyer_property_scores")
        .upsert(
          {
            buyer_id: buyerId,
            property_id: property.id,
            match_score: result.match_score,
            score_reasoning: result.score_reasoning ?? "",
            score_breakdown: { ...result.score_breakdown, source: "ai" },
          },
          { onConflict: "buyer_id,property_id" }
        );

      scoreResults.push({
        property_id: property.id,
        match_score: result.match_score,
      });
    } catch (err: any) {
      console.error(`Failed to score property ${property.id}:`, err.message);
    }
  });

  await Promise.all(scorePromises);

  await logEvent(taskId, "stage_scoring_done", {
    scored: scoreResults.length,
    scores: scoreResults,
  });

  return finishPipeline(taskId, outputData, scoreResults.length);
}

// ---------- Finish ----------

async function finishPipeline(
  taskId: string,
  outputData: Record<string, any>,
  scoredCount: number
) {
  const propertyIds: string[] = outputData.property_ids ?? [];

  await logEvent(taskId, "pipeline_complete", {
    property_ids: propertyIds,
    enriched: propertyIds.length,
    scored: scoredCount,
  });

  await updateTaskStatus(taskId, "completed", {
    output_data: {
      ...outputData,
      pipeline_stage: "complete",
      properties_enriched: propertyIds.length,
      properties_scored: scoredCount,
    },
  });

  const task = await getTask(taskId);
  if (task?.agent_id) {
    await createActivityEntry(
      task.agent_id,
      "research_completed",
      `Research completed: ${propertyIds.length} properties found`,
      `${propertyIds.length} enriched, ${scoredCount} scored`,
      { properties_found: propertyIds.length, properties_scored: scoredCount },
      { buyerId: task.buyer_id, taskId }
    );
  }

  return { stage: "complete", status: "completed" };
}
