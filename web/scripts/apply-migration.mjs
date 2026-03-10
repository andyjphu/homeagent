import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(url, key);

async function run() {
  // Test connection
  const { data, error } = await supabase.from("properties").select("id").limit(1);
  console.log("Connection test:", data ? `${data.length} properties found` : "error", error?.message || "");

  // Check if enrichment_cache exists
  const { data: d2, error: e2 } = await supabase.from("enrichment_cache").select("id").limit(1);
  if (e2 && e2.message.includes("Could not find")) {
    console.log("enrichment_cache table does NOT exist yet");
    console.log("\nPlease run this SQL in the Supabase Dashboard SQL Editor:");
    console.log("---");
    const sql = readFileSync(new URL("../supabase/migrations/00004_create_enrichment_cache.sql", import.meta.url), "utf-8");
    console.log(sql);
    console.log("---");
  } else {
    console.log("enrichment_cache table exists!");
  }
}

run().catch((e) => console.error(e));
