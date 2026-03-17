import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createActivityEntry } from "@/lib/supabase/activity";

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

  const { propertyId, content } = await request.json();

  if (!propertyId) {
    return NextResponse.json({ error: "propertyId required" }, { status: 400 });
  }

  if (!content?.trim() || typeof content !== "string") {
    return NextResponse.json({ error: "Content required" }, { status: 400 });
  }

  if (content.trim().length > 2000) {
    return NextResponse.json(
      { error: "Comment must be under 2,000 characters" },
      { status: 400 }
    );
  }

  // Verify property was actually sent to this buyer
  const { data: scoreRecord } = await supabase
    .from("buyer_property_scores")
    .select("id")
    .eq("buyer_id", buyer.id)
    .eq("property_id", propertyId)
    .eq("is_sent_to_buyer", true)
    .single();

  if (!scoreRecord) {
    return NextResponse.json(
      { error: "Property not found in your shortlist" },
      { status: 403 }
    );
  }

  const { data: comment, error } = await supabase
    .from("buyer_comments")
    .insert({
      buyer_id: buyer.id,
      property_id: propertyId,
      content: content.trim(),
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Fetch property address for a useful activity title
  const { data: property } = await supabase
    .from("properties")
    .select("address")
    .eq("id", propertyId)
    .single();

  const address = property?.address ?? "a property";

  // Notify agent via activity feed
  await createActivityEntry(
    buyer.agent_id,
    "comment_added",
    `${buyer.full_name} commented on ${address}`,
    content.trim().slice(0, 200),
    undefined,
    { buyerId: buyer.id, propertyId, isActionRequired: true }
  );

  // Update buyer last activity
  await supabase
    .from("buyers")
    .update({ last_activity_at: new Date().toISOString() })
    .eq("id", buyer.id);

  return NextResponse.json({ comment });
}
