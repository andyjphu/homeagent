import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createActivityEntry } from "@/lib/supabase/activity";

export const maxDuration = 60;

const ALLOWED_AUDIO_TYPES = new Set([
  "audio/mp4",      // .m4a (iPhone default)
  "audio/x-m4a",    // .m4a alternate
  "audio/aac",      // .aac
  "audio/mpeg",     // .mp3
  "audio/wav",      // .wav
  "audio/x-wav",    // .wav alternate
  "audio/webm",     // .webm
  "audio/ogg",      // .ogg
]);

const ALLOWED_EXTENSIONS = new Set([
  ".m4a", ".mp3", ".wav", ".webm", ".ogg", ".aac",
]);

const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB

function getExtension(filename: string): string {
  const dot = filename.lastIndexOf(".");
  return dot >= 0 ? filename.slice(dot).toLowerCase() : "";
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient() as any;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get agent
    const { data: agent } = await (supabase as any)
      .from("agents")
      .select("id")
      .eq("user_id", user.id)
      .single();

    if (!agent) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }

    const formData = await request.formData();
    const audioFile = formData.get("audio") as File | null;
    const transcriptText = (formData.get("transcript_text") as string) || null;
    const callerName = (formData.get("caller_name") as string) || null;
    const callerPhone = (formData.get("caller_phone") as string) || null;
    const notes = (formData.get("notes") as string) || null;
    const buyerId = (formData.get("buyer_id") as string) || null;
    const summaryText = (formData.get("summary_text") as string) || null;

    // Must have audio, transcript, or summary
    if (!audioFile && !transcriptText && !summaryText) {
      return NextResponse.json(
        { error: "Provide an audio file, transcript, or call summary" },
        { status: 400 }
      );
    }

    // Validate audio file if provided
    let storagePath: string | null = null;
    let recordingUrl: string | null = null;

    if (audioFile) {
      const ext = getExtension(audioFile.name);
      if (!ALLOWED_EXTENSIONS.has(ext)) {
        return NextResponse.json(
          { error: `Unsupported file type: ${ext}. Accepted: .m4a, .mp3, .wav, .webm, .ogg, .aac` },
          { status: 400 }
        );
      }
      if (audioFile.size > MAX_FILE_SIZE) {
        return NextResponse.json(
          { error: "File too large. Maximum size is 25MB." },
          { status: 400 }
        );
      }

      // Upload to Supabase Storage
      const admin = createAdminClient() as any;

      // Ensure bucket exists
      try {
        await admin.storage.createBucket("call-recordings", {
          public: true,
          allowedMimeTypes: [
            "audio/wav", "audio/mpeg", "audio/mp4", "audio/x-m4a",
            "audio/webm", "audio/ogg", "audio/aac", "audio/x-wav",
          ],
        });
      } catch {
        // Bucket already exists
      }

      const buffer = Buffer.from(await audioFile.arrayBuffer());
      storagePath = `${agent.id}/upload-${Date.now()}${ext}`;

      const { error: uploadError } = await admin.storage
        .from("call-recordings")
        .upload(storagePath, buffer, {
          contentType: audioFile.type || "audio/mp4",
          upsert: false,
        });

      if (uploadError) {
        console.error("[call-upload] Storage upload failed:", uploadError);
        return NextResponse.json(
          { error: "Failed to upload audio file" },
          { status: 500 }
        );
      }

      const { data: urlData } = admin.storage
        .from("call-recordings")
        .getPublicUrl(storagePath);

      recordingUrl = urlData?.publicUrl || null;
    }

    // Determine processing status
    const hasTranscript = !!transcriptText || !!summaryText;
    const contentText = transcriptText || summaryText || null;
    const source = summaryText && !transcriptText && !audioFile ? "manual" : "upload";
    const status = hasTranscript ? "transcribed" : audioFile ? "processing" : "processed";

    // Create communication record
    const admin = createAdminClient() as any;
    const { data: comm, error: commError } = await admin
      .from("communications")
      .insert({
        agent_id: agent.id,
        type: "call",
        direction: "outbound", // Agent-uploaded calls are agent-initiated
        buyer_id: buyerId,
        from_address: callerPhone,
        subject: callerName
          ? `Call with ${callerName}`
          : callerPhone
            ? `Call with ${callerPhone}`
            : "Call logged",
        raw_content: contentText,
        recording_url: recordingUrl,
        is_processed: false,
        occurred_at: new Date().toISOString(),
        ai_analysis: {
          status,
          source,
          storage_path: storagePath,
          caller_name: callerName,
          notes,
        },
      })
      .select("id")
      .single();

    if (commError) {
      console.error("[call-upload] Failed to create communication:", commError);
      return NextResponse.json(
        { error: "Failed to create call record" },
        { status: 500 }
      );
    }

    // Create activity entry
    await createActivityEntry(
      agent.id,
      "call_completed",
      callerName ? `Call logged: ${callerName}` : "Call logged",
      notes || undefined,
      { source, has_audio: !!audioFile, has_transcript: hasTranscript },
      {
        communicationId: comm.id,
        buyerId: buyerId || undefined,
      }
    );

    // Trigger background processing
    const processUrl = new URL("/api/calls/process", request.url);
    try {
      fetch(processUrl.toString(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          communicationId: comm.id,
          agentId: agent.id,
          hasAudio: !!audioFile,
          hasTranscript: hasTranscript,
          transcriptText: contentText,
          callerPhone: callerPhone || "",
          callerName,
          buyerId,
          storagePath,
        }),
      }).catch((err: unknown) => {
        console.error("[call-upload] Failed to trigger processing:", err);
      });
    } catch {
      // Non-blocking — processing can be retried
    }

    return NextResponse.json({
      id: comm.id,
      status: hasTranscript ? "analyzing" : audioFile ? "transcribing" : "done",
      recording_url: recordingUrl,
    });
  } catch (err) {
    console.error("[call-upload] Unexpected error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
