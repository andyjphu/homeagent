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

  const { scoreId, isFavorited } = await request.json();

  const { error } = await supabase
    .from("buyer_property_scores")
    .update({ is_favorited: isFavorited })
    .eq("id", scoreId)
    .eq("buyer_id", buyer.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
