import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

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

  // Check admin role
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
  const { email } = body;

  if (!email?.trim()) {
    return NextResponse.json({ error: "Email is required" }, { status: 400 });
  }

  // Check if already invited
  const { data: existing } = await admin
    .from("brokerage_invites")
    .select("id")
    .eq("brokerage_id", agent.brokerage_id)
    .eq("email", email.trim().toLowerCase())
    .is("accepted_at", null)
    .single();

  if (existing) {
    return NextResponse.json({ error: "Already invited" }, { status: 400 });
  }

  // Create invite
  const { data: invite, error } = await admin
    .from("brokerage_invites")
    .insert({
      brokerage_id: agent.brokerage_id,
      email: email.trim().toLowerCase(),
      invited_by: agent.id,
    })
    .select("invite_code")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const inviteUrl = `/team/join/${invite.invite_code}`;

  return NextResponse.json({ invite_code: invite.invite_code, invite_url: inviteUrl });
}
