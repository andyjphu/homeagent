import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createActivityEntry } from "@/lib/supabase/activity";

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

  if (!intentProfile || typeof intentProfile !== "object") {
    return NextResponse.json({ error: "intentProfile object required" }, { status: 400 });
  }

  if (JSON.stringify(intentProfile).length > 10_000) {
    return NextResponse.json({ error: "Payload too large" }, { status: 400 });
  }

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

  // Insert activity feed entry with intake details for notification email
  await createActivityEntry(
    buyer.agent_id,
    "buyer_updated",
    `${buyer.full_name} completed intake questionnaire`,
    "Buyer filled out their home search preferences. Review their updated profile to start curating properties.",
    {
      budget: merged.budget ?? null,
      beds: merged.beds ?? null,
      areas: merged.preferred_areas ?? null,
      timeline: merged.timeline ?? null,
    },
    { buyerId: buyer.id, isActionRequired: true }
  );

  return NextResponse.json({ success: true });
}
