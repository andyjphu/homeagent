import { createAdminClient } from "@/lib/supabase/admin";
import { FollowUpBossClient } from "./client";
import { getIntegration, updateSyncStatus } from "../db";
import { emptySyncResult, type SyncResult, type SyncError } from "../types";

const admin = () => createAdminClient() as any;

function getClient(apiKey: string): FollowUpBossClient {
  return new FollowUpBossClient(apiKey);
}

/**
 * Pull FUB contacts → create/update buyers in FoyerFind.
 * Match by email first. Don't overwrite existing FoyerFind data — FUB fills blanks.
 */
export async function syncContacts(agentId: string): Promise<SyncResult> {
  const result = emptySyncResult();

  const integration = await getIntegration(agentId, "followupboss");
  if (!integration?.access_token) {
    result.errors.push({
      entity: "integration",
      message: "Follow Up Boss not connected",
      timestamp: new Date().toISOString(),
    });
    return result;
  }

  const client = getClient(integration.access_token);

  try {
    // Fetch all FUB contacts (paginate up to 500 for MVP)
    let offset = 0;
    const limit = 100;
    let allPeople: any[] = [];

    while (offset < 500) {
      const { people, total } = await client.getPeople(limit, offset);
      allPeople = allPeople.concat(people);
      offset += limit;
      if (offset >= total || people.length < limit) break;
    }

    // Get existing buyers for this agent
    const { data: existingBuyers } = await admin()
      .from("buyers")
      .select("id, email, full_name, phone")
      .eq("agent_id", agentId)
      .eq("is_active", true);

    const buyersByEmail = new Map<string, any>();
    for (const b of existingBuyers ?? []) {
      if (b.email) buyersByEmail.set(b.email.toLowerCase(), b);
    }

    for (const person of allPeople) {
      try {
        const email = person.emails?.[0]?.value?.toLowerCase();
        const fullName = [person.firstName, person.lastName].filter(Boolean).join(" ").trim();
        if (!fullName) continue;

        const phone = person.phones?.[0]?.value || null;

        if (email && buyersByEmail.has(email)) {
          // Update existing buyer — fill blanks only
          const existing = buyersByEmail.get(email)!;
          const updates: Record<string, unknown> = {};
          if (!existing.phone && phone) updates.phone = phone;
          if (!existing.full_name && fullName) updates.full_name = fullName;

          if (Object.keys(updates).length > 0) {
            await admin()
              .from("buyers")
              .update({ ...updates, updated_at: new Date().toISOString() })
              .eq("id", existing.id);
            result.contactsUpdated++;
          }
          result.contactsSynced++;
        } else if (email) {
          // Create new buyer
          await admin()
            .from("buyers")
            .insert({
              agent_id: agentId,
              full_name: fullName,
              email,
              phone,
              source: "manual" as const,
              temperature: "warm" as const,
              intent_profile: {},
            });
          result.contactsCreated++;
          result.contactsSynced++;
        }
      } catch (err) {
        result.errors.push({
          entity: "contact",
          entityId: String(person.id),
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

  await updateSyncStatus(agentId, "followupboss", result.errors);
  return result;
}

/**
 * Push a research brief as a note to the FUB contact timeline.
 * Fire-and-forget — caller should .catch() errors.
 */
export async function pushResearchNote(
  agentId: string,
  briefId: string
): Promise<void> {
  const integration = await getIntegration(agentId, "followupboss");
  if (!integration?.access_token) return;

  const client = getClient(integration.access_token);

  // Get the brief with buyer and property info
  const { data: brief } = await admin()
    .from("research_briefs")
    .select("*, buyers(email, full_name), properties(address)")
    .eq("id", briefId)
    .single();

  if (!brief) return;

  const buyerEmail = (brief.buyers as any)?.email;
  if (!buyerEmail) return;

  // Find the person in FUB
  const person = await client.findPersonByEmail(buyerEmail);
  if (!person) return;

  const address = (brief.properties as any)?.address ?? "Unknown property";
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const briefUrl = `${appUrl}/r/${brief.public_token}`;

  await client.createNote(
    person.id,
    `FoyerFind Research: ${address}`,
    `Research brief generated for ${address}.\n\nConfidence: ${brief.confidence_level || "N/A"}\nData sources: ${(brief.data_sources ?? []).join(", ")}\n\nView full brief: ${briefUrl}`
  );
}

/**
 * Push a deal stage change as an event to the FUB contact timeline.
 * Fire-and-forget — caller should .catch() errors.
 */
export async function pushDealUpdate(
  agentId: string,
  dealId: string,
  newStage: string,
  previousStage: string
): Promise<void> {
  const integration = await getIntegration(agentId, "followupboss");
  if (!integration?.access_token) return;

  const client = getClient(integration.access_token);

  // Get deal with buyer info
  const { data: deal } = await admin()
    .from("deals")
    .select("*, buyers(email, full_name), properties(address)")
    .eq("id", dealId)
    .single();

  if (!deal) return;

  const buyerEmail = (deal.buyers as any)?.email;
  if (!buyerEmail) return;

  const person = await client.findPersonByEmail(buyerEmail);
  if (!person) return;

  const address = (deal.properties as any)?.address ?? "Unknown property";
  const stagePretty = newStage.replace(/_/g, " ");

  await client.createEvent(
    person.id,
    "PropertyEvent",
    `Deal stage changed: ${previousStage.replace(/_/g, " ")} → ${stagePretty}\nProperty: ${address}\n\nUpdated via FoyerFind`
  );
}
