-- Notification log table: tracks all sent notifications for debugging and history
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  event_type activity_event_type NOT NULL,
  channel TEXT NOT NULL CHECK (channel IN ('email', 'sms')),
  status TEXT NOT NULL DEFAULT 'sent' CHECK (status IN ('sent', 'failed', 'queued', 'batched')),
  recipient TEXT NOT NULL,                -- email address or phone number
  subject TEXT,                           -- email subject (null for sms)
  body TEXT NOT NULL,                     -- notification content
  payload JSONB NOT NULL DEFAULT '{}',    -- full event data for debugging
  activity_id UUID REFERENCES activity_feed(id) ON DELETE SET NULL,
  buyer_id UUID REFERENCES buyers(id) ON DELETE SET NULL,
  property_id UUID REFERENCES properties(id) ON DELETE SET NULL,
  deal_id UUID REFERENCES deals(id) ON DELETE SET NULL,
  error_message TEXT,                     -- error details if status = 'failed'
  scheduled_for TIMESTAMPTZ,             -- for quiet-hours queuing
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for agent notification history
CREATE INDEX idx_notifications_agent ON notifications(agent_id, sent_at DESC);
-- Index for finding queued notifications to send
CREATE INDEX idx_notifications_queued ON notifications(status, scheduled_for) WHERE status = 'queued';
-- Index for batching dedup (recent notifications per agent+event)
CREATE INDEX idx_notifications_dedup ON notifications(agent_id, event_type, channel, created_at DESC);

-- RLS
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Agents see own notifications"
  ON notifications FOR SELECT
  USING (agent_id = (SELECT id FROM agents WHERE user_id = auth.uid()));

-- Add timezone to agents for quiet hours calculation
ALTER TABLE agents ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'America/Chicago';
