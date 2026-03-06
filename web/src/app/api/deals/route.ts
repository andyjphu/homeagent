import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createActivityEntry } from "@/lib/supabase/activity";
import type { DealStage } from "@/types/database";

export async function POST(request: Request) {
  try {
    const supabase = (await createClient()) as ReturnType<
      typeof createClient
    > extends Promise<infer T> ? T : never;
    const sb = supabase as any;

    const {
      data: { user },
    } = await sb.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: agent } = await sb
      .from("agents")
      .select("id")
      .eq("user_id", user.id)
      .single();
    if (!agent) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }

    const body = await request.json();
    const { buyerId, propertyId, stage } = body as {
      buyerId: string;
      propertyId: string;
      stage?: DealStage;
    };

    if (!buyerId || !propertyId) {
      return NextResponse.json(
        { error: "buyerId and propertyId are required" },
        { status: 400 }
      );
    }

    // Check for existing active deal on same buyer+property
    const { data: existing } = await sb
      .from("deals")
      .select("id, stage")
      .eq("buyer_id", buyerId)
      .eq("property_id", propertyId)
      .not("stage", "in", '("closed","dead")')
      .limit(1);

    if (existing && existing.length > 0) {
      return NextResponse.json(
        { error: "An active deal already exists for this buyer and property", dealId: existing[0].id },
        { status: 409 }
      );
    }

    const { data: deal, error } = await sb
      .from("deals")
      .insert({
        agent_id: agent.id,
        buyer_id: buyerId,
        property_id: propertyId,
        stage: stage ?? "prospecting",
      })
      .select("*")
      .single();

    if (error) {
      console.error("[deals] Create failed:", error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Fetch buyer/property names for the activity entry
    const [{ data: buyer }, { data: property }] = await Promise.all([
      sb.from("buyers").select("full_name").eq("id", buyerId).single(),
      sb.from("properties").select("address").eq("id", propertyId).single(),
    ]);

    await createActivityEntry(
      agent.id,
      "deal_created",
      `Deal started: ${buyer?.full_name ?? "Unknown"} × ${property?.address ?? "Unknown"}`,
      `New deal created at stage: ${deal.stage}`,
      { dealId: deal.id, buyerId, propertyId, stage: deal.stage },
      { buyerId, propertyId, dealId: deal.id }
    );

    return NextResponse.json({ deal }, { status: 201 });
  } catch (err) {
    console.error("[deals] Unexpected error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
