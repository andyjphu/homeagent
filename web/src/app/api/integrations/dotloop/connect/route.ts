import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getDotloopAuthUrl } from "@/lib/integrations/dotloop/client";

export async function GET() {
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

    if (!process.env.DOTLOOP_CLIENT_ID || !process.env.DOTLOOP_REDIRECT_URI) {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
      return NextResponse.redirect(
        `${appUrl}/app/connections?error=dotloop_not_configured`
      );
    }

    // Encode agent ID in state for the callback
    const state = Buffer.from(JSON.stringify({ agentId: agent.id })).toString(
      "base64url"
    );
    const authUrl = getDotloopAuthUrl(state);

    return NextResponse.redirect(authUrl);
  } catch (err) {
    console.error("[dotloop/connect] Error:", err);
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    return NextResponse.redirect(
      `${appUrl}/app/connections?error=dotloop_connect_failed`
    );
  }
}
