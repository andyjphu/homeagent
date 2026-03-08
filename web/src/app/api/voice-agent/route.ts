/**
 * GET /api/voice-agent
 *
 * Returns voice agent status: connected platform, phone number, and recent AI calls.
 * Uses the Retell or Vapi API to fetch the configured phone number.
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getConfiguredPlatform } from "@/lib/voice-agent";

export async function GET() {
  try {
    const supabase = await createClient() as any;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const platform = getConfiguredPlatform();
    if (!platform) {
      return NextResponse.json({
        connected: false,
        platform: null,
        phoneNumber: null,
        recentCalls: [],
      });
    }

    // Fetch phone number from platform
    let phoneNumber: string | null = null;
    try {
      phoneNumber = await fetchPlatformPhoneNumber(platform);
    } catch (err) {
      console.error("[voice-agent] Failed to fetch phone number:", err);
    }

    // Fetch recent AI receptionist calls
    const { data: agent } = await (supabase as any)
      .from("agents")
      .select("id")
      .eq("user_id", user.id)
      .single();

    let recentCalls: Array<Record<string, unknown>> = [];
    if (agent) {
      const admin = createAdminClient() as ReturnType<typeof createAdminClient>;
      const { data: calls } = await (admin as any)
        .from("communications")
        .select("id, from_address, duration_seconds, occurred_at, ai_analysis, lead_id")
        .eq("agent_id", agent.id)
        .eq("ai_analysis->>source", "ai_voice_agent")
        .order("occurred_at", { ascending: false })
        .limit(10);

      recentCalls = (calls || []).map((c: Record<string, unknown>) => {
        const analysis = (c.ai_analysis || {}) as Record<string, unknown>;
        const extraction = (analysis.extraction || {}) as Record<string, unknown>;
        return {
          id: c.id,
          callerPhone: c.from_address,
          callerName: extraction.caller_name || analysis.caller_name || null,
          durationSeconds: c.duration_seconds,
          occurredAt: c.occurred_at,
          confidence: extraction.urgency || analysis.sentiment || null,
          hasLead: !!c.lead_id,
          platform: analysis.platform,
        };
      });
    }

    return NextResponse.json({
      connected: true,
      platform,
      phoneNumber,
      recentCalls,
    });
  } catch (err) {
    console.error("[voice-agent] API error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * Fetch the configured phone number from the voice agent platform.
 */
async function fetchPlatformPhoneNumber(
  platform: "retell" | "vapi"
): Promise<string | null> {
  if (platform === "retell") {
    return fetchRetellPhoneNumber();
  }
  if (platform === "vapi") {
    return fetchVapiPhoneNumber();
  }
  return null;
}

async function fetchRetellPhoneNumber(): Promise<string | null> {
  const apiKey = process.env.RETELL_API_KEY;
  if (!apiKey) return null;

  const res = await fetch("https://api.retellai.com/v2/list-phone-numbers", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({}),
  });

  if (!res.ok) {
    // Try GET endpoint as fallback
    const fallback = await fetch("https://api.retellai.com/v2/get-phone-number", {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!fallback.ok) return null;
    const data = await fallback.json();
    return data.phone_number || null;
  }

  const data = await res.json();
  // Return the first phone number
  if (Array.isArray(data) && data.length > 0) {
    return data[0].phone_number || data[0].number || null;
  }
  return null;
}

async function fetchVapiPhoneNumber(): Promise<string | null> {
  const apiKey = process.env.VAPI_API_KEY;
  if (!apiKey) return null;

  const res = await fetch("https://api.vapi.ai/phone-number", {
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
  });

  if (!res.ok) return null;
  const data = await res.json();
  if (Array.isArray(data) && data.length > 0) {
    return data[0].number || data[0].phoneNumber || null;
  }
  return null;
}
