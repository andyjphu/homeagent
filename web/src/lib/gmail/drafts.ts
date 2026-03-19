import { google } from "googleapis";
import type { OAuth2Client } from "google-auth-library";

interface CreateDraftOptions {
  to: string;
  subject: string;
  htmlBody: string;
  from?: string;
}

/**
 * Create a Gmail draft (not send) in the agent's inbox.
 * Uses gmail.users.drafts.create with RFC 2822 message format.
 * Returns the draft ID.
 */
export async function createGmailDraft(
  auth: OAuth2Client,
  options: CreateDraftOptions
): Promise<string> {
  const gmail = google.gmail({ version: "v1", auth });

  const headers = [
    options.from ? `From: ${options.from}` : "",
    `To: ${options.to}`,
    `Subject: ${options.subject}`,
    "MIME-Version: 1.0",
    'Content-Type: text/html; charset="UTF-8"',
  ]
    .filter(Boolean)
    .join("\r\n");

  const message = headers + "\r\n\r\n" + options.htmlBody;
  const raw = Buffer.from(message).toString("base64url");

  const res = await gmail.users.drafts.create({
    userId: "me",
    requestBody: {
      message: { raw },
    },
  });

  return res.data.id || "";
}
