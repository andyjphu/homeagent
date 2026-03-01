# HomeAgent — Next Steps

> Prioritized implementation backlog. Derived from Phase 8-11 spec audit (Mar 2026).
> Schema/DB columns for most of these already exist — work is mostly API routes + UI.

---

## Phase 8 — Offer Strategy & Negotiation

**What's done:** Strategy brief generation, FMV range display, escalation path, comp analysis, listing agent analysis — all wired end-to-end (LLM prompt → API → UI panel on deal page).

### 8.1 Counter-Offer Analysis Route
- `COUNTER_ANALYSIS_PROMPT` already exists in `lib/llm/prompts/offer-strategy.ts`
- Need: `POST /api/deals/[dealId]/counter` — accepts counter details, pulls existing strategy brief + deal context, calls LLM, updates `deals.offer_history` with new round, recalculates `deal_probability`
- Need: UI on deal page — "Analyze Counter" button, input form for counter terms, analysis display
- Effort: **Small** — prompt exists, just wiring

### 8.2 Offer Email Drafting
- Need: `POST /api/deals/[dealId]/draft-offer-email` — uses strategy brief narrative framing to draft professional offer submission email
- Need: UI — "Draft Offer Email" button on deal page → opens compose modal pre-filled with AI draft
- Reuses existing `compose-modal.tsx` pattern
- Effort: **Small**

---

## Phase 9 — Under Contract Management

**What's done:** Timeline visualization on deal page, contingency display, deal stage management.

### 9.1 Contract Timeline Auto-Generation
- Need: `POST /api/deals/[dealId]/generate-timeline` — input: closing date, earnest money deadline, contingency periods → auto-generates full `contingency_timeline` with all milestones
- Currently contingencies are manual entry only
- Effort: **Small** — mostly date math + DB write

### 9.2 Closing Checklist UI
- DB fields `closing_checklist` and `final_walkthrough_checklist` (JSONB) already exist
- Need: API endpoints to create/update checklist items
- Need: Checkable checklist component on deal page — auto-generated from contract terms
- Items: earnest money, inspection, appraisal, financing, title, walkthrough, closing
- Visible to buyer on their dashboard too
- Effort: **Small-Medium**

### 9.3 Document Upload + Analysis
- `inspection_analysis` JSONB field exists, `INSPECTION_ANALYSIS_PROMPT` exists
- Need: Supabase Storage bucket for documents
- Need: `POST /api/deals/[dealId]/analyze-document` — PDF upload, text extraction, LLM analysis
- Need: Upload UI on deal page + analysis display (categorized findings with severity colors)
- Requires: PDF parsing library (pdf-parse or similar)
- Effort: **Medium** — file upload + PDF extraction is the main work

### 9.4 Deadline Monitoring & Alerts
- `deadline_approaching` event type already defined in activity feed
- Need: Scheduled job (cron or Supabase pg_cron) that checks `contingency_timeline` for deadlines within 48h
- Need: Inserts into `activity_feed` → triggers existing Realtime subscription → shows in dashboard
- Effort: **Medium** — need a reliable scheduler (Vercel cron, Supabase pg_cron, or external)

---

## Phase 10 — Real-Time & Polish

**What's done:** Supabase Realtime on activity feed, toast notifications (Sonner), research pipeline polling.

### 10.1 Price Change UI Badges
- DB trigger `on_property_price_change()` already exists and logs to activity feed
- Need: "Updated" badge on property cards when `updated_at > last_viewed_at`
- Need: Price change indicator (arrow up/down + delta) on property cards
- Effort: **Small**

### 10.2 Property Monitoring
- Schema ready: `is_monitored`, `last_monitored_at`, `monitoring_interval_hours` on properties
- Need: Scheduled job that re-checks Zillow listing status for monitored properties
- Detects: price changes, status changes (active → pending → sold), description/photo updates
- DOM milestones (7, 14, 30, 60 days) trigger seller motivation re-score
- Deal properties checked more frequently
- Effort: **Medium-Large** — need Browser Use tasks + scheduler + change detection logic

### 10.3 Notification Bell
- Activity feed Realtime already works
- Need: Notification bell in top nav bar with unread count badge
- Need: Dropdown showing recent activity entries
- Need: Mark-as-read tracking (per agent)
- Effort: **Small-Medium**

---

## Phase 11 — Post-Close & Settings

**What's done:** Basic settings page (profile, Gmail toggle, LLM status, communication tone). Deal stage can be set to "closed" manually.

### 11.1 Deal Close Flow
- Need: Close confirmation dialog with final checks when stage → "closed"
- Need: Auto-populate `closed_at` timestamp
- Need: Move buyer to "Completed" section in command center
- Need: Trigger post-close sequence
- Effort: **Small**

### 11.2 Satisfaction Survey
- `satisfaction_score` field exists on deals
- Need: `GET/POST /api/survey/[token]` — public endpoints (no auth), token-based
- Need: Simple form page: NPS 1-10, text feedback, testimonial opt-in
- Need: Email with survey link sent on close
- Effort: **Small**

### 11.3 Post-Close Email Sequences
- Need: Scheduled email sequence triggered on deal close:
  - Day 0: Congratulations (personalized, references the property)
  - Day 7: "Settling in" — HOA contact, utility info, contractor recs
  - Day 30: Check-in
  - Month 6: Property value update + soft referral ask
  - Month 12: Annual update + referral ask
- Need: Email templates (LLM-drafted, agent-reviewed)
- Need: Scheduler (Vercel cron or similar)
- Effort: **Medium** — mainly the scheduling infrastructure

### 11.4 Notification Preferences in Settings
- `notification_preferences` field exists in schema
- Need: UI in settings page to configure what triggers alerts
- Need: Filter notifications by preference before showing
- Effort: **Small**

---

## Suggested Build Order

Priority based on: user value, effort, dependency chain.

| Order | Item | Phase | Effort | Why first |
|-------|------|-------|--------|-----------|
| 1 | Counter-offer analysis | 8.1 | Small | Prompt exists, just wiring. Completes the deal negotiation flow. |
| 2 | Offer email drafting | 8.2 | Small | Quick win, reuses compose modal. |
| 3 | Closing checklist UI | 9.2 | Small-Med | Schema exists, high agent value. |
| 4 | Deal close flow | 11.1 | Small | Gate for post-close features. |
| 5 | Satisfaction survey | 11.2 | Small | Simple, standalone. |
| 6 | Contract timeline auto-gen | 9.1 | Small | Date math, improves existing UI. |
| 7 | Notification bell | 10.3 | Small-Med | Realtime already works, just needs UI. |
| 8 | Price change badges | 10.1 | Small | DB trigger exists, just UI. |
| 9 | Notification preferences | 11.4 | Small | Settings page exists, add toggles. |
| 10 | Document upload + analysis | 9.3 | Medium | New infra (storage + PDF parsing). |
| 11 | Deadline monitoring | 9.4 | Medium | Needs scheduler infra. |
| 12 | Post-close email sequences | 11.3 | Medium | Needs scheduler + templates. |
| 13 | Property monitoring | 10.2 | Med-Large | Browser Use + scheduler + change detection. |
