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
    .select("id")
    .eq("dashboard_token", token)
    .single();

  if (!buyer) {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }

  const { propertyId, action, durationSeconds } = await request.json();

  const VALID_ACTIONS = ["view", "click", "dwell"];
  if (!propertyId || !action) {
    return NextResponse.json(
      { error: "propertyId and action required" },
      { status: 400 }
    );
  }

  if (!VALID_ACTIONS.includes(action)) {
    return NextResponse.json(
      { error: `action must be one of: ${VALID_ACTIONS.join(", ")}` },
      { status: 400 }
    );
  }

  if (action === "dwell" && (typeof durationSeconds !== "number" || durationSeconds < 0 || durationSeconds > 3600)) {
    return NextResponse.json(
      { error: "durationSeconds must be a number between 0 and 3600" },
      { status: 400 }
    );
  }

  // Get current score record — also verifies property belongs to this buyer
  const { data: score } = await supabase
    .from("buyer_property_scores")
    .select("id, view_count, total_dwell_seconds")
    .eq("buyer_id", buyer.id)
    .eq("property_id", propertyId)
    .eq("is_sent_to_buyer", true)
    .single();

  if (!score) {
    return NextResponse.json(
      { error: "Property score not found" },
      { status: 404 }
    );
  }

  // Update based on action type
  if (action === "view") {
    await supabase
      .from("buyer_property_scores")
      .update({ view_count: (score.view_count ?? 0) + 1 })
      .eq("id", score.id);
  } else if (action === "click") {
    await supabase
      .from("buyer_property_scores")
      .update({ view_count: (score.view_count ?? 0) + 1 })
      .eq("id", score.id);
  } else if (action === "dwell" && durationSeconds) {
    await supabase
      .from("buyer_property_scores")
      .update({
        total_dwell_seconds:
          (score.total_dwell_seconds ?? 0) + durationSeconds,
      })
      .eq("id", score.id);
  }

  // Update buyer last_activity_at
  await supabase
    .from("buyers")
    .update({ last_activity_at: new Date().toISOString() })
    .eq("id", buyer.id);

  return NextResponse.json({ success: true });
}
