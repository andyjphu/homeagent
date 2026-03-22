import { createAdminClient } from "@/lib/supabase/admin";
import type { IntegrationRecord, SyncError } from "./types";

const admin = () => createAdminClient() as any;

export async function getIntegration(
  agentId: string,
  provider: string
): Promise<IntegrationRecord | null> {
  const { data } = await admin()
    .from("agent_integrations")
    .select("*")
    .eq("agent_id", agentId)
    .eq("provider", provider)
    .eq("is_active", true)
    .maybeSingle();
  return data;
}

export async function upsertIntegration(
  agentId: string,
  provider: string,
  fields: {
    access_token?: string | null;
    refresh_token?: string | null;
    token_expires_at?: string | null;
    settings?: Record<string, unknown>;
    is_active?: boolean;
  }
): Promise<IntegrationRecord | null> {
  const { data } = await admin()
    .from("agent_integrations")
    .upsert(
      {
        agent_id: agentId,
        provider,
        ...fields,
      },
      { onConflict: "agent_id,provider" }
    )
    .select("*")
    .single();
  return data;
}

export async function deleteIntegration(
  agentId: string,
  provider: string
): Promise<void> {
  await admin()
    .from("agent_integrations")
    .delete()
    .eq("agent_id", agentId)
    .eq("provider", provider);
}

export async function updateSyncStatus(
  agentId: string,
  provider: string,
  errors: SyncError[]
): Promise<void> {
  await admin()
    .from("agent_integrations")
    .update({
      last_sync_at: new Date().toISOString(),
      sync_errors: errors,
    })
    .eq("agent_id", agentId)
    .eq("provider", provider);
}

export async function getActiveIntegrations(
  agentId: string
): Promise<IntegrationRecord[]> {
  const { data } = await admin()
    .from("agent_integrations")
    .select("*")
    .eq("agent_id", agentId)
    .eq("is_active", true);
  return data ?? [];
}
