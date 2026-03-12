import { createAdminClient } from "@/lib/supabase/admin";
import { createCalendarOAuth2Client } from "./oauth";

const REFRESH_BUFFER_MS = 5 * 60 * 1000; // 5 minutes before expiry

// Simple per-agent mutex to prevent concurrent token refreshes
const refreshLocks = new Map<string, Promise<void>>();

async function proactiveRefresh(
  agentId: string,
  oauth2Client: ReturnType<typeof createCalendarOAuth2Client>,
  supabase: ReturnType<typeof createAdminClient>
): Promise<void> {
  const credentials = oauth2Client.credentials;
  const expiryDate = credentials.expiry_date;
  if (!expiryDate || expiryDate - Date.now() > REFRESH_BUFFER_MS) {
    return;
  }

  const existing = refreshLocks.get(agentId);
  if (existing) {
    await existing;
    return;
  }

  const refreshPromise = (async () => {
    try {
      const { credentials: newCreds } =
        await oauth2Client.refreshAccessToken();
      oauth2Client.setCredentials(newCreds);

      const update: Record<string, string> = {};
      if (newCreds.access_token)
        update.google_calendar_access_token = newCreds.access_token;
      if (newCreds.refresh_token)
        update.google_calendar_refresh_token = newCreds.refresh_token;
      if (newCreds.expiry_date)
        update.google_calendar_token_expires_at = new Date(
          newCreds.expiry_date
        ).toISOString();

      if (Object.keys(update).length > 0) {
        await (supabase as any)
          .from("agents")
          .update(update)
          .eq("id", agentId);
      }
    } catch (err) {
      console.error("[calendar-tokens] Proactive refresh failed:", err);
    }
  })();

  refreshLocks.set(agentId, refreshPromise);
  try {
    await refreshPromise;
  } finally {
    refreshLocks.delete(agentId);
  }
}

export async function getCalendarAuthedClient(agentId: string) {
  const supabase = createAdminClient() as any;

  const { data: agent, error } = await supabase
    .from("agents")
    .select(
      "google_calendar_access_token, google_calendar_refresh_token, google_calendar_token_expires_at"
    )
    .eq("id", agentId)
    .single();

  if (
    error ||
    !agent?.google_calendar_access_token ||
    !agent?.google_calendar_refresh_token
  ) {
    throw new Error("Calendar not connected for this agent");
  }

  const oauth2Client = createCalendarOAuth2Client();
  oauth2Client.setCredentials({
    access_token: agent.google_calendar_access_token,
    refresh_token: agent.google_calendar_refresh_token,
    expiry_date: agent.google_calendar_token_expires_at
      ? new Date(agent.google_calendar_token_expires_at).getTime()
      : undefined,
  });

  // Let googleapis auto-refresh; persist new tokens when it does
  oauth2Client.on("tokens", async (tokens) => {
    const update: Record<string, string> = {};
    if (tokens.access_token)
      update.google_calendar_access_token = tokens.access_token;
    if (tokens.refresh_token)
      update.google_calendar_refresh_token = tokens.refresh_token;
    if (tokens.expiry_date)
      update.google_calendar_token_expires_at = new Date(
        tokens.expiry_date
      ).toISOString();

    if (Object.keys(update).length > 0) {
      await supabase.from("agents").update(update).eq("id", agentId);
    }
  });

  await proactiveRefresh(agentId, oauth2Client, supabase);

  return oauth2Client;
}
