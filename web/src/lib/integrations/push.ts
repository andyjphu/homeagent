/**
 * Fire-and-forget helpers that push data to connected integrations.
 * All functions are safe to call without checking connection status —
 * they silently return if the integration isn't active.
 */

import { pushResearchNote as fubPushResearch } from "./followupboss/sync";
import { pushDealUpdate as fubPushDeal } from "./followupboss/sync";
import { pushDealUpdate as dotloopPushDeal } from "./dotloop/sync";

/**
 * After a research brief is created, push a note to connected CRMs.
 * Call as: pushBriefToIntegrations(agentId, briefId).catch(console.error)
 */
export async function pushBriefToIntegrations(
  agentId: string,
  briefId: string
): Promise<void> {
  await Promise.allSettled([
    fubPushResearch(agentId, briefId),
  ]);
}

/**
 * After a deal stage changes, push updates to connected CRMs and TMS.
 * Call as: pushDealStageToIntegrations(...).catch(console.error)
 */
export async function pushDealStageToIntegrations(
  agentId: string,
  dealId: string,
  newStage: string,
  previousStage: string
): Promise<void> {
  await Promise.allSettled([
    fubPushDeal(agentId, dealId, newStage, previousStage),
    dotloopPushDeal(agentId, dealId, newStage),
  ]);
}
