import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { detectRiskSignals } from "@/lib/deals/risk-signals";

export async function GET(
  _request: Request,
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

    const { data: deal, error } = await supabase
      .from("deals")
      .select("*, properties(address, listing_price, zip)")
      .eq("id", dealId)
      .single();

    if (error || !deal) {
      return NextResponse.json({ error: "Deal not found" }, { status: 404 });
    }

    const property = deal.properties as any;
    if (!property) {
      return NextResponse.json({ signals: [] });
    }

    const signals = await detectRiskSignals(
      {
        id: deal.id,
        current_offer_price: deal.current_offer_price,
        agreed_price: deal.agreed_price,
        closing_date: deal.closing_date,
        contingencies: deal.contingencies as Record<string, string> | null,
        stage: deal.stage,
      },
      {
        address: property.address,
        listing_price: property.listing_price,
        zip: property.zip,
      }
    );

    return NextResponse.json({ signals });
  } catch (err) {
    console.error("[deals/risks] Error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
