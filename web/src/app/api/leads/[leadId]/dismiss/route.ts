import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ leadId: string }> }
) {
  const { leadId } = await params;
  const supabase = (await createClient()) as any;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: agent } = await supabase
    .from("agents")
    .select("id")
    .eq("user_id", user.id)
    .single();
  if (!agent) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }

  const { data: lead } = await supabase
    .from("leads")
    .select("id, name, status, agent_id")
    .eq("id", leadId)
    .eq("agent_id", agent.id)
    .single();

  if (!lead) {
    return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  }

  if (lead.status !== "draft") {
    return NextResponse.json(
      { error: "Lead is not in draft status" },
      { status: 400 }
    );
  }

  await supabase
    .from("leads")
    .update({ status: "dismissed" })
    .eq("id", lead.id);

  // Log activity
  await supabase.from("activity_feed").insert({
    agent_id: agent.id,
    event_type: "lead_dismissed",
    title: `Lead dismissed: ${lead.name || "Unknown"}`,
    metadata: { lead_id: lead.id },
  });

  return NextResponse.json({ success: true });
}
