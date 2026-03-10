// Apply migrations directly via pg module
// Uses the Supabase database connection string
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import pg from "pg";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load env
const envFile = readFileSync(join(__dirname, "../.env.local"), "utf-8");
for (const line of envFile.split("\n")) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const eqIdx = trimmed.indexOf("=");
  if (eqIdx > 0) {
    process.env[trimmed.substring(0, eqIdx)] = trimmed.substring(eqIdx + 1);
  }
}

// Extract project ref from Supabase URL
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const password = process.env.SUPABASE_PASSWORD;

if (!supabaseUrl || !password) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_PASSWORD");
  process.exit(1);
}

const projectRef = new URL(supabaseUrl).hostname.split(".")[0];
console.log("Project ref:", projectRef);
console.log("Password:", password.substring(0, 4) + "...");

// Try multiple connection approaches
const connectionConfigs = [
  {
    name: "Direct (IPv4)",
    host: `db.${projectRef}.supabase.co`,
    port: 5432,
    user: "postgres",
    password,
    database: "postgres",
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 10000,
  },
  {
    name: "Pooler US-East-1 (port 5432)",
    host: "aws-0-us-east-1.pooler.supabase.com",
    port: 5432,
    user: `postgres.${projectRef}`,
    password,
    database: "postgres",
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 10000,
  },
  {
    name: "Pooler US-East-1 (port 6543)",
    host: "aws-0-us-east-1.pooler.supabase.com",
    port: 6543,
    user: `postgres.${projectRef}`,
    password,
    database: "postgres",
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 10000,
  },
  {
    name: "Pooler US-West-2",
    host: "aws-0-us-west-2.pooler.supabase.com",
    port: 5432,
    user: `postgres.${projectRef}`,
    password,
    database: "postgres",
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 10000,
  },
  {
    name: "Pooler EU-West-1",
    host: "aws-0-eu-west-1.pooler.supabase.com",
    port: 5432,
    user: `postgres.${projectRef}`,
    password,
    database: "postgres",
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 10000,
  },
  {
    name: "Pooler AP-Southeast-1",
    host: "aws-0-ap-southeast-1.pooler.supabase.com",
    port: 5432,
    user: `postgres.${projectRef}`,
    password,
    database: "postgres",
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 10000,
  },
];

async function tryConnect(config) {
  const { name, ...pgConfig } = config;
  const client = new pg.Client(pgConfig);
  try {
    await client.connect();
    console.log(`✓ Connected via ${name}`);
    return client;
  } catch (e) {
    console.log(`✗ ${name}: ${e.message}`);
    return null;
  }
}

async function run() {
  let client = null;

  for (const config of connectionConfigs) {
    client = await tryConnect(config);
    if (client) break;
  }

  if (!client) {
    console.error("\nCould not connect to database via any method.");
    console.error("Please run the following SQL manually in the Supabase Dashboard SQL Editor:\n");
    console.log("-- Migration 00003");
    console.log(readFileSync(join(__dirname, "../supabase/migrations/00003_add_enrichment_data.sql"), "utf-8"));
    console.log("\n-- Migration 00004");
    console.log(readFileSync(join(__dirname, "../supabase/migrations/00004_create_enrichment_cache.sql"), "utf-8"));
    process.exit(1);
  }

  try {
    // Check if enrichment_data column exists
    const { rows: colCheck } = await client.query(
      "SELECT column_name FROM information_schema.columns WHERE table_name = 'properties' AND column_name = 'enrichment_data'"
    );

    if (colCheck.length === 0) {
      console.log("\nApplying migration 00003: Add enrichment_data column...");
      await client.query("ALTER TABLE properties ADD COLUMN IF NOT EXISTS enrichment_data JSONB DEFAULT NULL;");
      console.log("✓ enrichment_data column added");
    } else {
      console.log("✓ enrichment_data column already exists");
    }

    // Check if enrichment_cache table exists
    const { rows: tableCheck } = await client.query(
      "SELECT tablename FROM pg_tables WHERE tablename = 'enrichment_cache' AND schemaname = 'public'"
    );

    if (tableCheck.length === 0) {
      console.log("\nApplying migration 00004: Create enrichment_cache table...");
      const sql = readFileSync(join(__dirname, "../supabase/migrations/00004_create_enrichment_cache.sql"), "utf-8");
      await client.query(sql);
      console.log("✓ enrichment_cache table created");
    } else {
      console.log("✓ enrichment_cache table already exists");
    }

    // Verify
    console.log("\nVerification:");
    const { rows: props } = await client.query(
      "SELECT id, address, city, state, zip, latitude, longitude FROM properties LIMIT 5"
    );
    console.log(`Properties in database: ${props.length}`);
    for (const p of props) {
      console.log(`  ${p.id.substring(0, 8)}... | ${p.address}, ${p.city}, ${p.state} ${p.zip} | lat/lng: ${p.latitude}/${p.longitude}`);
    }
  } finally {
    await client.end();
  }
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
