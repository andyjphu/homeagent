import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST() {
  const supabase = await createClient() as any;
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient() as any;
  await admin
    .from("agents")
    .update({
      gmail_connected: false,
      gmail_access_token: null,
      gmail_refresh_token: null,
      gmail_token_expires_at: null,
      gmail_last_scan_at: null,
    })
    .eq("user_id", user.id);

  return NextResponse.json({ success: true });
}
