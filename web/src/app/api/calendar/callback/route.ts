import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createCalendarOAuth2Client } from "@/lib/calendar/oauth";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const error = searchParams.get("error");

  if (error || !code) {
    return NextResponse.redirect(`${origin}/settings?calendar=error`);
  }

  const supabase = (await createClient()) as any;
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(`${origin}/login`);
  }

  try {
    const oauth2Client = createCalendarOAuth2Client();
    const { tokens } = await oauth2Client.getToken(code);

    if (!tokens.access_token || !tokens.refresh_token) {
      return NextResponse.redirect(`${origin}/settings?calendar=error`);
    }

    const admin = createAdminClient() as any;
    await admin
      .from("agents")
      .update({
        calendar_connected: true,
        google_calendar_access_token: tokens.access_token,
        google_calendar_refresh_token: tokens.refresh_token,
        google_calendar_token_expires_at: new Date(
          tokens.expiry_date!
        ).toISOString(),
      })
      .eq("user_id", user.id);

    return NextResponse.redirect(`${origin}/settings?calendar=connected`);
  } catch (err) {
    console.error("Calendar OAuth callback error:", err);
    return NextResponse.redirect(`${origin}/settings?calendar=error`);
  }
}
