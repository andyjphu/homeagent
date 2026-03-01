import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { llmJSON } from "@/lib/llm/router";

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

  // Update buyer profile
  await supabase
    .from("buyers")
    .update({ intent_profile: intentProfile })
    .eq("id", buyer.id);

  // Check significance of change using Cerebras
  const oldProfile = buyer.intent_profile as any;
  const significance = await llmJSON<{ is_significant: boolean; reason: string }>(
    "significance_check",
    `You evaluate whether a change in a home buyer's search criteria is significant enough to warrant a new property search. A change is significant if it opens up meaningfully different listings (e.g., budget increased by >5%, bedroom count changed, new area added). Minor adjustments (small budget tweaks, cosmetic preference changes) are not significant. Respond with JSON: { "is_significant": boolean, "reason": "..." }`,
    `Old criteria: ${JSON.stringify(oldProfile)}\nNew criteria: ${JSON.stringify(intentProfile)}`
  );

  // If significant, add activity feed entry
  if (significance.is_significant) {
    await supabase.from("activity_feed").insert({
      agent_id: buyer.agent_id,
      event_type: "buyer_criteria_changed",
      buyer_id: buyer.id,
      title: `${buyer.full_name} updated search criteria`,
      description: significance.reason,
      is_action_required: true,
    });
  }

  return NextResponse.json({
    success: true,
    is_significant: significance.is_significant,
    reason: significance.reason,
  });
}
