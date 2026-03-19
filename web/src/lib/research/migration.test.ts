import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

describe("Research Briefs Migration (00008)", () => {
  const migrationPath = resolve(__dirname, "../../../supabase/migrations/00008_research_briefs.sql");
  const sql = readFileSync(migrationPath, "utf-8");

  it("creates the research_briefs table", () => {
    expect(sql).toContain("CREATE TABLE");
    expect(sql).toContain("research_briefs");
  });

  it("has all required columns", () => {
    const requiredColumns = [
      "id UUID PRIMARY KEY",
      "agent_id UUID NOT NULL REFERENCES agents(id)",
      "property_id UUID NOT NULL REFERENCES properties(id)",
      "buyer_id UUID REFERENCES buyers(id)",
      "trigger_type TEXT NOT NULL",
      "trigger_source_id TEXT",
      "brief_content TEXT",
      "simplified_content TEXT",
      "enrichment_snapshot JSONB",
      "confidence_level TEXT",
      "data_sources TEXT[]",
      "delivered_via TEXT",
      "gmail_draft_id TEXT",
      "delivered_at TIMESTAMPTZ",
      "viewed_at TIMESTAMPTZ",
      "public_token TEXT UNIQUE",
      "created_at TIMESTAMPTZ",
    ];

    for (const col of requiredColumns) {
      expect(sql).toContain(col);
    }
  });

  it("has cascade delete on agent_id", () => {
    expect(sql).toContain("REFERENCES agents(id) ON DELETE CASCADE");
  });

  it("has cascade delete on property_id", () => {
    expect(sql).toContain("REFERENCES properties(id) ON DELETE CASCADE");
  });

  it("generates UUID primary key by default", () => {
    expect(sql).toContain("DEFAULT gen_random_uuid()");
  });

  it("generates random public_token by default", () => {
    expect(sql).toContain("gen_random_bytes(16)");
    expect(sql).toContain("encode(");
  });

  it("creates agent index for efficient listing queries", () => {
    expect(sql).toContain("idx_research_briefs_agent");
    expect(sql).toContain("agent_id, created_at DESC");
  });

  it("creates token index for public page lookups", () => {
    expect(sql).toContain("idx_research_briefs_token");
    expect(sql).toContain("public_token");
  });

  it("has comp_count column", () => {
    expect(sql).toContain("comp_count");
  });
});
