import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * GET /api/admin/migrate
 *
 * Check which database migrations are pending.
 * Returns an array of migration check results.
 */
export async function GET() {
  const supabase = (await createClient()) as any;
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient() as any;
  const pending: string[] = [];
  const applied: string[] = [];

  // Migration 00003: enrichment_data column on properties
  const { error: enrichColErr } = await admin
    .from("properties")
    .select("enrichment_data")
    .limit(0);

  if (enrichColErr?.message?.includes("does not exist")) {
    pending.push("enrichment_data");
  } else {
    applied.push("enrichment_data");
  }

  // Migration 00004: enrichment_cache table
  const { error: cacheTableErr } = await admin
    .from("enrichment_cache")
    .select("id")
    .limit(0);

  if (cacheTableErr?.message?.includes("enrichment_cache")) {
    pending.push("enrichment_cache");
  } else {
    applied.push("enrichment_cache");
  }

  return NextResponse.json({ pending, applied });
}
