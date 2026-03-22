import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthedClient } from "@/lib/gmail/tokens";
import { createGmailDraft } from "@/lib/gmail/drafts";
import { isSmsAvailable, sendSms } from "@/lib/notifications/sms";

const DEADLINE_FIELDS: Record<string, string> = {
  inspection_deadline: "Inspection",
  appraisal_deadline: "Appraisal",
  financing_deadline: "Financing",
  title_deadline: "Title",
};

// Alert windows in hours
const ALERT_WINDOWS = [
  { hours: 48, label: "in 2 days", key: "48h", sms: false },
  { hours: 24, label: "Tomorrow", key: "24h", sms: false },
  { hours: 2, label: "in 2 hours", key: "2h", sms: true },
];

export async function GET(request: Request) {
  try {
    // Optional: verify cron secret for security
    const { searchParams } = new URL(request.url);
    const secret = searchParams.get("secret");
    if (process.env.CRON_SECRET && secret !== process.env.CRON_SECRET) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = createAdminClient() as any;

    // Fetch all active deals in contract-related stages
    const { data: deals, error } = await supabase
      .from("deals")
      .select(
        "id, agent_id, closing_date, contingencies, buyers(full_name, email), properties(address), agents(email, phone, gmail_connected, notification_preferences)"
      )
      .in("stage", [
        "under_contract",
        "inspection",
        "appraisal",
        "closing",
      ]);

    if (error) {
      console.error("[check-deadlines] Query error:", error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!deals || deals.length === 0) {
      return NextResponse.json({ processed: 0, alerts: 0 });
    }

    let totalAlerts = 0;
    const now = Date.now();

    for (const deal of deals) {
      const contingencies = (deal.contingencies ?? {}) as Record<string, string>;
      const agent = deal.agents as any;
      const buyer = deal.buyers as any;
      const property = deal.properties as any;
      const address = property?.address ?? "Unknown property";
      const alertsSent = ((contingencies as any)._alerts_sent ?? {}) as Record<string, boolean>;
      let alertsUpdated = false;

      // Build deadline list: contingency deadlines + closing date
      const deadlines: { type: string; label: string; date: Date }[] = [];

      for (const [field, label] of Object.entries(DEADLINE_FIELDS)) {
        if (contingencies[field]) {
          deadlines.push({
            type: field,
            label,
            date: new Date(contingencies[field]),
          });
        }
      }

      if (deal.closing_date) {
        deadlines.push({
          type: "closing_date",
          label: "Closing",
          date: new Date(deal.closing_date),
        });
      }

      for (const deadline of deadlines) {
        const hoursUntil =
          (deadline.date.getTime() - now) / (1000 * 60 * 60);

        for (const window of ALERT_WINDOWS) {
          // Check if we're within this alert window
          // e.g., for 48h window: 46h < hoursUntil < 48h (or just < 48h and > next window)
          const nextWindow = ALERT_WINDOWS.find(
            (w) => w.hours < window.hours
          );
          const lowerBound = nextWindow ? nextWindow.hours : 0;

          if (hoursUntil <= 0 || hoursUntil > window.hours || hoursUntil <= lowerBound) {
            continue;
          }

          const alertKey = `${deadline.type}_${window.key}`;
          if (alertsSent[alertKey]) continue; // Already sent

          // Send Gmail draft alert
          if (agent?.gmail_connected && agent?.email) {
            try {
              const auth = await getAuthedClient(deal.agent_id);
              const subject =
                window.key === "2h"
                  ? `URGENT: ${deadline.label} deadline ${window.label} for ${address}`
                  : `Reminder: ${deadline.label} deadline ${window.label} for ${address}`;

              await createGmailDraft(auth, {
                to: agent.email,
                subject,
                htmlBody: `
                  <h3>${subject}</h3>
                  <p><strong>Deal:</strong> ${buyer?.full_name ?? "Unknown"} × ${address}</p>
                  <p><strong>Deadline:</strong> ${deadline.label} — ${deadline.date.toLocaleDateString("en-US", {
                    weekday: "long",
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                  })}</p>
                  <p>Please ensure all required actions are completed before this deadline.</p>
                `,
              });
            } catch (err) {
              console.error(
                `[check-deadlines] Gmail draft failed for deal ${deal.id}:`,
                err
              );
            }
          }

          // Send SMS for 2h urgent window
          if (
            window.sms &&
            isSmsAvailable() &&
            agent?.phone
          ) {
            const prefs = (agent.notification_preferences ?? {}) as any;
            if (prefs.sms_notifications !== false) {
              try {
                await sendSms(
                  agent.phone,
                  `URGENT: ${deadline.label} deadline ${window.label} for ${address}. Ensure all actions are complete.`
                );
              } catch (err) {
                console.error(
                  `[check-deadlines] SMS failed for deal ${deal.id}:`,
                  err
                );
              }
            }
          }

          alertsSent[alertKey] = true;
          alertsUpdated = true;
          totalAlerts++;
        }
      }

      // Persist which alerts have been sent to prevent duplicates
      if (alertsUpdated) {
        await supabase
          .from("deals")
          .update({
            contingencies: {
              ...contingencies,
              _alerts_sent: alertsSent,
            },
            updated_at: new Date().toISOString(),
          })
          .eq("id", deal.id);
      }
    }

    return NextResponse.json({
      processed: deals.length,
      alerts: totalAlerts,
    });
  } catch (err) {
    console.error("[check-deadlines] Unexpected error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
