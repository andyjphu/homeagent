import Twilio from "twilio";

let twilioClient: ReturnType<typeof Twilio> | null = null;

function getClient() {
  if (twilioClient) return twilioClient;

  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;

  if (!accountSid || !authToken) {
    return null;
  }

  twilioClient = Twilio(accountSid, authToken);
  return twilioClient;
}

/**
 * Check if SMS sending is available (Twilio credentials configured).
 */
export function isSmsAvailable(): boolean {
  return !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_FROM_NUMBER);
}

/**
 * Send an SMS via Twilio Messaging API.
 * Returns the Twilio message SID on success, or throws on failure.
 */
export async function sendSms(to: string, body: string): Promise<string> {
  const client = getClient();
  if (!client) {
    throw new Error("Twilio not configured: missing TWILIO_ACCOUNT_SID or TWILIO_AUTH_TOKEN");
  }

  const fromNumber = process.env.TWILIO_FROM_NUMBER;
  if (!fromNumber) {
    throw new Error("Twilio not configured: missing TWILIO_FROM_NUMBER");
  }

  // Truncate SMS to 1600 chars (Twilio max for multi-segment)
  const truncated = body.length > 1600 ? body.slice(0, 1597) + "..." : body;

  const message = await client.messages.create({
    to,
    from: fromNumber,
    body: truncated,
  });

  return message.sid;
}
