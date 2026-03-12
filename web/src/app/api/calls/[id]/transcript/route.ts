import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * PATCH /api/calls/[id]/transcript
 *
 * Submit a manual transcript for a call that couldn't be auto-transcribed.
 * Updates the communication record and re-triggers background processing.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = (await createClient()) as any;
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: callId } = await params;
  const { transcript } = await request.json();

  if (!transcript || typeof transcript !== "string" || !transcript.trim()) {
    return NextResponse.json(
      { error: "Transcript text is required" },
      { status: 400 }
    );
  }

  // Verify agent owns this call
  const { data: agent } = await supabase
    .from("agents")
    .select("id")
    .eq("user_id", user.id)
    .single();

  if (!agent) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }

  const admin = createAdminClient() as any;

  // Get the communication record
  const { data: call } = await admin
    .from("communications")
    .select("id, agent_id, ai_analysis, from_address, buyer_id")
    .eq("id", callId)
    .single();

  if (!call || call.agent_id !== agent.id) {
    return NextResponse.json({ error: "Call not found" }, { status: 404 });
  }

  const existingAnalysis = (call.ai_analysis || {}) as Record<string, unknown>;

  // Update the communication with the manual transcript
  await admin
    .from("communications")
    .update({
      raw_content: transcript.trim(),
      ai_analysis: {
        ...existingAnalysis,
        status: "transcribed",
        transcript_source: "manual",
      },
    })
    .eq("id", callId);

  // Re-trigger background processing
  const origin = request.headers.get("origin") || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  try {
    await fetch(`${origin}/api/calls/process`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        communicationId: callId,
        agentId: agent.id,
        hasAudio: !!existingAnalysis.storage_path,
        hasTranscript: true,
        transcriptText: transcript.trim(),
        callerPhone: call.from_address || "",
        callerName: typeof existingAnalysis.caller_name === "string" ? existingAnalysis.caller_name : null,
        buyerId: call.buyer_id || null,
        storagePath: typeof existingAnalysis.storage_path === "string" ? existingAnalysis.storage_path : null,
      }),
    });
  } catch {
    // Processing will still work — the transcript is saved
  }

  return NextResponse.json({ status: "processing" });
}
