import { google, calendar_v3 } from "googleapis";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCalendarAuthedClient } from "./tokens";

interface DealDeadline {
  eventType: string;
  date: string; // YYYY-MM-DD
  summary: string;
  description?: string;
}

interface SyncResult {
  created: string[];
  updated: string[];
  deleted: string[];
  errors: string[];
}

/**
 * Check if calendar sync is enabled for this agent.
 */
async function isCalendarSyncEnabled(agentId: string): Promise<boolean> {
  const supabase = createAdminClient() as any;
  const { data: agent } = await supabase
    .from("agents")
    .select("calendar_connected, calendar_auto_create_events")
    .eq("id", agentId)
    .single();
  return !!(agent?.calendar_connected && agent?.calendar_auto_create_events);
}

/**
 * Extract deadlines from a deal object into a flat list.
 */
function extractDealDeadlines(
  deal: {
    closing_date?: string | null;
    contingencies?: Record<string, string> | null;
  },
  buyerName: string,
  propertyAddress: string
): DealDeadline[] {
  const deadlines: DealDeadline[] = [];
  const contingencies =
    (deal.contingencies as Record<string, string> | null) ?? {};

  if (deal.closing_date) {
    deadlines.push({
      eventType: "closing",
      date: deal.closing_date,
      summary: `Closing: ${propertyAddress}`,
      description: `Closing for ${buyerName} at ${propertyAddress}`,
    });
  }

  const deadlineMap: Record<string, string> = {
    inspection_deadline: "Inspection Deadline",
    appraisal_deadline: "Appraisal Deadline",
    financing_deadline: "Financing Deadline",
    title_deadline: "Title Deadline",
  };

  for (const [key, label] of Object.entries(deadlineMap)) {
    if (contingencies[key]) {
      deadlines.push({
        eventType: key,
        date: contingencies[key],
        summary: `${label}: ${propertyAddress}`,
        description: `${label} for ${buyerName} at ${propertyAddress}`,
      });
    }
  }

  return deadlines;
}

/**
 * Build a Google Calendar event resource for a deadline.
 */
function buildCalendarEvent(
  deadline: DealDeadline,
  dealId: string
): calendar_v3.Schema$Event {
  return {
    summary: deadline.summary,
    description: deadline.description,
    start: { date: deadline.date },
    end: { date: deadline.date },
    reminders: {
      useDefault: false,
      overrides: [
        { method: "popup", minutes: 24 * 60 }, // 24 hours before
        { method: "popup", minutes: 120 }, // 2 hours before
      ],
    },
    extendedProperties: {
      private: {
        foyerfind_id: dealId,
        foyerfind_event_type: deadline.eventType,
      },
    },
  };
}

/**
 * Sync deal deadlines to Google Calendar.
 * Creates/updates/deletes events as needed. Fire-and-forget safe.
 */
export async function syncDealToCalendar(
  agentId: string,
  dealId: string,
  deal: {
    closing_date?: string | null;
    contingencies?: Record<string, string> | null;
  },
  buyerName: string,
  propertyAddress: string
): Promise<SyncResult> {
  const result: SyncResult = {
    created: [],
    updated: [],
    deleted: [],
    errors: [],
  };

  try {
    const enabled = await isCalendarSyncEnabled(agentId);
    if (!enabled) return result;

    const auth = await getCalendarAuthedClient(agentId);
    const calendar = google.calendar({ version: "v3", auth });
    const supabase = createAdminClient() as any;

    const deadlines = extractDealDeadlines(deal, buyerName, propertyAddress);

    // Get existing calendar event mappings for this deal
    const { data: existingEvents } = await supabase
      .from("calendar_events")
      .select("*")
      .eq("deal_id", dealId);

    const existing = (existingEvents ?? []) as Array<{
      id: string;
      event_type: string;
      google_event_id: string;
      event_date: string | null;
      summary: string | null;
    }>;

    const existingByType = new Map(existing.map((e) => [e.event_type, e]));
    const desiredTypes = new Set(deadlines.map((d) => d.eventType));

    // Create or update events
    for (const deadline of deadlines) {
      const existingEvent = existingByType.get(deadline.eventType);
      const eventBody = buildCalendarEvent(deadline, dealId);

      if (existingEvent) {
        // Update if date or summary changed
        if (
          existingEvent.event_date !== deadline.date ||
          existingEvent.summary !== deadline.summary
        ) {
          try {
            await calendar.events.update({
              calendarId: "primary",
              eventId: existingEvent.google_event_id,
              requestBody: eventBody,
            });
            await supabase
              .from("calendar_events")
              .update({
                event_date: deadline.date,
                summary: deadline.summary,
              })
              .eq("id", existingEvent.id);
            result.updated.push(deadline.eventType);
          } catch (err) {
            console.error(
              `[calendar-sync] Update failed for ${deadline.eventType}:`,
              err
            );
            result.errors.push(`update:${deadline.eventType}`);
          }
        }
      } else {
        // Create new event
        try {
          const res = await calendar.events.insert({
            calendarId: "primary",
            requestBody: eventBody,
          });
          if (res.data.id) {
            await supabase.from("calendar_events").insert({
              agent_id: agentId,
              deal_id: dealId,
              google_event_id: res.data.id,
              event_type: deadline.eventType,
              event_date: deadline.date,
              summary: deadline.summary,
            });
            result.created.push(deadline.eventType);
          }
        } catch (err) {
          console.error(
            `[calendar-sync] Create failed for ${deadline.eventType}:`,
            err
          );
          result.errors.push(`create:${deadline.eventType}`);
        }
      }
    }

    // Delete events for removed deadlines
    for (const existingEvent of existing) {
      if (!desiredTypes.has(existingEvent.event_type)) {
        try {
          await calendar.events.delete({
            calendarId: "primary",
            eventId: existingEvent.google_event_id,
          });
        } catch (err) {
          // Event may already be deleted from Google Calendar directly
          console.error(
            `[calendar-sync] Delete from Google failed for ${existingEvent.event_type}:`,
            err
          );
        }
        await supabase
          .from("calendar_events")
          .delete()
          .eq("id", existingEvent.id);
        result.deleted.push(existingEvent.event_type);
      }
    }
  } catch (err) {
    console.error("[calendar-sync] Top-level sync error:", err);
    result.errors.push("sync_failed");
  }

  return result;
}

/**
 * Delete ALL calendar events for a deal (e.g., when deal goes to 'dead').
 */
export async function deleteDealCalendarEvents(
  agentId: string,
  dealId: string
): Promise<void> {
  try {
    const enabled = await isCalendarSyncEnabled(agentId);
    if (!enabled) return;

    const auth = await getCalendarAuthedClient(agentId);
    const calendar = google.calendar({ version: "v3", auth });
    const supabase = createAdminClient() as any;

    const { data: events } = await supabase
      .from("calendar_events")
      .select("id, google_event_id")
      .eq("deal_id", dealId);

    for (const event of events ?? []) {
      try {
        await calendar.events.delete({
          calendarId: "primary",
          eventId: event.google_event_id,
        });
      } catch (err) {
        console.error("[calendar-sync] Delete event failed:", err);
      }
      await supabase.from("calendar_events").delete().eq("id", event.id);
    }
  } catch (err) {
    console.error("[calendar-sync] deleteDealCalendarEvents failed:", err);
  }
}
