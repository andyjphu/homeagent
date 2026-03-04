import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthedClient } from "@/lib/gmail/tokens";
import { fetchRecentEmails } from "@/lib/gmail/client";
import { llmJSON, isLLMAvailable } from "@/lib/llm/router";
import { EMAIL_CLASSIFICATION_PROMPT, LEAD_CLASSIFICATION_PROMPT } from "@/lib/llm/prompts/lead-classification";
import { classifyByKeywords } from "@/lib/email/keyword-classifier";
import { createActivityEntry } from "@/lib/supabase/activity";

interface ClassificationResult {
  classification: "deal_relevant" | "new_lead" | "noise" | "action_required";
  confidence: "high" | "medium" | "low";
  reasoning: string;
}

/** Extract email address from a "Name <email>" string */
function extractEmail(from: string): string {
  const match = from.match(/<(.+?)>/);
  return match ? match[1].toLowerCase() : from.toLowerCase().trim();
}

export async function POST(request: Request) {
  const { searchParams } = new URL(request.url);
  const rescan = searchParams.get("rescan") === "1";

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

    // Rescan: clear old communications and reset time window
    if (rescan) {
      await admin
        .from("communications")
        .delete()
        .eq("agent_id", agent.id)
        .eq("type", "email");
    }

    const after = rescan
      ? new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString()
      : (agent.gmail_last_scan_at || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());

    console.log("[email-scan] agent:", agent.id, "email:", agent.email, "after:", after, "rescan:", rescan);

    const emails = await fetchRecentEmails(auth, agent.email, 25, after);

    console.log("[email-scan] fetched", emails.length, "emails from Gmail");

    if (emails.length === 0) {
      await admin
        .from("agents")
        .update({ gmail_last_scan_at: new Date().toISOString() })
        .eq("id", agent.id);

      return NextResponse.json({ processed: 0, total: 0, debug: { after, agentEmail: agent.email } });
    }

    // Deduplicate against existing communications by gmail_message_id
    const messageIds = emails.map((e) => e.id);
    const { data: existing } = await admin
      .from("communications")
      .select("gmail_message_id")
      .eq("agent_id", agent.id)
      .in("gmail_message_id", messageIds);

    const existingIds = new Set((existing || []).map((e: { gmail_message_id: string }) => e.gmail_message_id));
    const newEmails = emails.filter((e) => !existingIds.has(e.id));

    // Pre-fetch existing buyers for linking inbound emails
    const { data: buyers } = await admin
      .from("buyers")
      .select("id, email, full_name")
      .eq("agent_id", agent.id)
      .eq("is_active", true);

    const buyerByEmail = new Map<string, { id: string; full_name: string }>();
    for (const buyer of buyers || []) {
      if (buyer.email) {
        buyerByEmail.set(buyer.email.toLowerCase(), { id: buyer.id, full_name: buyer.full_name });
      }
    }

    // Pre-fetch existing lead emails to prevent duplicate lead creation
    const { data: existingLeads } = await admin
      .from("leads")
      .select("email, source_communication_id")
      .eq("agent_id", agent.id)
      .in("status", ["draft", "confirmed"]);

    const existingLeadEmails = new Set(
      (existingLeads || [])
        .map((l: { email: string | null }) => l.email?.toLowerCase())
        .filter(Boolean)
    );
    const existingLeadCommIds = new Set(
      (existingLeads || [])
        .map((l: { source_communication_id: string | null }) => l.source_communication_id)
        .filter(Boolean)
    );

    const useLLM = isLLMAvailable("email_classification");
    let processed = 0;
    const errors: string[] = [];

    // Classify all emails in parallel
    const classifications = await Promise.all(
      newEmails.map(async (email): Promise<ClassificationResult | null> => {
        try {
          if (useLLM) {
            return await llmJSON<ClassificationResult>(
              "email_classification",
              EMAIL_CLASSIFICATION_PROMPT,
              `Subject: ${email.subject}\nFrom: ${email.from}\nTo: ${email.to}\n\n${email.body.slice(0, 2000)}`
            );
          }
          // Keyword fallback
          return classifyByKeywords(email.subject, email.body, email.from);
        } catch (llmError) {
          // LLM failed — fall back to keyword classification
          console.warn(`[email-scan] LLM failed for "${email.subject}", using keyword fallback:`, llmError);
          try {
            return classifyByKeywords(email.subject, email.body, email.from);
          } catch {
            errors.push(`Classification failed for "${email.subject}"`);
            return null;
          }
        }
      })
    );

    for (let i = 0; i < newEmails.length; i++) {
      const email = newEmails[i];
      const classification = classifications[i];
      try {
        // Check if this inbound email is from an existing buyer
        const senderEmail = extractEmail(email.from);
        const matchedBuyer = email.direction === "inbound" ? buyerByEmail.get(senderEmail) : undefined;

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
            // Link to existing buyer if found
            buyer_id: matchedBuyer?.id || null,
          })
          .select("id")
          .single();

        // Create activity entry for non-noise inbound emails
        if (
          email.direction === "inbound" &&
          classification?.classification &&
          classification.classification !== "noise" &&
          comm
        ) {
          const description = matchedBuyer
            ? `From ${matchedBuyer.full_name} — ${classification.classification.replace(/_/g, " ")}`
            : `From ${email.from} — ${classification.classification.replace(/_/g, " ")}`;

          await createActivityEntry(
            agent.id,
            "email_received",
            `Email: ${email.subject || "(no subject)"}`,
            description,
            {
              from: email.from,
              classification: classification.classification,
              confidence: classification.confidence,
            },
            {
              communicationId: comm.id,
              buyerId: matchedBuyer?.id,
              isActionRequired:
                classification.classification === "action_required" ||
                classification.classification === "new_lead",
            }
          );
        }

        // Auto-create draft lead for new_lead emails (with duplicate prevention)
        if (classification?.classification === "new_lead" && comm) {
          const senderAddr = extractEmail(email.from);

          // Skip if this email is from an existing buyer
          if (matchedBuyer) {
            console.log(`[email-scan] Skipping lead creation — sender ${senderAddr} is existing buyer ${matchedBuyer.full_name}`);
          }
          // Skip if a lead already exists for this email address or communication
          else if (existingLeadEmails.has(senderAddr) || existingLeadCommIds.has(comm.id)) {
            console.log(`[email-scan] Skipping lead creation — lead already exists for ${senderAddr}`);
          } else {
            try {
              let extractedInfo: Record<string, unknown> = {};
              if (isLLMAvailable("lead_classification")) {
                try {
                  extractedInfo = await llmJSON(
                    "lead_classification",
                    LEAD_CLASSIFICATION_PROMPT,
                    email.body.slice(0, 3000)
                  );
                } catch {
                  // LLM extraction is optional — lead still created with basic info
                }
              }

              const senderName = email.from.replace(/<.*>/, "").trim() || null;

              await admin.from("leads").insert({
                agent_id: agent.id,
                source: "email",
                status: "draft",
                confidence: classification.confidence,
                name: (extractedInfo.name as string) || senderName,
                email: senderAddr,
                phone: (extractedInfo.phone as string) || null,
                raw_source_content: email.body.slice(0, 5000),
                extracted_info: extractedInfo,
                source_communication_id: comm.id,
              });

              // Track this email to prevent duplicates within the same scan batch
              existingLeadEmails.add(senderAddr);
              existingLeadCommIds.add(comm.id);

              // Activity entry for lead detection
              await createActivityEntry(
                agent.id,
                "lead_detected",
                `New lead: ${(extractedInfo.name as string) || senderName || senderAddr}`,
                `Detected from email: ${email.subject || "(no subject)"}`,
                {
                  source: "email",
                  email: senderAddr,
                  confidence: classification.confidence,
                },
                {
                  communicationId: comm.id,
                  isActionRequired: true,
                }
              );
            } catch (leadError) {
              console.error("[email-scan] Failed to auto-create lead:", leadError);
            }
          }
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
      usedLLM: useLLM,
      ...(errors.length > 0 ? { errors } : {}),
    });
  } catch (err) {
    console.error("Email scan error:", err);
    const message = err instanceof Error ? err.message : "Failed to scan emails";
    // Surface helpful error for Gmail disconnected
    if (message.includes("Gmail not connected")) {
      return NextResponse.json(
        { error: "Gmail is not connected. Please connect Gmail in Settings." },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: "Failed to scan emails" },
      { status: 500 }
    );
  }
}
