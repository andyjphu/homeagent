import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const supabase = createAdminClient() as any;

  // Validate token — fetch agent_id for activity feed
  const { data: buyer } = await supabase
    .from("buyers")
    .select("id, agent_id, full_name")
    .eq("dashboard_token", token)
    .single();

  if (!buyer) {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }

  const { scoreId, isFavorited } = await request.json();

  if (!scoreId || typeof scoreId !== "string") {
    return NextResponse.json({ error: "scoreId required" }, { status: 400 });
  }

  if (typeof isFavorited !== "boolean") {
    return NextResponse.json({ error: "isFavorited must be a boolean" }, { status: 400 });
  }

  // Update favorite status with timestamp
  const { data: updated, error } = await supabase
    .from("buyer_property_scores")
    .update({
      is_favorited: isFavorited,
      favorited_at: isFavorited ? new Date().toISOString() : null,
    })
    .eq("id", scoreId)
    .eq("buyer_id", buyer.id)
    .select("property_id, properties(address)")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Notify agent via activity feed when buyer favorites a property
  if (isFavorited && updated) {
    const address = (updated.properties as any)?.address ?? "a property";
    await supabase.from("activity_feed").insert({
      agent_id: buyer.agent_id,
      event_type: "property_favorited",
      buyer_id: buyer.id,
      property_id: updated.property_id,
      title: `${buyer.full_name} favorited ${address}`,
      description: "Buyer marked this property as a favorite on their dashboard.",
      is_action_required: false,
    });
  }

  // Update buyer last activity
  await supabase
    .from("buyers")
    .update({ last_activity_at: new Date().toISOString() })
    .eq("id", buyer.id);

  return NextResponse.json({ success: true });
}
