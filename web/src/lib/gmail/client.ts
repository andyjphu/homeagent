import { google, gmail_v1 } from "googleapis";
import type { OAuth2Client } from "google-auth-library";
import type { GaxiosResponseWithHTTP2 } from "googleapis-common";

export interface GmailMessage {
  id: string;
  threadId: string;
  subject: string;
  from: string;
  to: string;
  date: string;
  snippet: string;
  body: string;
  direction: "inbound" | "outbound";
}

export async function fetchRecentEmails(
  auth: OAuth2Client,
  agentEmail: string,
  maxResults: number = 20,
  after?: string
): Promise<GmailMessage[]> {
  const gmail = google.gmail({ version: "v1", auth });

  let query = "in:inbox OR in:sent";
  if (after) {
    const afterEpoch = Math.floor(new Date(after).getTime() / 1000);
    query += ` after:${afterEpoch}`;
  }

  console.log("[gmail-client] query:", query);

  const listResponse = await gmail.users.messages.list({
    userId: "me",
    maxResults,
    q: query,
  });

  console.log("[gmail-client] messages found:", listResponse.data.messages?.length ?? 0);

  const messageIds = listResponse.data.messages || [];
  if (messageIds.length === 0) return [];

  // Fetch in batches of 5 to avoid rate limits and timeouts
  const BATCH_SIZE = 5;
  const messages: GaxiosResponseWithHTTP2<gmail_v1.Schema$Message>[] = [];
  for (let i = 0; i < messageIds.length; i += BATCH_SIZE) {
    const batch = messageIds.slice(i, i + BATCH_SIZE);
    const results = await Promise.all(
      batch.map((msg) =>
        gmail.users.messages.get({
          userId: "me",
          id: msg.id!,
          format: "full",
        })
      )
    );
    messages.push(...results);
  }

  return messages
    .map((res) => parseMessage(res.data, agentEmail))
    .filter((msg): msg is GmailMessage => msg !== null);
}

function parseMessage(
  message: gmail_v1.Schema$Message,
  agentEmail: string
): GmailMessage | null {
  if (!message.id || !message.threadId) return null;

  const headers = message.payload?.headers || [];
  const getHeader = (name: string) =>
    headers.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value || "";

  const from = getHeader("From");
  const to = getHeader("To");
  const subject = getHeader("Subject");
  const date = getHeader("Date");

  const direction = from.toLowerCase().includes(agentEmail.toLowerCase())
    ? "outbound"
    : "inbound";

  const body = extractTextBody(message.payload);

  return {
    id: message.id,
    threadId: message.threadId,
    subject,
    from,
    to,
    date: new Date(date).toISOString(),
    snippet: message.snippet || "",
    body,
    direction,
  };
}

function extractTextBody(
  payload: gmail_v1.Schema$MessagePart | undefined
): string {
  if (!payload) return "";

  if (payload.mimeType === "text/plain" && payload.body?.data) {
    return Buffer.from(payload.body.data, "base64url").toString("utf-8");
  }

  if (payload.parts) {
    for (const part of payload.parts) {
      if (part.mimeType === "text/plain" && part.body?.data) {
        return Buffer.from(part.body.data, "base64url").toString("utf-8");
      }
    }
    for (const part of payload.parts) {
      const text = extractTextBody(part);
      if (text) return text;
    }
  }

  return "";
}
