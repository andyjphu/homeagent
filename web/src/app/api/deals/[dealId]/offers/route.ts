import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createActivityEntry } from "@/lib/supabase/activity";
import type { OfferType } from "@/types/database";

const VALID_OFFER_TYPES: OfferType[] = [
  "initial",
  "counter",
  "best_and_final",
  "accepted",
  "rejected",
];

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

    const { data: offers, error } = await supabase
      .from("offers")
      .select("*")
      .eq("deal_id", dealId)
      .order("round_number", { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ offers: offers ?? [] });
  } catch (err) {
    console.error("[offers] GET error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(
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
    const {
      offerType,
      price,
      closingDays,
      otherTerms,
      contingenciesWaived,
      responseDeadline,
    } = body as {
      offerType: OfferType;
      price: number;
      closingDays?: number;
      otherTerms?: string;
      contingenciesWaived?: string[];
      responseDeadline?: string;
    };

    if (!offerType || !VALID_OFFER_TYPES.includes(offerType)) {
      return NextResponse.json(
        { error: `Invalid offer type. Must be one of: ${VALID_OFFER_TYPES.join(", ")}` },
        { status: 400 }
      );
    }

    if (!price || price <= 0) {
      return NextResponse.json({ error: "Price is required and must be positive" }, { status: 400 });
    }

    // Fetch deal for context
    const { data: deal } = await supabase
      .from("deals")
      .select("*, buyers(full_name), properties(address)")
      .eq("id", dealId)
      .single();

    if (!deal) {
      return NextResponse.json({ error: "Deal not found" }, { status: 404 });
    }

    // Determine round number
    const { data: existingOffers } = await supabase
      .from("offers")
      .select("round_number")
      .eq("deal_id", dealId)
      .order("round_number", { ascending: false })
      .limit(1);

    const roundNumber =
      existingOffers && existingOffers.length > 0
        ? existingOffers[0].round_number + 1
        : 1;

    const { data: offer, error } = await supabase
      .from("offers")
      .insert({
        deal_id: dealId,
        round_number: roundNumber,
        offer_type: offerType,
        price,
        closing_days: closingDays ?? null,
        other_terms: otherTerms ?? null,
        contingencies_waived: contingenciesWaived ?? [],
        response_deadline: responseDeadline ?? null,
      })
      .select("*")
      .single();

    if (error) {
      console.error("[offers] Create failed:", error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Update deal's current_offer_price
    await supabase
      .from("deals")
      .update({
        current_offer_price: price,
        updated_at: new Date().toISOString(),
      })
      .eq("id", dealId);

    const buyerName = (deal.buyers as any)?.full_name ?? "Unknown";
    const propertyAddress = (deal.properties as any)?.address ?? "Unknown";

    const eventType =
      offerType === "counter" ? "counter_received" as const : "offer_submitted" as const;

    await createActivityEntry(
      deal.agent_id,
      eventType,
      `${offerType.replace(/_/g, " ")} offer: $${price.toLocaleString()} for ${propertyAddress}`,
      `Round ${roundNumber} ${offerType} offer by ${buyerName}`,
      {
        dealId,
        offerId: offer.id,
        roundNumber,
        offerType,
        price,
      },
      {
        buyerId: deal.buyer_id,
        propertyId: deal.property_id,
        dealId,
      }
    );

    return NextResponse.json({ offer }, { status: 201 });
  } catch (err) {
    console.error("[offers] POST error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
