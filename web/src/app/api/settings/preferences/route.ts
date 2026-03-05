import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { AgentPreferences } from "@/types/database";
import { DEFAULT_PREFERENCES } from "@/types/database";

export async function POST(request: Request) {
  try {
    const supabase = await createClient() as any;
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body: Partial<AgentPreferences> = await request.json();

    // Merge with defaults, only allow known boolean keys
    const prefs: AgentPreferences = { ...DEFAULT_PREFERENCES };
    for (const key of Object.keys(DEFAULT_PREFERENCES) as (keyof AgentPreferences)[]) {
      if (typeof body[key] === "boolean") {
        prefs[key] = body[key];
      }
    }

    const { error } = await supabase
      .from("agents")
      .update({ notification_preferences: prefs })
      .eq("user_id", user.id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET() {
  try {
    const supabase = await createClient() as any;
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: agent, error } = await supabase
      .from("agents")
      .select("notification_preferences")
      .eq("user_id", user.id)
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const prefs = { ...DEFAULT_PREFERENCES, ...(agent?.notification_preferences as Partial<AgentPreferences> || {}) };
    return NextResponse.json(prefs);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
