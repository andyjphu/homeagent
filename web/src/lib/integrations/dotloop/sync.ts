import { createAdminClient } from "@/lib/supabase/admin";
import { DotloopClient, refreshDotloopToken } from "./client";
import { getIntegration, upsertIntegration, updateSyncStatus } from "../db";
import { emptySyncResult, type SyncResult } from "../types";

const admin = () => createAdminClient() as any;

/** Map Dotloop statuses to FoyerFind deal stages. */
const DOTLOOP_STATUS_MAP: Record<string, string> = {
  "Pre-Offer": "pre_offer",
  "Pre Offer": "pre_offer",
  Listing: "prospecting",
  "Under Contract": "under_contract",
  Sold: "closed",
  Leased: "closed",
  Archived: "dead",
  Active: "touring",
};

function mapDotloopStage(status: string): string {
  return DOTLOOP_STATUS_MAP[status] || "prospecting";
}

/** Reverse map: FoyerFind stage → Dotloop status. */
const FOYERFIND_TO_DOTLOOP: Record<string, string> = {
  prospecting: "Listing",
  touring: "Active",
  pre_offer: "Pre-Offer",
  negotiating: "Pre-Offer",
  under_contract: "Under Contract",
  inspection: "Under Contract",
  appraisal: "Under Contract",
  closing: "Under Contract",
  closed: "Sold",
  dead: "Archived",
};

async function getAuthedClient(agentId: string): Promise<{
  client: DotloopClient;
  profileId: number;
} | null> {
  const integration = await getIntegration(agentId, "dotloop");
  if (!integration?.access_token || !integration?.refresh_token) return null;

  // Check if token needs refresh (5 min buffer)
  let accessToken = integration.access_token;
  if (
    integration.token_expires_at &&
    new Date(integration.token_expires_at).getTime() < Date.now() + 5 * 60 * 1000
  ) {
    try {
      const tokens = await refreshDotloopToken(integration.refresh_token);
      accessToken = tokens.access_token;
      await upsertIntegration(agentId, "dotloop", {
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        token_expires_at: new Date(
          Date.now() + tokens.expires_in * 1000
        ).toISOString(),
      });
    } catch (err) {
      console.error("[dotloop] Token refresh failed:", err);
      return null;
    }
  }

  const client = new DotloopClient(accessToken);
  const profileId =
    (integration.settings as any)?.profileId ??
    (await client.getProfile().then((p) => p.id));

  return { client, profileId };
}

/**
 * Pull Dotloop loops → create/update deals in FoyerFind.
 * Match by dotloop_loop_id stored in deal settings or by property address + buyer.
 */
export async function syncDeals(agentId: string): Promise<SyncResult> {
  const result = emptySyncResult();

  const auth = await getAuthedClient(agentId);
  if (!auth) {
    result.errors.push({
      entity: "integration",
      message: "Dotloop not connected or token expired",
      timestamp: new Date().toISOString(),
    });
    return result;
  }

  const { client, profileId } = auth;

  try {
    const loops = await client.getLoops(profileId);

    for (const loop of loops) {
      try {
        const stage = mapDotloopStage(loop.status);

        // Check if deal already linked via intelligence_dossier.dotloop_loop_id
        const { data: existingDeal } = await admin()
          .from("deals")
          .select("id, stage")
          .eq("agent_id", agentId)
          .contains("intelligence_dossier", { dotloop_loop_id: loop.id })
          .maybeSingle();

        if (existingDeal) {
          // Update stage if changed
          if (existingDeal.stage !== stage) {
            await admin()
              .from("deals")
              .update({
                stage,
                updated_at: new Date().toISOString(),
              })
              .eq("id", existingDeal.id);
            result.dealsUpdated++;
          }
          result.dealsSynced++;
        } else {
          // Try to match by loop name (often contains address)
          // For MVP, just track — don't auto-create deals without buyer context
          result.dealsSynced++;
        }
      } catch (err) {
        result.errors.push({
          entity: "loop",
          entityId: String(loop.id),
          message: err instanceof Error ? err.message : "Unknown error",
          timestamp: new Date().toISOString(),
        });
      }
    }
  } catch (err) {
    result.errors.push({
      entity: "sync",
      message: err instanceof Error ? err.message : "Sync failed",
      timestamp: new Date().toISOString(),
    });
  }

  await updateSyncStatus(agentId, "dotloop", result.errors);
  return result;
}

/**
 * Push a FoyerFind deal stage change to Dotloop.
 * Fire-and-forget.
 */
export async function pushDealUpdate(
  agentId: string,
  dealId: string,
  newStage: string
): Promise<void> {
  const auth = await getAuthedClient(agentId);
  if (!auth) return;

  const { client, profileId } = auth;

  // Check if deal has a dotloop_loop_id
  const { data: deal } = await admin()
    .from("deals")
    .select("intelligence_dossier")
    .eq("id", dealId)
    .single();

  const loopId = (deal?.intelligence_dossier as any)?.dotloop_loop_id;
  if (!loopId) return;

  const dotloopStatus = FOYERFIND_TO_DOTLOOP[newStage];
  if (!dotloopStatus) return;

  await client.updateLoopStatus(profileId, loopId, dotloopStatus);
}
