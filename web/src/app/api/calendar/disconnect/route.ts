import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST() {
  const supabase = (await createClient()) as any;
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient() as any;
  await admin
    .from("agents")
    .update({
      calendar_connected: false,
      google_calendar_access_token: null,
      google_calendar_refresh_token: null,
      google_calendar_token_expires_at: null,
    })
    .eq("user_id", user.id);

  return NextResponse.json({ success: true });
}
