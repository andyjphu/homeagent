import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createActivityEntry } from "@/lib/supabase/activity";

export async function POST(request: Request) {
  const supabase = (await createClient()) as any;
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { scoreId, sent } = await request.json();

  if (!scoreId || typeof sent !== "boolean") {
    return NextResponse.json(
      { error: "scoreId and sent (boolean) required" },
      { status: 400 }
    );
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

  // Create activity feed entry when sending to buyer
  if (sent) {
    try {
      const { data: scoreRecord } = await supabase
        .from("buyer_property_scores")
        .select(
          "buyer_id, property_id, properties(address), buyers(full_name, agent_id)"
        )
        .eq("id", scoreId)
        .single();

      if (scoreRecord?.buyers?.agent_id) {
        await createActivityEntry(
          scoreRecord.buyers.agent_id,
          "properties_sent",
          `Property sent to ${scoreRecord.buyers.full_name}`,
          scoreRecord.properties?.address || "Property",
          { score_id: scoreId },
          {
            buyerId: scoreRecord.buyer_id,
            propertyId: scoreRecord.property_id,
          }
        );
      }
    } catch {
      // Don't fail the main operation if activity entry fails
      console.error("[send-property] Failed to create activity entry");
    }
  }

  return NextResponse.json({ ok: true });
}
