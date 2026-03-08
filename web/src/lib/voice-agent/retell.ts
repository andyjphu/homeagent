/**
 * Retell AI webhook parsing and signature validation.
 *
 * Retell events: call_started, call_ended, call_analyzed
 * Signature: HMAC-SHA256 via x-retell-signature header
 * Docs: https://docs.retellai.com/features/webhook-overview
 */

import crypto from "crypto";
import type { NormalizedVoiceAgentPayload, WebhookParseResult } from "./types";

// --- Retell-specific payload types ---

interface RetellCallObject {
  call_id: string;
  agent_id?: string;
  call_type?: string;
  call_status?: string;
  from_number?: string;
  to_number?: string;
  direction?: string;
  start_timestamp?: number;
  end_timestamp?: number;
  duration_ms?: number;
  disconnection_reason?: string;
  transcript?: string;
  recording_url?: string;
  metadata?: Record<string, unknown>;
  retell_llm_dynamic_variables?: Record<string, unknown>;
  collected_dynamic_variables?: Record<string, unknown>;
  call_analysis?: {
    call_summary?: string;
    user_sentiment?: string;
    call_successful?: boolean;
    in_voicemail?: boolean;
    custom_analysis_data?: Record<string, unknown>;
  } | null;
}

interface RetellWebhookPayload {
  event: string;
  call: RetellCallObject;
}

/**
 * Validate Retell webhook signature using HMAC-SHA256.
 * Uses the RETELL_API_KEY as the secret (per Retell docs).
 */
export function validateRetellSignature(
  body: string,
  signature: string | null
): boolean {
  const apiKey = process.env.RETELL_API_KEY;
  if (!apiKey || !signature) return false;

  const expected = crypto
    .createHmac("sha256", apiKey)
    .update(body)
    .digest("hex");

  try {
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expected)
    );
  } catch {
    return false;
  }
}

/**
 * Parse and normalize a Retell webhook payload.
 */
export function parseRetellWebhook(
  body: RetellWebhookPayload
): WebhookParseResult {
  const { event, call } = body;

  if (!call?.call_id) {
    return { ok: false, reason: "Missing call_id in payload", status: 400 };
  }

  // Map Retell events to our normalized status
  let eventType: NormalizedVoiceAgentPayload["eventType"];
  switch (event) {
    case "call_started":
      eventType = "started";
      break;
    case "call_ended":
      eventType = "ended";
      break;
    case "call_analyzed":
      eventType = "analyzed";
      break;
    default:
      // Accept unknown events as "ended" to be safe
      eventType = "ended";
  }

  const durationMs = call.duration_ms ?? (
    call.start_timestamp && call.end_timestamp
      ? call.end_timestamp - call.start_timestamp
      : null
  );

  const analysis = call.call_analysis;

  const payload: NormalizedVoiceAgentPayload = {
    platform: "retell",
    eventType,
    callId: call.call_id,
    callerPhone: call.from_number || "",
    agentPhone: call.to_number || null,
    direction: call.direction === "outbound" ? "outbound" : "inbound",
    durationSeconds: durationMs != null ? Math.round(durationMs / 1000) : null,
    recordingUrl: call.recording_url || null,
    transcript: call.transcript || null,
    summary: analysis?.call_summary || null,
    sentiment: analysis?.user_sentiment || null,
    callSuccessful: analysis?.call_successful ?? null,
    isVoicemail: analysis?.in_voicemail ?? false,
    disconnectionReason: call.disconnection_reason || null,
    structuredData: analysis?.custom_analysis_data || call.collected_dynamic_variables || null,
    rawPayload: body as unknown as Record<string, unknown>,
    startedAt: call.start_timestamp
      ? new Date(call.start_timestamp).toISOString()
      : null,
    endedAt: call.end_timestamp
      ? new Date(call.end_timestamp).toISOString()
      : null,
  };

  return { ok: true, payload };
}
