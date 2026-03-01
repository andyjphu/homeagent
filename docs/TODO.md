# HomeAgent AI — Claude Code Build Prompts

> **How to use this:** Run these prompts sequentially in Claude Code sessions. Each prompt is scoped to ~1 session of work. Later prompts reference earlier ones. Adjust the tech stack choices if you have preferences — these defaults are opinionated toward speed-to-demo.

---

## Assumed Tech Stack

| Layer | Choice | Why |
|-------|--------|-----|
| Backend | FastAPI + Python | Browser Use is Python, Claude SDK is Python, keeps it monoglot |
| Database | **Supabase** (hosted Postgres + client SDK) | Managed Postgres, built-in auth, realtime, storage, edge functions — eliminates tons of infra work |
| Task Queue | Celery + Redis | Browser Use jobs are long-running, need async |
| Real-time | **Supabase Realtime** (Postgres changes) + WebSockets for agent tasks | Supabase handles DB-driven events, WS for long-running task streaming |
| Storage | **Supabase Storage** | Call recordings, inspection PDFs, property photos |
| Frontend | Next.js 14 (App Router) + TypeScript | SSR for dashboards, React for command center |
| Styling | Tailwind CSS + shadcn/ui | Fast, consistent, good defaults |
| Auth | **Supabase Auth** (Google OAuth for agents) + token-based access (buyers) | Agents get full OAuth, buyers get unique dashboard tokens |
| LLM | Claude API (Sonnet for fast, Opus for deep) | Native to the product |
| Transcription | **OpenAI Whisper API** (or local whisper.cpp) | Best accuracy for real estate calls, speaker diarization via post-processing |
| Email | Gmail API / MCP | Core integration |
| Browser Automation | browser-use (Python) | Core scraping engine |
| Deployment | Docker Compose (dev) + Supabase Cloud, fly.io or Railway for backend (prod) | Supabase handles DB/auth/realtime/storage; only backend + frontend need hosting |

---

## Phase 0: Project Scaffolding & Data Model

### Prompt 0A — Monorepo Setup

```
Create a monorepo for "HomeAgent AI" with this structure:

/homeagent
  /backend          — FastAPI Python app
  /frontend         — Next.js 14 App Router with TypeScript
  /agents           — Browser Use agent code (Python)
  /shared           — Shared types/schemas
  /supabase         — Supabase migrations, seed files, edge functions
  docker-compose.yml — Redis, backend, frontend, worker (Supabase runs as a cloud service or via supabase CLI locally)
  .env.example

Backend setup:
- FastAPI with uvicorn
- supabase-py client library for DB access (from supabase import create_client)
- Celery with Redis broker for long-running Browser Use tasks
- Pydantic v2 for schemas
- Project structure: /api (routes), /schemas (Pydantic), /services (business logic), /tasks (Celery), /core (config, deps, security)
- Supabase client initialized in /core/supabase.py as a singleton
- Auth middleware that validates Supabase JWT tokens from the frontend

Frontend setup:
- Next.js 14 App Router
- TypeScript strict mode
- Tailwind CSS + shadcn/ui initialized
- @supabase/supabase-js + @supabase/ssr for client-side and server-side Supabase access
- Supabase Auth helpers integrated (Google OAuth flow for agents)
- Layout with sidebar navigation skeleton
- Environment config: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, backend API URL

Supabase project setup:
- Initialize with supabase init in /supabase directory
- Configure supabase/config.toml for local dev
- Create /supabase/migrations directory for SQL migrations
- Create /supabase/seed.sql for sample data

Docker Compose:
- redis:7
- backend service (hot reload, mounts /backend and /agents)
- celery worker service (same image as backend, different entrypoint)
- frontend service (hot reload)
- Note: Supabase runs via `supabase start` locally (uses its own Docker containers) or connects to Supabase Cloud. Don't include Supabase in this docker-compose — reference it via env vars.

Include a Makefile with: make up, make down, make db-reset (supabase db reset), make seed, make logs, make migrate (supabase migration new), make supabase-start, make supabase-stop
```

### Prompt 0B — Database Schema & Migrations

```
In the HomeAgent project, create a Supabase SQL migration (supabase/migrations/001_initial_schema.sql) with the full data model. Use UUID primary keys (gen_random_uuid()), created_at/updated_at timestamps with triggers on everything, and soft deletes (deleted_at nullable) where appropriate.

**Custom types (enums):**
- buyer_source: 'manual', 'email', 'call'
- confidence_level: 'high', 'medium', 'low'
- buyer_status: 'draft', 'confirmed', 'active', 'inactive', 'closed'
- deal_stage: 'prospecting', 'touring', 'negotiating', 'under_contract', 'closing', 'closed', 'dead'
- communication_type: 'email', 'call'
- communication_direction: 'inbound', 'outbound'
- communication_classification: 'deal_relevant', 'new_lead', 'noise'
- buyer_property_status: 'suggested', 'viewed', 'favorited', 'touring', 'offered', 'rejected'
- task_type: 'search', 'monitor', 'comp_pull', 'lead_classify'
- task_status: 'queued', 'running', 'complete', 'failed'

**Tables:**

**agents** — id (uuid pk), email (text unique), name (text), phone (text nullable — agent's real phone number for Twilio bridge), gmail_connected (bool default false), calendar_connected (bool default false), preferences (jsonb default '{}'), negotiation_style_profile (jsonb default '{}'), email_signature (text), communication_tone (text default 'professional'), google_refresh_token (text nullable, encrypted), auth_user_id (uuid references auth.users — links to Supabase Auth), twilio_bridge_enabled (bool default false — opt-in for auto-capture mode), recording_disclosure_state (text nullable — agent's state for consent law reminders)

**buyers** — id (uuid pk), agent_id (uuid FK agents), name (text), email (text nullable), phone (text nullable), source (buyer_source), referral_source (text nullable), confidence_level (confidence_level default 'medium'), status (buyer_status default 'draft'), intake_form_completed (bool default false), intake_form_token (uuid unique default gen_random_uuid()), dashboard_token (uuid unique default gen_random_uuid()), buyer_intent_profile (jsonb default '{}'), engagement_metrics (jsonb default '{}'), communication_preferences (jsonb default '{}')

**properties** — id (uuid pk), address (text), city (text), state (text), zip (text), latitude (float8 nullable), longitude (float8 nullable), price (integer — cents), original_price (integer — cents), beds (smallint), baths (numeric(3,1)), sqft (integer), lot_sqft (integer nullable), year_built (smallint nullable), hoa_monthly (integer nullable — cents), listing_url (text), listing_agent_name (text nullable), listing_agent_email (text nullable), listing_agent_phone (text nullable), listing_agent_profile (jsonb default '{}'), photos (jsonb default '[]'), description (text), structured_data (jsonb default '{}'), match_score (smallint nullable check 0-100), match_reasoning (text nullable), seller_motivation_score (smallint nullable check 0-100), seller_motivation_reasoning (text nullable), price_history (jsonb default '[]'), days_on_market (integer default 0), status (text default 'active' check in active/pending/sold/delisted), last_scraped_at (timestamptz)

**deals** — id (uuid pk), buyer_id (uuid FK buyers), property_id (uuid FK properties), agent_id (uuid FK agents), stage (deal_stage default 'prospecting'), offer_history (jsonb default '[]'), contingency_timeline (jsonb default '{}'), action_items (jsonb default '[]'), intelligence_dossier (jsonb default '{}'), strategy_brief (jsonb default '{}'), deal_probability (smallint nullable check 0-100), closed_at (timestamptz nullable)

**communications** — id (uuid pk), deal_id (uuid FK deals nullable), buyer_id (uuid FK buyers nullable), agent_id (uuid FK agents), type (communication_type), direction (communication_direction), raw_content (text), ai_analysis (jsonb default '{}'), classification (communication_classification default 'deal_relevant'), external_id (text nullable), metadata (jsonb default '{}'), recording_path (text nullable — Supabase Storage path for call recordings), transcript (text nullable), occurred_at (timestamptz default now())

**buyer_properties** — id (uuid pk), buyer_id (uuid FK buyers), property_id (uuid FK properties), status (buyer_property_status default 'suggested'), buyer_notes (text nullable), agent_notes (text nullable), dashboard_dwell_seconds (integer default 0), UNIQUE(buyer_id, property_id)

**dashboard_sessions** — id (uuid pk), buyer_id (uuid FK buyers), page_views (jsonb default '[]'), property_clicks (jsonb default '[]'), started_at (timestamptz default now()), ended_at (timestamptz nullable)

**agent_tasks** — id (uuid pk), agent_id (uuid FK agents), buyer_id (uuid FK buyers nullable), property_id (uuid FK properties nullable), task_type (task_type), status (task_status default 'queued'), input_params (jsonb default '{}'), output_data (jsonb default '{}'), execution_log (jsonb default '[]'), started_at (timestamptz nullable), completed_at (timestamptz nullable), error (text nullable)

**activity_feed** — id (uuid pk), agent_id (uuid FK agents), buyer_id (uuid FK buyers nullable), deal_id (uuid FK deals nullable), property_id (uuid FK properties nullable), event_type (text), title (text), description (text), metadata (jsonb default '{}')

**Add indexes:**
- buyers(agent_id), buyers(status)
- deals(agent_id), deals(stage), deals(buyer_id)
- communications(buyer_id), communications(deal_id), communications(agent_id)
- activity_feed(agent_id, created_at DESC)
- agent_tasks(status), agent_tasks(agent_id)
- properties(status)
- buyer_properties(buyer_id), buyer_properties(property_id)

**Row Level Security (RLS):**
Enable RLS on ALL tables. Create policies:
- agents: users can only read/update their own row (auth.uid() = auth_user_id)
- buyers, deals, properties, communications, agent_tasks, activity_feed: agents can only access rows where agent_id matches their agent record
- buyer_properties, dashboard_sessions: accessible by agent (via agent_id on buyer) AND by buyer dashboard token (for public dashboard access)

Create a helper function get_agent_id() that looks up the agent.id from auth.uid().

**Supabase Realtime:**
Enable realtime on: activity_feed, agent_tasks, buyer_properties, deals (these tables need to push live updates to the frontend).
Add `alter publication supabase_realtime add table activity_feed, agent_tasks, buyer_properties, deals;`

**Auto-update triggers:**
Create a trigger function that sets updated_at = now() on every UPDATE, and apply it to all tables.

**Supabase Storage:**
Create buckets:
- 'call-recordings' (private) — for uploaded call audio files
- 'documents' (private) — for inspection reports, appraisals, contracts
- 'property-photos' (private) — for cached property photos

Also create all the Pydantic v2 schemas (Create, Update, Read) for each table in backend/schemas/. The Pydantic models should match the Supabase table structure. Include a base schema pattern with id, created_at, updated_at.
```

---

## Phase 1: Agent Command Center (Frontend Core)

### Prompt 1A — Auth & Layout

```
In the HomeAgent frontend, implement:

1. **Supabase Auth** with Google OAuth provider:
   - Configure Supabase Auth in the dashboard to enable Google OAuth (for Gmail scope access later)
   - Create a Supabase client utility (lib/supabase/client.ts for browser, lib/supabase/server.ts for server components using @supabase/ssr)
   - Login page at /login with "Sign in with Google" button using supabase.auth.signInWithOAuth({ provider: 'google', options: { scopes: 'https://www.googleapis.com/auth/gmail.modify https://www.googleapis.com/auth/calendar' } })
   - On first login, a Supabase database trigger (or edge function) should create the agent record in the agents table, linking auth_user_id to auth.users.id
   - Middleware in middleware.ts that checks Supabase session on all /app/* routes, redirects to /login if unauthenticated
   - Store the Google OAuth provider_token (for Gmail API) — capture it from the auth callback and store in agents.google_refresh_token

2. **App layout** at /app/layout.tsx:
   - Left sidebar (collapsible): Logo, nav links (Dashboard, Clients, Settings), agent avatar at bottom (from Supabase Auth user metadata)
   - Main content area with top bar showing current page title + notification bell icon
   - Use a dark sidebar (#1a1a2e or similar) with light content area
   - Responsive: sidebar collapses to icons on mobile
   - Sign out button in sidebar footer

3. **Dashboard page** at /app/page.tsx (the Command Center):
   Skeleton layout with 4 sections stacked vertically:
   - "New Leads" — card grid (empty state: "No new leads detected")
   - "Action Required" — card list sorted by urgency (empty state)
   - "Active Deals" — filterable card grid with stage tabs (prospecting/touring/negotiating/under_contract/closing)
   - "Activity Feed" — chronological stream on the right side (or below on mobile)

   Each buyer card shows: name, deal stage badge, temperature indicator (colored dot: red/orange/blue), property name if applicable, last activity text, days since last contact, next action with countdown, and a link arrow.

Make it look polished — not generic. Use a professional real estate aesthetic. Think Bloomberg terminal meets modern CRM. Use proper loading skeletons, not spinners.
```

### Prompt 1B — Backend API for Command Center

```
In the HomeAgent backend, create the API routes that power the command center. Use the supabase-py client for all DB access (not raw SQL or an ORM).

**Auth middleware:**
Create a FastAPI dependency get_current_agent(authorization: str = Header()) that:
1. Extracts the JWT from the Authorization header (Bearer token from Supabase Auth)
2. Verifies the JWT using Supabase's JWT secret (or calls supabase.auth.get_user(token))
3. Looks up the agent record from agents table using the auth_user_id
4. Returns the agent record (or 401)

**GET /api/dashboard** — Returns the full command center payload for the authenticated agent:
{
  new_leads: Buyer[] (status=draft, sorted by created_at desc),
  action_required: { buyer: Buyer, action: string, urgency: "high"|"medium"|"low", due_at: datetime }[],
  active_deals: { buyer: Buyer, deal: Deal | null, property: Property | null, last_activity: ActivityFeed, temperature: string }[],
  recent_activity: ActivityFeed[] (last 50, across all buyers)
}

Use supabase.table('buyers').select('*').eq('agent_id', agent.id).eq('status', 'draft') pattern for queries.
For joins (buyer + deal + property), use Supabase's select with foreign key joins: supabase.table('buyers').select('*, deals(*), properties(*)').

Temperature is computed from: days since last communication, dashboard visit recency, and deal stage momentum.

**POST /api/buyers** — Create buyer (manual entry). Uses supabase.table('buyers').insert({...}).
**PATCH /api/buyers/{id}** — Update buyer. Uses supabase.table('buyers').update({...}).eq('id', id).
**POST /api/buyers/{id}/confirm** — Confirm a draft lead → sets status to active, triggers research Celery task.
**DELETE /api/buyers/{id}/dismiss** — Dismiss a draft lead (soft delete).

**GET /api/buyers/{id}** — Full buyer detail. Use select with joins to pull properties (via buyer_properties), deal, communications, activity.

**GET /api/activity** — Paginated activity feed. Use .range(offset, offset + limit) for pagination, with filters.

All queries are automatically scoped to agent_id via the auth middleware + RLS policies. But also explicitly filter by agent_id in the application layer as defense in depth.
```

### Prompt 1C — Connect Frontend to Backend

```
In the HomeAgent frontend, wire up the command center to real API data:

1. Create an API client utility that:
   - Gets the Supabase session token via supabase.auth.getSession()
   - Passes it as Authorization: Bearer header to all FastAPI backend calls
   - Wraps fetch with error handling, token refresh, and typing

2. Create React Query (TanStack Query) hooks:
   - useDashboard() — fetches /api/dashboard, refetches every 30s
   - useBuyer(id) — fetches individual buyer
   - useActivity(filters) — paginated activity feed

3. Populate the dashboard sections with real data from the hooks. 
   - New Leads section: each card has [Review & Confirm] and [Dismiss] buttons that call the API and optimistically update.
   - Active Deals: clicking a card navigates to /app/clients/[id]
   - Activity Feed: infinite scroll with timestamps

4. Create the /app/clients/[id] page — buyer detail view with tabs:
   - Overview (intent profile, contact info, engagement metrics)
   - Properties (their shortlist with scores)
   - Communications (email + call history)  
   - Deal (if in negotiation+, shows offer history and timeline)

5. Create "Add Client" modal triggered from a FAB or header button. Form with: name, email, phone, notes, source dropdown. On submit, creates buyer and shows success toast.

6. **Supabase Realtime subscriptions** (replace manual WebSocket):
   - Subscribe to activity_feed table changes filtered by agent_id:
     supabase.channel('agent-feed').on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'activity_feed', filter: `agent_id=eq.${agentId}` }, callback).subscribe()
   - Subscribe to agent_tasks changes (for research progress)
   - Subscribe to buyer_properties changes (for buyer dashboard activity)
   - On new activity_feed INSERT → push into the feed + invalidate React Query dashboard cache
   - On agent_tasks UPDATE (status change) → show toast notification
   
   Create a custom hook useRealtimeSubscriptions(agentId) that sets up all channels and cleans up on unmount.

7. For **Browser Use task streaming** (which needs more granular updates than DB changes), keep a single WebSocket endpoint /ws/agent/{agent_id} on the backend for streaming live execution logs during research tasks. This complements Supabase Realtime — use Supabase for DB-driven events, WebSocket for streaming task progress.
```

---

## Phase 2: Buyer Intake & Intent Profile

### Prompt 2A — Intake Form System

```
Build the buyer intake form system:

**Backend:**
1. Each buyer has a unique intake_form_token (UUID, auto-generated by Supabase). 
2. GET /api/intake/{token} — public route, no auth. Queries supabase.table('buyers').select('name, agent_id, agents(name)').eq('intake_form_token', token).single(). Returns buyer name, agent name, form fields.
3. POST /api/intake/{token} — submits the form. Uses supabase.table('buyers').update({...intake_data, intake_form_completed: True}).eq('intake_form_token', token). Triggers intent profile generation.

Form fields to collect (all optional, buyer fills what they want):
- Budget range (min/max)
- Bedrooms (min), Bathrooms (min)
- Minimum square footage
- Preferred areas/neighborhoods (multi-select or free text)
- Must-have amenities (pool, garage, home office, EV charger, smart home, etc — checkboxes)
- Nice-to-have amenities (same list)
- School district importance (1-5 scale), minimum school rating
- Max commute time (minutes) + workplace address
- Timeline (when do they need to move by)
- Current living situation (renting, own and selling, relocating from where)
- Household details (adults, kids, pets)
- HOA tolerance (yes/no/prefer not)
- Deal breakers (free text)
- Additional notes (free text)

**Frontend:**
1. Create /intake/[token] as a public page (no auth). 
2. Clean, mobile-first form design. Progress bar across top. Save-as-you-go (debounced PATCH). 
3. Warm, inviting design — this is the buyer's first impression. Use the agent's name in the header: "Mike is finding your perfect home. Help us understand what you're looking for."
4. On submit: confirmation screen with "Your agent will be in touch soon" + a note that they'll receive a dashboard link.

**Intent Profile Generation:**
Create a service function generate_intent_profile(buyer_id) that:
1. Pulls all known buyer data (manual entry fields + intake form + any extracted email/call data)
2. Sends to Claude (Sonnet) with prompt: "Generate a comprehensive buyer intent profile from this data. Output as structured JSON with: priorities_ranked, budget_analysis, lifestyle_factors, timeline_pressure, risk_tolerance, deal_breakers, search_strategy_recommendation."
3. Stores result in buyer.buyer_intent_profile
4. Creates activity feed entry: "Intent profile generated for {buyer_name}"
```

---

## Phase 3: Browser Use Research Pipeline

### Prompt 3A — Browser Use Agent Core

```
In the /agents directory, build the Browser Use research agent:

**Prerequisites:** Install browser-use package. Create a base agent class that handles:
- Browser session management (headless Chrome)
- Screenshot capture at key steps (for execution log replay in UI)  
- Structured logging of every action (navigate, click, extract, scroll)
- Error handling and retry logic
- Progress reporting via Redis pub/sub (so the Celery task can stream to WebSocket)

**ZillowSearchAgent:**
Input: buyer search criteria (location, price range, beds, baths, sqft, amenities)
Output: list of PropertyCandidate objects with all extracted data

Steps:
1. Navigate to Zillow search with criteria
2. Apply filters (price range, beds, baths, home type)
3. Paginate through results (up to 5 pages / ~50 listings)
4. For each listing on the results page, extract: address, price, beds, baths, sqft, thumbnail, listing URL
5. For top 20 candidates (sorted by relevance), navigate into the detail page and extract:
   - Full address, price, price history (from Zillow's price history section)
   - All structured details (lot size, year built, HOA, parking, etc.)
   - Days on market
   - Listing agent name and brokerage
   - Description text
   - Photo URLs (first 10)
   - Zillow's Zestimate if available
6. Return structured PropertyCandidate list

**Cross-Reference Agents (separate agent classes):**
- SchoolAgent: Takes an address → hits GreatSchools.org → returns assigned schools with ratings
- WalkScoreAgent: Takes an address → hits WalkScore → returns walk/transit/bike scores  
- CommuteAgent: Takes an address + destination → hits Google Maps → returns drive time at 8 AM weekday

Each agent is a separate class that can be composed in the pipeline.

**Create a Celery task:** run_property_research(buyer_id)
1. Pull buyer intent profile and search criteria from Supabase: supabase.table('buyers').select('*').eq('id', buyer_id).single()
2. Run ZillowSearchAgent
3. For each property result, run cross-reference agents in parallel (asyncio.gather or Celery chord)
4. Store results as Property records: supabase.table('properties').upsert([...property_dicts], on_conflict='listing_url')
5. Create buyer_properties junction records: supabase.table('buyer_properties').insert([{buyer_id, property_id, status: 'suggested'} for ...])
6. Update agent_tasks status to 'running' with execution_log entries → triggers Supabase Realtime
7. Stream granular progress events via Redis → WebSocket (for step-by-step UI updates during the task)
8. When complete, update agent_tasks status to 'complete', trigger the scoring pipeline (next prompt)
```

### Prompt 3B — LLM Scoring Pipeline

```
Build the property scoring pipeline:

**Celery task: score_properties(buyer_id)**

For each unscorated property linked to the buyer:

1. Build the scoring prompt. Include:
   - Full buyer intent profile JSON
   - Property structured data (all fields)
   - Cross-reference data (schools, walk score, commute)
   - Price history and DOM context
   
2. Call Claude (Sonnet) with system prompt:
   "You are a real estate analysis AI. Score this property for the buyer on a 0-100 scale. Consider: location match, price positioning within budget, amenity alignment, school district quality, commute impact, lifestyle fit, and investment potential. Return JSON: { score: number, reasoning: string (2-3 sentences explaining the score to the buyer), pros: string[], cons: string[], flags: string[] (concerns to investigate) }"

3. Store score, reasoning in property record (supabase.table('properties').update({match_score, match_reasoning}).eq('id', property_id)) and buyer_properties record.

**Seller Motivation Scoring (separate Celery task: score_seller_motivation(property_id))**

Call Claude (Sonnet) with:
- Price history (drops, relisting patterns)
- Days on market vs market median
- Listing description changes over time
- Listing agent's portfolio size (if known)

System prompt: "Assess seller motivation 0-100. Consider: price reduction patterns, DOM relative to market, listing refresh behavior, agent workload. Return JSON: { score: number, reasoning: string, signals: string[], recommended_leverage: string[] }"

Store in property record via supabase.table('properties').update({seller_motivation_score, seller_motivation_reasoning}).eq('id', property_id).

**After scoring completes:**
- Rank properties by match_score descending
- Insert activity_feed entry: "Research complete for {buyer_name}: {n} properties scored, top match: {address} ({score}/100)" → Supabase Realtime pushes this to the agent's command center automatically
```

### Prompt 3C — Agent Task Viewer

```
In the frontend, build the Browser Use task viewer:

1. On the buyer detail page (/app/clients/[id]), add a "Research" tab.

2. Show the current/latest agent task for this buyer:
   - Status badge (queued → running → complete)
   - If running: live progress feed from WebSocket showing what the agent is doing ("Navigating to Zillow... Extracting listing 12/47... Cross-referencing schools...")
   - If complete: summary card showing "47 listings found, 20 deeply analyzed, 8 scored above 70"
   - "Run New Search" button to trigger fresh research

3. When research is complete, the Properties tab lights up with the ranked shortlist. Each property card shows:
   - Photo thumbnail
   - Address, price, beds/baths/sqft
   - Match score (large, colored: green 80+, yellow 60-79, red <60)
   - Score reasoning (2-3 sentence summary)
   - Seller motivation indicator (if scored)
   - Quick actions: [Remove] [Add Note] [View Detail]

4. Property detail modal/page: full data display — all structured data, price history chart (recharts), school ratings, walk scores, commute time, photos gallery, listing description, AI reasoning, seller motivation analysis.

5. "Send to Client" flow:
   - Agent selects which properties to include (checkboxes, default = top 5)
   - Agent can reorder via drag-and-drop
   - Agent can add personal notes to each property
   - "Preview Email" button → shows the AI-drafted email (next prompt)
   - "Send" button → sends via backend
```

---

## Phase 4: Email Drafting & Sending

### Prompt 4A — Email Composition & Gmail Integration

```
Build the email drafting and sending system:

**Backend:**

1. **POST /api/buyers/{id}/compose-email** — Given a buyer_id and list of property_ids (in order):
   - Pull buyer intent profile, buyer name, selected properties with scores/reasoning
   - Call Claude (Sonnet) with prompt:
     "Draft a personalized email from a buyer's agent to their client. The agent's name is {agent_name}. The buyer's name is {buyer_name}. Use the agent's communication tone: {tone}. Include the top properties with brief highlights for each (address, price, key selling points from the AI scoring). End with a link to their private dashboard: {dashboard_url}. Be warm, professional, and concise. Do NOT use corporate jargon. Sound like a knowledgeable friend who found great options."
   - Return: { subject: string, body_html: string, body_text: string }

2. **POST /api/buyers/{id}/send-email** — Takes the composed email (agent may have edited it) and sends via Gmail API.
   - Use Google OAuth tokens from the agent's session
   - Send from agent's actual Gmail address
   - Store in communications table as outbound email
   - Create activity feed entry
   - Generate the buyer's dashboard token/URL if not exists
   - Include dashboard link in the email

3. **Gmail API integration service:**
   - gmail_send(agent_id, to, subject, body_html) — sends email using agent's Google OAuth token (stored in agents.google_refresh_token via Supabase)
   - gmail_list_messages(agent_id, query, after) — search messages  
   - gmail_get_message(agent_id, message_id) — get full message content
   - Retrieve OAuth refresh token from Supabase: supabase.table('agents').select('google_refresh_token').eq('id', agent_id).single()
   - Handle token refresh using google-auth library

**Frontend:**

1. Email preview modal in the "Send to Client" flow:
   - Shows rendered HTML email
   - Editable subject line and body (rich text editor — use tiptap or just a textarea for v1)
   - "Regenerate" button to get a new draft
   - "Send" button with confirmation dialog
   
2. On send success: toast notification, buyer status updates, activity feed entry appears
```

---

## Phase 5: Buyer Dashboard

### Prompt 5A — Buyer Dashboard Core

```
Build the buyer's private dashboard:

**Backend:**
1. GET /api/dashboard/buyer/{token} — Public route. Token is the buyer's unique dashboard_token. Query: supabase.table('buyers').select('*, agent:agents(name, email), buyer_properties(*, property:properties(*)), deals(*)').eq('dashboard_token', token).single(). Returns:
   { buyer: { name, agent_name, agent_photo }, properties: BuyerProperty[] (with full property data, sorted by score), deal: Deal | null, search_criteria: { current filters }, timeline: DealTimeline | null }

2. POST /api/dashboard/buyer/{token}/favorite/{property_id} — Toggle favorite. Updates buyer_properties via supabase.table('buyer_properties').update({status: 'favorited'}).match({buyer_id, property_id}). Also inserts activity_feed entry → Supabase Realtime notifies agent.
3. POST /api/dashboard/buyer/{token}/comment/{property_id} — Add comment (body: { text }). Updates buyer_properties.buyer_notes. Inserts activity_feed.
4. PATCH /api/dashboard/buyer/{token}/criteria — Update search criteria. Updates buyer.buyer_intent_profile via Supabase.
   - If changes open new search territory (budget expanded, new areas added, requirements relaxed), auto-queue a new Browser Use research Celery task
   - Insert activity_feed entry for the agent
5. POST /api/dashboard/buyer/{token}/track — Log page view / property click with dwell time. Body: { property_id, action: "view"|"click"|"dwell", duration_seconds }. Inserts into dashboard_sessions and updates buyer_properties.dashboard_dwell_seconds.

**Frontend — /dashboard/[token] (public, no auth):**

1. **Header:** "Your Home Search" + agent's name and photo. Clean, warm design.

2. **Property Cards Grid:**
   - Large photo, address, price, beds/baths/sqft
   - Match score badge with reasoning text
   - Heart icon to favorite (filled when favorited)
   - Comment icon with count
   - Click to expand full detail view

3. **Property Detail Expanded View:**
   - Photo gallery (swipeable on mobile)
   - All structured data in clean layout
   - Price history chart (recharts)
   - School ratings with school names
   - Walk/transit/bike scores (visual indicators)
   - Commute time display
   - AI match reasoning (expanded)
   - Comment thread (buyer can add comments, sees agent notes if any)
   - [Request Tour] button

4. **Comparison Mode:**
   - Select 2-3 properties → side-by-side table
   - Highlights differences in green/red

5. **Search Criteria Panel (collapsible sidebar or modal):**
   - Current filters displayed with edit controls
   - Sliders for budget range, sqft
   - Dropdowns for beds/baths minimums
   - Checkbox groups for areas, amenities
   - School rating minimum slider
   - Commute time input with workplace address
   - "Update" button that saves and shows: "Your agent will be notified of these changes"
   - If criteria change triggers new research: show "Searching for new properties matching your updated criteria..."

6. **Deal Timeline (shows when deal stage >= negotiating):**
   - Visual timeline bar showing stages
   - Current stage highlighted
   - Key dates and deadlines

7. **Track all interactions:** Every page load, property click, dwell time → POST to /track endpoint. This feeds the agent's intelligence on buyer behavior.

Design this to be BEAUTIFUL. This is what sells the product. Mobile-first. The buyer should feel like they have a personal concierge, not a search engine.
```

---

## Phase 6: Email Intelligence

### Prompt 6A — Email Monitoring & Lead Detection

```
Build the email monitoring system:

**Celery periodic task: scan_emails(agent_id) — runs every 15 minutes**

1. Fetch recent emails from agent's Gmail (last 15 min window using gmail_list_messages with after timestamp).

2. For each email, check if the sender matches any existing buyer (by email address) or any known listing agent in active deals.

3. **If matched to existing buyer/deal:**
   - Store as communication record: supabase.table('communications').insert({...})
   - Run Claude (Sonnet) analysis with deal context:
     "Analyze this email in the context of this real estate deal. Extract: sender_position (what they're saying), deadlines_mentioned, emotional_tone, red_flags, action_items_for_agent, leverage_points. Return JSON."
   - Update communication.ai_analysis via supabase.table('communications').update({...}).eq('id', comm_id)
   - Insert activity_feed entry (triggers Supabase Realtime → agent gets instant notification)
   - If action items detected with urgency, the activity_feed event_type='action_required' will surface in command center

4. **If unmatched sender:**
   - Run lead classification via Claude (Sonnet):
     "Is this email a potential new real estate buyer lead? Analyze the content for buying intent signals. Return JSON: { is_lead: boolean, confidence: 'high'|'medium'|'low', extracted_info: { name, phone, budget, location, timeline, referral_source, household_info, any_other_details } }"
   - If is_lead=true:
     - Check for duplicates (fuzzy match on name, email, phone against existing buyers via Supabase query)
     - If no duplicate: create draft buyer record: supabase.table('buyers').insert({...extracted_info, status: 'draft', source: 'email', confidence_level: confidence})
     - Insert activity_feed entry: event_type='new_lead' (triggers Supabase Realtime → instant notification on command center)
     - WebSocket push NOT needed — Supabase Realtime handles it

**Backend routes:**
- GET /api/communications?buyer_id=X — List communications for a buyer (supabase.table('communications').select('*').eq('buyer_id', X).order('occurred_at', desc=True))
- GET /api/communications/{id} — Single communication with AI analysis
- POST /api/communications/{id}/reanalyze — Re-run AI analysis with updated deal context

**Frontend additions:**
- Communications tab on buyer detail page: email list with sender, subject, timestamp, sentiment badge, action items extracted
- Click to expand: full email body + AI analysis panel (key insights, action items, tone assessment)
- New lead cards in command center show "Source: Email" badge with extracted preview
```

---

## Phase 7: Call Intelligence

### Prompt 7A — iOS 18 Native Call Recording + Whisper Analysis

```
Build the call capture and intelligence system. Two capture methods:

**Primary (production): iOS 18 native call recording.** Agent records calls using the built-in iPhone record button (iOS 18.1+). Recording + transcript auto-save to the Notes app. Agent shares the audio to HomeAgent afterward via iOS Share Sheet. One extra tap after the call.

**Secondary (demo / power users): Twilio conference bridge.** Fully automatic capture — no post-call step. Better for demos because the entire flow is visible in the app. Keep this as an opt-in "auto-capture" mode.

Both paths feed into the same Whisper transcription → Claude analysis pipeline.

---

## PRIMARY FLOW: iOS 18 Native Recording + Share to HomeAgent

**How it works from the agent's perspective:**
1. Agent makes/receives a call normally in the iPhone Phone app
2. During the call, taps the waveform icon (top-left of call screen) to start recording — this is native iOS, nothing to do with HomeAgent
3. iOS announces "This call is being recorded" to both parties (handles legal disclosure automatically)
4. Call ends. Recording + transcript saved to Notes app under "Call Recordings" folder
5. Agent opens the note → taps Share → taps "HomeAgent" (or "Save Audio to Files" → shared folder)
6. HomeAgent receives the audio, runs Whisper + Claude analysis, and the call intelligence appears in the command center

**The key insight:** iOS 18 already solved the hard part (capturing call audio + legal disclosure). HomeAgent just needs to be a good receiver and analyzer. Don't rebuild what Apple already ships.

**Backend:**

1. **POST /api/calls/upload** — Receives audio from the agent.
   ```python
   @router.post("/api/calls/upload")
   async def upload_call(
       file: UploadFile,
       buyer_id: Optional[str] = Form(None),
       deal_id: Optional[str] = Form(None),
       contact_name: Optional[str] = Form(None),
       agent = Depends(get_current_agent)
   ):
       # Upload to Supabase Storage
       file_bytes = await file.read()
       ext = file.filename.split('.')[-1] if file.filename else 'wav'
       storage_path = f"{agent['id']}/{uuid4()}.{ext}"
       supabase.storage.from_('call-recordings').upload(storage_path, file_bytes)
       
       # Create communication record
       comm = supabase.table('communications').insert({
           'agent_id': agent['id'],
           'buyer_id': buyer_id,
           'deal_id': deal_id,
           'type': 'call',
           'direction': 'outbound',
           'raw_content': '',
           'recording_path': storage_path,
           'metadata': {
               'contact_name': contact_name,
               'source': 'ios_native',  # vs 'twilio_bridge'
               'original_filename': file.filename,
           },
           'occurred_at': datetime.utcnow().isoformat()
       }).execute()
       
       # Trigger transcription + analysis
       transcribe_and_analyze_call.delay(comm.data[0]['id'])
       
       # Activity feed
       create_activity(agent['id'], 'call_uploaded',
           f"Call recording uploaded",
           f"Transcription in progress...",
           buyer_id=buyer_id)
       
       return {"communication_id": comm.data[0]['id'], "status": "processing"}
   ```

2. **POST /api/calls/upload-with-transcript** — If the agent shares both the audio AND the iOS-generated transcript (from Notes), skip Whisper and go straight to Claude analysis. Saves time + cost.
   ```python
   @router.post("/api/calls/upload-with-transcript")
   async def upload_call_with_transcript(
       file: UploadFile,
       transcript_text: str = Form(...),  # iOS-generated transcript pasted or included
       buyer_id: Optional[str] = Form(None),
       deal_id: Optional[str] = Form(None),
       contact_name: Optional[str] = Form(None),
       agent = Depends(get_current_agent)
   ):
       # Same storage upload...
       # Create comm record with transcript already populated
       # Skip Whisper, trigger analysis-only task
       analyze_call.delay(comm_id)  # no transcription step needed
   ```

3. **POST /api/calls/paste-transcript** — Agent can also just paste the iOS transcript text without the audio file. Lowest friction option — no file transfer at all.

4. **Celery task: transcribe_and_analyze_call(communication_id)**
   - Download audio from Supabase Storage
   - Send to **OpenAI Whisper API** for transcription:
     ```python
     import openai
     client = openai.OpenAI()
     
     with open(audio_path, 'rb') as f:
         transcript = client.audio.transcriptions.create(
             model="whisper-1",
             file=f,
             response_format="verbose_json",
             timestamp_granularities=["segment"]
         )
     ```
   - For speaker diarization (Whisper doesn't natively separate speakers):
     Send timestamped transcript to Claude (good enough for v1):
       "This is a real estate call. Two speakers: the agent ({agent_name}) and the other party. Using conversational flow and context, label each segment. The agent likely initiates greetings, asks questions, discusses strategy. Return diarized transcript as JSON array of {speaker, text, start, end}."
   - Store full transcript in communication.transcript
   - Store diarized version in communication.metadata['diarized_transcript']
   - Then run analysis (continues in same task) — see analysis section below

5. **Celery task: analyze_call(communication_id)** — Analysis-only (when transcript already exists):
   - Pull full deal context if comm is linked to a buyer/deal
   - Call Claude (Opus) with diarized transcript + deal context:
     "Analyze this real estate call transcript. Speaker identification is provided. Generate: { buyer_temperature: 'hot'|'warm'|'cool', key_topics: string[], negotiation_leverage: string[], concerns_raised: string[], action_items: { item: string, deadline: string|null, priority: string }[], agent_coaching: string (constructive feedback on the agent's performance), summary: string (3-4 sentence overview) }"
   - If the call involves an unrecognized speaker with buying intent → run lead classification (same as email flow)
   - Update buyer intent profile with new signals
   - Store analysis in communication.ai_analysis
   - Insert activity_feed entry (Supabase Realtime → frontend notification)

6. **Seller-side call analysis** — when comm is linked to a deal and the other party is a listing agent:
   - Additional Claude prompt: "Analyze this call with a listing agent for negotiation intelligence. Identify: hedging_language, urgency_signals, information_leaks, estimated_seller_floor_price, listing_agent_negotiation_style, recommended_tactics. Return JSON."
   - Store in deal.intelligence_dossier

**Frontend — Call upload UX (primary flow):**

1. **"Add Call Recording" button** in the Communications tab of any buyer/deal page, and also accessible from the main dashboard. Icon: microphone + upload arrow.

2. **Upload flow (bottom sheet on mobile, modal on desktop):**
   - **Step 1 — Link the call:**
     - "Who was on this call?" → quick-select from active buyers + listing agents, or "New / Unknown"
     - This step can be skipped — the AI will attempt to identify the caller from the transcript content
   - **Step 2 — Share the recording:**
     - Three options presented:
       - **"Share from Notes"** (recommended) — instructions: "Open Notes → Call Recordings → tap the recording → Share → HomeAgent". If the app is registered as a Share Extension target, this opens HomeAgent directly with the file. If not, agent uses "Save Audio to Files" and the app reads from a shared iCloud Drive folder.
       - **"Upload file"** — standard file picker (for recordings saved to Files, Voice Memos, etc.)
       - **"Paste transcript only"** — textarea for pasting the iOS-generated transcript text. No audio, but analysis still runs. Fastest option.
   - **Step 3 — Processing:**
     - "Transcribing..." → "Analyzing..." → "Complete ✓"
     - Estimated time: 30-90 seconds depending on call length
     - Agent can navigate away — they'll get a notification when done

3. **iOS Share Extension (ideal, requires some native code):**
   Register HomeAgent as a Share Extension target so it appears in the iOS Share Sheet. When the agent shares a call recording from Notes:
   - HomeAgent app/PWA opens with the audio file pre-loaded
   - Quick-select contact linking screen appears
   - One tap to submit → processing begins
   - This is the smoothest path: Record (native) → Notes → Share → HomeAgent → done

4. **Alternative: watched iCloud Drive folder:**
   During onboarding, agent sets up an iOS Shortcut (provided by HomeAgent):
   - Shortcut: "When a new note appears in Call Recordings folder → Save Audio to Files → iCloud Drive/HomeAgent/Recordings"
   - Backend periodically checks this shared folder for new files (or uses iCloud Drive API)
   - Fully automatic after initial setup, but depends on Shortcuts reliability

---

## SECONDARY FLOW: Twilio Conference Bridge (Demo / Auto-Capture)

Keep this for demos and as an opt-in power-user feature. The agent enables "Auto-Capture Mode" in settings, which uses the Twilio bridge approach.

**How it works:**
1. Agent opens HomeAgent → taps "Recorded Call" on a buyer/deal page
2. Selects the contact → HomeAgent calls Twilio → Twilio calls the agent's iPhone
3. Agent answers → dials the other party → taps Merge Calls on iPhone
4. Twilio records both sides. When call ends, recording auto-flows into the analysis pipeline. Zero post-call steps.

**Backend (Twilio endpoints):**

1. **POST /api/calls/start-bridge** — Initiates the Twilio bridge call.
   ```python
   from twilio.rest import Client
   
   @router.post("/api/calls/start-bridge")
   async def start_bridge(
       body: StartBridgeRequest,  # { buyer_id?, deal_id?, contact_name?, contact_phone? }
       agent = Depends(get_current_agent)
   ):
       twilio_client = Client(TWILIO_SID, TWILIO_AUTH_TOKEN)
       
       comm = supabase.table('communications').insert({
           'agent_id': agent['id'],
           'buyer_id': body.buyer_id,
           'deal_id': body.deal_id,
           'type': 'call',
           'direction': 'outbound',
           'raw_content': '',
           'metadata': {
               'contact_name': body.contact_name,
               'contact_phone': body.contact_phone,
               'source': 'twilio_bridge',
               'bridge_status': 'initiated',
           },
           'occurred_at': datetime.utcnow().isoformat()
       }).execute()
       
       comm_id = comm.data[0]['id']
       
       call = twilio_client.calls.create(
           to=agent['phone'],
           from_=TWILIO_BRIDGE_NUMBER,
           url=f"{BASE_URL}/api/calls/twilio-join-conference/{comm_id}",
           status_callback=f"{BASE_URL}/api/calls/twilio-status/{comm_id}",
           status_callback_event=['completed'],
       )
       
       supabase.table('communications').update({
           'metadata': {**comm.data[0]['metadata'], 'twilio_call_sid': call.sid}
       }).eq('id', comm_id).execute()
       
       return {
           "communication_id": comm_id,
           "status": "bridge_calling",
           "contact_phone": body.contact_phone,
       }
   ```

2. **GET /api/calls/twilio-join-conference/{comm_id}** — TwiML endpoint.
   ```python
   @router.get("/api/calls/twilio-join-conference/{comm_id}")
   async def twilio_join_conference(comm_id: str):
       response = VoiceResponse()
       dial = response.dial()
       dial.conference(
           f"recording-{comm_id}",
           record="record-from-start",
           recording_status_callback=f"{BASE_URL}/api/calls/twilio-recording-complete/{comm_id}",
           recording_status_callback_event="completed",
           beep=False,
           start_conference_on_enter=True,
           end_conference_on_exit=True,
       )
       return Response(content=str(response), media_type="application/xml")
   ```

3. **POST /api/calls/twilio-recording-complete/{comm_id}** — Webhook when recording is ready.
   - Download recording from Twilio
   - Upload to Supabase Storage
   - Update communication record with recording_path
   - Trigger transcribe_and_analyze_call.delay(comm_id) — same pipeline as primary flow
   - Insert activity_feed entry

**Frontend — Twilio bridge UX (secondary flow):**

1. **"Recorded Call" button** — appears on buyer/deal pages only when agent has Twilio auto-capture enabled in settings.

2. **Tap flow:**
   - Select contact → "Starting bridge... Answer the incoming call, then dial {name} and tap Merge Calls"
   - Shows iPhone merge instructions (screenshot of the Merge Calls button location)
   - Recording indicator (red dot + timer) once conference is active
   - Call ends → "Recording complete ✓ Transcribing..." → notification when analysis is done

3. This flow is great for **demos** because the entire journey — from tapping "Recorded Call" to seeing the AI analysis — happens visibly within the app.

---

## SHARED: Call Analysis UI

**Call detail view** (in Communications tab, identical regardless of capture method):
- Audio player (stream from Supabase Storage signed URL via `<audio>` tag)
- Diarized transcript with speaker labels (Agent / Other Party) and timestamps
- Tap a transcript segment → audio seeks to that timestamp
- AI analysis panel: summary card, temperature badge, key insights, action items
- Coaching section (collapsible — "How you did")
- For seller-side calls: "Negotiation Intelligence" panel showing extracted leverage

**Call history** in Communications tab:
- All recorded calls with duration, date/time, linked buyer/deal
- Quick badges: temperature dot, action items count
- Source indicator: "iOS Recording" or "Auto-Capture"
- Status: uploading → transcribing → analyzing → complete

---

## Database & Config

**Database additions to agents table:**
- phone (text nullable) — agent's phone number (needed for Twilio bridge)
- twilio_bridge_enabled (bool default false) — opt-in for auto-capture mode
- recording_disclosure_state (text nullable) — agent's state for consent law reminders

**New env vars:**
- TWILIO_ACCOUNT_SID
- TWILIO_AUTH_TOKEN
- TWILIO_BRIDGE_NUMBER
- BASE_URL (public URL for Twilio webhooks — use ngrok for local dev)

**Onboarding checklist (shown in Settings):**
- [ ] iPhone running iOS 18.1+ (required for native call recording)
- [ ] "Add HomeAgent to Home Screen" (for quick Share Sheet access)
- [ ] Optional: Install the "Auto-Share Call Recordings" iOS Shortcut (automates the Notes → HomeAgent step)
- [ ] Optional: Enable Auto-Capture Mode (requires phone number for Twilio bridge)
```

---

## Phase 8: Offer Strategy & Negotiation

### Prompt 8A — Pre-Offer Intelligence Brief

```
Build the offer strategy system:

**Backend:**

1. POST /api/deals/{id}/strategy-brief — Generates comprehensive offer strategy:
   
   Gather all intelligence:
   - Property dossier (full structured data, price history, DOM, tax assessment)
   - Seller motivation profile (score + signals)
   - Comp analysis (pull from properties table — recent sales within 0.5mi, similar beds/baths/sqft)
   - Listing agent profile (from scraped data)
   - Buyer intent profile (budget, timeline, priorities)
   - All communications related to this deal
   
   Call Claude (Opus) with everything:
   "Generate a comprehensive offer strategy brief for this real estate deal. Include:
   - fair_market_value_range: { low, mid, high, methodology }
   - recommended_opening_offer: { price, reasoning }
   - escalation_strategy: { steps: [{ if_counter_above, then_offer, rationale }], absolute_ceiling }
   - contingency_recommendations: { inspection, appraisal, financing, reasoning_for_each }
   - closing_timeline_recommendation: { days, reasoning, hold_in_reserve }
   - narrative_framing: string (how to position the offer emotionally)
   - risk_assessment: { deal_probability_pct, risks: [{ risk, probability, mitigation }] }
   - comps_to_cite: [{ address, price, why_favorable }]
   - comps_they_will_cite: [{ address, price, counter_argument }]
   Return as structured JSON."
   
   Store in deal record. Create activity feed entry.

2. POST /api/deals/{id}/counter-analysis — When counter-offer arrives:
   - Input: counter_offer details (price, terms, contingencies)
   - Pull existing strategy brief + all deal context
   - Claude (Opus) analysis:
     "Analyze this counter-offer against our strategy. What does the counter-offer reveal? Update deal probability. Provide updated recommendation with reasoning."
   - Update deal.offer_history with new round
   - Update deal_probability
   - Create activity feed entry

3. POST /api/deals/{id}/draft-offer-email — Draft the offer submission email:
   - Uses strategy brief narrative framing
   - Professional, doesn't reveal intelligence
   - Agent reviews and sends via Gmail

**Frontend — Deal tab on buyer detail page:**

1. "Generate Strategy Brief" button → loading state → displays the brief in a structured layout:
   - Fair market value range visualization (bar chart with low/mid/high markers and listing price)
   - Recommended offer card with reasoning
   - Escalation strategy as a decision tree or step list
   - Comp analysis in two columns (favorable / unfavorable)
   - Risk assessment with probability bars
   
2. Offer History timeline:
   - Each round: our offer, their counter, AI analysis, deal probability change
   - Visual deal probability line chart over time
   
3. "Analyze Counter" button when new counter arrives → input form for counter details → analysis appears
```

---

## Phase 9: Under Contract Management

### Prompt 9A — Contract Timeline & Document Analysis

```
Build the under-contract management system:

**Backend:**

1. POST /api/deals/{id}/generate-timeline — When deal moves to under_contract stage:
   - Input: contract terms (closing date, earnest money, contingency periods)
   - Generate contingency timeline with all deadlines
   - Create monitoring tasks for each deadline (alert 48h before)
   - Store in deal.contingency_timeline
   - Create activity feed entries for key dates

2. POST /api/deals/{id}/analyze-document — Upload and analyze deal documents:
   - Accept PDF upload (inspection report, appraisal, title commitment)
   - Upload to Supabase Storage bucket 'documents': supabase.storage.from_('documents').upload(f'{deal_id}/{filename}', file_bytes)
   - Extract text from PDF (use PyPDF2 or pdfplumber)
   - Detect document type from content
   - Route to appropriate Claude (Opus) analysis prompt:
   
   For INSPECTION REPORTS:
   "Analyze this home inspection report. Categorize every finding into: critical (deal-impacting, >$2000 repair), moderate (negotiation leverage, $500-2000), minor (cosmetic, <$500). For critical and moderate items, estimate repair cost range. Generate: repair_negotiation_strategy (what to ask for, how to frame it, what to concede), risk_assessment (should buyer proceed?). Return structured JSON."
   
   For APPRAISAL:
   "The contract price is ${price}. Analyze this appraisal. If appraised value < contract price, generate scenarios with recommended actions for each. Return structured JSON."
   
   Store analysis in deal record. Create activity feed entry.

3. Celery periodic task: check_deal_deadlines(agent_id)
   - Run hourly
   - For each active deal in under_contract stage
   - Check contingency_timeline for deadlines within 48 hours
   - Create "Action Required" entries in command center
   - Send WebSocket alert

**Frontend — Deal tab enhancements:**

1. Contract Timeline visualization:
   - Horizontal timeline bar showing all milestones
   - Current date indicator
   - Color coding: green (completed), yellow (upcoming <48h), gray (future)
   - Click milestone for details and action items

2. Document Analysis section:
   - Upload button for PDFs
   - Processing indicator while analyzing
   - Results displayed as structured cards:
     - Inspection: prioritized findings with severity colors, repair cost estimates, negotiation strategy
     - Appraisal: value comparison chart, scenario cards with actions
   
3. Closing Checklist:
   - Auto-generated from contract terms
   - Checkable items: earnest money, inspection, appraisal, financing, title, walkthrough, closing
   - Status tracked and visible to buyer on their dashboard
```

---

## Phase 10: Real-Time & Polish

### Prompt 10A — Real-Time Events & Notifications

```
Build the real-time event system using Supabase Realtime as the primary mechanism:

**Architecture:**
- **Supabase Realtime** handles all DB-driven events (new leads, email detected, price changes, buyer activity, deadline alerts). The frontend subscribes directly to Postgres changes — no custom WebSocket server needed for these.
- **FastAPI WebSocket** /ws/agent/{agent_id} handles ONLY streaming Browser Use task progress (step-by-step updates during research). This is the one thing that doesn't fit Supabase Realtime because it's ephemeral streaming data, not DB rows.

**Backend changes:**

1. **Ensure all backend processes write to the right tables to trigger Realtime:**
   - Email scanner → insert into activity_feed → frontend gets instant notification
   - Lead detection → insert buyer (status=draft) + insert activity_feed → frontend shows new lead card
   - Browser Use completion → update agent_tasks status + insert activity_feed
   - Price change detection → insert activity_feed with event_type='price_change'
   - Deadline checker → insert activity_feed with event_type='deadline_approaching'
   
   Create a helper: create_activity(agent_id, event_type, title, description, buyer_id=None, deal_id=None, property_id=None, metadata={}) that inserts into activity_feed via Supabase client.

2. **WebSocket endpoint (streaming only):** /ws/agent/{agent_id}
   - Authenticated via token query param (verify Supabase JWT)
   - Only used during active Browser Use tasks
   - Celery tasks publish progress to Redis → FastAPI WS reads from Redis and streams to client
   - Events: { step: int, total: int, action: string, screenshot_url?: string }

**Frontend:**

1. **Supabase Realtime hook:** useRealtimeNotifications(agentId)
   ```typescript
   // Subscribe to activity_feed inserts for this agent
   supabase.channel(`agent-${agentId}`)
     .on('postgres_changes', {
       event: 'INSERT',
       schema: 'public',
       table: 'activity_feed',
       filter: `agent_id=eq.${agentId}`
     }, (payload) => {
       // Add to notification queue
       // Invalidate React Query cache
       // Show toast for high-priority events
     })
     .on('postgres_changes', {
       event: 'UPDATE',
       schema: 'public',
       table: 'agent_tasks',
       filter: `agent_id=eq.${agentId}`
     }, (payload) => {
       // Update task status in UI
     })
     .subscribe()
   ```

2. Notification bell in top bar: unread count badge, dropdown showing recent activity_feed entries
3. Toast notifications for high-priority events (new leads where confidence='high', action_required urgency='high')
4. Browser push notifications (request permission on first login) for critical events when tab is not active
5. Auto-invalidate React Query caches when relevant Realtime events arrive
6. For Browser Use streaming: separate useTaskStream(taskId) hook that connects to the WS endpoint only when a task is actively running
```

### Prompt 10B — Property Monitoring

```
Build the ongoing property monitoring system:

**Celery periodic task: monitor_properties(agent_id) — runs every 6 hours**

For each property linked to an active buyer (query via Supabase: join buyer_properties → buyers where status != 'rejected' and buyer.status = 'active'):
1. Re-scrape the Zillow listing page via Browser Use
2. Compare against stored data (pull current from supabase.table('properties').select('*').eq('id', property_id)):
   - Price change → append to price_history jsonb array, update price field, insert activity_feed with event_type='price_change' (triggers Supabase Realtime)
   - Status change (active → pending → sold) → update status, insert activity_feed with event_type='listing_status_change'
   - Description change → flag in structured_data as "listing_refreshed"
   - Photos changed → flag as "photos_updated"
   - Days on market milestone (7, 14, 21, 30, 45, 60) → re-run seller motivation scoring task

3. For properties in active deals (supabase.table('deals').select('property_id').in_('stage', ['negotiating', 'under_contract'])):
   - Check more frequently (every 2 hours)
   - If listing goes to "pending" unexpectedly → insert activity_feed with event_type='urgent_listing_change' and metadata indicating possible competing offer

**Celery periodic task: refresh_comps(deal_id) — runs daily for under_contract deals**
- Search for new comparable sales that closed since last check
- If significant new comp found → insert activity_feed, update deal.intelligence_dossier

**Frontend:**
- Property cards show "Updated" badge when changes detected since last view (compare property.updated_at with buyer's last dashboard_session)
- Price history chart updates automatically (Supabase Realtime on properties table)
- Monitoring status indicator on property detail (last_scraped_at, changes detected)
```

---

## Phase 11: Post-Close & Settings

### Prompt 11A — Post-Close Flywheel

```
Build the post-close system:

**When deal.stage transitions to 'closed':**

1. Generate satisfaction survey link (simple form: NPS 1-10, text feedback, testimonial opt-in)
2. Queue follow-up email sequence:
   - Day 0: Congratulations email (personalized, references the property)
   - Day 7: "Settling in" email with HOA contact, utility info, contractor recommendations (all from deal file)
   - Day 30: Check-in
   - Month 6: Property value update (re-scrape comps, estimate appreciation)
   - Month 12: Annual value update + "know anyone looking to buy?" soft referral ask

3. Move buyer to "Completed" section in command center
4. Continue monitoring the property (quarterly) for appreciation data

**Backend:**
- POST /api/deals/{id}/close — Transition to closed, trigger post-close sequence
- Celery tasks for scheduled email sends (using celery beat or eta)
- GET /api/survey/{token} — Public survey endpoint
- POST /api/survey/{token} — Submit survey

**Frontend — Settings page (/app/settings):**
- Agent profile: name, photo, email signature, communication tone (dropdown: professional/friendly/casual)
- Gmail connection status + reconnect button (re-triggers Supabase Auth OAuth with Gmail scopes)
- Calendar connection status
- Notification preferences (what triggers alerts)
- Default search criteria (starting point for new buyers)
- Post-close email template customization
- Supabase Auth session info (logged in as, last sign-in)
```

---

## Build Order Summary

| Order | Prompt | What You Get | Depends On |
|-------|--------|-------------|------------|
| 1 | 0A | Running monorepo with Docker | Nothing |
| 2 | 0B | Full database schema | 0A |
| 3 | 1A | Command center UI skeleton | 0A |
| 4 | 1B | Dashboard API | 0B |
| 5 | 1C | Wired-up command center | 1A + 1B |
| 6 | 2A | Intake form system | 0B + 1C |
| 7 | 3A | Browser Use scraping | 0B |
| 8 | 3B | LLM scoring | 3A |
| 9 | 3C | Research viewer UI | 1C + 3B |
| 10 | 4A | Email drafting + Gmail | 3C |
| 11 | 5A | Buyer dashboard | 4A |
| 12 | 6A | Email monitoring + lead detection | 4A |
| 13 | 7A | Call intelligence | 0B + 1C |
| 14 | 8A | Offer strategy | 3B + 6A |
| 15 | 9A | Contract management | 8A |
| 16 | 10A | Real-time events | All backend |
| 17 | 10B | Property monitoring | 3A + 10A |
| 18 | 11A | Post-close + settings | 9A |

---

## Tips for Claude Code Sessions

1. **Feed context:** At the start of each session, paste the relevant prompt AND tell Claude Code about the existing codebase structure. Something like: "Here's the current project structure: [tree output]. I need to implement Phase 3A."

2. **One prompt per session:** These are scoped to be ~1 session each. Don't combine them.

3. **Test as you go:** After each prompt, run the Docker stack (`make up`) and verify. Run `supabase start` first for local Supabase. Fix issues before moving on.

4. **Seed data:** After Phase 0B, ask Claude Code to create a seed.sql file with sample data (a test agent, 2-3 buyers at different stages, some properties). Load it with `supabase db reset` which runs both migrations and seed. This makes every subsequent phase testable.

5. **Environment variables:** Keep a running .env with:
   - SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY (from `supabase status` or Supabase dashboard)
   - ANTHROPIC_API_KEY
   - OPENAI_API_KEY (for Whisper transcription)
   - TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_BRIDGE_NUMBER
   - BASE_URL (public URL for Twilio webhooks — ngrok URL for local dev)
   - Google OAuth client ID/secret (for Gmail and Calendar)
   - REDIS_URL
   
6. **Supabase local dev:** Run `supabase start` before `make up`. It spins up a local Supabase stack (Postgres, Auth, Realtime, Storage, Studio) in Docker. Access Studio at http://localhost:54323 to inspect your database visually. Use `supabase db diff` to auto-generate migrations from schema changes.

7. **Twilio bridge local dev:** Twilio webhooks need a public URL to reach your local backend. Use ngrok (`ngrok http 8000`) to get a public URL, then set BASE_URL in .env to the ngrok URL. You'll need to update this every time ngrok restarts (unless you pay for a fixed subdomain). Test the full bridge flow by calling your own phone — you'll get the merge experience firsthand.

8. **Whisper tips:** The OpenAI Whisper API has a 25MB file limit. For longer calls, either compress the audio (ffmpeg to low-bitrate mp3) or split into chunks. For local Whisper (faster iteration, no API cost), install whisper.cpp or openai-whisper Python package and run on the backend machine.

8. **Browser Use gotchas:** Zillow aggressively blocks scrapers. You may need to add: rotating user agents, request delays, and potentially residential proxies. Start with a simple approach and add anti-detection as needed.

9. **For YC demo:** Prioritize Phases 0-5 + 8A. That gives you: working command center, Browser Use research, email delivery, buyer dashboard, and offer strategy. Skip call intelligence and post-close for the demo — add them in the narrative.

10. **Supabase RLS debugging:** If queries return empty when you know data exists, it's almost always an RLS policy issue. Check policies in Supabase Studio → Authentication → Policies. During development, you can temporarily use the service_role key (bypasses RLS) to confirm it's a policy issue.