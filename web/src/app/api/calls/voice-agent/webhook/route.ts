/**
 * POST /api/calls/voice-agent/webhook
 *
 * Receives end-of-call webhooks from Vapi or Retell.
 * Validates signature, creates communication record + draft lead,
 * triggers extraction pipeline, and logs to activity feed.
 */

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createActivityEntry } from "@/lib/supabase/activity";
import { parseVoiceAgentWebhook } from "@/lib/voice-agent";
import type { NormalizedVoiceAgentPayload } from "@/lib/voice-agent";

export const maxDuration = 60;

export async function POST(request: Request) {
  // Read body as text for signature validation
  const bodyText = await request.text();

  const result = parseVoiceAgentWebhook({
    body: bodyText,
    headers: request.headers,
  });

  if (!result.ok) {
    // Return 200 for ignored events (like call_started), error status for real failures
    const isIgnored = result.status === 200;
    if (isIgnored) {
      console.log(`[voice-agent-webhook] ${result.reason}`);
      return NextResponse.json({ status: "ignored", reason: result.reason });
    }
    console.error(`[voice-agent-webhook] Rejected: ${result.reason}`);
    return NextResponse.json(
      { error: result.reason },
      { status: result.status }
    );
  }

  const payload = result.payload;

  // Skip call_started events — we only care about ended/analyzed
  if (payload.eventType === "started") {
    return NextResponse.json({ status: "ack" });
  }

  // For Retell: call_ended fires before analysis is ready.
  // We still process it (creates the record), but call_analyzed will update it.
  // For Vapi: end-of-call-report already includes analysis.

  try {
    await processVoiceAgentCall(payload, request.url);
    return NextResponse.json({ status: "ok" });
  } catch (err) {
    console.error("[voice-agent-webhook] Processing error:", err);
    return NextResponse.json(
      { error: "Processing failed" },
      { status: 500 }
    );
  }
}

async function processVoiceAgentCall(
  payload: NormalizedVoiceAgentPayload,
  requestUrl: string
) {
  const admin = createAdminClient() as ReturnType<typeof createAdminClient>;

  // Find the agent — try matching by phone number first, then fall back to most recently active
  let agent: { id: string; full_name: string; notification_preferences: unknown } | null = null;

  if (payload.agentPhone) {
    // Try to match agent by their registered phone number
    const { data: phoneMatch } = await (admin as any)
      .from("agents")
      .select("id, full_name, notification_preferences")
      .eq("phone", payload.agentPhone)
      .limit(1)
      .maybeSingle();
    if (phoneMatch) agent = phoneMatch;
  }

  if (!agent) {
    // Fallback: get the most recently updated agent (most likely the active one)
    const { data: fallback } = await (admin as any)
      .from("agents")
      .select("id, full_name, notification_preferences")
      .order("updated_at", { ascending: false })
      .limit(1)
      .single();
    agent = fallback;
  }

  if (!agent) {
    console.error("[voice-agent-webhook] No agent found in database");
    return;
  }

  // Check if this call already has a communication record (Retell sends call_ended then call_analyzed)
  const { data: existingComm } = await (admin as any)
    .from("communications")
    .select("id")
    .eq("agent_id", agent.id)
    .eq("ai_analysis->>voice_agent_call_id", payload.callId)
    .maybeSingle();

  if (existingComm && payload.eventType === "analyzed") {
    // Update existing record with analysis data
    await updateExistingCommunication(admin, existingComm.id, payload, agent.id, requestUrl);
    return;
  }

  if (existingComm) {
    // Already have a record for this call_ended event, skip duplicate
    console.log(`[voice-agent-webhook] Duplicate event for call ${payload.callId}, skipping`);
    return;
  }

  // Determine caller display name
  const callerName = extractCallerName(payload);
  const displayLabel = callerName || payload.callerPhone || "Unknown caller";

  // Create communication record
  const { data: comm, error: commError } = await (admin as any)
    .from("communications")
    .insert({
      agent_id: agent.id,
      type: "call",
      direction: payload.direction,
      from_address: payload.callerPhone || null,
      to_address: payload.agentPhone || null,
      duration_seconds: payload.durationSeconds,
      recording_url: payload.recordingUrl,
      subject: `AI Receptionist: ${displayLabel}`,
      raw_content: payload.transcript || null,
      is_processed: false,
      occurred_at: payload.startedAt || new Date().toISOString(),
      classification: "new_lead",
      ai_analysis: {
        status: payload.transcript ? "transcribed" : "awaiting_transcription",
        source: "ai_voice_agent",
        platform: payload.platform,
        voice_agent_call_id: payload.callId,
        caller_name: callerName,
        summary: payload.summary,
        sentiment: payload.sentiment,
        call_successful: payload.callSuccessful,
        is_voicemail: payload.isVoicemail,
        disconnection_reason: payload.disconnectionReason,
        structured_data: payload.structuredData,
      },
    })
    .select("id")
    .single();

  if (commError) {
    console.error("[voice-agent-webhook] Failed to create communication:", commError);
    return;
  }

  // Create activity entry
  const confidenceLabel = payload.transcript ? "with transcript" : "recording only";
  await createActivityEntry(
    agent.id,
    "call_completed",
    `New call from ${displayLabel} — AI Receptionist`,
    payload.summary || `${payload.platform} AI receptionist handled call (${confidenceLabel})`,
    {
      source: "ai_voice_agent",
      platform: payload.platform,
      duration_seconds: payload.durationSeconds,
      has_transcript: !!payload.transcript,
      is_voicemail: payload.isVoicemail,
      sentiment: payload.sentiment,
    },
    { communicationId: comm.id, isActionRequired: true }
  );

  // Trigger extraction pipeline if we have a transcript
  if (payload.transcript) {
    const processUrl = new URL("/api/calls/process", requestUrl);
    try {
      fetch(processUrl.toString(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          communicationId: comm.id,
          agentId: agent.id,
          hasAudio: !!payload.recordingUrl,
          hasTranscript: true,
          transcriptText: payload.transcript,
          callerPhone: payload.callerPhone || "",
          callerName,
          buyerId: null,
          storagePath: null,
        }),
      }).catch((err: unknown) => {
        console.error("[voice-agent-webhook] Failed to trigger processing:", err);
      });
    } catch {
      // Non-blocking
    }
  } else {
    // No transcript — mark as processed with what we have
    await (admin as any)
      .from("communications")
      .update({
        is_processed: true,
        processed_at: new Date().toISOString(),
      })
      .eq("id", comm.id);

    // Still create a draft lead from structured data or phone number
    await createDraftLead(admin, agent.id, comm.id, payload, callerName);
  }

  console.log(
    `[voice-agent-webhook] Processed ${payload.platform} call ${payload.callId}: comm=${comm.id}`
  );
}

/**
 * Update an existing communication record when Retell sends call_analyzed after call_ended.
 */
async function updateExistingCommunication(
  admin: ReturnType<typeof createAdminClient>,
  commId: string,
  payload: NormalizedVoiceAgentPayload,
  agentId: string,
  requestUrl: string
) {
  const callerName = extractCallerName(payload);

  await (admin as any)
    .from("communications")
    .update({
      raw_content: payload.transcript || undefined,
      recording_url: payload.recordingUrl || undefined,
      duration_seconds: payload.durationSeconds || undefined,
      ai_analysis: {
        status: payload.transcript ? "transcribed" : "processed",
        source: "ai_voice_agent",
        platform: payload.platform,
        voice_agent_call_id: payload.callId,
        caller_name: callerName,
        summary: payload.summary,
        sentiment: payload.sentiment,
        call_successful: payload.callSuccessful,
        is_voicemail: payload.isVoicemail,
        disconnection_reason: payload.disconnectionReason,
        structured_data: payload.structuredData,
      },
    })
    .eq("id", commId);

  // Trigger extraction if we now have a transcript
  if (payload.transcript) {
    const processUrl = new URL("/api/calls/process", requestUrl);
    try {
      fetch(processUrl.toString(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          communicationId: commId,
          agentId,
          hasAudio: !!payload.recordingUrl,
          hasTranscript: true,
          transcriptText: payload.transcript,
          callerPhone: payload.callerPhone || "",
          callerName,
          buyerId: null,
          storagePath: null,
        }),
      }).catch((err: unknown) => {
        console.error("[voice-agent-webhook] Failed to trigger processing for update:", err);
      });
    } catch {
      // Non-blocking
    }
  }

  console.log(
    `[voice-agent-webhook] Updated existing comm ${commId} with analyzed data`
  );
}

/**
 * Create a draft lead from voice agent data when no transcript is available.
 */
async function createDraftLead(
  admin: ReturnType<typeof createAdminClient>,
  agentId: string,
  commId: string,
  payload: NormalizedVoiceAgentPayload,
  callerName: string | null
) {
  const name = callerName || (payload.callerPhone ? `Caller ${payload.callerPhone}` : "Unknown caller");
  const structured = payload.structuredData || {};

  const { data: lead } = await (admin as any)
    .from("leads")
    .insert({
      agent_id: agentId,
      source: "call" as const,
      status: "draft" as const,
      confidence: "low" as const,
      name,
      phone: payload.callerPhone || null,
      email: (structured as Record<string, unknown>).email as string || null,
      raw_source_content: payload.summary || `AI receptionist call via ${payload.platform}`,
      extracted_info: {
        summary: payload.summary,
        sentiment: payload.sentiment,
        platform: payload.platform,
        structured_data: payload.structuredData,
      },
      source_communication_id: commId,
    })
    .select("id")
    .single();

  if (lead) {
    await (admin as any)
      .from("communications")
      .update({ lead_id: lead.id })
      .eq("id", commId);
  }
}

/**
 * Try to extract caller name from structured data.
 */
function extractCallerName(payload: NormalizedVoiceAgentPayload): string | null {
  const sd = payload.structuredData;
  if (!sd) return null;

  // Check common field names for name
  const nameFields = ["name", "Name", "caller_name", "callerName", "customer_name", "customerName"];
  for (const field of nameFields) {
    if (typeof sd[field] === "string" && sd[field]) {
      return sd[field] as string;
    }
  }

  return null;
}
