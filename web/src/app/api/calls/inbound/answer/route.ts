import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST() {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  // Look up agent name for personalized greeting
  let agentName = "HomeAgent";
  try {
    const admin = createAdminClient() as any;
    const { data: agent } = await admin
      .from("agents")
      .select("full_name")
      .limit(1)
      .single();
    if (agent?.full_name) {
      agentName = agent.full_name;
    }
  } catch {
    // Fall back to default name
  }

  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna">Thanks for calling ${agentName}'s office. Tell me about what you're looking for and I'll make sure they get your message.</Say>
  <Record
    maxLength="300"
    action="${appUrl}/api/calls/inbound/recording-done"
    transcribe="true"
    transcribeCallback="${appUrl}/api/calls/inbound/transcription-done"
    playBeep="true"
    timeout="10"
  />
  <Say voice="Polly.Joanna">I didn't receive a recording. Please try calling back. Goodbye.</Say>
</Response>`;

  return new NextResponse(twiml, {
    headers: { "Content-Type": "text/xml" },
  });
}
