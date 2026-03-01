import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthedClient } from "@/lib/gmail/tokens";
import { sendEmail } from "@/lib/gmail/send";

export async function POST(request: Request) {
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

  const { to, subject, body, threadId, inReplyTo } = await request.json();

  if (!to || !subject || !body) {
    return NextResponse.json(
      { error: "to, subject, and body are required" },
      { status: 400 }
    );
  }

  try {
    const auth = await getAuthedClient(agent.id);

    const messageId = await sendEmail(auth, {
      from: agent.email,
      to,
      subject,
      body,
      threadId,
      inReplyTo,
    });

    // Store in communications table
    await admin.from("communications").insert({
      agent_id: agent.id,
      type: "email",
      direction: "outbound",
      subject,
      raw_content: body.slice(0, 10000),
      from_address: agent.email,
      to_address: to,
      gmail_message_id: messageId,
      gmail_thread_id: threadId || null,
      occurred_at: new Date().toISOString(),
      is_processed: true,
      processed_at: new Date().toISOString(),
    });

    return NextResponse.json({ ok: true, messageId });
  } catch (err: any) {
    console.error("[email-send] error:", err);
    const msg = err?.message || "Failed to send email";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
