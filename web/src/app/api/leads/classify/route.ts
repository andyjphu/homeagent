import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { llmJSON } from "@/lib/llm/router";
import { LEAD_CLASSIFICATION_PROMPT } from "@/lib/llm/prompts/lead-classification";

interface ExtractedLeadInfo {
  is_lead: boolean;
  name: string | null;
  budget_min: number | null;
  budget_max: number | null;
  beds: number | null;
  baths: number | null;
  areas: string[];
  timeline: string | null;
  household_size: number | null;
  priorities: string[];
  referral_source: string | null;
  amenities: string[];
  concerns: string[];
}

export async function POST(request: Request) {
  const supabase = await createClient() as any;
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { leadId, content } = await request.json();

  if (!content) {
    return NextResponse.json({ error: "No content provided" }, { status: 400 });
  }

  const result = await llmJSON<ExtractedLeadInfo>(
    "lead_classification",
    LEAD_CLASSIFICATION_PROMPT,
    content
  );

  // Update lead if leadId provided
  if (leadId) {
    await supabase
      .from("leads")
      .update({
        name: result.name,
        extracted_info: result,
      })
      .eq("id", leadId);
  }

  return NextResponse.json({
    extracted_info: result,
    name: result.name,
    is_lead: result.is_lead,
  });
}
