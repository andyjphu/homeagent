import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { llmJSON } from "@/lib/llm/router";
import { LEAD_CLASSIFICATION_PROMPT } from "@/lib/llm/prompts/lead-classification";

export async function POST(request: Request) {
  const supabase = await createClient() as any;
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { communicationId } = await request.json();

  if (!communicationId) {
    return NextResponse.json({ error: "communicationId required" }, { status: 400 });
  }

  const admin = createAdminClient() as any;

  const { data: comm } = await admin
    .from("communications")
    .select("id, agent_id, from_address, raw_content, classification")
    .eq("id", communicationId)
    .single();

  if (!comm) {
    return NextResponse.json({ error: "Communication not found" }, { status: 404 });
  }

  // Check if a lead already exists for this communication
  const { data: existingLead } = await admin
    .from("leads")
    .select("id")
    .eq("source_communication_id", communicationId)
    .single();

  if (existingLead) {
    return NextResponse.json({ error: "Lead already exists for this email", leadId: existingLead.id }, { status: 409 });
  }

  let extractedInfo: Record<string, any> = {};
  try {
    extractedInfo = await llmJSON(
      "lead_classification",
      LEAD_CLASSIFICATION_PROMPT,
      (comm.raw_content || "").slice(0, 3000)
    );
  } catch {
    // LLM extraction is optional
  }

  const senderName = (comm.from_address || "").replace(/<.*>/, "").trim() || null;
  const senderEmailMatch = (comm.from_address || "").match(/<(.+?)>/);
  const senderEmail = senderEmailMatch ? senderEmailMatch[1] : comm.from_address;

  const { data: lead, error } = await admin.from("leads").insert({
    agent_id: comm.agent_id,
    source: "email",
    status: "draft",
    confidence: comm.classification === "new_lead" ? "high" : "medium",
    name: extractedInfo.name || senderName,
    email: senderEmail,
    phone: extractedInfo.phone || null,
    raw_source_content: (comm.raw_content || "").slice(0, 5000),
    extracted_info: extractedInfo,
    source_communication_id: comm.id,
  }).select("id").single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, leadId: lead.id });
}
