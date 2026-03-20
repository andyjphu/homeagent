-- Add feedback_submitted to activity event types
ALTER TYPE activity_event_type ADD VALUE IF NOT EXISTS 'feedback_submitted';

-- Showing feedback: buyers rate properties after showings
CREATE TABLE IF NOT EXISTS showing_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_id UUID NOT NULL REFERENCES buyers(id) ON DELETE CASCADE,
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  overall_rating INT CHECK (overall_rating BETWEEN 1 AND 5),
  tags TEXT[] DEFAULT '{}',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE showing_feedback ENABLE ROW LEVEL SECURITY;

-- Agents see their own buyers' feedback
CREATE POLICY "agents_own_feedback" ON showing_feedback
  FOR ALL USING (agent_id = auth.uid());

-- Index for common queries
CREATE INDEX idx_showing_feedback_buyer ON showing_feedback(buyer_id);
CREATE INDEX idx_showing_feedback_property ON showing_feedback(property_id);
CREATE INDEX idx_showing_feedback_agent ON showing_feedback(agent_id);
