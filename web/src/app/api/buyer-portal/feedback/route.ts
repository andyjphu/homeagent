import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { portalToken, dealId, satisfactionScore, wouldRefer, testimonial } =
      body as {
        portalToken: string;
        dealId: string;
        satisfactionScore: number;
        wouldRefer: boolean | null;
        testimonial: string | null;
      };

    if (!portalToken || !dealId) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    if (
      typeof satisfactionScore !== "number" ||
      satisfactionScore < 1 ||
      satisfactionScore > 10
    ) {
      return NextResponse.json(
        { error: "Satisfaction score must be between 1 and 10" },
        { status: 400 }
      );
    }

    const supabase = createAdminClient() as any;

    // Validate portal token → buyer
    const { data: buyer } = await supabase
      .from("buyers")
      .select("id")
      .eq("dashboard_token", portalToken)
      .single();

    if (!buyer) {
      return NextResponse.json(
        { error: "Invalid portal token" },
        { status: 403 }
      );
    }

    // Verify deal belongs to this buyer and is closed
    const { data: deal } = await supabase
      .from("deals")
      .select("id, stage")
      .eq("id", dealId)
      .eq("buyer_id", buyer.id)
      .single();

    if (!deal) {
      return NextResponse.json(
        { error: "Deal not found" },
        { status: 404 }
      );
    }

    if (deal.stage !== "closed") {
      return NextResponse.json(
        { error: "Feedback can only be submitted for closed deals" },
        { status: 400 }
      );
    }

    // Store feedback on the deal
    const { error: updateError } = await supabase
      .from("deals")
      .update({
        satisfaction_score: satisfactionScore,
        // Store referral + testimonial in closing_checklist (JSONB) as feedback data
        closing_checklist: {
          feedback: {
            would_refer: wouldRefer,
            testimonial: testimonial ?? null,
            submitted_at: new Date().toISOString(),
          },
        },
        updated_at: new Date().toISOString(),
      })
      .eq("id", dealId);

    if (updateError) {
      console.error("[feedback] Update failed:", updateError.message);
      return NextResponse.json(
        { error: "Failed to save feedback" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[feedback] Error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
