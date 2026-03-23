import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  const supabase = (await createClient()) as any;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient() as any;

  const { data: agent } = await admin
    .from("agents")
    .select("id, brokerage_id")
    .eq("user_id", user.id)
    .single();
  if (!agent?.brokerage_id) {
    return NextResponse.json({ error: "Not in a brokerage" }, { status: 400 });
  }

  const { data: brokerage } = await admin
    .from("brokerages")
    .select("*")
    .eq("id", agent.brokerage_id)
    .single();

  return NextResponse.json({ brokerage });
}

export async function PATCH(request: Request) {
  const supabase = (await createClient()) as any;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient() as any;

  const { data: agent } = await admin
    .from("agents")
    .select("id, brokerage_id")
    .eq("user_id", user.id)
    .single();
  if (!agent?.brokerage_id) {
    return NextResponse.json({ error: "Not in a brokerage" }, { status: 400 });
  }

  // Check admin
  const { data: membership } = await admin
    .from("brokerage_agents")
    .select("role")
    .eq("brokerage_id", agent.brokerage_id)
    .eq("agent_id", agent.id)
    .single();
  if (membership?.role !== "admin") {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const body = await request.json();
  const updates: Record<string, unknown> = {};
  if (body.name !== undefined) updates.name = body.name;
  if (body.logo_url !== undefined) updates.logo_url = body.logo_url;
  if (body.brand_colors !== undefined) updates.brand_colors = body.brand_colors;
  if (body.custom_domain !== undefined) updates.custom_domain = body.custom_domain;
  if (body.settings !== undefined) updates.settings = body.settings;

  const { error } = await admin
    .from("brokerages")
    .update(updates)
    .eq("id", agent.brokerage_id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
