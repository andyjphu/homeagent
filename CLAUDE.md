# HomeAgent — Project Guide

## What This Is

HomeAgent is a **command center for buyer's real estate agents**. It helps agents manage leads, curate property shortlists for clients, share private dashboards with buyers, and track deals through closing.

**It is NOT "an AI product."** It is a productivity and workflow tool for agents. AI capabilities (LLM scoring, email classification, market analysis) exist as optional enhancements that can be toggled on — but the product must work and be valuable without them.

## Core Philosophy

- **Agent-first, AI-second.** The product sells because it saves agents time and helps them demonstrate value to clients. AI is an accelerant, not the pitch.
- **Ship narrow, ship working.** Two features done well beat thirteen features stubbed. Every feature must actually work end-to-end before moving to the next.
- **Legal data only.** Never scrape Zillow, Redfin, or any site that prohibits it. Use MLS APIs (Bridge Interactive, Spark/RESO, SimplyRETS) or manual agent entry. Scraping is a liability.
- **Post-NAR positioning.** After the 2024 NAR settlement, buyer's agents must justify their commission. HomeAgent is the tool that helps agents prove their value — showing clients the research, curation, and negotiation work being done on their behalf.

---

## Feature Tiers

### Tier 1 — Core (must be production-quality)

These are the two features that define the product. They must work flawlessly.

1. **Agent Command Center / Dashboard**
   - Lead management (manual entry, status tracking, pipeline view)
   - Buyer portfolio (active clients, temperature, last activity)
   - Deal tracking (stage-based: prospecting → touring → negotiating → closing)
   - Action items and activity feed
   - Property curation (agent selects/ranks properties for each buyer)

2. **Buyer Private Dashboard**
   - Token-based access (no auth required for buyers, just a unique link)
   - Ranked property cards with agent notes and reasoning
   - Favorite/comment on properties (feedback flows back to agent)
   - Filter panel to refine preferences
   - Deal progress tracking (when in contract)

### Tier 2 — Minimum Viable Stubs (functional but basic)

These features should exist in a basic working form. They don't need to be polished or AI-enhanced — just functional enough that the app feels complete and the data flows through.

3. **Email Integration** — Basic Gmail connection. Show recent emails grouped by buyer/deal. Manual classification by agent ("this is about the Chen deal"). No auto-classification needed yet.

4. **Property Research** — Manual property entry by agent (address, price, beds, baths, photos, notes). NO browser automation or scraping. Agent pastes listing URLs and key details. Future: connect to MLS API feed.

5. **LLM Property Scoring** — Optional toggle. When enabled, runs buyer intent profile against property data to suggest a match score. Agent can override. Score is a suggestion, not a verdict. UI clearly labels it as "AI-suggested."

6. **Offer Strategy Notes** — A structured text form where the agent records their strategy (comps they pulled, price rationale, escalation plan). NOT AI-generated. Future: AI can pre-fill as a draft.

7. **Call Log** — Simple log of calls (date, buyer, duration, agent's notes). No transcription, no analysis. Future: integrate Whisper transcription, then analysis.

### Tier 3 — Future / Documented Only (do not build yet)

These are documented in `docs/homeagent-framework.md` as the long-term vision. Do not implement them now. Reference them when designing Tier 1-2 features to ensure the data model supports future expansion.

8. **Automated Email Lead Detection** — LLM classifies inbound emails as potential leads.
9. **Call Transcription & Analysis** — Whisper/Deepgram integration, post-call debriefs.
10. **Negotiation Intelligence** — Counter-offer analysis, deal probability, listing agent profiling.
11. **Inspection Report Parsing** — PDF upload → AI extracts critical/moderate/minor issues.
12. **Appraisal Scenario Planning** — Pre-computed responses to different appraisal outcomes.
13. **Post-Close Monitoring & Referral Flywheel** — Property appreciation tracking, NPS, referral generation.
14. **Real-Time Activity Feed** — WebSocket/SSE push for live updates across dashboards.
15. **Seller Motivation Scoring** — Behavioral signals (price drops, DOM, relisting) → AI score.
16. **Browser Automation Research** — Automated property research via Browser Use / Playwright. Only pursue this with legal MLS API access, never by scraping.

---

## Data Sources Policy

| Source | Status | Notes |
|--------|--------|-------|
| Agent manual entry | Allowed | Primary data source for MVP |
| MLS API (Bridge Interactive, Spark, SimplyRETS) | Preferred | Legal, reliable, real-time. Requires paid access. |
| Zillow scraping | PROHIBITED | ToS violation, fragile, legal risk |
| Redfin scraping | PROHIBITED | Same as above |
| Public records (county assessor) | Allowed with care | Rate-limit, respect robots.txt |
| GreatSchools API | Allowed | Has official API |
| Google Maps API | Allowed | Paid, official |

---

## NAR Settlement Positioning

The 2024 NAR settlement fundamentally changed buyer's agent economics:
- Buyer-broker agreements are now mandatory before showing homes
- Buyer's agent compensation is no longer guaranteed via MLS
- Agents must articulate and demonstrate their value to earn commission

**HomeAgent addresses this directly:**
- The buyer dashboard is a transparency tool — clients see exactly what work their agent is doing
- Property curation with reasoning shows the agent's expertise (not just sending auto-alerts)
- Deal tracking proves the agent is managing complexity the buyer can't handle alone
- The activity feed is an implicit work log that justifies the agent's commission

When writing copy, feature descriptions, or marketing language, frame features in terms of **agent value demonstration**, not "AI intelligence."

---

## Tech Stack

| Layer | Technology | Notes |
|-------|-----------|-------|
| Frontend | Next.js 16 + React 19 + TypeScript | App Router, server components |
| Styling | Tailwind CSS 4 + shadcn/ui | |
| Database | Supabase (PostgreSQL) | Auth, realtime, storage |
| Auth | Supabase Auth (Google OAuth for agents) | Buyers use token-based dashboard access |
| LLM (optional) | Cerebras (fast/cheap) + Gemini (complex) | Via OpenAI-compatible API. Always optional. |
| Backend Service | FastAPI (Python) | For heavy async tasks only |
| Deployment | Vercel (frontend) + Railway/Fly.io (backend) | Supabase Cloud for DB |

---

## Code Conventions

- TypeScript strict mode, path aliases via `@/*`
- Server components by default, `"use client"` only when needed
- Supabase client: `server.ts` for server components, `client.ts` for client, `admin.ts` for service-role operations (buyer dashboard)
- API routes in `web/src/app/api/` follow Next.js conventions
- LLM calls go through `web/src/lib/llm/router.ts` which picks Cerebras or Gemini based on task complexity
- All LLM features must be behind feature flags or optional toggles — the app must work without them

---

## AI Usage Guidelines

When adding AI-powered features:

1. **Label it.** Any AI-generated content in the UI must be clearly marked as "AI-suggested" or similar. Never present AI output as agent expertise.
2. **Make it overridable.** Agent can always edit, override, or dismiss AI suggestions.
3. **Degrade gracefully.** If LLM API is down or unconfigured, the feature falls back to manual input. No blank screens, no errors.
4. **Don't hallucinate stakes.** For high-stakes outputs (offer price, deal probability, seller motivation), show the reasoning and source data. Never present a bare number.
5. **Cost-aware routing.** Use Cerebras (fast/cheap) for classification, quick extraction. Use Gemini for complex analysis (property scoring, strategy). Never use expensive models for simple tasks.

---

## Future Work (Parking Lot)

Items to revisit when Tier 1 and Tier 2 are solid:

- [ ] MLS API integration (Bridge Interactive or Spark) for live property feeds
- [ ] Gmail monitoring for automatic lead detection
- [ ] Whisper/Deepgram call transcription
- [ ] Real-time WebSocket activity feed
- [ ] Celery + Redis for production task queue (replace in-memory asyncio)
- [ ] Rate limiting on all API endpoints
- [ ] Dashboard token rotation/expiry
- [ ] Audit logging for compliance
- [ ] Call recording consent/compliance by state
- [ ] Docker Compose for local dev
- [ ] CI/CD pipeline
- [ ] Error monitoring (Sentry)
- [ ] Mobile-responsive buyer dashboard
- [ ] Competitive analysis: Follow Up Boss, kvCORE, LionDesk, Rechat, Lofty — understand what they do well and don't duplicate, find gaps
