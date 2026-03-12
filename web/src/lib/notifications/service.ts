import { createAdminClient } from "@/lib/supabase/admin";
import type { AgentPreferences, ActivityEventType } from "@/types/database";
import { DEFAULT_PREFERENCES } from "@/types/database";
import { sendSms, isSmsAvailable } from "./sms";
import { sendNotificationEmail, isEmailAvailable } from "./email";
import {
  NOTIFICATION_EVENT_CONFIG,
  BATCH_WINDOW_MS,
  QUIET_HOURS_START,
  QUIET_HOURS_END,
  type NotificationPayload,
  type NotificationContext,
  type NotificationRecord,
  type NotificationChannel,
} from "./types";

interface AgentNotificationProfile {
  id: string;
  email: string;
  full_name: string;
  phone: string | null;
  notification_preferences: Partial<AgentPreferences>;
  timezone: string;
}

/**
 * Main notification dispatcher. Called after an activity entry is created.
 * Checks preferences, quiet hours, batching, then dispatches via email/SMS.
 *
 * This is fire-and-forget — callers should not await this or let failures
 * block the original action.
 */
export async function dispatchNotification(payload: NotificationPayload): Promise<void> {
  try {
    const config = NOTIFICATION_EVENT_CONFIG[payload.eventType];
    if (!config) return; // Event type not notification-worthy

    const agent = await getAgentProfile(payload.agentId);
    if (!agent) return;

    // Check agent preferences
    const prefs: AgentPreferences = { ...DEFAULT_PREFERENCES, ...(agent.notification_preferences || {}) };
    if (!prefs[config.preferenceKey]) return; // Agent disabled this category

    // Build context for message templates
    const ctx = await buildContext(agent, payload);

    // Determine channels
    const channels: NotificationChannel[] = [];

    // Email: always eligible if available
    if (await isEmailAvailable(agent.id)) {
      channels.push("email");
    }

    // SMS: only for high-priority events, if agent has phone, SMS enabled in prefs, and Twilio configured
    if (
      config.priority === "high" &&
      agent.phone &&
      prefs.sms_notifications &&
      isSmsAvailable()
    ) {
      channels.push("sms");
    }

    if (channels.length === 0) return;

    // Check batching: skip if similar notification sent recently
    if (config.batchable) {
      const shouldBatch = await checkBatching(agent.id, payload.eventType, channels);
      if (shouldBatch) return; // Recent similar notification exists
    }

    // Dispatch to each channel
    for (const channel of channels) {
      if (channel === "sms") {
        await dispatchSms(agent, payload, ctx, config.smsSummary(ctx));
      } else {
        await dispatchEmail(agent, payload, ctx, config.emailSubject(ctx), config.emailBody(ctx));
      }
    }
  } catch (err) {
    console.error("[notifications] Dispatch failed:", err);
  }
}

async function dispatchSms(
  agent: AgentNotificationProfile,
  payload: NotificationPayload,
  _ctx: NotificationContext,
  body: string
): Promise<void> {
  if (!agent.phone) return;

  const admin = createAdminClient() as any;

  // Check quiet hours
  if (isQuietHours(agent.timezone)) {
    // Queue for 8 AM next day
    const scheduledFor = getNextActiveTime(agent.timezone);
    await admin.from("notifications").insert({
      agent_id: agent.id,
      event_type: payload.eventType,
      channel: "sms",
      status: "queued",
      recipient: agent.phone,
      body,
      payload: payload.metadata || {},
      activity_id: payload.activityId,
      buyer_id: payload.buyerId,
      property_id: payload.propertyId,
      deal_id: payload.dealId,
      scheduled_for: scheduledFor,
    } satisfies NotificationRecord);
    return;
  }

  try {
    await sendSms(agent.phone, body);
    await logNotification(admin, agent, payload, "sms", "sent", agent.phone, undefined, body);
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : "Unknown error";
    console.error("[notifications] SMS failed:", errorMsg);
    await logNotification(admin, agent, payload, "sms", "failed", agent.phone, undefined, body, errorMsg);
  }
}

async function dispatchEmail(
  agent: AgentNotificationProfile,
  payload: NotificationPayload,
  _ctx: NotificationContext,
  subject: string,
  body: string
): Promise<void> {
  const admin = createAdminClient() as any;

  try {
    await sendNotificationEmail(agent.id, agent.email, subject, body);
    await logNotification(admin, agent, payload, "email", "sent", agent.email, subject, body);
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : "Unknown error";
    console.error("[notifications] Email failed:", errorMsg);
    await logNotification(admin, agent, payload, "email", "failed", agent.email, subject, body, errorMsg);
  }
}

async function logNotification(
  admin: any,
  agent: AgentNotificationProfile,
  payload: NotificationPayload,
  channel: NotificationChannel,
  status: "sent" | "failed" | "queued",
  recipient: string,
  subject: string | undefined,
  body: string,
  errorMessage?: string
): Promise<void> {
  await admin.from("notifications").insert({
    agent_id: agent.id,
    event_type: payload.eventType,
    channel,
    status,
    recipient,
    subject: subject || null,
    body,
    payload: payload.metadata || {},
    activity_id: payload.activityId,
    buyer_id: payload.buyerId,
    property_id: payload.propertyId,
    deal_id: payload.dealId,
    error_message: errorMessage || null,
  });
}

/**
 * Check if a similar notification was sent recently (within BATCH_WINDOW_MS).
 * If so, return true to indicate the current notification should be skipped.
 */
async function checkBatching(
  agentId: string,
  eventType: ActivityEventType,
  channels: NotificationChannel[]
): Promise<boolean> {
  const admin = createAdminClient() as any;
  const cutoff = new Date(Date.now() - BATCH_WINDOW_MS).toISOString();

  for (const channel of channels) {
    const { data } = await admin
      .from("notifications")
      .select("id")
      .eq("agent_id", agentId)
      .eq("event_type", eventType)
      .eq("channel", channel)
      .in("status", ["sent", "queued"])
      .gte("created_at", cutoff)
      .limit(1);

    if (data && data.length > 0) {
      return true; // Recent notification exists for this channel
    }
  }

  return false;
}

async function getAgentProfile(agentId: string): Promise<AgentNotificationProfile | null> {
  const admin = createAdminClient() as any;
  const { data, error } = await admin
    .from("agents")
    .select("id, email, full_name, phone, notification_preferences, timezone")
    .eq("id", agentId)
    .single();

  if (error || !data) return null;

  return {
    id: data.id,
    email: data.email,
    full_name: data.full_name,
    phone: data.phone,
    notification_preferences: (data.notification_preferences || {}) as Partial<AgentPreferences>,
    timezone: data.timezone || "America/Chicago",
  };
}

/**
 * Build notification context by resolving buyer/property names from IDs.
 */
async function buildContext(
  agent: AgentNotificationProfile,
  payload: NotificationPayload
): Promise<NotificationContext> {
  const admin = createAdminClient() as any;
  let buyerName: string | undefined;
  let propertyAddress: string | undefined;
  let dealStage: string | undefined;

  if (payload.buyerId) {
    const { data } = await admin
      .from("buyers")
      .select("full_name")
      .eq("id", payload.buyerId)
      .single();
    buyerName = data?.full_name;
  }

  if (payload.propertyId) {
    const { data } = await admin
      .from("properties")
      .select("address, city, state")
      .eq("id", payload.propertyId)
      .single();
    if (data) {
      propertyAddress = [data.address, data.city, data.state].filter(Boolean).join(", ");
    }
  }

  if (payload.dealId) {
    const { data } = await admin
      .from("deals")
      .select("stage")
      .eq("id", payload.dealId)
      .single();
    dealStage = data?.stage;
  }

  return {
    agentName: agent.full_name,
    buyerName,
    propertyAddress,
    dealStage,
    title: payload.title,
    description: payload.description,
    metadata: payload.metadata,
  };
}

/**
 * Check if current time is within quiet hours for the agent's timezone.
 */
function isQuietHours(timezone: string): boolean {
  try {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      hour: "numeric",
      hour12: false,
    });
    const hour = parseInt(formatter.format(now), 10);
    // Quiet: 9 PM (21) to 8 AM (8)
    return hour >= QUIET_HOURS_START || hour < QUIET_HOURS_END;
  } catch {
    // Invalid timezone, default to not quiet
    return false;
  }
}

/**
 * Get the next 8 AM in the agent's timezone as an ISO string.
 */
function getNextActiveTime(timezone: string): string {
  try {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      hour: "numeric",
      hour12: false,
    });
    const currentHour = parseInt(formatter.format(now), 10);

    // If before 8 AM, next active is today at 8 AM
    // If after 9 PM, next active is tomorrow at 8 AM
    const msToAdd = currentHour >= QUIET_HOURS_START
      ? (24 - currentHour + QUIET_HOURS_END) * 60 * 60 * 1000
      : (QUIET_HOURS_END - currentHour) * 60 * 60 * 1000;

    // Round to the hour
    const next = new Date(now.getTime() + msToAdd);
    next.setMinutes(0, 0, 0);
    return next.toISOString();
  } catch {
    // Fallback: 1 hour from now
    return new Date(Date.now() + 60 * 60 * 1000).toISOString();
  }
}

/**
 * Process queued notifications that are due.
 * Called by the /api/notifications/flush-queue route (cron or manual).
 */
export async function flushQueuedNotifications(): Promise<number> {
  const admin = createAdminClient() as any;
  const now = new Date().toISOString();

  const { data: queued, error } = await admin
    .from("notifications")
    .select("*")
    .eq("status", "queued")
    .lte("scheduled_for", now)
    .order("scheduled_for", { ascending: true })
    .limit(50);

  if (error || !queued || queued.length === 0) return 0;

  let sent = 0;

  for (const notif of queued) {
    try {
      if (notif.channel === "sms" && notif.recipient) {
        await sendSms(notif.recipient, notif.body);
      } else if (notif.channel === "email" && notif.recipient) {
        await sendNotificationEmail(
          notif.agent_id,
          notif.recipient,
          notif.subject || "FoyerFind Notification",
          notif.body
        );
      }

      await admin
        .from("notifications")
        .update({ status: "sent", sent_at: new Date().toISOString() })
        .eq("id", notif.id);

      sent++;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Unknown error";
      await admin
        .from("notifications")
        .update({ status: "failed", error_message: errorMsg })
        .eq("id", notif.id);
    }
  }

  return sent;
}
