/**
 * Vapi AI webhook parsing and signature validation.
 *
 * Vapi event: end-of-call-report (main event we care about)
 * Signature: Bearer token via Authorization header, or HMAC via x-vapi-signature
 * Docs: https://docs.vapi.ai/server-url/events
 */

import crypto from "crypto";
import type { NormalizedVoiceAgentPayload, WebhookParseResult } from "./types";

// --- Vapi-specific payload types ---

interface VapiCallObject {
  id: string;
  orgId?: string;
  type?: string;
  status?: string;
  assistantId?: string;
  phoneNumberId?: string;
  phoneCallProvider?: string;
  startedAt?: number;
  endedAt?: number;
  from?: { phoneNumber?: string };
  to?: { phoneNumber?: string };
  customer?: { number?: string; name?: string };
  messages?: Array<{ role: string; message: string }>;
  costs?: Array<{ type: string; cost: number }>;
  costBreakdown?: { total?: number };
  analysis?: {
    summary?: string;
    structuredData?: Record<string, unknown>;
    successEvaluation?: string;
  };
  artifact?: {
    transcript?: string;
    recordingUrl?: string;
    stereoRecordingUrl?: string;
    messages?: Array<{ role: string; message: string }>;
  };
}

interface VapiWebhookPayload {
  message: {
    type: string;
    endedReason?: string;
    call?: VapiCallObject;
    artifact?: {
      transcript?: string;
      recordingUrl?: string;
      messages?: Array<{ role: string; message: string }>;
    };
    timestamp?: string;
  };
}

/**
 * Validate Vapi webhook using Bearer token or HMAC signature.
 */
export function validateVapiSignature(
  body: string,
  authHeader: string | null,
  signatureHeader: string | null
): boolean {
  const serverSecret = process.env.VAPI_SERVER_SECRET;
  if (!serverSecret) return false;

  // Method 1: Bearer token
  if (authHeader) {
    const token = authHeader.replace("Bearer ", "");
    return token === serverSecret;
  }

  // Method 2: HMAC-SHA256 signature
  if (signatureHeader) {
    const expected = crypto
      .createHmac("sha256", serverSecret)
      .update(body)
      .digest("hex");

    try {
      return crypto.timingSafeEqual(
        Buffer.from(signatureHeader),
        Buffer.from(expected)
      );
    } catch {
      return false;
    }
  }

  return false;
}

/**
 * Parse and normalize a Vapi webhook payload.
 */
export function parseVapiWebhook(
  body: VapiWebhookPayload
): WebhookParseResult {
  const msg = body.message;
  if (!msg?.type) {
    return { ok: false, reason: "Missing message.type in payload", status: 400 };
  }

  // We only process end-of-call-report for now
  if (msg.type !== "end-of-call-report") {
    return { ok: false, reason: `Ignoring event type: ${msg.type}`, status: 200 };
  }

  const call = msg.call;
  if (!call?.id) {
    return { ok: false, reason: "Missing call.id in payload", status: 400 };
  }

  const callerPhone =
    call.customer?.number ||
    call.from?.phoneNumber ||
    "";

  const durationSeconds =
    call.startedAt && call.endedAt
      ? Math.round((call.endedAt - call.startedAt) / 1000)
      : null;

  const transcript =
    msg.artifact?.transcript ||
    call.artifact?.transcript ||
    null;

  const recordingUrl =
    call.artifact?.recordingUrl ||
    msg.artifact?.recordingUrl ||
    null;

  const payload: NormalizedVoiceAgentPayload = {
    platform: "vapi",
    eventType: "analyzed", // end-of-call-report includes analysis
    callId: call.id,
    callerPhone,
    agentPhone: call.to?.phoneNumber || null,
    direction: call.type === "outboundPhoneCall" ? "outbound" : "inbound",
    durationSeconds,
    recordingUrl,
    transcript,
    summary: call.analysis?.summary || null,
    sentiment: null, // Vapi doesn't provide sentiment directly
    callSuccessful:
      call.analysis?.successEvaluation === "true" ? true :
      call.analysis?.successEvaluation === "false" ? false :
      null,
    isVoicemail: msg.endedReason === "voicemail",
    disconnectionReason: msg.endedReason || null,
    structuredData: call.analysis?.structuredData || null,
    rawPayload: body as unknown as Record<string, unknown>,
    startedAt: call.startedAt
      ? new Date(call.startedAt).toISOString()
      : null,
    endedAt: call.endedAt
      ? new Date(call.endedAt).toISOString()
      : null,
  };

  return { ok: true, payload };
}
