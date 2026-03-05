import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createActivityEntry } from "@/lib/supabase/activity";

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

  // Log activity when property is sent to buyer
  if (sent) {
    // Look up agent and score context for activity entry
    const { data: scoreData } = await supabase
      .from("buyer_property_scores")
      .select("buyer_id, property_id, properties(address)")
      .eq("id", scoreId)
      .single();

    if (scoreData) {
      const { data: agentData } = await supabase
        .from("agents")
        .select("id")
        .eq("user_id", user.id)
        .single();

      if (agentData) {
        await createActivityEntry(
          agentData.id,
          "properties_sent",
          `Property sent to buyer`,
          (scoreData.properties as Record<string, unknown>)?.address as string ?? "Property shared with buyer",
          undefined,
          { buyerId: scoreData.buyer_id, propertyId: scoreData.property_id }
        );
      }
    }
  }

  return NextResponse.json({ ok: true });
}
