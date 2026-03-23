import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createActivityEntry } from "@/lib/supabase/activity";

export async function POST(request: Request) {
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
  const { buyer_id, to_agent_id } = body;

  if (!buyer_id || !to_agent_id) {
    return NextResponse.json(
      { error: "buyer_id and to_agent_id are required" },
      { status: 400 }
    );
  }

  // Verify target agent is in same brokerage
  const { data: targetAgent } = await admin
    .from("brokerage_agents")
    .select("agent_id")
    .eq("brokerage_id", agent.brokerage_id)
    .eq("agent_id", to_agent_id)
    .single();
  if (!targetAgent) {
    return NextResponse.json(
      { error: "Target agent not in brokerage" },
      { status: 400 }
    );
  }

  // Get buyer and source agent info
  const { data: buyer } = await admin
    .from("buyers")
    .select("id, full_name, agent_id")
    .eq("id", buyer_id)
    .single();
  if (!buyer) {
    return NextResponse.json({ error: "Buyer not found" }, { status: 404 });
  }

  const fromAgentId = buyer.agent_id;

  // Get agent names for activity entry
  const [{ data: fromAgent }, { data: toAgent }] = await Promise.all([
    admin.from("agents").select("full_name").eq("id", fromAgentId).single(),
    admin.from("agents").select("full_name").eq("id", to_agent_id).single(),
  ]);

  // Transfer: update buyer and all related records
  const updates = await Promise.all([
    admin.from("buyers").update({ agent_id: to_agent_id }).eq("id", buyer_id),
    admin.from("deals").update({ agent_id: to_agent_id }).eq("agent_id", fromAgentId).eq("buyer_id", buyer_id),
    admin.from("communications").update({ agent_id: to_agent_id }).eq("agent_id", fromAgentId).eq("buyer_id", buyer_id),
  ]);

  const errors = updates.filter((u) => u.error);
  if (errors.length > 0) {
    return NextResponse.json(
      { error: "Partial transfer failure", details: errors.map((e) => e.error?.message) },
      { status: 500 }
    );
  }

  // Log activity for both agents
  const title = `${buyer.full_name} transferred from ${fromAgent?.full_name} to ${toAgent?.full_name}`;
  await Promise.all([
    createActivityEntry(fromAgentId, "buyer_transferred", title, undefined, {
      buyer_id,
      from_agent_id: fromAgentId,
      to_agent_id,
    }, { buyerId: buyer_id }),
    createActivityEntry(to_agent_id, "buyer_transferred", title, undefined, {
      buyer_id,
      from_agent_id: fromAgentId,
      to_agent_id,
    }, { buyerId: buyer_id }),
  ]);

  return NextResponse.json({ success: true });
}
