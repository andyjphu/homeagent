import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { runTask } from "@/lib/browser-use/client";
import { buildZillowSearchPrompt } from "@/lib/browser-use/prompts";
import { logEvent, updateTaskStatus } from "@/lib/browser-use/save-results";

export async function POST(request: Request) {
  const supabase = (await createClient()) as any;
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { buyerId, agentId, intentProfile, taskType } = await request.json();

  // Create task record
  const { data: task, error } = await supabase
    .from("agent_tasks")
    .insert({
      agent_id: agentId,
      buyer_id: buyerId,
      task_type: taskType || "full_research_pipeline",
      input_params: {
        intent_profile: intentProfile,
      },
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Add activity feed entry
  await supabase.from("activity_feed").insert({
    agent_id: agentId,
    event_type: "research_started",
    buyer_id: buyerId,
    task_id: task.id,
    title: "Research started",
    description: "Property research pipeline triggered",
  });

  // Start Zillow search directly via Browser Use Cloud
  let liveUrl: string | null = null;
  try {
    const prompt = buildZillowSearchPrompt({
      location:
        intentProfile?.preferred_areas?.[0] ??
        intentProfile?.location ??
        intentProfile?.areas?.[0] ??
        "",
      price_min: intentProfile?.budget_min ?? intentProfile?.price_min ?? 300000,
      price_max: intentProfile?.budget_max ?? intentProfile?.price_max ?? 750000,
      beds_min: intentProfile?.beds_min ?? intentProfile?.min_beds ?? 3,
      baths_min: intentProfile?.baths_min ?? intentProfile?.min_baths ?? 2,
      home_type: intentProfile?.home_type ?? "",
    });

    await logEvent(task.id, "pipeline_start", intentProfile);
    await logEvent(task.id, "stage_zillow_start");

    const buTask = await runTask(prompt);

    await updateTaskStatus(task.id, "running", {
      output_data: {
        pipeline_stage: "zillow_search",
        bu_task_id: buTask.id,
        live_url: buTask.live_url,
        intent_profile: intentProfile,
        workplace: intentProfile?.workplace_address ?? null,
        skip_enrichment: false,
        buyer_id: buyerId,
      },
    });

    liveUrl = buTask.live_url;
  } catch (err: any) {
    console.error("Failed to start Browser Use task:", err);
    await logEvent(task.id, "stage_zillow_failed", { error: err.message });
    await updateTaskStatus(task.id, "failed", {
      output_data: { error: err.message },
      error_message: err.message,
    });

    return NextResponse.json({
      task,
      liveUrl: null,
      error: err.message,
    });
  }

  return NextResponse.json({ task, liveUrl });
}
