import { createAdminClient } from "./admin";
import type { ActivityEventType } from "@/types/database";

interface ActivityEntryOptions {
  buyerId?: string;
  propertyId?: string;
  dealId?: string;
  communicationId?: string;
  taskId?: string;
  isActionRequired?: boolean;
}

/**
 * Shared helper for creating activity_feed entries.
 * Every mutation that logs activity should use this function.
 */
export async function createActivityEntry(
  agentId: string,
  type: ActivityEventType,
  title: string,
  description?: string,
  metadata?: Record<string, unknown>,
  options?: ActivityEntryOptions
): Promise<string | null> {
  const admin = createAdminClient() as ReturnType<typeof createAdminClient>;

  const { data, error } = await (admin as any)
    .from("activity_feed")
    .insert({
      agent_id: agentId,
      event_type: type,
      title,
      description: description ?? null,
      metadata: metadata ?? {},
      is_action_required: options?.isActionRequired ?? false,
      buyer_id: options?.buyerId ?? null,
      property_id: options?.propertyId ?? null,
      deal_id: options?.dealId ?? null,
      communication_id: options?.communicationId ?? null,
      task_id: options?.taskId ?? null,
    })
    .select("id")
    .single();

  if (error) {
    console.error("[activity] Failed to create entry:", error.message);
    return null;
  }

  return data?.id ?? null;
}
