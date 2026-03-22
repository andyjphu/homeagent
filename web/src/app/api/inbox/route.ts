import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const supabase = (await createClient()) as any;
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: agent } = await supabase
    .from("agents")
    .select("id")
    .eq("user_id", user.id)
    .single();

  if (!agent) {
    return NextResponse.json({ error: "No agent" }, { status: 404 });
  }

  const url = new URL(request.url);
  const typeFilter = url.searchParams.get("type"); // email | call | sms | note
  const buyerId = url.searchParams.get("buyer_id");
  const limit = Math.min(parseInt(url.searchParams.get("limit") || "50"), 200);
  const offset = parseInt(url.searchParams.get("offset") || "0");

  let query = supabase
    .from("communications")
    .select(
      "id, type, direction, buyer_id, deal_id, lead_id, subject, raw_content, from_address, to_address, duration_seconds, recording_url, classification, ai_analysis, gmail_message_id, is_processed, occurred_at, created_at, buyers:buyer_id(id, full_name, email)",
      { count: "exact" }
    )
    .eq("agent_id", agent.id)
    .order("occurred_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (typeFilter && ["email", "call", "sms", "note"].includes(typeFilter)) {
    query = query.eq("type", typeFilter);
  }

  if (buyerId) {
    query = query.eq("buyer_id", buyerId);
  }

  const { data: communications, count, error } = await query;

  if (error) {
    console.error("[inbox] Query failed:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Get unique buyers for filter dropdown
  const { data: buyers } = await supabase
    .from("buyers")
    .select("id, full_name, email")
    .eq("agent_id", agent.id)
    .order("full_name");

  return NextResponse.json({
    communications: communications ?? [],
    buyers: buyers ?? [],
    total: count ?? 0,
  });
}
