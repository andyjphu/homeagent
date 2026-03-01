import { google } from "googleapis";
import type { OAuth2Client } from "google-auth-library";

interface SendEmailOptions {
  from: string;
  to: string;
  subject: string;
  body: string;
  threadId?: string;
  inReplyTo?: string;
}

/**
 * Send an email via Gmail API.
 * Builds RFC 2822 message, base64url encodes, and sends.
 * Supports reply threading via threadId + inReplyTo.
 */
export async function sendEmail(
  auth: OAuth2Client,
  options: SendEmailOptions
): Promise<string> {
  const gmail = google.gmail({ version: "v1", auth });

  const headers = [
    `From: ${options.from}`,
    `To: ${options.to}`,
    `Subject: ${options.subject}`,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=UTF-8",
  ];

  if (options.inReplyTo) {
    headers.push(`In-Reply-To: ${options.inReplyTo}`);
    headers.push(`References: ${options.inReplyTo}`);
  }

  const message = headers.join("\r\n") + "\r\n\r\n" + options.body;
  const raw = Buffer.from(message).toString("base64url");

  const res = await gmail.users.messages.send({
    userId: "me",
    requestBody: {
      raw,
      ...(options.threadId ? { threadId: options.threadId } : {}),
    },
  });

  return res.data.id || "";
}
