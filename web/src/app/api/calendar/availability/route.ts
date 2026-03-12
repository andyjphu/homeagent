import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAvailability } from "@/lib/calendar/availability";
import { addDays, format } from "date-fns";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const agentId = searchParams.get("agentId");
  const startDate = searchParams.get("startDate");
  const endDate = searchParams.get("endDate");
  const slotMinutes = parseInt(searchParams.get("slotMinutes") || "30", 10);

  if (!agentId) {
    return NextResponse.json({ error: "agentId required" }, { status: 400 });
  }

  // Verify agent exists and has calendar availability enabled
  const supabase = createAdminClient() as any;
  const { data: agent } = await supabase
    .from("agents")
    .select("calendar_connected, calendar_show_availability")
    .eq("id", agentId)
    .single();

  if (!agent?.calendar_connected || !agent?.calendar_show_availability) {
    return NextResponse.json(
      { error: "Calendar availability not enabled" },
      { status: 404 }
    );
  }

  const now = new Date();
  const start = startDate || format(now, "yyyy-MM-dd");
  const end = endDate || format(addDays(now, 14), "yyyy-MM-dd");

  try {
    const availability = await getAvailability(agentId, start, end, slotMinutes);
    return NextResponse.json({ availability });
  } catch (err) {
    console.error("[calendar/availability] Error:", err);
    return NextResponse.json(
      { error: "Failed to fetch availability" },
      { status: 500 }
    );
  }
}
