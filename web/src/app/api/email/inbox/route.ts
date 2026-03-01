import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthedClient } from "@/lib/gmail/tokens";
import { fetchRecentEmails } from "@/lib/gmail/client";

export async function GET() {
  const supabase = await createClient() as any;
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient() as any;
  const { data: agent } = await admin
    .from("agents")
    .select("id, email")
    .eq("user_id", user.id)
    .single();

  if (!agent) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }

  try {
    const auth = await getAuthedClient(agent.id);
    const after = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
    const emails = await fetchRecentEmails(auth, agent.email, 25, after);

    return NextResponse.json({ emails });
  } catch (err) {
    console.error("[email-inbox] error:", err);
    return NextResponse.json({ error: "Failed to fetch emails" }, { status: 500 });
  }
}
