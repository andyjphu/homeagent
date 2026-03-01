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

  // Let googleapis auto-refresh; persist new tokens when it does
  oauth2Client.on("tokens", async (tokens) => {
    const update: Record<string, string> = {};
    if (tokens.access_token) update.gmail_access_token = tokens.access_token;
    if (tokens.refresh_token) update.gmail_refresh_token = tokens.refresh_token;
    if (tokens.expiry_date) update.gmail_token_expires_at = new Date(tokens.expiry_date).toISOString();

    if (Object.keys(update).length > 0) {
      await supabase
        .from("agents")
        .update(update)
        .eq("id", agentId);
    }
  });

  return oauth2Client;
}
