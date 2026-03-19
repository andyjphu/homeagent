-- Research briefs table for auto-generated property research
CREATE TABLE IF NOT EXISTS research_briefs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  buyer_id UUID REFERENCES buyers(id),
  trigger_type TEXT NOT NULL,
  trigger_source_id TEXT,
  brief_content TEXT,
  simplified_content TEXT,
  enrichment_snapshot JSONB,
  confidence_level TEXT,
  data_sources TEXT[],
  comp_count INTEGER DEFAULT 0,
  delivered_via TEXT,
  gmail_draft_id TEXT,
  delivered_at TIMESTAMPTZ,
  viewed_at TIMESTAMPTZ,
  public_token TEXT UNIQUE DEFAULT encode(gen_random_bytes(16), 'hex'),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_research_briefs_agent ON research_briefs(agent_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_research_briefs_token ON research_briefs(public_token);
