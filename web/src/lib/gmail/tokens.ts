import { createAdminClient } from "@/lib/supabase/admin";
import { createOAuth2Client } from "./oauth";

export async function getAuthedClient(agentId: string) {
  const supabase = createAdminClient() as any;

  const { data: agent, error } = await supabase
    .from("agents")
    .select("gmail_access_token, gmail_refresh_token, gmail_token_expires_at")
    .eq("id", agentId)
    .single();

  if (error || !agent?.gmail_access_token || !agent?.gmail_refresh_token) {
    throw new Error("Gmail not connected for this agent");
  }

  const oauth2Client = createOAuth2Client();
  oauth2Client.setCredentials({
    access_token: agent.gmail_access_token,
    refresh_token: agent.gmail_refresh_token,
    expiry_date: new Date(agent.gmail_token_expires_at).getTime(),
  });

  // Refresh if expiring within 5 minutes
  const expiresAt = new Date(agent.gmail_token_expires_at).getTime();
  const FIVE_MINUTES = 5 * 60 * 1000;

  if (expiresAt - Date.now() < FIVE_MINUTES) {
    const { credentials } = await oauth2Client.refreshAccessToken();

    await supabase
      .from("agents")
      .update({
        gmail_access_token: credentials.access_token,
        gmail_token_expires_at: new Date(credentials.expiry_date!).toISOString(),
        ...(credentials.refresh_token
          ? { gmail_refresh_token: credentials.refresh_token }
          : {}),
      })
      .eq("id", agentId);

    oauth2Client.setCredentials(credentials);
  }

  return oauth2Client;
}
