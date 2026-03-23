-- FoyerFind Broker Platform
-- Teams, compliance, commission tracking, white-label branding
-- ============================================================

-- ============================================================
-- TABLES
-- ============================================================

CREATE TABLE brokerages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  logo_url TEXT,
  brand_colors JSONB DEFAULT '{}',
  custom_domain TEXT,
  settings JSONB DEFAULT '{}',
  plan TEXT DEFAULT 'team',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE brokerage_agents (
  brokerage_id UUID NOT NULL REFERENCES brokerages(id) ON DELETE CASCADE,
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'agent' CHECK (role IN ('admin', 'agent')),
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (brokerage_id, agent_id)
);

ALTER TABLE agents ADD COLUMN IF NOT EXISTS brokerage_id UUID REFERENCES brokerages(id);

CREATE TABLE deal_commissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  agent_id UUID NOT NULL REFERENCES agents(id),
  commission_type TEXT NOT NULL CHECK (commission_type IN ('percentage', 'flat_fee')),
  commission_value NUMERIC NOT NULL,
  expected_amount NUMERIC,
  paid_amount NUMERIC,
  paid_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE brokerage_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brokerage_id UUID NOT NULL REFERENCES brokerages(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  invite_code TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(16), 'hex'),
  invited_by UUID NOT NULL REFERENCES agents(id),
  accepted_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '7 days',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add buyer_transferred event type
ALTER TYPE activity_event_type ADD VALUE IF NOT EXISTS 'buyer_transferred';

-- ============================================================
-- RLS HELPER FUNCTIONS
-- ============================================================

-- SECURITY DEFINER: bypasses RLS on brokerage_agents to check admin status
CREATE OR REPLACE FUNCTION is_brokerage_admin_of(target_agent_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1
    FROM brokerage_agents ba_me
    JOIN brokerage_agents ba_target ON ba_me.brokerage_id = ba_target.brokerage_id
    WHERE ba_me.agent_id = (SELECT id FROM agents WHERE user_id = auth.uid() LIMIT 1)
      AND ba_me.role = 'admin'
      AND ba_target.agent_id = target_agent_id
  )
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- SECURITY DEFINER: get current agent id (bypasses agents RLS)
CREATE OR REPLACE FUNCTION current_agent_id()
RETURNS UUID AS $$
  SELECT id FROM agents WHERE user_id = auth.uid() LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Legacy helper kept for compatibility
CREATE OR REPLACE FUNCTION is_brokerage_admin(requester_agent_id UUID, target_agent_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM brokerage_agents ba_req
    JOIN brokerage_agents ba_target ON ba_req.brokerage_id = ba_target.brokerage_id
    WHERE ba_req.agent_id = requester_agent_id
      AND ba_req.role = 'admin'
      AND ba_target.agent_id = target_agent_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ============================================================
-- ROW-LEVEL SECURITY — NEW TABLES
-- ============================================================

ALTER TABLE brokerages ENABLE ROW LEVEL SECURITY;
ALTER TABLE brokerage_agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE deal_commissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE brokerage_invites ENABLE ROW LEVEL SECURITY;

-- Brokerages: visible to members (uses SECURITY DEFINER current_agent_id)
CREATE POLICY brokerage_member_access ON brokerages FOR ALL
  USING (id IN (
    SELECT brokerage_id FROM brokerage_agents
    WHERE agent_id = current_agent_id()
  ));

-- Brokerage agents: visible to members of same brokerage
CREATE POLICY brokerage_agents_access ON brokerage_agents FOR ALL
  USING (brokerage_id IN (
    SELECT brokerage_id FROM brokerage_agents ba
    WHERE ba.agent_id = current_agent_id()
  ));

-- Commissions: own or admin can see team's
CREATE POLICY commission_access ON deal_commissions FOR ALL
  USING (
    agent_id IN (SELECT id FROM agents WHERE user_id = auth.uid())
    OR is_brokerage_admin_of(agent_id)
  );

-- Invites: admin of the brokerage can manage
CREATE POLICY invite_access ON brokerage_invites FOR ALL
  USING (brokerage_id IN (
    SELECT brokerage_id FROM brokerage_agents
    WHERE agent_id = current_agent_id() AND role = 'admin'
  ));

-- ============================================================
-- UPDATE EXISTING RLS POLICIES FOR BROKERAGE ADMIN ACCESS
-- ============================================================
-- Pattern: original check OR is_brokerage_admin_of(agent_id)
-- is_brokerage_admin_of is SECURITY DEFINER so it can read brokerage_agents

-- leads
DROP POLICY IF EXISTS agent_leads ON leads;
CREATE POLICY agent_leads ON leads FOR ALL
  USING (
    agent_id IN (SELECT id FROM agents WHERE user_id = auth.uid())
    OR is_brokerage_admin_of(agent_id)
  );

-- buyers
DROP POLICY IF EXISTS agent_buyers ON buyers;
CREATE POLICY agent_buyers ON buyers FOR ALL
  USING (
    agent_id IN (SELECT id FROM agents WHERE user_id = auth.uid())
    OR is_brokerage_admin_of(agent_id)
  );

-- properties
DROP POLICY IF EXISTS agent_properties ON properties;
CREATE POLICY agent_properties ON properties FOR ALL
  USING (
    agent_id IN (SELECT id FROM agents WHERE user_id = auth.uid())
    OR is_brokerage_admin_of(agent_id)
  );

-- deals
DROP POLICY IF EXISTS agent_deals ON deals;
CREATE POLICY agent_deals ON deals FOR ALL
  USING (
    agent_id IN (SELECT id FROM agents WHERE user_id = auth.uid())
    OR is_brokerage_admin_of(agent_id)
  );

-- offers (through deals)
DROP POLICY IF EXISTS agent_offers ON offers;
CREATE POLICY agent_offers ON offers FOR ALL
  USING (deal_id IN (
    SELECT id FROM deals WHERE
      agent_id IN (SELECT id FROM agents WHERE user_id = auth.uid())
      OR is_brokerage_admin_of(agent_id)
  ));

-- communications
DROP POLICY IF EXISTS agent_communications ON communications;
CREATE POLICY agent_communications ON communications FOR ALL
  USING (
    agent_id IN (SELECT id FROM agents WHERE user_id = auth.uid())
    OR is_brokerage_admin_of(agent_id)
  );

-- activity feed
DROP POLICY IF EXISTS agent_activity ON activity_feed;
CREATE POLICY agent_activity ON activity_feed FOR ALL
  USING (
    agent_id IN (SELECT id FROM agents WHERE user_id = auth.uid())
    OR is_brokerage_admin_of(agent_id)
  );

-- buyer property scores
DROP POLICY IF EXISTS agent_buyer_scores ON buyer_property_scores;
CREATE POLICY agent_buyer_scores ON buyer_property_scores FOR ALL
  USING (buyer_id IN (
    SELECT id FROM buyers WHERE
      agent_id IN (SELECT id FROM agents WHERE user_id = auth.uid())
      OR is_brokerage_admin_of(agent_id)
  ));

-- dashboard sessions
DROP POLICY IF EXISTS agent_dashboard_sessions ON dashboard_sessions;
CREATE POLICY agent_dashboard_sessions ON dashboard_sessions FOR ALL
  USING (buyer_id IN (
    SELECT id FROM buyers WHERE
      agent_id IN (SELECT id FROM agents WHERE user_id = auth.uid())
      OR is_brokerage_admin_of(agent_id)
  ));

-- buyer comments
DROP POLICY IF EXISTS agent_buyer_comments ON buyer_comments;
CREATE POLICY agent_buyer_comments ON buyer_comments FOR ALL
  USING (buyer_id IN (
    SELECT id FROM buyers WHERE
      agent_id IN (SELECT id FROM agents WHERE user_id = auth.uid())
      OR is_brokerage_admin_of(agent_id)
  ));

-- research briefs
DROP POLICY IF EXISTS agent_research_briefs ON research_briefs;
CREATE POLICY agent_research_briefs ON research_briefs FOR ALL
  USING (
    agent_id IN (SELECT id FROM agents WHERE user_id = auth.uid())
    OR is_brokerage_admin_of(agent_id)
  );

-- agent tasks
DROP POLICY IF EXISTS agent_tasks_policy ON agent_tasks;
CREATE POLICY agent_tasks_policy ON agent_tasks FOR ALL
  USING (
    agent_id IN (SELECT id FROM agents WHERE user_id = auth.uid())
    OR is_brokerage_admin_of(agent_id)
  );

-- agents table: own data only (admin visibility handled via admin client in team pages)
DROP POLICY IF EXISTS agent_own_data ON agents;
CREATE POLICY agent_own_data ON agents FOR ALL
  USING (user_id = auth.uid());

-- ============================================================
-- INDEXES
-- ============================================================

CREATE INDEX idx_brokerage_agents_agent ON brokerage_agents(agent_id);
CREATE INDEX idx_brokerage_agents_brokerage ON brokerage_agents(brokerage_id);
CREATE INDEX idx_deal_commissions_deal ON deal_commissions(deal_id);
CREATE INDEX idx_deal_commissions_agent ON deal_commissions(agent_id);
CREATE INDEX idx_agents_brokerage ON agents(brokerage_id);
CREATE INDEX idx_brokerage_invites_code ON brokerage_invites(invite_code);
CREATE INDEX idx_brokerage_invites_email ON brokerage_invites(email);
