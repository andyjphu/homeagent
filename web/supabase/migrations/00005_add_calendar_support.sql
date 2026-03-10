-- Add Google Calendar OAuth columns to agents table
-- (calendar_connected already exists from 00001_initial_schema.sql)
ALTER TABLE agents ADD COLUMN IF NOT EXISTS google_calendar_access_token TEXT;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS google_calendar_refresh_token TEXT;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS google_calendar_token_expires_at TIMESTAMPTZ;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS calendar_working_hours JSONB DEFAULT '{"start":"09:00","end":"18:00","days":[1,2,3,4,5,6]}';
ALTER TABLE agents ADD COLUMN IF NOT EXISTS calendar_auto_create_events BOOLEAN DEFAULT TRUE;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS calendar_show_availability BOOLEAN DEFAULT TRUE;

-- Calendar events mapping table: tracks which Google Calendar events FoyerFind created
CREATE TABLE IF NOT EXISTS calendar_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  deal_id UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  google_event_id TEXT NOT NULL,
  event_type TEXT NOT NULL,  -- 'closing', 'inspection_deadline', 'appraisal_deadline', 'financing_deadline', 'title_deadline'
  event_date DATE,
  summary TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_calendar_events_agent_deal ON calendar_events(agent_id, deal_id);
CREATE INDEX IF NOT EXISTS idx_calendar_events_google_id ON calendar_events(google_event_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_calendar_events_unique ON calendar_events(deal_id, event_type);

-- RLS
ALTER TABLE calendar_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY agent_calendar_events ON calendar_events FOR ALL
  USING (agent_id IN (SELECT id FROM agents WHERE user_id = auth.uid()));

-- Updated_at trigger (reuses the update_updated_at function from 00001)
CREATE TRIGGER set_calendar_events_updated_at
  BEFORE UPDATE ON calendar_events
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
