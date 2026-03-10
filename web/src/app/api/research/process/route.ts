import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getTask } from "@/lib/browser-use/save-results";

/**
 * POST /api/research/process
 *
 * Returns the current status of a research/enrichment pipeline task.
 * Both the Python service and the API fallback update task status directly
 * in Supabase, so this endpoint simply reads the latest state.
 *
 * Called by the frontend polling loop every ~4s while a task is active.
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

  try {
    const task = await getTask(taskId);
    const outputData = task.output_data ?? {};

    return NextResponse.json({
      stage: outputData.pipeline_stage ?? "pending",
      status: task.status,
      service: outputData.service ?? null,
      propertyIds: outputData.property_ids ?? [],
      propertiesFound: outputData.properties_found ?? outputData.property_ids?.length ?? 0,
      propertiesEnriched: outputData.properties_enriched ?? 0,
      propertiesScored: outputData.properties_scored ?? 0,
      enrichmentProgress: outputData.enrichment_progress ?? null,
      enrichmentTotal: outputData.enrichment_total ?? null,
      errorMessage: task.error_message ?? outputData.error ?? null,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message },
      { status: 500 }
    );
  }
}
