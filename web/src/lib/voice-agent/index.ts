/**
 * Voice Agent platform abstraction layer.
 *
 * Auto-detects whether a webhook came from Retell or Vapi,
 * validates the signature, and normalizes the payload.
 */

export type { NormalizedVoiceAgentPayload, VoiceAgentPlatform, WebhookParseResult } from "./types";

import type { WebhookParseResult, VoiceAgentPlatform } from "./types";
import { validateRetellSignature, parseRetellWebhook } from "./retell";
import { validateVapiSignature, parseVapiWebhook } from "./vapi";

interface WebhookRequest {
  body: string; // raw JSON body string
  headers: {
    get(name: string): string | null;
  };
}

/**
 * Detect which platform sent the webhook based on headers and payload shape.
 */
function detectPlatform(
  headers: WebhookRequest["headers"],
  parsedBody: Record<string, unknown>
): VoiceAgentPlatform | null {
  // Retell sends x-retell-signature header
  if (headers.get("x-retell-signature")) {
    return "retell";
  }

  // Vapi sends Authorization or x-vapi-signature
  if (headers.get("x-vapi-signature") || headers.get("authorization")) {
    return "vapi";
  }

  // Fallback: detect from payload shape
  if ("event" in parsedBody && "call" in parsedBody) {
    return "retell";
  }
  if ("message" in parsedBody) {
    return "vapi";
  }

  return null;
}

/**
 * Parse a voice agent webhook request from any supported platform.
 *
 * 1. Detects the platform (Retell or Vapi)
 * 2. Validates the webhook signature
 * 3. Parses and normalizes the payload
 */
export function parseVoiceAgentWebhook(req: WebhookRequest): WebhookParseResult {
  let parsedBody: Record<string, unknown>;
  try {
    parsedBody = JSON.parse(req.body);
  } catch {
    return { ok: false, reason: "Invalid JSON body", status: 400 };
  }

  const platform = detectPlatform(req.headers, parsedBody);
  if (!platform) {
    return { ok: false, reason: "Unable to detect voice agent platform", status: 400 };
  }

  // Validate signature
  if (platform === "retell") {
    const signature = req.headers.get("x-retell-signature");
    if (!validateRetellSignature(req.body, signature)) {
      return { ok: false, reason: "Invalid Retell webhook signature", status: 401 };
    }
    return parseRetellWebhook(parsedBody as unknown as Parameters<typeof parseRetellWebhook>[0]);
  }

  if (platform === "vapi") {
    const authHeader = req.headers.get("authorization");
    const sigHeader = req.headers.get("x-vapi-signature");
    if (!validateVapiSignature(req.body, authHeader, sigHeader)) {
      return { ok: false, reason: "Invalid Vapi webhook signature", status: 401 };
    }
    return parseVapiWebhook(parsedBody as unknown as Parameters<typeof parseVapiWebhook>[0]);
  }

  return { ok: false, reason: "Unsupported platform", status: 400 };
}

/**
 * Check if a voice agent platform is configured.
 */
export function getConfiguredPlatform(): VoiceAgentPlatform | null {
  if (process.env.RETELL_API_KEY) return "retell";
  if (process.env.VAPI_API_KEY) return "vapi";
  return null;
}
