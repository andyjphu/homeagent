import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/notifications/history?limit=50&offset=0&channel=sms
 *
 * Returns the agent's notification history for the Settings page.
 */
export async function GET(request: Request) {
  try {
    const supabase = (await createClient()) as any;
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: agent } = await supabase
      .from("agents")
      .select("id")
      .eq("user_id", user.id)
      .single();

    if (!agent) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }

    const url = new URL(request.url);
    const limit = Math.min(parseInt(url.searchParams.get("limit") || "50"), 100);
    const offset = parseInt(url.searchParams.get("offset") || "0");
    const channel = url.searchParams.get("channel"); // 'email' | 'sms' | null

    let query = supabase
      .from("notifications")
      .select("id, event_type, channel, status, recipient, subject, body, sent_at, created_at, error_message")
      .eq("agent_id", agent.id)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (channel === "email" || channel === "sms") {
      query = query.eq("channel", channel);
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ notifications: data || [] });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
