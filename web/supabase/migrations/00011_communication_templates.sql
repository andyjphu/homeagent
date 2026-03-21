-- Communication templates for agents
-- System templates are shared; agent templates are per-agent customizations.

CREATE TABLE IF NOT EXISTS communication_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID REFERENCES agents(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  channel TEXT NOT NULL,
  subject TEXT,
  body TEXT NOT NULL,
  is_system BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_templates_agent ON communication_templates(agent_id);
CREATE INDEX idx_templates_category ON communication_templates(category);

-- RLS: agents can read system templates + their own, and manage their own
ALTER TABLE communication_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Read system and own templates"
  ON communication_templates FOR SELECT
  USING (is_system = TRUE OR agent_id IN (SELECT id FROM agents WHERE user_id = auth.uid()));

CREATE POLICY "Manage own templates"
  ON communication_templates FOR ALL
  USING (agent_id IN (SELECT id FROM agents WHERE user_id = auth.uid()))
  WITH CHECK (agent_id IN (SELECT id FROM agents WHERE user_id = auth.uid()));

-- Seed system templates (agent_id is NULL for system templates)
INSERT INTO communication_templates (agent_id, name, category, channel, subject, body, is_system) VALUES
(NULL, 'New listing alert', 'listing', 'email',
 'New Listing: {{address}}',
 'Hi {{buyer_name}},

I found a new listing that matches your criteria:

{{address}}
{{beds}} bed | {{baths}} bath | {{sqft}} sqft
Listed at ${{price}}

Here are the highlights:
{{highlights}}

Let me know if you''d like to schedule a showing!

Best,
{{agent_name}}

---
Powered by FoyerFind',
 TRUE),

(NULL, 'Showing confirmation', 'showing', 'email',
 'Showing Confirmed: {{address}}',
 'Hi {{buyer_name}},

Your showing is confirmed:

Property: {{address}}
Date: {{date}}
Time: {{time}}

I''ll meet you there. Let me know if anything changes.

Best,
{{agent_name}}

---
Powered by FoyerFind',
 TRUE),

(NULL, 'Showing confirmation SMS', 'showing', 'sms',
 NULL,
 'Hi {{buyer_name}}! Your showing at {{address}} is confirmed for {{date}} at {{time}}. See you there! - {{agent_name}}',
 TRUE),

(NULL, 'Offer update', 'offer', 'email',
 'Offer Update: {{address}}',
 'Hi {{buyer_name}},

I have an update on your offer for {{address}}:

{{update_details}}

Next steps:
{{next_steps}}

I''ll keep you posted on any developments. Don''t hesitate to reach out with questions.

Best,
{{agent_name}}

---
Powered by FoyerFind',
 TRUE),

(NULL, 'Post-showing follow-up', 'showing', 'email',
 'How did you like {{address}}?',
 'Hi {{buyer_name}},

Thank you for touring {{address}} today! I''d love to hear your thoughts.

A few things that stood out:
{{highlights}}

Did anything catch your eye? Any concerns or questions I can help with?

If you''d like to schedule another visit or see similar properties, just let me know.

Looking forward to hearing from you!

Best,
{{agent_name}}

---
Powered by FoyerFind',
 TRUE),

(NULL, 'Closing checklist', 'closing', 'email',
 'Closing Checklist: {{address}}',
 'Hi {{buyer_name}},

Congratulations — we''re in the home stretch! Here''s your closing checklist for {{address}}:

[ ] Final walkthrough scheduled: {{walkthrough_date}}
[ ] Closing date: {{closing_date}}
[ ] Bring government-issued ID
[ ] Certified/cashier''s check or wire transfer arranged
[ ] Homeowner''s insurance policy in place
[ ] Review closing disclosure (received at least 3 days prior)

Let me know if you have any questions about the process.

Best,
{{agent_name}}

---
Powered by FoyerFind',
 TRUE);
