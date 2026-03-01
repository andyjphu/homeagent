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

    // Fetch classifications for these emails from DB
    const gmailIds = emails.map((e) => e.id);

    let classMap = new Map();
    if (gmailIds.length > 0) {
      const { data: classifications } = await admin
        .from("communications")
        .select("gmail_message_id, classification, ai_analysis, buyers(full_name)")
        .eq("agent_id", agent.id)
        .in("gmail_message_id", gmailIds);

      classMap = new Map(
        (classifications || []).map((c: any) => [c.gmail_message_id, c])
      );
    }

    const merged = emails.map((email) => {
      const cls = classMap.get(email.id) as any;
      return {
        ...email,
        classification: cls?.classification || null,
        aiAnalysis: cls?.ai_analysis || null,
        buyerName: cls?.buyers?.full_name || null,
      };
    });

    return NextResponse.json({ emails: merged });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("[email-inbox] error:", msg, err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
