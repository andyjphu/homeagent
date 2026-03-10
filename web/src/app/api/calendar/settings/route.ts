import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = (await createClient()) as any;
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const updates: Record<string, unknown> = {};

  if (body.workingHours) {
    updates.calendar_working_hours = body.workingHours;
  }
  if (typeof body.autoCreateEvents === "boolean") {
    updates.calendar_auto_create_events = body.autoCreateEvents;
  }
  if (typeof body.showAvailability === "boolean") {
    updates.calendar_show_availability = body.showAvailability;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No valid fields" }, { status: 400 });
  }

  const { error } = await supabase
    .from("agents")
    .update(updates)
    .eq("user_id", user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
