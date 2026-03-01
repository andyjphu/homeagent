-- HomeAgent AI - Initial Database Schema
-- ============================================================
-- ENUMS
-- ============================================================

CREATE TYPE lead_source AS ENUM ('manual', 'email', 'call', 'referral');
CREATE TYPE lead_status AS ENUM ('draft', 'confirmed', 'dismissed', 'merged');
CREATE TYPE lead_confidence AS ENUM ('high', 'medium', 'low');

CREATE TYPE buyer_temperature AS ENUM ('hot', 'warm', 'cool', 'cold');

CREATE TYPE deal_stage AS ENUM (
  'prospecting',
  'touring',
  'pre_offer',
  'negotiating',
  'under_contract',
  'inspection',
  'appraisal',
  'closing',
  'closed',
  'dead'
);

CREATE TYPE communication_type AS ENUM ('email', 'call');
CREATE TYPE communication_direction AS ENUM ('inbound', 'outbound');
CREATE TYPE communication_classification AS ENUM (
  'deal_relevant', 'new_lead', 'noise', 'action_required'
);

CREATE TYPE agent_task_type AS ENUM (
  'zillow_search',
  'property_detail',
  'cross_reference',
  'comp_analysis',
  'listing_monitor',
  'listing_agent_profile',
  'full_research_pipeline'
);
CREATE TYPE agent_task_status AS ENUM (
  'queued', 'running', 'completed', 'failed', 'cancelled'
);

CREATE TYPE offer_type AS ENUM ('initial', 'counter', 'best_and_final', 'accepted', 'rejected');

CREATE TYPE activity_event_type AS ENUM (
  'lead_detected', 'lead_confirmed', 'lead_dismissed',
  'buyer_created', 'buyer_updated', 'buyer_criteria_changed',
  'research_started', 'research_completed',
  'properties_sent', 'property_price_change', 'property_status_change',
  'email_received', 'email_sent', 'email_drafted',
  'call_completed', 'call_analyzed',
  'deal_created', 'deal_stage_changed',
  'offer_submitted', 'counter_received', 'deal_accepted',
  'dashboard_viewed', 'property_favorited', 'comment_added',
  'inspection_analyzed', 'appraisal_received',
  'deadline_approaching', 'deal_closed'
);

-- ============================================================
-- CORE TABLES
-- ============================================================

-- Agents (Agent Mike's account)
CREATE TABLE agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT NOT NULL,
  phone TEXT,
  brokerage TEXT,
  gmail_connected BOOLEAN DEFAULT FALSE,
  gmail_access_token TEXT,
  gmail_refresh_token TEXT,
  gmail_token_expires_at TIMESTAMPTZ,
  gmail_last_scan_at TIMESTAMPTZ,
  calendar_connected BOOLEAN DEFAULT FALSE,
  notification_preferences JSONB DEFAULT '{}',
  email_signature TEXT,
  communication_tone TEXT DEFAULT 'professional',
  negotiation_style_profile JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Listing agents (profiled from scraping)
CREATE TABLE listing_agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  brokerage TEXT,
  phone TEXT,
  email TEXT,
  active_listing_count INTEGER,
  avg_days_on_market DECIMAL(5, 1),
  avg_list_to_sale_ratio DECIMAL(5, 3),
  avg_counter_rounds DECIMAL(3, 1),
  typical_first_counter_drop DECIMAL(5, 3),
  total_deals_analyzed INTEGER DEFAULT 0,
  profile_data JSONB DEFAULT '{}',
  last_profiled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Leads (draft records before confirmation)
CREATE TABLE leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  status lead_status DEFAULT 'draft',
  source lead_source NOT NULL,
  confidence lead_confidence DEFAULT 'medium',
  name TEXT,
  email TEXT,
  phone TEXT,
  raw_source_content TEXT,
  extracted_info JSONB DEFAULT '{}',
  potential_duplicate_of UUID REFERENCES leads(id),
  merged_into_buyer_id UUID,
  source_communication_id UUID,
  detected_at TIMESTAMPTZ DEFAULT NOW(),
  confirmed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Buyers (confirmed client records)
CREATE TABLE buyers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  dashboard_token TEXT UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  intent_profile JSONB DEFAULT '{}',
  temperature buyer_temperature DEFAULT 'warm',
  last_activity_at TIMESTAMPTZ,
  last_dashboard_visit_at TIMESTAMPTZ,
  dashboard_visit_count INTEGER DEFAULT 0,
  source lead_source NOT NULL,
  referral_source TEXT,
  referral_buyer_id UUID REFERENCES buyers(id),
  original_lead_id UUID REFERENCES leads(id),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Properties (scraped/researched property records)
CREATE TABLE properties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  address TEXT NOT NULL,
  city TEXT,
  state TEXT,
  zip TEXT,
  latitude DECIMAL(10, 7),
  longitude DECIMAL(10, 7),
  listing_price INTEGER,
  beds INTEGER,
  baths DECIMAL(3, 1),
  sqft INTEGER,
  lot_sqft INTEGER,
  year_built INTEGER,
  property_type TEXT,
  hoa_monthly INTEGER,
  tax_annual INTEGER,
  tax_assessed_value INTEGER,
  listing_description TEXT,
  photos JSONB DEFAULT '[]',
  amenities JSONB DEFAULT '[]',
  walk_score INTEGER,
  transit_score INTEGER,
  school_ratings JSONB DEFAULT '{}',
  commute_data JSONB DEFAULT '{}',
  days_on_market INTEGER,
  listing_status TEXT DEFAULT 'active',
  zillow_url TEXT,
  zillow_id TEXT,
  mls_number TEXT,
  price_history JSONB DEFAULT '[]',
  seller_motivation_score INTEGER,
  seller_motivation_reasoning TEXT,
  listing_changes_log JSONB DEFAULT '[]',
  listing_agent_id UUID REFERENCES listing_agents(id),
  is_monitored BOOLEAN DEFAULT FALSE,
  last_monitored_at TIMESTAMPTZ,
  monitoring_interval_hours INTEGER DEFAULT 6,
  scraped_at TIMESTAMPTZ,
  research_task_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Buyer-Property scoring junction
CREATE TABLE buyer_property_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_id UUID NOT NULL REFERENCES buyers(id) ON DELETE CASCADE,
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  match_score INTEGER NOT NULL,
  score_reasoning TEXT,
  score_breakdown JSONB DEFAULT '{}',
  buyer_favorable_comps JSONB DEFAULT '[]',
  seller_favorable_comps JSONB DEFAULT '[]',
  fair_market_value_low INTEGER,
  fair_market_value_mid INTEGER,
  fair_market_value_high INTEGER,
  agent_rank INTEGER,
  agent_notes TEXT,
  is_sent_to_buyer BOOLEAN DEFAULT FALSE,
  sent_at TIMESTAMPTZ,
  is_favorited BOOLEAN DEFAULT FALSE,
  favorited_at TIMESTAMPTZ,
  view_count INTEGER DEFAULT 0,
  total_dwell_seconds INTEGER DEFAULT 0,
  UNIQUE(buyer_id, property_id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Deals (buyer + property in active negotiation/contract)
CREATE TABLE deals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  buyer_id UUID NOT NULL REFERENCES buyers(id) ON DELETE CASCADE,
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  stage deal_stage DEFAULT 'pre_offer',
  stage_entered_at TIMESTAMPTZ DEFAULT NOW(),
  stage_history JSONB DEFAULT '[]',
  current_offer_price INTEGER,
  agreed_price INTEGER,
  contract_date DATE,
  closing_date DATE,
  earnest_money INTEGER,
  contingencies JSONB DEFAULT '{}',
  deal_probability INTEGER,
  intelligence_dossier JSONB DEFAULT '{}',
  offer_strategy_brief JSONB DEFAULT '{}',
  inspection_report_url TEXT,
  inspection_analysis JSONB DEFAULT '{}',
  repair_negotiation_strategy JSONB DEFAULT '{}',
  appraised_value INTEGER,
  appraisal_scenarios JSONB DEFAULT '{}',
  closing_checklist JSONB DEFAULT '{}',
  final_walkthrough_checklist JSONB DEFAULT '{}',
  satisfaction_score INTEGER,
  closed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Offers (each round of negotiation)
CREATE TABLE offers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  round_number INTEGER NOT NULL,
  offer_type offer_type NOT NULL,
  price INTEGER NOT NULL,
  closing_days INTEGER,
  contingencies_waived JSONB DEFAULT '[]',
  personal_property_included JSONB DEFAULT '[]',
  personal_property_excluded JSONB DEFAULT '[]',
  other_terms TEXT,
  ai_analysis JSONB DEFAULT '{}',
  source_communication_id UUID,
  submitted_at TIMESTAMPTZ DEFAULT NOW(),
  response_deadline TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Communications (emails and calls)
CREATE TABLE communications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  type communication_type NOT NULL,
  direction communication_direction NOT NULL,
  buyer_id UUID REFERENCES buyers(id),
  deal_id UUID REFERENCES deals(id),
  lead_id UUID REFERENCES leads(id),
  subject TEXT,
  raw_content TEXT,
  from_address TEXT,
  to_address TEXT,
  duration_seconds INTEGER,
  recording_url TEXT,
  classification communication_classification,
  ai_analysis JSONB DEFAULT '{}',
  gmail_message_id TEXT,
  gmail_thread_id TEXT,
  is_processed BOOLEAN DEFAULT FALSE,
  processed_at TIMESTAMPTZ,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Dashboard sessions (buyer interaction tracking)
CREATE TABLE dashboard_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_id UUID NOT NULL REFERENCES buyers(id) ON DELETE CASCADE,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  duration_seconds INTEGER,
  page_views JSONB DEFAULT '[]',
  actions JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Buyer comments on properties
CREATE TABLE buyer_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_id UUID NOT NULL REFERENCES buyers(id) ON DELETE CASCADE,
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Agent tasks (Browser Use jobs)
CREATE TABLE agent_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  buyer_id UUID REFERENCES buyers(id),
  task_type agent_task_type NOT NULL,
  status agent_task_status DEFAULT 'queued',
  priority INTEGER DEFAULT 5,
  input_params JSONB NOT NULL DEFAULT '{}',
  output_data JSONB DEFAULT '{}',
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,
  execution_log JSONB DEFAULT '[]',
  is_recurring BOOLEAN DEFAULT FALSE,
  recurrence_interval_hours INTEGER,
  next_run_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Activity feed (unified event stream)
CREATE TABLE activity_feed (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  event_type activity_event_type NOT NULL,
  buyer_id UUID REFERENCES buyers(id),
  property_id UUID REFERENCES properties(id),
  deal_id UUID REFERENCES deals(id),
  communication_id UUID REFERENCES communications(id),
  task_id UUID REFERENCES agent_tasks(id),
  title TEXT NOT NULL,
  description TEXT,
  metadata JSONB DEFAULT '{}',
  is_read BOOLEAN DEFAULT FALSE,
  is_action_required BOOLEAN DEFAULT FALSE,
  occurred_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- INDEXES
-- ============================================================

CREATE INDEX idx_agents_user_id ON agents(user_id);
CREATE INDEX idx_leads_agent_id ON leads(agent_id);
CREATE INDEX idx_leads_status ON leads(agent_id, status);
CREATE INDEX idx_buyers_agent_id ON buyers(agent_id);
CREATE INDEX idx_buyers_dashboard_token ON buyers(dashboard_token);
CREATE INDEX idx_properties_agent_id ON properties(agent_id);
CREATE INDEX idx_properties_monitored ON properties(is_monitored, last_monitored_at) WHERE is_monitored = TRUE;
CREATE INDEX idx_buyer_property_scores_buyer ON buyer_property_scores(buyer_id, match_score DESC);
CREATE INDEX idx_deals_agent_id ON deals(agent_id);
CREATE INDEX idx_deals_stage ON deals(agent_id, stage);
CREATE INDEX idx_offers_deal_id ON offers(deal_id);
CREATE INDEX idx_communications_agent_id ON communications(agent_id);
CREATE INDEX idx_communications_gmail ON communications(gmail_message_id) WHERE gmail_message_id IS NOT NULL;
CREATE INDEX idx_agent_tasks_agent_id ON agent_tasks(agent_id);
CREATE INDEX idx_agent_tasks_status ON agent_tasks(agent_id, status);
CREATE INDEX idx_activity_feed_agent_id ON activity_feed(agent_id, occurred_at DESC);
CREATE INDEX idx_activity_feed_unread ON activity_feed(agent_id, is_read) WHERE is_read = FALSE;

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE buyers ENABLE ROW LEVEL SECURITY;
ALTER TABLE properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE buyer_property_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE communications ENABLE ROW LEVEL SECURITY;
ALTER TABLE dashboard_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE buyer_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_feed ENABLE ROW LEVEL SECURITY;
ALTER TABLE listing_agents ENABLE ROW LEVEL SECURITY;

-- Agent sees only their own record
CREATE POLICY agent_own_data ON agents FOR ALL USING (user_id = auth.uid());

-- Agent-scoped tables
CREATE POLICY agent_leads ON leads FOR ALL
  USING (agent_id IN (SELECT id FROM agents WHERE user_id = auth.uid()));

CREATE POLICY agent_buyers ON buyers FOR ALL
  USING (agent_id IN (SELECT id FROM agents WHERE user_id = auth.uid()));

CREATE POLICY agent_properties ON properties FOR ALL
  USING (agent_id IN (SELECT id FROM agents WHERE user_id = auth.uid()));

CREATE POLICY agent_deals ON deals FOR ALL
  USING (agent_id IN (SELECT id FROM agents WHERE user_id = auth.uid()));

CREATE POLICY agent_offers ON offers FOR ALL
  USING (deal_id IN (
    SELECT id FROM deals WHERE agent_id IN (SELECT id FROM agents WHERE user_id = auth.uid())
  ));

CREATE POLICY agent_communications ON communications FOR ALL
  USING (agent_id IN (SELECT id FROM agents WHERE user_id = auth.uid()));

CREATE POLICY agent_tasks_policy ON agent_tasks FOR ALL
  USING (agent_id IN (SELECT id FROM agents WHERE user_id = auth.uid()));

CREATE POLICY agent_activity ON activity_feed FOR ALL
  USING (agent_id IN (SELECT id FROM agents WHERE user_id = auth.uid()));

CREATE POLICY agent_listing_agents ON listing_agents FOR ALL USING (true);

-- Buyer property scores: agent can manage, buyer can read via token
CREATE POLICY agent_buyer_scores ON buyer_property_scores FOR ALL
  USING (buyer_id IN (
    SELECT id FROM buyers WHERE agent_id IN (SELECT id FROM agents WHERE user_id = auth.uid())
  ));

-- Dashboard sessions: agent can read
CREATE POLICY agent_dashboard_sessions ON dashboard_sessions FOR ALL
  USING (buyer_id IN (
    SELECT id FROM buyers WHERE agent_id IN (SELECT id FROM agents WHERE user_id = auth.uid())
  ));

-- Buyer comments: agent can read
CREATE POLICY agent_buyer_comments ON buyer_comments FOR ALL
  USING (buyer_id IN (
    SELECT id FROM buyers WHERE agent_id IN (SELECT id FROM agents WHERE user_id = auth.uid())
  ));

-- ============================================================
-- FUNCTIONS & TRIGGERS
-- ============================================================

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_updated_at BEFORE UPDATE ON agents FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON leads FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON buyers FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON properties FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON buyer_property_scores FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON deals FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON agent_tasks FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON listing_agents FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Lead confirmed -> activity feed
CREATE OR REPLACE FUNCTION on_lead_confirmed()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'confirmed' AND OLD.status = 'draft' THEN
    INSERT INTO activity_feed (agent_id, event_type, title, metadata, is_action_required)
    VALUES (
      NEW.agent_id,
      'lead_confirmed',
      'Lead confirmed: ' || COALESCE(NEW.name, 'Unknown'),
      jsonb_build_object('lead_id', NEW.id, 'source', NEW.source),
      FALSE
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER lead_confirmed_trigger
  AFTER UPDATE ON leads
  FOR EACH ROW
  WHEN (NEW.status = 'confirmed' AND OLD.status = 'draft')
  EXECUTE FUNCTION on_lead_confirmed();

-- New lead detected -> activity feed
CREATE OR REPLACE FUNCTION on_lead_created()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO activity_feed (agent_id, event_type, title, metadata, is_action_required)
  VALUES (
    NEW.agent_id,
    'lead_detected',
    'New lead detected: ' || COALESCE(NEW.name, 'Unknown') || ' (' || NEW.source || ')',
    jsonb_build_object('lead_id', NEW.id, 'source', NEW.source, 'confidence', NEW.confidence),
    TRUE
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER lead_created_trigger
  AFTER INSERT ON leads
  FOR EACH ROW
  EXECUTE FUNCTION on_lead_created();

-- Deal stage change -> activity feed + stage history
CREATE OR REPLACE FUNCTION on_deal_stage_change()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.stage IS DISTINCT FROM OLD.stage THEN
    NEW.stage_history = OLD.stage_history || jsonb_build_object(
      'stage', NEW.stage,
      'entered_at', NOW(),
      'previous_stage', OLD.stage
    );
    NEW.stage_entered_at = NOW();

    INSERT INTO activity_feed (
      agent_id, event_type, deal_id, buyer_id, property_id,
      title, is_action_required
    )
    SELECT
      NEW.agent_id, 'deal_stage_changed', NEW.id, NEW.buyer_id, NEW.property_id,
      'Deal moved to ' || REPLACE(NEW.stage::TEXT, '_', ' ') || ': ' || b.full_name,
      TRUE
    FROM buyers b WHERE b.id = NEW.buyer_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER deal_stage_change_trigger
  BEFORE UPDATE ON deals
  FOR EACH ROW
  EXECUTE FUNCTION on_deal_stage_change();

-- Property price change -> activity feed + price history
CREATE OR REPLACE FUNCTION on_property_price_change()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.listing_price IS DISTINCT FROM OLD.listing_price AND OLD.listing_price IS NOT NULL THEN
    NEW.price_history = OLD.price_history || jsonb_build_object(
      'date', NOW(),
      'price', NEW.listing_price,
      'previous_price', OLD.listing_price,
      'event', 'price_change'
    );

    INSERT INTO activity_feed (
      agent_id, event_type, property_id,
      title, description, metadata
    )
    VALUES (
      NEW.agent_id, 'property_price_change', NEW.id,
      'Price change: ' || NEW.address,
      'Price changed from $' || OLD.listing_price || ' to $' || NEW.listing_price,
      jsonb_build_object('old_price', OLD.listing_price, 'new_price', NEW.listing_price)
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER property_price_change_trigger
  BEFORE UPDATE ON properties
  FOR EACH ROW
  EXECUTE FUNCTION on_property_price_change();

-- Buyer favorite -> activity feed
CREATE OR REPLACE FUNCTION on_property_favorited()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_favorited = TRUE AND (OLD.is_favorited IS NULL OR OLD.is_favorited = FALSE) THEN
    NEW.favorited_at = NOW();

    INSERT INTO activity_feed (
      agent_id, event_type, buyer_id, property_id,
      title, metadata
    )
    SELECT
      b.agent_id, 'property_favorited', NEW.buyer_id, NEW.property_id,
      b.full_name || ' favorited a property',
      jsonb_build_object('buyer_id', NEW.buyer_id, 'property_id', NEW.property_id)
    FROM buyers b WHERE b.id = NEW.buyer_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER property_favorited_trigger
  BEFORE UPDATE ON buyer_property_scores
  FOR EACH ROW
  EXECUTE FUNCTION on_property_favorited();

-- Comment added -> activity feed
CREATE OR REPLACE FUNCTION on_comment_added()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO activity_feed (
    agent_id, event_type, buyer_id, property_id,
    title, description, metadata
  )
  SELECT
    b.agent_id, 'comment_added', NEW.buyer_id, NEW.property_id,
    b.full_name || ' commented on a property',
    LEFT(NEW.content, 100),
    jsonb_build_object('comment_id', NEW.id)
  FROM buyers b WHERE b.id = NEW.buyer_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER comment_added_trigger
  AFTER INSERT ON buyer_comments
  FOR EACH ROW
  EXECUTE FUNCTION on_comment_added();
