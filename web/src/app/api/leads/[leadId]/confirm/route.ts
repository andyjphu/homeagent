import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ leadId: string }> }
) {
  const { leadId } = await params;
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

  // Fetch the lead
  const { data: lead } = await supabase
    .from("leads")
    .select("*")
    .eq("id", leadId)
    .eq("agent_id", agent.id)
    .single();

  if (!lead) {
    return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  }

  if (lead.status !== "draft") {
    return NextResponse.json(
      { error: "Lead is not in draft status" },
      { status: 400 }
    );
  }

  const extractedInfo = (lead.extracted_info || {}) as any;

  // Create buyer record
  const { data: buyer, error: buyerError } = await supabase
    .from("buyers")
    .insert({
      agent_id: agent.id,
      full_name: lead.name || "Unknown",
      email: lead.email,
      phone: lead.phone,
      source: lead.source,
      referral_source: extractedInfo.referral_source || null,
      original_lead_id: lead.id,
      intent_profile: {
        budget_min: extractedInfo.budget_min,
        budget_max: extractedInfo.budget_max,
        estimated_income: extractedInfo.estimated_income,
        beds_min: extractedInfo.beds,
        baths_min: extractedInfo.baths,
        sqft_min: extractedInfo.sqft_min,
        preferred_areas: extractedInfo.areas || [],
        must_have_amenities: extractedInfo.amenities || [],
        timeline: extractedInfo.timeline,
        household_size: extractedInfo.household_size,
        max_commute_minutes: extractedInfo.max_commute_minutes,
        school_priority: extractedInfo.school_priority,
        hoa_tolerance: extractedInfo.hoa_tolerance,
        priorities_ranked: extractedInfo.priorities || [],
        concerns: extractedInfo.concerns || [],
      },
    })
    .select()
    .single();

  if (buyerError || !buyer) {
    return NextResponse.json(
      { error: "Failed to create buyer" },
      { status: 500 }
    );
  }

  // Update lead status
  await supabase
    .from("leads")
    .update({
      status: "confirmed",
      confirmed_at: new Date().toISOString(),
      merged_into_buyer_id: buyer.id,
    })
    .eq("id", lead.id);

  // Log activity
  await supabase.from("activity_feed").insert({
    agent_id: agent.id,
    event_type: "lead_confirmed",
    buyer_id: buyer.id,
    title: `Lead confirmed: ${lead.name || "Unknown"}`,
    description: `Created buyer profile from ${lead.source} lead`,
    metadata: { lead_id: lead.id },
  });

  return NextResponse.json({ buyer });
}
