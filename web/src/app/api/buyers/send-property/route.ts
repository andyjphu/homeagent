import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createClient() as any;
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { scoreId, sent } = await request.json();

  if (!scoreId || typeof sent !== "boolean") {
    return NextResponse.json({ error: "scoreId and sent (boolean) required" }, { status: 400 });
  }

  const { error } = await supabase
    .from("buyer_property_scores")
    .update({
      is_sent_to_buyer: sent,
      sent_at: sent ? new Date().toISOString() : null,
    })
    .eq("id", scoreId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
