import { NextResponse } from "next/server";
import { flushQueuedNotifications } from "@/lib/notifications/service";

/**
 * GET /api/notifications/flush-queue
 *
 * Processes queued notifications that are due (quiet-hours SMS).
 * Intended to be called by a cron job (e.g., every 15 minutes via Vercel Cron).
 */
export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = request.headers.get("authorization");
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    const sent = await flushQueuedNotifications();
    return NextResponse.json({ flushed: sent });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    console.error("[flush-queue] Error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
