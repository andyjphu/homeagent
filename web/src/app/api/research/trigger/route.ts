import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { logEvent, updateTaskStatus } from "@/lib/browser-use/save-results";
import { createActivityEntry } from "@/lib/supabase/activity";

const PYTHON_SERVICE_URL = process.env.BROWSER_AGENT_URL || "http://localhost:8000";

/**
 * POST /api/research/trigger
 *
 * Creates an agent_task for enrichment + scoring of a buyer's existing properties.
 * Attempts to delegate to the Python browser agent service. Falls back to
 * API-based enrichment if the service is unavailable.
 *
 * The primary workflow for adding properties is manual entry + auto-enrichment.
 * This research pipeline is supplementary infrastructure for browser-based
 * enrichment (schools, walkscore, commute) and LLM scoring.
 */
export async function POST(request: Request) {
  const supabase = (await createClient()) as any;
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { buyerId, agentId, intentProfile } = await request.json();

  if (!buyerId || !agentId) {
    return NextResponse.json({ error: "buyerId and agentId required" }, { status: 400 });
  }

  // Get buyer's existing property IDs
  const admin = createAdminClient() as any;
  const { data: scores } = await admin
    .from("buyer_property_scores")
    .select("property_id")
    .eq("buyer_id", buyerId);

  const propertyIds: string[] = (scores ?? []).map((s: { property_id: string }) => s.property_id);

  if (propertyIds.length === 0) {
    return NextResponse.json(
      { error: "No properties to research. Add properties manually first, then run enrichment." },
      { status: 400 }
    );
  }

  // Create task record
  const { data: task, error } = await supabase
    .from("agent_tasks")
    .insert({
      agent_id: agentId,
      buyer_id: buyerId,
      task_type: "enrichment_pipeline",
      input_params: {
        intent_profile: intentProfile,
        property_ids: propertyIds,
      },
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Add activity feed entry
  await createActivityEntry(
    agentId,
    "research_started",
    "Enrichment pipeline started",
    `Enriching ${propertyIds.length} properties with school/walkscore/commute data + scoring`,
    undefined,
    { buyerId, taskId: task.id }
  );

  await logEvent(task.id, "pipeline_start", {
    property_count: propertyIds.length,
    property_ids: propertyIds,
  });

  // Try to delegate to the Python browser agent service
  let serviceAvailable = false;
  try {
    const healthRes = await fetch(`${PYTHON_SERVICE_URL}/health`, {
      signal: AbortSignal.timeout(3000),
    });
    serviceAvailable = healthRes.ok;
  } catch {
    // Service not reachable
  }

  if (serviceAvailable) {
    // Delegate to Python service for browser-based enrichment
    try {
      const res = await fetch(`${PYTHON_SERVICE_URL}/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          task_id: task.id,
          agent_id: agentId,
          buyer_id: buyerId,
          task_type: "enrichment_pipeline",
          input_params: {
            intent_profile: intentProfile,
            property_ids: propertyIds,
          },
        }),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Python service returned ${res.status}: ${text}`);
      }

      await logEvent(task.id, "delegated_to_python_service", {
        property_count: propertyIds.length,
      });
      await updateTaskStatus(task.id, "running", {
        output_data: {
          pipeline_stage: "enrichment",
          property_ids: propertyIds,
          service: "python",
        },
      });

      return NextResponse.json({
        task,
        service: "python",
        propertyCount: propertyIds.length,
      });
    } catch (err: any) {
      console.error("Failed to delegate to Python service:", err);
      await logEvent(task.id, "python_service_failed", { error: err.message });
      // Fall through to API-based enrichment
    }
  }

  // Fallback: use API-based enrichment service directly
  await logEvent(task.id, "using_api_enrichment_fallback");
  await updateTaskStatus(task.id, "running", {
    output_data: {
      pipeline_stage: "enrichment",
      property_ids: propertyIds,
      service: "api_fallback",
      enrichment_progress: 0,
    },
  });

  // Fire off enrichment for each property (non-blocking)
  // The process endpoint will handle tracking and scoring
  triggerApiFallbackEnrichment(task.id, agentId, buyerId, propertyIds, intentProfile).catch(
    (err) => console.error("API fallback enrichment error:", err)
  );

  return NextResponse.json({
    task,
    service: "api_fallback",
    propertyCount: propertyIds.length,
    message: "Research service not available. Using API-based enrichment instead.",
  });
}

/**
 * Fallback: enrich properties via the API enrichment service,
 * then run LLM scoring. Updates task status as it progresses.
 */
async function triggerApiFallbackEnrichment(
  taskId: string,
  agentId: string,
  buyerId: string,
  propertyIds: string[],
  intentProfile: Record<string, unknown>
) {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  let enrichedCount = 0;

  // Enrich each property via the API endpoint
  for (let i = 0; i < propertyIds.length; i++) {
    const propId = propertyIds[i];
    try {
      const res = await fetch(`${baseUrl}/api/properties/${propId}/enrich`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (res.ok) {
        enrichedCount++;
        await logEvent(taskId, "property_enriched", {
          property_id: propId,
          index: i + 1,
          total: propertyIds.length,
        });
      } else {
        await logEvent(taskId, "enrichment_failed", {
          property_id: propId,
          error: `HTTP ${res.status}`,
        });
      }
    } catch (err: any) {
      await logEvent(taskId, "enrichment_failed", {
        property_id: propId,
        error: err.message,
      });
    }

    await updateTaskStatus(taskId, "running", {
      output_data: {
        pipeline_stage: "enrichment",
        property_ids: propertyIds,
        service: "api_fallback",
        enrichment_progress: i + 1,
        enrichment_total: propertyIds.length,
        properties_enriched: enrichedCount,
      },
    });
  }

  // Move to scoring stage
  await logEvent(taskId, "stage_scoring_start", { property_count: propertyIds.length });
  await updateTaskStatus(taskId, "running", {
    output_data: {
      pipeline_stage: "scoring",
      property_ids: propertyIds,
      service: "api_fallback",
      properties_enriched: enrichedCount,
    },
  });

  // Run LLM scoring
  let scoredCount = 0;
  try {
    const scoreRes = await fetch(`${baseUrl}/api/properties/score`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ buyerId, propertyIds }),
    });

    if (scoreRes.ok) {
      const data = await scoreRes.json();
      scoredCount = data.scores?.length ?? 0;
    }
  } catch (err: any) {
    await logEvent(taskId, "stage_scoring_failed", { error: err.message });
  }

  await logEvent(taskId, "stage_scoring_done", { scored: scoredCount });

  // Complete
  await logEvent(taskId, "pipeline_complete", {
    property_ids: propertyIds,
    enriched: enrichedCount,
    scored: scoredCount,
  });

  await updateTaskStatus(taskId, "completed", {
    output_data: {
      pipeline_stage: "complete",
      property_ids: propertyIds,
      properties_found: propertyIds.length,
      properties_enriched: enrichedCount,
      properties_scored: scoredCount,
      service: "api_fallback",
    },
  });

  await createActivityEntry(
    agentId,
    "research_completed",
    `Enrichment complete: ${propertyIds.length} properties, ${enrichedCount} enriched, ${scoredCount} scored`,
    undefined,
    { properties_found: propertyIds.length, properties_scored: scoredCount },
    { buyerId, taskId }
  );
}
