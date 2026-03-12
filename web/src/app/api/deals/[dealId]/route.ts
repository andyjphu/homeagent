import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { syncDealToCalendar } from "@/lib/calendar/sync";

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

    // Only allow updating specific fields
    const allowedFields = [
      "contract_date",
      "closing_date",
      "earnest_money",
      "agreed_price",
      "contingencies",
      "inspection_report_url",
      "appraised_value",
    ];

    const updates: Record<string, unknown> = {};
    for (const field of allowedFields) {
      if (field in body) {
        updates[field] = body[field];
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
    }

    updates.updated_at = new Date().toISOString();

    const { data: deal, error } = await supabase
      .from("deals")
      .update(updates)
      .eq("id", dealId)
      .select("*")
      .single();

    if (error) {
      console.error("[deals] PATCH failed:", error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Fire-and-forget calendar sync if deadline fields were updated
    if ("closing_date" in updates || "contingencies" in updates) {
      try {
        const { data: related } = await supabase
          .from("deals")
          .select("agent_id, buyers(full_name), properties(address)")
          .eq("id", dealId)
          .single();
        if (related) {
          const buyerName =
            (related.buyers as any)?.full_name ?? "Unknown";
          const addr =
            (related.properties as any)?.address ?? "Unknown";
          syncDealToCalendar(
            related.agent_id,
            dealId,
            deal,
            buyerName,
            addr
          ).catch(console.error);
        }
      } catch {
        // Silently ignore calendar sync errors
      }
    }

    return NextResponse.json({ deal });
  } catch (err) {
    console.error("[deals] PATCH error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
