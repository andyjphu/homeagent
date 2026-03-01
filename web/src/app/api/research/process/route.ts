import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  runTask,
  getTaskStatus,
  parseJSON,
  type BUTaskStatus,
} from "@/lib/browser-use/client";
import {
  buildSchoolSearchPrompt,
  buildWalkScorePrompt,
  buildCommutePrompt,
} from "@/lib/browser-use/prompts";
import {
  saveProperty,
  linkPropertyToBuyer,
  saveEnrichment,
  logEvent,
  updateTaskStatus,
  getTask,
} from "@/lib/browser-use/save-results";
import { llmJSON } from "@/lib/llm/router";
import { PROPERTY_SCORING_PROMPT } from "@/lib/llm/prompts/property-scoring";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * POST /api/research/process
 *
 * Advances the research pipeline for a given agent_tasks record.
 * Called by the client polling loop every ~4s. Each call:
 * 1. Checks the current BU Cloud task status
 * 2. If finished, parses output, saves results, starts next stage
 * 3. Returns current state + live_url for the frontend
 *
 * Pipeline stages:
 *   zillow_search → enrichment (school→walkscore→commute per property) → scoring → complete
 */
export async function POST(request: Request) {
  const supabase = (await createClient()) as any;
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { taskId } = await request.json();
  if (!taskId) {
    return NextResponse.json({ error: "taskId required" }, { status: 400 });
  }

  const task = await getTask(taskId);
  const outputData = task.output_data ?? {};
  const stage = outputData.pipeline_stage;

  // Scoring stage doesn't use BU — handle separately
  if (stage === "scoring") {
    const scoringResult = await handleScoringStage(taskId, task.buyer_id, outputData);
    return NextResponse.json(scoringResult);
  }

  // If no BU task running, nothing to process
  if (!outputData.bu_task_id) {
    return NextResponse.json({
      stage: stage ?? "pending",
      status: task.status,
      liveUrl: null,
    });
  }

  // Check BU Cloud task status
  let buStatus: BUTaskStatus;
  try {
    buStatus = await getTaskStatus(outputData.bu_task_id);
  } catch (err: any) {
    return NextResponse.json({
      stage,
      status: task.status,
      liveUrl: outputData.live_url ?? null,
      error: err.message,
    });
  }

  // Still running — return current state with live URL
  if (buStatus.status === "started" || buStatus.status === "created") {
    return NextResponse.json({
      stage,
      status: "running",
      liveUrl: outputData.live_url ?? null,
      buStatus: buStatus.status,
    });
  }

  // Stopped (manually or error)
  if (buStatus.status === "stopped") {
    await logEvent(taskId, `${stage}_failed`, {
      error: buStatus.output ?? "Task failed",
    });
    await updateTaskStatus(taskId, "failed", {
      output_data: { ...outputData, error: buStatus.output ?? "Browser Use task failed" },
      error_message: buStatus.output ?? "Browser Use task failed",
    });
    return NextResponse.json({
      stage,
      status: "failed",
      liveUrl: null,
      error: buStatus.output,
    });
  }

  // Finished — advance pipeline based on current stage
  if (buStatus.status === "finished") {
    try {
      const result = await advancePipeline(
        taskId,
        task.agent_id,
        task.buyer_id,
        outputData,
        buStatus.output
      );
      return NextResponse.json(result);
    } catch (err: any) {
      await logEvent(taskId, "pipeline_error", { error: err.message });
      await updateTaskStatus(taskId, "failed", {
        output_data: { ...outputData, error: err.message },
        error_message: err.message,
      });
      return NextResponse.json({
        stage,
        status: "failed",
        liveUrl: null,
        error: err.message,
      });
    }
  }

  // Paused or unknown — return current state
  return NextResponse.json({
    stage,
    status: task.status,
    liveUrl: outputData.live_url ?? null,
    buStatus: buStatus.status,
  });
}

// ---------- Pipeline routing ----------

async function advancePipeline(
  taskId: string,
  agentId: string,
  buyerId: string,
  outputData: Record<string, any>,
  buOutput: string | null
): Promise<Record<string, any>> {
  const stage = outputData.pipeline_stage;

  switch (stage) {
    case "zillow_search":
      return handleZillowSearchDone(taskId, agentId, buyerId, outputData, buOutput);
    case "enrichment":
      return handleEnrichmentDone(taskId, agentId, buyerId, outputData, buOutput);
    default:
      await updateTaskStatus(taskId, "completed", {
        output_data: { ...outputData, pipeline_stage: "complete" },
      });
      return { stage: "complete", status: "completed", liveUrl: null };
  }
}

// ---------- Stage: Zillow search done ----------

/**
 * Parse search results, save properties, then start enrichment or scoring.
 */
async function handleZillowSearchDone(
  taskId: string,
  agentId: string,
  buyerId: string,
  outputData: Record<string, any>,
  buOutput: string | null
) {
  const listings = parseJSON(buOutput);

  if (!Array.isArray(listings) || listings.length === 0) {
    await logEvent(taskId, "no_properties_found");
    await updateTaskStatus(taskId, "completed", {
      output_data: {
        ...outputData,
        pipeline_stage: "complete",
        properties_found: 0,
        properties_enriched: 0,
        properties_scored: 0,
        property_ids: [],
      },
    });
    return { stage: "complete", status: "completed", liveUrl: null };
  }

  await logEvent(taskId, "stage_zillow_done", { property_count: listings.length });

  // Rank candidates by price fit to buyer budget (matching Python _rank_candidates)
  const intent = outputData.intent_profile ?? {};
  const budgetMin = intent.budget_min ?? 300000;
  const budgetMax = intent.budget_max ?? 750000;
  const budgetMid = (budgetMin + budgetMax) / 2;
  const maxDetailPages = 15;

  const ranked = [...listings]
    .sort((a, b) => {
      const priceA = parsePrice(a.price ?? a.listing_price);
      const priceB = parsePrice(b.price ?? b.listing_price);
      return Math.abs(priceA - budgetMid) - Math.abs(priceB - budgetMid);
    })
    .slice(0, maxDetailPages);

  await logEvent(taskId, "candidates_selected", { count: ranked.length });

  // Save each property from search results (fast path, no detail deep-dives)
  const savedIds: string[] = [];
  for (const listing of ranked) {
    const address = listing.address ?? "unknown";

    // Parse city/state/zip from address string (matching Python logic)
    const parts = address.split(",").map((p: string) => p.trim());
    const city = parts.length > 1 ? parts[1] : null;
    const stateZip = parts.length > 2 ? parts[2].trim().split(/\s+/) : [];
    const state = stateZip[0] ?? null;
    const zip = stateZip[1] ?? null;

    // Extract zillow_id from URL
    const url = listing.listing_url ?? "";
    const zpidMatch = url.match(/\/(\d+)_zpid/);
    const zillowId = zpidMatch ? zpidMatch[1] : null;

    const propertyData: Record<string, any> = {
      address,
      city,
      state,
      zip,
      listing_price: listing.price,
      beds: listing.beds,
      baths: listing.baths,
      sqft: listing.sqft,
      photos: listing.thumbnail_url ? [listing.thumbnail_url] : [],
      zillow_url: url,
      zillow_id: zillowId,
      listing_status: "active",
    };

    try {
      const propId = await saveProperty(agentId, taskId, propertyData);
      savedIds.push(propId);
      await logEvent(taskId, "property_saved", { property_id: propId, address });

      if (buyerId) {
        await linkPropertyToBuyer(buyerId, propId);
      }
    } catch (err: any) {
      await logEvent(taskId, "property_save_error", { error: err.message, address });
    }
  }

  const newOutputData = {
    ...outputData,
    property_ids: savedIds,
    properties_found: listings.length,
    properties_saved: savedIds.length,
  };

  if (savedIds.length === 0) {
    await updateTaskStatus(taskId, "completed", {
      output_data: { ...newOutputData, pipeline_stage: "complete" },
    });
    return { stage: "complete", status: "completed", liveUrl: null };
  }

  // Skip enrichment if flag is set — go straight to scoring
  if (outputData.skip_enrichment) {
    await logEvent(taskId, "stage_crossref_skipped", { reason: "skip_enrichment flag" });
    return startScoringStage(taskId, buyerId, newOutputData);
  }

  // Start enrichment
  await logEvent(taskId, "stage_crossref_start", { property_count: savedIds.length });
  return startEnrichmentStep(taskId, newOutputData, { type: "school", propIdx: 0 });
}

// ---------- Stage: Enrichment done ----------

async function handleEnrichmentDone(
  taskId: string,
  agentId: string,
  buyerId: string,
  outputData: Record<string, any>,
  buOutput: string | null
) {
  const result = parseJSON(buOutput) as Record<string, any> | null;
  const propIdx = outputData.enrichment_index ?? 0;
  const type: string = outputData.enrichment_type ?? "school";
  const propertyIds: string[] = outputData.property_ids ?? [];
  const propId = propertyIds[propIdx];

  // Save enrichment data
  if (result && propId) {
    const updates: Record<string, any> = {};
    if (type === "school") {
      updates.school_ratings = result;
    } else if (type === "walkscore") {
      if (result.walk_score != null) updates.walk_score = result.walk_score;
      if (result.transit_score != null) updates.transit_score = result.transit_score;
    } else if (type === "commute") {
      updates.commute_data = result;
    }

    if (Object.keys(updates).length > 0) {
      try {
        await saveEnrichment(propId, updates);
        await logEvent(taskId, "property_enriched", {
          property_id: propId,
          fields_updated: Object.keys(updates),
        });
      } catch (err: any) {
        await logEvent(taskId, `${type}_failed`, { error: err.message });
      }
    } else {
      await logEvent(taskId, "property_no_enrichment", { property_id: propId });
    }
  } else {
    await logEvent(taskId, `${type}_failed`, { error: "No data returned" });
  }

  // Determine next enrichment step
  const nextStep = getNextEnrichmentStep(type, propIdx, propertyIds.length, outputData);

  if (nextStep) {
    return startEnrichmentStep(taskId, outputData, nextStep);
  }

  // All enrichment done — start scoring
  return startScoringStage(taskId, outputData.buyer_id ?? "", outputData);
}

// ---------- Stage: LLM Scoring ----------

async function startScoringStage(
  taskId: string,
  buyerId: string,
  outputData: Record<string, any>
) {
  const propertyIds: string[] = outputData.property_ids ?? [];

  if (!buyerId || propertyIds.length === 0) {
    await logEvent(taskId, "pipeline_complete", {
      property_ids: propertyIds,
      enriched: 0,
      scored: 0,
    });
    await updateTaskStatus(taskId, "completed", {
      output_data: {
        ...outputData,
        pipeline_stage: "complete",
        properties_enriched: 0,
        properties_scored: 0,
      },
    });
    return { stage: "complete", status: "completed", liveUrl: null };
  }

  await logEvent(taskId, "stage_scoring_start", { property_count: propertyIds.length });
  await updateTaskStatus(taskId, "running", {
    output_data: {
      ...outputData,
      pipeline_stage: "scoring",
      bu_task_id: null,
      live_url: null,
    },
  });

  return { stage: "scoring", status: "running", liveUrl: null };
}

/**
 * Actually run the scoring (called when stage === "scoring").
 * This doesn't use Browser Use — it calls the LLM directly.
 */
async function handleScoringStage(
  taskId: string,
  buyerId: string,
  outputData: Record<string, any>
) {
  const propertyIds: string[] = outputData.property_ids ?? [];
  const adminSupabase = createAdminClient() as any;

  // Fetch buyer intent profile
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

  // Fetch properties
  const { data: properties } = await adminSupabase
    .from("properties")
    .select("*")
    .in("id", propertyIds);

  if (!properties || properties.length === 0) {
    await logEvent(taskId, "stage_scoring_failed", { error: "No properties to score" });
    return finishPipeline(taskId, outputData, 0);
  }

  // Score each property using existing LLM infrastructure
  let scoredCount = 0;
  const scoreResults: { property_id: string; match_score: number }[] = [];

  for (const property of properties) {
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
Walk Score: ${property.walk_score ?? "N/A"}
School Ratings: ${JSON.stringify(property.school_ratings)}
Amenities: ${JSON.stringify(property.amenities)}
Commute Data: ${JSON.stringify(property.commute_data)}
Description: ${property.listing_description ?? "N/A"}
`;

    try {
      const result = await llmJSON<{
        match_score: number;
        score_reasoning: string;
        score_breakdown: any;
      }>("property_scoring", PROPERTY_SCORING_PROMPT, context);

      if (typeof result.match_score !== "number") continue;

      await adminSupabase
        .from("buyer_property_scores")
        .upsert(
          {
            buyer_id: buyerId,
            property_id: property.id,
            match_score: result.match_score,
            score_reasoning: result.score_reasoning ?? "",
            score_breakdown: result.score_breakdown ?? {},
          },
          { onConflict: "buyer_id,property_id" }
        );

      scoredCount++;
      scoreResults.push({
        property_id: property.id,
        match_score: result.match_score,
      });
    } catch (err: any) {
      console.error(`Failed to score property ${property.id}:`, err.message);
    }
  }

  await logEvent(taskId, "stage_scoring_done", {
    scored: scoredCount,
    scores: scoreResults,
  });

  return finishPipeline(taskId, outputData, scoredCount);
}

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

  return { stage: "complete", status: "completed", liveUrl: null };
}

// ---------- Enrichment step management ----------

interface EnrichmentStep {
  type: "school" | "walkscore" | "commute";
  propIdx: number;
}

function getNextEnrichmentStep(
  currentType: string,
  currentPropIdx: number,
  totalProps: number,
  outputData: Record<string, any>
): EnrichmentStep | null {
  const types: ("school" | "walkscore" | "commute")[] = ["school", "walkscore"];
  if (outputData.workplace) types.push("commute");

  const typeIdx = types.indexOf(currentType as any);
  if (typeIdx >= 0 && typeIdx < types.length - 1) {
    return { type: types[typeIdx + 1], propIdx: currentPropIdx };
  }

  // Next property — limit to 5 for enrichment (BU Cloud tasks are expensive)
  const nextProp = currentPropIdx + 1;
  if (nextProp < totalProps && nextProp < 5) {
    return { type: "school", propIdx: nextProp };
  }

  return null;
}

async function startEnrichmentStep(
  taskId: string,
  outputData: Record<string, any>,
  step: EnrichmentStep
) {
  const propertyIds: string[] = outputData.property_ids ?? [];
  const propId = propertyIds[step.propIdx];

  // Get property address
  const adminSupabase = createAdminClient() as any;
  const { data: prop } = await adminSupabase
    .from("properties")
    .select("address, city, state, zip")
    .eq("id", propId)
    .single();

  if (!prop) {
    await logEvent(taskId, "property_not_found", { property_id: propId });
    const next = getNextEnrichmentStep(step.type, step.propIdx, propertyIds.length, outputData);
    if (next) return startEnrichmentStep(taskId, outputData, next);
    return startScoringStage(taskId, outputData.buyer_id ?? "", outputData);
  }

  const fullAddress = [prop.address, prop.city, prop.state, prop.zip]
    .filter(Boolean)
    .join(", ");

  let prompt: string;
  if (step.type === "school") {
    prompt = buildSchoolSearchPrompt(fullAddress);
  } else if (step.type === "walkscore") {
    prompt = buildWalkScorePrompt(fullAddress);
  } else {
    prompt = buildCommutePrompt(fullAddress, outputData.workplace);
  }

  await logEvent(taskId, "crossref_start", {
    index: step.propIdx + 1,
    total: propertyIds.length,
    address: fullAddress,
  });

  const buTask = await runTask(prompt);

  const updated = {
    ...outputData,
    pipeline_stage: "enrichment",
    enrichment_type: step.type,
    enrichment_index: step.propIdx,
    bu_task_id: buTask.taskId,
    bu_session_id: buTask.sessionId,
    live_url: buTask.liveUrl,
  };
  await updateTaskStatus(taskId, "running", { output_data: updated });

  return {
    stage: "enrichment",
    status: "running",
    liveUrl: buTask.liveUrl,
    enrichment_type: step.type,
    enrichment_index: step.propIdx,
  };
}

// ---------- Helpers ----------

function parsePrice(value: any): number {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const cleaned = value.replace(/[^\d]/g, "");
    return parseInt(cleaned, 10) || 0;
  }
  return 0;
}
