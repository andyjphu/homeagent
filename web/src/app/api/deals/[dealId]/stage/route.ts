import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createActivityEntry } from "@/lib/supabase/activity";
import type { DealStage } from "@/types/database";

const VALID_STAGES: DealStage[] = [
  "prospecting",
  "touring",
  "pre_offer",
  "negotiating",
  "under_contract",
  "inspection",
  "appraisal",
  "closing",
  "closed",
  "dead",
];

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ dealId: string }> }
) {
  try {
    const { dealId } = await params;
    const supabase = (await createClient()) as any;

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { stage } = body as { stage: DealStage };

    if (!stage || !VALID_STAGES.includes(stage)) {
      return NextResponse.json(
        { error: `Invalid stage. Must be one of: ${VALID_STAGES.join(", ")}` },
        { status: 400 }
      );
    }

    // Fetch deal with buyer/property for activity entry
    const { data: deal } = await supabase
      .from("deals")
      .select("*, buyers(full_name), properties(address)")
      .eq("id", dealId)
      .single();

    if (!deal) {
      return NextResponse.json({ error: "Deal not found" }, { status: 404 });
    }

    const previousStage = deal.stage as DealStage;
    if (previousStage === stage) {
      return NextResponse.json({ deal });
    }

    // Build update payload
    const updatePayload: Record<string, unknown> = {
      stage,
      updated_at: new Date().toISOString(),
    };

    // Set closed_at when moving to closed
    if (stage === "closed") {
      updatePayload.closed_at = new Date().toISOString();
    }

    // Clear closed_at if moving away from closed (e.g. reopening)
    if (previousStage === "closed" && stage !== "closed") {
      updatePayload.closed_at = null;
    }

    const { data: updatedDeal, error } = await supabase
      .from("deals")
      .update(updatePayload)
      .eq("id", dealId)
      .select("*")
      .single();

    if (error) {
      console.error("[deals/stage] Update failed:", error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // NOTE: The DB trigger `on_deal_stage_change` already creates a
    // 'deal_stage_changed' activity_feed entry and updates stage_history.
    // We only create additional entries for special event types the trigger
    // doesn't cover (deal_closed, deal_accepted).
    const buyerName = (deal.buyers as any)?.full_name ?? "Unknown";
    const propertyAddress = (deal.properties as any)?.address ?? "Unknown";

    if (stage === "closed") {
      await createActivityEntry(
        deal.agent_id,
        "deal_closed",
        `Deal closed: ${buyerName} × ${propertyAddress}`,
        `Stage changed from ${previousStage.replace(/_/g, " ")} to closed`,
        {
          dealId,
          previousStage,
          newStage: stage,
          buyerName,
          propertyAddress,
        },
        {
          buyerId: deal.buyer_id,
          propertyId: deal.property_id,
          dealId,
        }
      );
    }

    return NextResponse.json({ deal: updatedDeal });
  } catch (err) {
    console.error("[deals/stage] Unexpected error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
