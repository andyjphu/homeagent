-- Agent integrations: stores credentials and sync state for external services
CREATE TABLE agent_integrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    provider TEXT NOT NULL,
    access_token TEXT,
    refresh_token TEXT,
    token_expires_at TIMESTAMPTZ,
    settings JSONB DEFAULT '{}',
    last_sync_at TIMESTAMPTZ,
    sync_errors JSONB DEFAULT '[]',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(agent_id, provider)
);

CREATE INDEX idx_agent_integrations_agent ON agent_integrations(agent_id);
CREATE INDEX idx_agent_integrations_provider ON agent_integrations(provider);

-- RLS policies
ALTER TABLE agent_integrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Agents can view own integrations"
    ON agent_integrations FOR SELECT
    USING (agent_id IN (
        SELECT id FROM agents WHERE user_id = auth.uid()
    ));

CREATE POLICY "Agents can manage own integrations"
    ON agent_integrations FOR ALL
    USING (agent_id IN (
        SELECT id FROM agents WHERE user_id = auth.uid()
    ));

-- Add integration_synced event type (extend the existing check constraint or enum)
-- Since activity_feed event_type is a TEXT column with an app-level enum, no schema change needed.
