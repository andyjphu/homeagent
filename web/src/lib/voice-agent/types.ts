/**
 * Platform-agnostic types for voice agent webhook payloads.
 * Supports Retell and Vapi — the abstraction layer normalizes
 * platform-specific payloads into these shared types.
 */

export type VoiceAgentPlatform = "retell" | "vapi";

export type VoiceAgentCallStatus =
  | "started"
  | "ended"
  | "analyzed"
  | "error";

/**
 * Normalized webhook payload from any voice agent platform.
 */
export interface NormalizedVoiceAgentPayload {
  platform: VoiceAgentPlatform;
  eventType: VoiceAgentCallStatus;

  /** Platform-specific call ID */
  callId: string;

  /** Caller phone in E.164 format (e.g. "+15551234567") */
  callerPhone: string;

  /** AI receptionist phone number that was called */
  agentPhone: string | null;

  /** Call direction */
  direction: "inbound" | "outbound";

  /** Call duration in seconds */
  durationSeconds: number | null;

  /** URL to the call recording (may expire — download promptly) */
  recordingUrl: string | null;

  /** Full conversation transcript as plain text */
  transcript: string | null;

  /** AI-generated call summary */
  summary: string | null;

  /** Caller sentiment */
  sentiment: string | null;

  /** Whether the call was successful per the AI's evaluation */
  callSuccessful: boolean | null;

  /** Whether voicemail was detected */
  isVoicemail: boolean;

  /** Why the call ended */
  disconnectionReason: string | null;

  /** Structured data extracted by the AI during/after the call */
  structuredData: Record<string, unknown> | null;

  /** Raw platform-specific payload for debugging */
  rawPayload: Record<string, unknown>;

  /** Timestamp when the call started (ISO string) */
  startedAt: string | null;

  /** Timestamp when the call ended (ISO string) */
  endedAt: string | null;
}

/**
 * Result of webhook parsing — either success or a rejection.
 */
export type WebhookParseResult =
  | { ok: true; payload: NormalizedVoiceAgentPayload }
  | { ok: false; reason: string; status: number };
