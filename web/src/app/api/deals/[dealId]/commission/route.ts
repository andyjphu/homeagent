import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { calculateCommission } from "@/lib/brokerage/helpers";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ dealId: string }> }
) {
  const { dealId } = await params;
  const supabase = (await createClient()) as any;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient() as any;

  // Verify the user owns this deal (or is admin of the agent's brokerage)
  const { data: agent } = await admin
    .from("agents")
    .select("id")
    .eq("user_id", user.id)
    .single();
  if (!agent) return NextResponse.json({ error: "Agent not found" }, { status: 404 });

  const { data: commission } = await admin
    .from("deal_commissions")
    .select("*")
    .eq("deal_id", dealId)
    .single();

  return NextResponse.json({ commission: commission || null });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ dealId: string }> }
) {
  const { dealId } = await params;
  const supabase = (await createClient()) as any;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient() as any;

  const { data: agent } = await admin
    .from("agents")
    .select("id")
    .eq("user_id", user.id)
    .single();
  if (!agent) return NextResponse.json({ error: "Agent not found" }, { status: 404 });

  // Get deal to calculate expected amount
  const { data: deal } = await admin
    .from("deals")
    .select("agent_id, agreed_price")
    .eq("id", dealId)
    .single();
  if (!deal) return NextResponse.json({ error: "Deal not found" }, { status: 404 });

  const body = await request.json();
  const { commission_type, commission_value, notes } = body;

  if (!commission_type || commission_value == null) {
    return NextResponse.json(
      { error: "commission_type and commission_value are required" },
      { status: 400 }
    );
  }

  const expected_amount = calculateCommission(
    commission_type,
    commission_value,
    deal.agreed_price
  );

  const { data, error } = await admin
    .from("deal_commissions")
    .insert({
      deal_id: dealId,
      agent_id: deal.agent_id,
      commission_type,
      commission_value,
      expected_amount,
      notes: notes || null,
    })
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ commission: data });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ dealId: string }> }
) {
  const { dealId } = await params;
  const supabase = (await createClient()) as any;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient() as any;

  const body = await request.json();
  const updates: Record<string, unknown> = {};
  if (body.commission_type !== undefined) updates.commission_type = body.commission_type;
  if (body.commission_value !== undefined) updates.commission_value = body.commission_value;
  if (body.paid_amount !== undefined) updates.paid_amount = body.paid_amount;
  if (body.paid_at !== undefined) updates.paid_at = body.paid_at;
  if (body.notes !== undefined) updates.notes = body.notes;

  // Recalculate expected amount if type or value changed
  if (body.commission_type !== undefined || body.commission_value !== undefined) {
    const { data: deal } = await admin
      .from("deals")
      .select("agreed_price")
      .eq("id", dealId)
      .single();

    const { data: existing } = await admin
      .from("deal_commissions")
      .select("commission_type, commission_value")
      .eq("deal_id", dealId)
      .single();

    const type = body.commission_type ?? existing?.commission_type;
    const value = body.commission_value ?? existing?.commission_value;
    updates.expected_amount = calculateCommission(type, value, deal?.agreed_price);
  }

  const { error } = await admin
    .from("deal_commissions")
    .update(updates)
    .eq("deal_id", dealId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
