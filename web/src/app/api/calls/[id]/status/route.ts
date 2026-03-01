import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const supabase = (await createClient()) as any;
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: comm } = await supabase
    .from("communications")
    .select(
      "id, type, direction, from_address, duration_seconds, recording_url, raw_content, ai_analysis, is_processed, lead_id, occurred_at"
    )
    .eq("id", id)
    .single();

  if (!comm) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const analysis = (comm.ai_analysis || {}) as any;

  return NextResponse.json({
    id: comm.id,
    status: comm.is_processed
      ? "complete"
      : analysis.status === "failed"
        ? "failed"
        : "processing",
    has_transcript: !!comm.raw_content,
    has_analysis: comm.is_processed,
    recording_url: comm.recording_url,
    transcript: comm.raw_content,
    analysis: comm.is_processed ? comm.ai_analysis : null,
    lead_id: comm.lead_id,
    duration_seconds: comm.duration_seconds,
    caller_phone: comm.from_address,
  });
}
