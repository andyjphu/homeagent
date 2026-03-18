-- FoyerFind Pivot Foundation
-- Adds plan management, brand settings, and voice tone to agents

ALTER TABLE agents ADD COLUMN IF NOT EXISTS plan TEXT DEFAULT 'free';
ALTER TABLE agents ADD COLUMN IF NOT EXISTS plan_expires_at TIMESTAMPTZ;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS brand_settings JSONB DEFAULT '{}';
ALTER TABLE agents ADD COLUMN IF NOT EXISTS voice_tone TEXT DEFAULT 'professional';
