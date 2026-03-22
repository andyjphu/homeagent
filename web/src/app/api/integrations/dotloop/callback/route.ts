import { NextResponse } from "next/server";
import { exchangeDotloopCode, DotloopClient } from "@/lib/integrations/dotloop/client";
import { upsertIntegration } from "@/lib/integrations/db";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  if (!code || !state) {
    return NextResponse.redirect(
      `${appUrl}/app/connections?error=dotloop_missing_params`
    );
  }

  try {
    // Decode agent ID from state
    const { agentId } = JSON.parse(
      Buffer.from(state, "base64url").toString("utf-8")
    );

    // Exchange code for tokens
    const tokens = await exchangeDotloopCode(code);

    // Get the profile ID for future API calls
    const client = new DotloopClient(tokens.access_token);
    const profile = await client.getProfile();

    await upsertIntegration(agentId, "dotloop", {
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      token_expires_at: new Date(
        Date.now() + tokens.expires_in * 1000
      ).toISOString(),
      settings: { profileId: profile.id, profileName: profile.name },
      is_active: true,
    });

    return NextResponse.redirect(`${appUrl}/app/connections?dotloop=connected`);
  } catch (err) {
    console.error("[dotloop/callback] Error:", err);
    return NextResponse.redirect(
      `${appUrl}/app/connections?error=dotloop_auth_failed`
    );
  }
}
