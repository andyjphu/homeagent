import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = (await createClient()) as any;
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { scoreId, matchScore, scoreReasoning, agentNotes } =
    await request.json();

  if (!scoreId) {
    return NextResponse.json(
      { error: "scoreId is required" },
      { status: 400 }
    );
  }

  if (typeof matchScore !== "number" || matchScore < 0 || matchScore > 100) {
    return NextResponse.json(
      { error: "matchScore must be 0-100" },
      { status: 400 }
    );
  }

  const updateData: Record<string, unknown> = {
    match_score: matchScore,
    score_breakdown: { source: "manual" },
  };

  if (scoreReasoning !== undefined) {
    updateData.score_reasoning = scoreReasoning || null;
  }

  if (agentNotes !== undefined) {
    updateData.agent_notes = agentNotes || null;
  }

  const { data: score, error } = await supabase
    .from("buyer_property_scores")
    .update(updateData)
    .eq("id", scoreId)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ score });
}
