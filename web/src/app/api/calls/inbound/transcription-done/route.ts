import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { extractBuyerIntent } from "@/lib/services/call-intelligence";

export const maxDuration = 60;

export async function POST(request: Request) {
  const formData = await request.formData();
  const transcriptionText = formData.get("TranscriptionText") as string;
  const transcriptionSid = formData.get("TranscriptionSid") as string;
  const transcriptionStatus = formData.get("TranscriptionStatus") as string;
  const recordingSid = formData.get("RecordingSid") as string;
  const callSid = formData.get("CallSid") as string;
  const callerPhone = formData.get("From") as string;

  console.log(
    "[transcription] Received callback — status:",
    transcriptionStatus,
    "recordingSid:",
    recordingSid
  );

  // Twilio sends status "completed" when transcription is ready
  if (transcriptionStatus !== "completed" || !transcriptionText) {
    console.log(
      "[transcription] Skipping — status:",
      transcriptionStatus,
      "hasText:",
      !!transcriptionText
    );
    return NextResponse.json({ ok: true });
  }

  const admin = createAdminClient() as any;

  // Find the communication record by matching the recording_sid in ai_analysis
  const { data: comms } = await admin
    .from("communications")
    .select("id, lead_id, from_address, ai_analysis")
    .eq("type", "call")
    .eq("direction", "inbound")
    .order("created_at", { ascending: false })
    .limit(20);

  const comm = comms?.find(
    (c: any) => c.ai_analysis?.recording_sid === recordingSid
  );

  if (!comm) {
    console.error(
      "[transcription] No matching communication for recordingSid:",
      recordingSid
    );
    return NextResponse.json({ error: "No matching communication" }, { status: 404 });
  }

  console.log(
    "[transcription] Matched communication:",
    comm.id,
    "— transcript:",
    transcriptionText.slice(0, 100)
  );

  // Extract buyer intent from transcript using keyword parsing
  const analysis = extractBuyerIntent(
    transcriptionText,
    callerPhone || comm.from_address
  );

  // Update communication with transcript + analysis
  await admin
    .from("communications")
    .update({
      raw_content: transcriptionText,
      ai_analysis: {
        ...analysis,
        transcription_sid: transcriptionSid,
        recording_sid: recordingSid,
        call_sid: callSid,
        status: "completed",
        source: "twilio_transcription",
      },
      is_processed: true,
      processed_at: new Date().toISOString(),
    })
    .eq("id", comm.id);

  // Update the linked lead with extracted info
  if (comm.lead_id) {
    await admin
      .from("leads")
      .update({
        confidence: analysis.confidence,
        name: analysis.caller_name || `Caller ${callerPhone || comm.from_address}`,
        raw_source_content: transcriptionText,
        extracted_info: {
          budget_min: analysis.budget_range.min,
          budget_max: analysis.budget_range.max,
          beds: analysis.bedrooms,
          baths: analysis.bathrooms,
          areas: analysis.locations_mentioned,
          timeline: analysis.timeline,
          amenities: analysis.must_haves,
          concerns: analysis.deal_breakers,
          summary: analysis.summary,
        },
      })
      .eq("id", comm.lead_id);

    console.log(
      "[transcription] Lead updated:",
      comm.lead_id,
      "confidence:",
      analysis.confidence
    );
  }

  return NextResponse.json({ ok: true, commId: comm.id });
}
