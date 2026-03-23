import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  // Auth check via regular client
  const supabase = (await createClient()) as any;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Use admin client for DB operations to bypass RLS bootstrap issue
  const admin = createAdminClient() as any;

  const { data: agent } = await admin
    .from("agents")
    .select("id, brokerage_id")
    .eq("user_id", user.id)
    .single();
  if (!agent) return NextResponse.json({ error: "Agent not found" }, { status: 404 });

  if (agent.brokerage_id) {
    return NextResponse.json(
      { error: "Already part of a brokerage" },
      { status: 400 }
    );
  }

  const body = await request.json();
  const { name, logo_url, brand_colors } = body;

  if (!name?.trim()) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  // Create brokerage
  const { data: brokerage, error: brokerageErr } = await admin
    .from("brokerages")
    .insert({ name: name.trim(), logo_url: logo_url || null, brand_colors: brand_colors || {} })
    .select("id")
    .single();

  if (brokerageErr) {
    return NextResponse.json({ error: brokerageErr.message }, { status: 500 });
  }

  // Add current agent as admin
  const { error: memberErr } = await admin
    .from("brokerage_agents")
    .insert({ brokerage_id: brokerage.id, agent_id: agent.id, role: "admin" });

  if (memberErr) {
    return NextResponse.json({ error: memberErr.message }, { status: 500 });
  }

  // Set brokerage_id on agent
  await admin
    .from("agents")
    .update({ brokerage_id: brokerage.id })
    .eq("id", agent.id);

  return NextResponse.json({ brokerage_id: brokerage.id });
}
