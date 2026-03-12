import { getAuthedClient } from "@/lib/gmail/tokens";
import { sendEmail } from "@/lib/gmail/send";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Check if email notifications are available for an agent.
 * Requires Gmail connection OR Resend API key.
 */
export async function isEmailAvailable(agentId: string): Promise<boolean> {
  // Check Resend first (no DB lookup needed)
  if (process.env.RESEND_API_KEY) return true;

  // Fall back to checking Gmail connection
  const admin = createAdminClient() as any;
  const { data: agent } = await admin
    .from("agents")
    .select("gmail_connected, gmail_access_token")
    .eq("id", agentId)
    .single();

  return !!(agent?.gmail_connected && agent?.gmail_access_token);
}

/**
 * Send a notification email.
 * Tries Resend (transactional email) first, falls back to Gmail API.
 */
export async function sendNotificationEmail(
  agentId: string,
  to: string,
  subject: string,
  body: string
): Promise<void> {
  // Try Resend first (preferred for transactional notifications)
  if (process.env.RESEND_API_KEY) {
    await sendViaResend(to, subject, body);
    return;
  }

  // Fall back to Gmail API
  await sendViaGmail(agentId, to, subject, body);
}

async function sendViaResend(to: string, subject: string, body: string): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY!;
  const fromAddress = process.env.NOTIFICATION_FROM_EMAIL || "notifications@foyerfind.com";

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: `FoyerFind <${fromAddress}>`,
      to: [to],
      subject,
      text: body,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Resend API error (${res.status}): ${err}`);
  }
}

async function sendViaGmail(
  agentId: string,
  to: string,
  subject: string,
  body: string
): Promise<void> {
  const admin = createAdminClient() as any;
  const { data: agent } = await admin
    .from("agents")
    .select("email")
    .eq("id", agentId)
    .single();

  if (!agent?.email) {
    throw new Error("Agent email not found");
  }

  const auth = await getAuthedClient(agentId);
  await sendEmail(auth, {
    from: agent.email,
    to,
    subject,
    body,
  });
}
