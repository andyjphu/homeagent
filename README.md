# FoyerFind

**The command center for buyer's agents.**

FoyerFind helps real estate buyer's agents manage their entire client workflow — from first lead to closing day — while giving buyers a private, transparent dashboard to track their home search.

## The Problem

The 2024 NAR settlement upended buyer's agent economics. Agents must now sign buyer-broker agreements before showing homes, and compensation is no longer guaranteed through the MLS. For the first time, buyer's agents need to **prove their value** to earn their commission.

Meanwhile, agents juggle 8-15 active buyers using scattered tools — spreadsheets, email threads, text messages, and generic CRMs built for the listing side. There's no purpose-built system for the buyer's agent workflow.

## The Solution

FoyerFind gives agents two things:

### 1. Agent Command Center
A single dashboard where the agent manages everything:
- **Lead pipeline** — capture leads from manual entry, email, or calls; track status and confidence
- **Buyer portfolio** — active clients with engagement temperature, last activity, and next actions
- **Property curation** — research and rank properties for each buyer with notes and reasoning
- **Deal tracking** — stage-based workflow from prospecting through closing with contingency timelines
- **Activity feed** — unified stream across all clients (new leads, buyer interactions, price changes, deal updates)

### 2. Buyer Private Dashboard
Each buyer gets a unique, shareable link — no login required:
- **Ranked property cards** with the agent's notes, match reasoning, and comparisons
- **Interactive feedback** — favorite properties, leave comments, adjust search filters
- **Deal progress** — when in contract, buyers see their timeline, stage, and next milestones

The buyer dashboard doubles as a **transparency tool**. Clients see exactly what work their agent is doing — research, curation, negotiation prep — which justifies the agent's commission in a post-NAR world.

## How It Works

```
Agent signs up → Adds buyers → Curates properties → Sends dashboard link
                                                           ↓
                                              Buyer browses, favorites, comments
                                                           ↓
                                              Feedback flows back to agent
                                                           ↓
                                     Agent refines, makes offer → Tracks deal to close
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 16, React 19, TypeScript, Tailwind CSS, shadcn/ui |
| Database & Auth | Supabase (PostgreSQL, Auth, Realtime) |
| Agent Auth | Google OAuth via Supabase |
| Buyer Access | Token-based (unique URL, no sign-up required) |
| Backend Service | FastAPI (Python) for async tasks |
| AI (optional) | Cerebras (fast inference) + Google Gemini (complex analysis) |

## Project Structure

```
foyerfind/
├── web/                          # Next.js frontend
│   ├── src/app/(agent)/          #   Agent dashboard (protected)
│   ├── src/app/(buyer)/          #   Buyer dashboard (token-based)
│   ├── src/app/(auth)/           #   Login / signup
│   ├── src/app/api/              #   API routes
│   ├── src/lib/llm/              #   LLM integration (optional)
│   └── src/lib/supabase/         #   Supabase client wrappers
├── services/browser-agent/       # FastAPI backend for async tasks
├── docs/                         # Product framework & build prompts
│   ├── homeagent-framework.md    #   Full product vision (13 phases)
│   └── TODO.md                   #   Implementation prompts
└── CLAUDE.md                     # Project conventions & build priorities
```

## Getting Started

### Prerequisites
- Node.js 18+
- npm
- Supabase account (or local via `supabase start`)

### Setup

```bash
# Clone
git clone https://github.com/andyjphu/foyerfind.git
cd foyerfind

# Install frontend dependencies
cd web && npm install

# Copy env template and fill in values
cp web/.env.example web/.env.local

# Run database migrations
npx supabase db push

# Start dev server
npm run dev
```

### Environment Variables

Copy `web/.env.example` to `web/.env.local`. Use these **exact variable names** everywhere (local, Vercel, CI).

| Variable | Required | Where Used | Description |
|----------|----------|------------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Client + Server | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Client + Server | Supabase publishable/anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Server only | Supabase service role key (admin ops) |
| `NEXT_PUBLIC_APP_URL` | Yes | Client + Server | App base URL (`http://localhost:3000` local, production URL on Vercel) |
| `GOOGLE_OAUTH_CLIENT_ID` | Yes | Server only | Google OAuth 2.0 client ID |
| `GOOGLE_OAUTH_CLIENT_SECRET` | Yes | Server only | Google OAuth 2.0 client secret |
| `GOOGLE_REDIRECT_URI` | Yes | Server only | Gmail OAuth callback — must be `{APP_URL}/api/email/callback` |
| `GEMINI_API_KEY` | Optional | Server only | Gemini API key for complex LLM tasks |
| `CEREBRAS_API_KEY` | Optional | Server only | Cerebras API key for fast/cheap LLM tasks |

### Google Cloud Console Setup

1. Create OAuth 2.0 credentials at [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. Add **Authorized redirect URIs** for every environment:
   - `http://localhost:3000/api/email/callback` (local dev)
   - `https://your-domain.vercel.app/api/email/callback` (production)
3. Enable the **Gmail API**
4. Configure the **OAuth consent screen** and add `gmail.readonly` scope
5. If app is in "Testing" mode, add your Google account as a test user

Open [http://localhost:3000](http://localhost:3000).

### Backend (optional, for async tasks)

```bash
cd services/browser-agent
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

## AI Features (Optional)

FoyerFind works fully without AI. When API keys are configured, optional AI enhancements become available:

- **Property match scoring** — LLM compares buyer preferences against property data and suggests a 0-100 match score (clearly labeled as "AI-suggested", always overridable by the agent)
- **Email classification** — categorizes incoming emails as new leads, deal-relevant, or noise
- **Lead extraction** — pulls buyer intent signals (budget, timeline, location) from emails and call notes

AI is the accelerant, not the product. Every AI feature degrades gracefully to manual input when unavailable.

## What's Next

See [CLAUDE.md](./CLAUDE.md) for the full feature tier breakdown. Current priorities:

1. Production-quality agent command center and buyer dashboard
2. Manual property entry and curation workflow
3. Basic Gmail integration (read-only)
4. MLS API evaluation (Bridge Interactive / Spark) for live property feeds
5. Optional AI scoring toggle

## License

MIT
