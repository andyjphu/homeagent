import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const supabase = await createClient() as any;
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { full_name, phone, brokerage, email_signature, communication_tone } = body;

    // Validate communication_tone if provided
    const validTones = ["professional", "friendly", "casual"];
    if (communication_tone && !validTones.includes(communication_tone)) {
      return NextResponse.json({ error: "Invalid communication tone" }, { status: 400 });
    }

    const updateData: Record<string, string | null> = {
      phone: phone || null,
      brokerage: brokerage || null,
      email_signature: email_signature || null,
    };

    if (full_name && typeof full_name === "string" && full_name.trim()) {
      updateData.full_name = full_name.trim();
    }

    if (communication_tone) {
      updateData.communication_tone = communication_tone;
    }

    const { error } = await supabase
      .from("agents")
      .update(updateData)
      .eq("user_id", user.id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
