import type { IntegrationProvider, SyncResult } from "../types";
import { getIntegration, deleteIntegration } from "../db";
import { syncDeals } from "./sync";

export const dotloopProvider: IntegrationProvider = {
  name: "dotloop",

  async connect(
    _agentId: string,
    _credentials: Record<string, string>
  ): Promise<void> {
    // OAuth flow handled via /api/integrations/dotloop/connect + callback routes
    throw new Error(
      "Dotloop uses OAuth. Use /api/integrations/dotloop/connect to initiate."
    );
  },

  async disconnect(agentId: string): Promise<void> {
    await deleteIntegration(agentId, "dotloop");
  },

  async sync(agentId: string): Promise<SyncResult> {
    return syncDeals(agentId);
  },

  async isConnected(agentId: string): Promise<boolean> {
    const integration = await getIntegration(agentId, "dotloop");
    return !!integration?.is_active;
  },
};
