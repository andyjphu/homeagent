import type { ActivityEventType } from "@/types/database";

export type NotificationChannel = "email" | "sms";

export type NotificationPriority = "high" | "normal" | "low";

/**
 * Maps activity event types to notification configuration.
 * - preferenceKey: which AgentPreferences toggle controls this event
 * - priority: determines SMS eligibility (high = SMS + email, normal/low = email only)
 * - batchable: if true, similar events within BATCH_WINDOW_MS are consolidated
 * - smsTemplate / emailTemplate: message formatters
 */
export interface NotificationEventConfig {
  preferenceKey: "new_leads" | "email_activity" | "property_changes" | "deadline_reminders";
  priority: NotificationPriority;
  batchable: boolean;
  smsSummary: (ctx: NotificationContext) => string;
  emailSubject: (ctx: NotificationContext) => string;
  emailBody: (ctx: NotificationContext) => string;
}

export interface NotificationContext {
  agentName: string;
  buyerName?: string;
  propertyAddress?: string;
  dealStage?: string;
  title: string;
  description?: string;
  metadata?: Record<string, unknown>;
}

export interface NotificationPayload {
  agentId: string;
  eventType: ActivityEventType;
  activityId: string | null;
  title: string;
  description?: string;
  metadata?: Record<string, unknown>;
  buyerId?: string | null;
  propertyId?: string | null;
  dealId?: string | null;
}

export interface NotificationRecord {
  agent_id: string;
  event_type: ActivityEventType;
  channel: NotificationChannel;
  status: "sent" | "failed" | "queued" | "batched";
  recipient: string;
  subject?: string;
  body: string;
  payload: Record<string, unknown>;
  activity_id?: string | null;
  buyer_id?: string | null;
  property_id?: string | null;
  deal_id?: string | null;
  error_message?: string;
  scheduled_for?: string;
}

/** Batch window: events of the same type within this window get consolidated */
export const BATCH_WINDOW_MS = 60 * 60 * 1000; // 1 hour

/** Quiet hours: no SMS during these hours (agent's local time) */
export const QUIET_HOURS_START = 21; // 9 PM
export const QUIET_HOURS_END = 8;    // 8 AM

/**
 * Event type → notification config mapping.
 * Only events listed here trigger notifications.
 */
export const NOTIFICATION_EVENT_CONFIG: Partial<Record<ActivityEventType, NotificationEventConfig>> = {
  property_favorited: {
    preferenceKey: "property_changes",
    priority: "high",
    batchable: false,
    smsSummary: (ctx) =>
      `${ctx.buyerName || "A buyer"} favorited ${ctx.propertyAddress || "a property"}. High interest signal!`,
    emailSubject: (ctx) =>
      `${ctx.buyerName || "Buyer"} favorited a property`,
    emailBody: (ctx) =>
      `${ctx.buyerName || "A buyer"} just favorited ${ctx.propertyAddress || "a property"} on their dashboard.\n\n` +
      `This is a strong interest signal. Consider reaching out to discuss next steps.\n\n` +
      `— FoyerFind`,
  },

  comment_added: {
    preferenceKey: "property_changes",
    priority: "normal",
    batchable: false,
    smsSummary: (ctx) =>
      `${ctx.buyerName || "A buyer"} commented on ${ctx.propertyAddress || "a property"}.`,
    emailSubject: (ctx) =>
      `New comment from ${ctx.buyerName || "buyer"} on ${ctx.propertyAddress || "a property"}`,
    emailBody: (ctx) =>
      `${ctx.buyerName || "A buyer"} left a comment on ${ctx.propertyAddress || "a property"}:\n\n` +
      `"${ctx.description || "(no preview)"}"\n\n` +
      `Log in to FoyerFind to view and respond.\n\n` +
      `— FoyerFind`,
  },

  buyer_updated: {
    preferenceKey: "new_leads",
    priority: "normal",
    batchable: false,
    smsSummary: (ctx) =>
      `${ctx.buyerName || "A buyer"} completed their intake form.`,
    emailSubject: (ctx) =>
      `${ctx.buyerName || "Buyer"} submitted their intake form`,
    emailBody: (ctx) => {
      const meta = ctx.metadata || {};
      return `${ctx.buyerName || "A buyer"} just completed their intake form.\n\n` +
        (meta.budget ? `Budget: ${meta.budget}\n` : "") +
        (meta.beds ? `Beds: ${meta.beds}\n` : "") +
        (meta.areas ? `Preferred areas: ${meta.areas}\n` : "") +
        (meta.timeline ? `Timeline: ${meta.timeline}\n` : "") +
        `\nLog in to FoyerFind to review their full profile.\n\n` +
        `— FoyerFind`;
    },
  },

  dashboard_viewed: {
    preferenceKey: "property_changes",
    priority: "low",
    batchable: true,
    smsSummary: (ctx) =>
      `${ctx.buyerName || "A buyer"} viewed their dashboard.`,
    emailSubject: (ctx) =>
      `${ctx.buyerName || "Buyer"} visited their dashboard`,
    emailBody: (ctx) =>
      `${ctx.buyerName || "A buyer"} viewed their FoyerFind dashboard.\n\n` +
      `${ctx.description || ""}\n\n` +
      `— FoyerFind`,
  },

  lead_detected: {
    preferenceKey: "new_leads",
    priority: "high",
    batchable: false,
    smsSummary: (ctx) => {
      const meta = ctx.metadata || {};
      const name = meta.leadName || "Unknown";
      const budget = meta.budget ? ` — ${meta.budget} budget` : "";
      const area = meta.area ? `, ${meta.area}` : "";
      return `New lead: ${name}${budget}${area}`;
    },
    emailSubject: () => `New lead detected`,
    emailBody: (ctx) => {
      const meta = ctx.metadata || {};
      return `A new lead has been detected.\n\n` +
        `Name: ${meta.leadName || "Unknown"}\n` +
        `Source: ${meta.source || "Unknown"}\n` +
        (meta.email ? `Email: ${meta.email}\n` : "") +
        (meta.phone ? `Phone: ${meta.phone}\n` : "") +
        (meta.budget ? `Budget: ${meta.budget}\n` : "") +
        (meta.area ? `Area: ${meta.area}\n` : "") +
        `\nLog in to FoyerFind to review and confirm this lead.\n\n` +
        `— FoyerFind`;
    },
  },

  deadline_approaching: {
    preferenceKey: "deadline_reminders",
    priority: "high",
    batchable: false,
    smsSummary: (ctx) => {
      const meta = ctx.metadata || {};
      return `Deal deadline: ${meta.deadlineType || "Unknown"} for ${ctx.propertyAddress || "a deal"} in ${meta.hoursRemaining || "< 48"}h`;
    },
    emailSubject: (ctx) => {
      const meta = ctx.metadata || {};
      return `Deal deadline approaching: ${meta.deadlineType || "deadline"} in ${meta.hoursRemaining || "< 48"} hours`;
    },
    emailBody: (ctx) => {
      const meta = ctx.metadata || {};
      return `A deal deadline is approaching:\n\n` +
        `Deadline: ${meta.deadlineType || "Unknown"}\n` +
        `Property: ${ctx.propertyAddress || "Unknown"}\n` +
        `Buyer: ${ctx.buyerName || "Unknown"}\n` +
        `Due: ${meta.deadlineDate || "Unknown"} (${meta.hoursRemaining || "< 48"} hours remaining)\n\n` +
        `Log in to FoyerFind to review this deal.\n\n` +
        `— FoyerFind`;
    },
  },

  call_analyzed: {
    preferenceKey: "new_leads",
    priority: "high",
    batchable: false,
    smsSummary: (ctx) => {
      const meta = ctx.metadata || {};
      return `AI voice agent qualified a new lead: ${meta.callerName || "Unknown caller"}`;
    },
    emailSubject: () => `Voice agent qualified a new lead`,
    emailBody: (ctx) => {
      const meta = ctx.metadata || {};
      return `Your AI voice agent just completed a call and qualified a new lead.\n\n` +
        `Caller: ${meta.callerName || "Unknown"}\n` +
        (meta.phone ? `Phone: ${meta.phone}\n` : "") +
        (meta.summary ? `Summary: ${meta.summary}\n` : "") +
        `\nLog in to FoyerFind to review the call details.\n\n` +
        `— FoyerFind`;
    },
  },

  buyer_criteria_changed: {
    preferenceKey: "property_changes",
    priority: "normal",
    batchable: true,
    smsSummary: (ctx) =>
      `${ctx.buyerName || "A buyer"} updated their search criteria.`,
    emailSubject: (ctx) =>
      `${ctx.buyerName || "Buyer"} updated search criteria`,
    emailBody: (ctx) =>
      `${ctx.buyerName || "A buyer"} updated their search criteria on FoyerFind.\n\n` +
      `${ctx.description || ""}\n\n` +
      `Log in to review the changes and adjust property recommendations.\n\n` +
      `— FoyerFind`,
  },
};
