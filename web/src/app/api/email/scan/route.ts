import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthedClient } from "@/lib/gmail/tokens";
import { fetchRecentEmails } from "@/lib/gmail/client";
import { llmJSON } from "@/lib/llm/router";
import { EMAIL_CLASSIFICATION_PROMPT } from "@/lib/llm/prompts/lead-classification";

interface ClassificationResult {
  classification: "deal_relevant" | "new_lead" | "noise" | "action_required";
  confidence: "high" | "medium" | "low";
  reasoning: string;
}

export async function POST() {
  const supabase = await createClient() as any;
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient() as any;

  const { data: agent } = await admin
    .from("agents")
    .select("id, email, gmail_last_scan_at")
    .eq("user_id", user.id)
    .single();

  if (!agent) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }

  try {
    const auth = await getAuthedClient(agent.id);

    const after = agent.gmail_last_scan_at
      || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    console.log("[email-scan] agent:", agent.id, "email:", agent.email, "after:", after);

    const emails = await fetchRecentEmails(auth, agent.email, 30, after);

    console.log("[email-scan] fetched", emails.length, "emails from Gmail");

    if (emails.length === 0) {
      await admin
        .from("agents")
        .update({ gmail_last_scan_at: new Date().toISOString() })
        .eq("id", agent.id);

      return NextResponse.json({ processed: 0, total: 0, debug: { after, agentEmail: agent.email } });
    }

    // Deduplicate
    const messageIds = emails.map((e) => e.id);
    const { data: existing } = await admin
      .from("communications")
      .select("gmail_message_id")
      .eq("agent_id", agent.id)
      .in("gmail_message_id", messageIds);

    const existingIds = new Set((existing || []).map((e: any) => e.gmail_message_id));
    const newEmails = emails.filter((e) => !existingIds.has(e.id));

    let processed = 0;
    const errors: string[] = [];

    for (const email of newEmails) {
      try {
        // Try LLM classification, but don't require it
        let classification: ClassificationResult | null = null;
        try {
          classification = await llmJSON<ClassificationResult>(
            "email_classification",
            EMAIL_CLASSIFICATION_PROMPT,
            `Subject: ${email.subject}\nFrom: ${email.from}\nTo: ${email.to}\n\n${email.body.slice(0, 2000)}`
          );
        } catch (llmError) {
          console.error(`[email-scan] LLM classification failed for ${email.id}:`, llmError);
          errors.push(`LLM failed for "${email.subject}": ${llmError instanceof Error ? llmError.message : "unknown"}`);
        }

        const { data: comm } = await admin
          .from("communications")
          .insert({
            agent_id: agent.id,
            type: "email",
            direction: email.direction,
            subject: email.subject,
            raw_content: email.body.slice(0, 10000),
            from_address: email.from,
            to_address: email.to,
            gmail_message_id: email.id,
            gmail_thread_id: email.threadId,
            classification: classification?.classification || null,
            ai_analysis: classification || null,
            is_processed: !!classification,
            processed_at: new Date().toISOString(),
            occurred_at: email.date,
          })
          .select("id")
          .single();

        if (
          email.direction === "inbound" &&
          classification?.classification &&
          classification.classification !== "noise" &&
          comm
        ) {
          await admin.from("activity_feed").insert({
            agent_id: agent.id,
            event_type: "email_received",
            communication_id: comm.id,
            title: `Email: ${email.subject || "(no subject)"}`,
            description: `From ${email.from} — ${classification.classification.replace(/_/g, " ")}`,
            metadata: {
              from: email.from,
              classification: classification.classification,
              confidence: classification.confidence,
            },
            is_action_required:
              classification.classification === "action_required" ||
              classification.classification === "new_lead",
          });
        }

        processed++;
      } catch (emailError) {
        const msg = emailError instanceof Error ? emailError.message : "unknown";
        console.error(`[email-scan] Failed to process email ${email.id}:`, emailError);
        errors.push(`DB insert failed for "${email.subject}": ${msg}`);
      }
    }

    await admin
      .from("agents")
      .update({ gmail_last_scan_at: new Date().toISOString() })
      .eq("id", agent.id);

    return NextResponse.json({
      processed,
      total: newEmails.length,
      skipped: emails.length - newEmails.length,
      ...(errors.length > 0 ? { errors } : {}),
    });
  } catch (err) {
    console.error("Email scan error:", err);
    return NextResponse.json(
      { error: "Failed to scan emails" },
      { status: 500 }
    );
  }
}
