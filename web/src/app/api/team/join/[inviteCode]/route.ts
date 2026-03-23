import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ inviteCode: string }> }
) {
  const { inviteCode } = await params;
  const supabase = (await createClient()) as any;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient() as any;

  const { data: agent } = await admin
    .from("agents")
    .select("id, email, brokerage_id")
    .eq("user_id", user.id)
    .single();
  if (!agent) return NextResponse.json({ error: "Agent not found" }, { status: 404 });

  if (agent.brokerage_id) {
    return NextResponse.json(
      { error: "Already part of a brokerage" },
      { status: 400 }
    );
  }

  // Find valid invite
  const { data: invite } = await admin
    .from("brokerage_invites")
    .select("id, brokerage_id, email, expires_at")
    .eq("invite_code", inviteCode)
    .is("accepted_at", null)
    .single();

  if (!invite) {
    return NextResponse.json({ error: "Invalid or expired invite" }, { status: 404 });
  }

  // Check expiry
  if (new Date(invite.expires_at) < new Date()) {
    return NextResponse.json({ error: "Invite has expired" }, { status: 400 });
  }

  // Add agent to brokerage
  const { error: joinErr } = await admin
    .from("brokerage_agents")
    .insert({
      brokerage_id: invite.brokerage_id,
      agent_id: agent.id,
      role: "agent",
    });

  if (joinErr) {
    return NextResponse.json({ error: joinErr.message }, { status: 500 });
  }

  // Update agent.brokerage_id
  await admin
    .from("agents")
    .update({ brokerage_id: invite.brokerage_id })
    .eq("id", agent.id);

  // Mark invite as accepted
  await admin
    .from("brokerage_invites")
    .update({ accepted_at: new Date().toISOString() })
    .eq("id", invite.id);

  return NextResponse.json({ brokerage_id: invite.brokerage_id });
}
