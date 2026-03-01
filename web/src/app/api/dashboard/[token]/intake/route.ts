import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(
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

  // Merge: only override fields the buyer actually filled in
  const existingProfile = (buyer.intent_profile || {}) as Record<string, unknown>;
  const merged: Record<string, unknown> = { ...existingProfile };

  for (const [key, value] of Object.entries(intentProfile)) {
    // Skip undefined, null, empty strings, and empty arrays
    if (
      value === undefined ||
      value === null ||
      value === "" ||
      (Array.isArray(value) && value.length === 0)
    ) {
      continue;
    }
    merged[key] = value;
  }

  // Update buyer profile and activity timestamp
  await supabase
    .from("buyers")
    .update({
      intent_profile: merged,
      last_activity_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", buyer.id);

  // Insert activity feed entry
  await supabase.from("activity_feed").insert({
    agent_id: buyer.agent_id,
    event_type: "buyer_updated",
    buyer_id: buyer.id,
    title: `${buyer.full_name} completed intake questionnaire`,
    description:
      "Buyer filled out their home search preferences. Review their updated profile to start curating properties.",
    is_action_required: true,
  });

  return NextResponse.json({ success: true });
}
