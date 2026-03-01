import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createClient() as any;
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

  // Forward to Python Browser Agent service
  const browserAgentUrl = process.env.BROWSER_AGENT_URL || "http://localhost:8000";
  let backendReachable = true;
  try {
    const backendRes = await fetch(`${browserAgentUrl}/tasks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        task_id: task.id,
        agent_id: agentId,
        buyer_id: buyerId,
        task_type: taskType || "full_research_pipeline",
        input_params: {
          intent_profile: intentProfile,
        },
      }),
    });
    if (!backendRes.ok) {
      backendReachable = false;
    }
  } catch (err) {
    backendReachable = false;
    console.warn("Browser agent service not available:", err);
  }

  return NextResponse.json({ task, backendReachable });
}
