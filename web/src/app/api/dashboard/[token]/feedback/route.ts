import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createActivityEntry } from "@/lib/supabase/activity";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const supabase = createAdminClient() as any;

  // Validate token
  const { data: buyer } = await supabase
    .from("buyers")
    .select("id, agent_id")
    .eq("dashboard_token", token)
    .single();

  if (!buyer) {
    return NextResponse.json({ error: "Invalid token" }, { status: 404 });
  }

  const propertyId = request.nextUrl.searchParams.get("propertyId");

  let query = supabase
    .from("showing_feedback")
    .select("*")
    .eq("buyer_id", buyer.id)
    .order("created_at", { ascending: false });

  if (propertyId) {
    query = query.eq("property_id", propertyId);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ feedback: data });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const supabase = createAdminClient() as any;

  // Validate token
  const { data: buyer } = await supabase
    .from("buyers")
    .select("id, agent_id, full_name")
    .eq("dashboard_token", token)
    .single();

  if (!buyer) {
    return NextResponse.json({ error: "Invalid token" }, { status: 404 });
  }

  const body = await request.json();
  const { propertyId, overallRating, tags, notes } = body;

  if (!propertyId) {
    return NextResponse.json({ error: "propertyId required" }, { status: 400 });
  }

  if (overallRating != null && (overallRating < 1 || overallRating > 5)) {
    return NextResponse.json({ error: "Rating must be 1-5" }, { status: 400 });
  }

  // Validate property exists and is sent to buyer
  const { data: score } = await supabase
    .from("buyer_property_scores")
    .select("id")
    .eq("buyer_id", buyer.id)
    .eq("property_id", propertyId)
    .eq("is_sent_to_buyer", true)
    .single();

  if (!score) {
    return NextResponse.json({ error: "Property not found" }, { status: 404 });
  }

  // Upsert feedback (one feedback per buyer-property pair)
  const { data: existing } = await supabase
    .from("showing_feedback")
    .select("id")
    .eq("buyer_id", buyer.id)
    .eq("property_id", propertyId)
    .single();

  let feedback;
  if (existing) {
    const { data, error } = await supabase
      .from("showing_feedback")
      .update({
        overall_rating: overallRating,
        tags: tags || [],
        notes: notes || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    feedback = data;
  } else {
    const { data, error } = await supabase
      .from("showing_feedback")
      .insert({
        buyer_id: buyer.id,
        property_id: propertyId,
        agent_id: buyer.agent_id,
        overall_rating: overallRating,
        tags: tags || [],
        notes: notes || null,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    feedback = data;
  }

  // Log activity
  await createActivityEntry(
    buyer.agent_id,
    "feedback_submitted",
    `${buyer.full_name} submitted showing feedback`,
    `Rating: ${overallRating}/5${tags?.length ? `, Tags: ${tags.join(", ")}` : ""}`,
    undefined,
    { buyerId: buyer.id, propertyId }
  );

  return NextResponse.json({ feedback });
}
