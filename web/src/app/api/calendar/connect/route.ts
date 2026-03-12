import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCalendarAuthUrl } from "@/lib/calendar/oauth";

export async function GET() {
  const supabase = (await createClient()) as any;
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(
      new URL("/login", process.env.NEXT_PUBLIC_APP_URL)
    );
  }

  const authUrl = getCalendarAuthUrl();
  return NextResponse.redirect(authUrl);
}
