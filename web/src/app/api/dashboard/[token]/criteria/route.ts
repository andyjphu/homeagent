import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { llmJSON } from "@/lib/llm/router";
import { createActivityEntry } from "@/lib/supabase/activity";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const supabase = createAdminClient() as any;

  // Validate token
  const { data: buyer } = await supabase
    .from("buyers")
    .select("*")
    .eq("dashboard_token", token)
    .single();

  if (!buyer) {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }

  const { intentProfile } = await request.json();

  if (!intentProfile || typeof intentProfile !== "object") {
    return NextResponse.json({ error: "intentProfile object required" }, { status: 400 });
  }

  // Guard: reject payloads over 10KB to prevent abuse
  if (JSON.stringify(intentProfile).length > 10_000) {
    return NextResponse.json({ error: "Payload too large" }, { status: 400 });
  }

  // Update buyer profile and activity timestamp
  await supabase
    .from("buyers")
    .update({
      intent_profile: intentProfile,
      last_activity_at: new Date().toISOString(),
    })
    .eq("id", buyer.id);

  // Try LLM significance check — degrade gracefully if unavailable
  let isSignificant = true;
  let reason = "Buyer updated their search criteria.";

  try {
    const oldProfile = buyer.intent_profile as any;
    const significance = await llmJSON<{ is_significant: boolean; reason: string }>(
      "significance_check",
      `You evaluate whether a change in a home buyer's search criteria is significant enough to warrant a new property search. A change is significant if it opens up meaningfully different listings (e.g., budget increased by >5%, bedroom count changed, new area added). Minor adjustments (small budget tweaks, cosmetic preference changes) are not significant. Respond with JSON: { "is_significant": boolean, "reason": "..." }`,
      `Old criteria: ${JSON.stringify(oldProfile)}\nNew criteria: ${JSON.stringify(intentProfile)}`
    );
    isSignificant = significance.is_significant;
    reason = significance.reason;
  } catch {
    // LLM unavailable — default to treating all changes as significant
    // so the agent is always notified. Better safe than silent.
  }

  // Always notify agent when criteria change is significant
  if (isSignificant) {
    await createActivityEntry(
      buyer.agent_id,
      "buyer_criteria_changed",
      `${buyer.full_name} updated search criteria`,
      reason,
      undefined,
      { buyerId: buyer.id, isActionRequired: true }
    );
  }

  return NextResponse.json({
    success: true,
    is_significant: isSignificant,
    reason,
  });
}
