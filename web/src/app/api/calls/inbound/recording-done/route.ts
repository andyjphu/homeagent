import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createActivityEntry } from "@/lib/supabase/activity";

export const maxDuration = 300;

export async function POST(request: Request) {
  const formData = await request.formData();
  const recordingUrl = formData.get("RecordingUrl") as string;
  const recordingSid = formData.get("RecordingSid") as string;
  const recordingDuration = parseInt(
    (formData.get("RecordingDuration") as string) || "0",
    10
  );
  const callerPhone = formData.get("From") as string;
  const calledNumber = formData.get("To") as string;
  const callSid = formData.get("CallSid") as string;

  const thankYouTwiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna">Thank you for your message. An agent will get back to you shortly. Goodbye.</Say>
  <Hangup/>
</Response>`;

  if (!recordingUrl) {
    return new NextResponse(thankYouTwiml, {
      headers: { "Content-Type": "text/xml" },
    });
  }

  const admin = createAdminClient() as any;

  // Get the agent (for demo, use the first/only agent)
  const { data: agent } = await admin
    .from("agents")
    .select("id, full_name")
    .limit(1)
    .single();

  if (!agent) {
    console.error("[call-recording] No agent found in database");
    return new NextResponse(thankYouTwiml, {
      headers: { "Content-Type": "text/xml" },
    });
  }

  // Download recording from Twilio (append .wav, use Basic auth)
  const twilioSid = process.env.TWILIO_ACCOUNT_SID!;
  const twilioAuth = process.env.TWILIO_AUTH_TOKEN!;
  const wavUrl = `${recordingUrl}.wav`;

  let audioBuffer: Buffer;
  try {
    const res = await fetch(wavUrl, {
      headers: {
        Authorization:
          "Basic " +
          Buffer.from(`${twilioSid}:${twilioAuth}`).toString("base64"),
      },
    });
    if (!res.ok) throw new Error(`Twilio download failed: ${res.status}`);
    audioBuffer = Buffer.from(await res.arrayBuffer());
  } catch (err) {
    console.error("[call-recording] Failed to download recording:", err);
    return new NextResponse(thankYouTwiml, {
      headers: { "Content-Type": "text/xml" },
    });
  }

  // Upload to Supabase Storage
  const storagePath = `${agent.id}/${callSid}-${Date.now()}.wav`;

  // Ensure bucket exists (idempotent)
  try {
    await admin.storage.createBucket("call-recordings", {
      public: true, // Public for demo — use signed URLs in production
      allowedMimeTypes: ["audio/wav", "audio/mpeg", "audio/mp4", "audio/webm"],
    });
  } catch {
    // Bucket already exists
  }

  const { error: uploadError } = await admin.storage
    .from("call-recordings")
    .upload(storagePath, audioBuffer, {
      contentType: "audio/wav",
      upsert: false,
    });

  if (uploadError) {
    console.error("[call-recording] Storage upload failed:", uploadError);
  }

  // Get public URL for the recording
  const { data: urlData } = admin.storage
    .from("call-recordings")
    .getPublicUrl(storagePath);

  const publicUrl = urlData?.publicUrl || null;

  // Create communication record — transcription will arrive via Twilio callback
  const { data: comm, error: commError } = await admin
    .from("communications")
    .insert({
      agent_id: agent.id,
      type: "call",
      direction: "inbound",
      from_address: callerPhone,
      to_address: calledNumber,
      duration_seconds: recordingDuration,
      recording_url: publicUrl,
      subject: `Inbound call from ${callerPhone}`,
      is_processed: false,
      occurred_at: new Date().toISOString(),
      classification: "new_lead",
      ai_analysis: {
        status: "awaiting_transcription",
        recording_sid: recordingSid,
        call_sid: callSid,
        storage_path: storagePath,
      },
    })
    .select("id")
    .single();

  if (commError) {
    console.error(
      "[call-recording] Failed to create communication:",
      commError
    );
  }

  // Create a basic lead immediately (will be enriched when transcription arrives)
  if (comm) {
    const { data: lead } = await admin
      .from("leads")
      .insert({
        agent_id: agent.id,
        source: "call",
        status: "draft",
        confidence: "low",
        name: `Caller ${callerPhone}`,
        phone: callerPhone,
        raw_source_content: `Inbound call (${recordingDuration}s) — transcription pending via Twilio`,
        extracted_info: {},
        source_communication_id: comm.id,
      })
      .select("id")
      .single();

    if (lead) {
      await admin
        .from("communications")
        .update({ lead_id: lead.id })
        .eq("id", comm.id);
    }

    console.log(
      "[call-recording] Communication created:",
      comm.id,
      "Lead created:",
      lead?.id
    );

    // Log activity for the inbound call
    await createActivityEntry(
      agent.id,
      "call_completed",
      `Inbound call from ${callerPhone}`,
      `Duration: ${recordingDuration}s — transcription pending`,
      { caller: callerPhone, duration: recordingDuration },
      { communicationId: comm.id }
    );
  }

  return new NextResponse(thankYouTwiml, {
    headers: { "Content-Type": "text/xml" },
  });
}
