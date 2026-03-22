import type { IntegrationProvider, SyncResult } from "../types";
import { getIntegration, upsertIntegration, deleteIntegration } from "../db";
import { FollowUpBossClient } from "./client";
import { syncContacts } from "./sync";

export const followUpBossProvider: IntegrationProvider = {
  name: "followupboss",

  async connect(agentId: string, credentials: Record<string, string>): Promise<void> {
    const apiKey = credentials.apiKey;
    if (!apiKey) throw new Error("API key is required");

    // Verify the key works
    const client = new FollowUpBossClient(apiKey);
    const valid = await client.verifyKey();
    if (!valid) throw new Error("Invalid Follow Up Boss API key");

    await upsertIntegration(agentId, "followupboss", {
      access_token: apiKey,
      is_active: true,
    });
  },

  async disconnect(agentId: string): Promise<void> {
    await deleteIntegration(agentId, "followupboss");
  },

  async sync(agentId: string): Promise<SyncResult> {
    return syncContacts(agentId);
  },

  async isConnected(agentId: string): Promise<boolean> {
    const integration = await getIntegration(agentId, "followupboss");
    return !!integration?.is_active;
  },
};
