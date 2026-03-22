import type { IntegrationProvider } from "./types";
import { followUpBossProvider } from "./followupboss/provider";
import { dotloopProvider } from "./dotloop/provider";

const providers = new Map<string, IntegrationProvider>([
  ["followupboss", followUpBossProvider],
  ["dotloop", dotloopProvider],
]);

export function getProvider(name: string): IntegrationProvider | undefined {
  return providers.get(name);
}

export function listProviders(): string[] {
  return Array.from(providers.keys());
}
