# HomeAgent — Future Directions

> Research-backed opportunities. Sources: NAR data, Redfin commission reports, kvCORE/FUB user reviews, proptech VC tracking, housing economist forecasts (Mar 2026).

---

## 1. Value Demonstration & Commission Defense

**Why now:** NAR settlement made buyer-broker agreements mandatory before showings. Agents who can articulate their value are winning — commissions have actually ticked *up* to 2.42% post-settlement. 71% of active realtors didn't close a single deal in 2024. The agents who survive will be those who can prove what they do.

**Directions:**
- **Work Log / Commission Justification Report** — Auto-generated PDF or shareable summary of agent activity per deal: showings scheduled, emails sent, research done, negotiations logged. Agents present this at buyer-broker agreement signing to justify their fee.
- **Buyer-Broker Agreement Builder** — Guided form to help agents draft their value pitch and agreement terms. Templated language for different service tiers.
- **Savings Ledger** — Track negotiated discounts, inspection-driven price reductions, seller concessions won. Display total "value delivered" per buyer deal. Surface this in the buyer dashboard.

---

## 2. Deep CRM Gap-Filling (Compete Where Competitors Fail)

**Why now:** kvCORE/BoldTrail complaints: 10–30s screen load times, no phone support, opaque pricing, consistent technical glitches. Follow Up Boss: weak analytics, no mass texting, clunky reporting interface. Both are expensive. There's real room for a faster, more honest tool.

**Directions:**
- **Fast, Lightweight Pipeline** — Compete on speed and reliability. A CRM that loads instantly and doesn't crash on mobile is a genuine differentiator vs. incumbents.
- **Team Performance Analytics** — Deal velocity, lead response time, close rate by source, time-to-close per agent. FUB and kvCORE are both weak here.
- **Commission Tracking** — Most CRMs don't track projected vs. actual commission in-pipeline. Build this natively: projected GCI, expected close date, commission split.
- **Smart Segmented Communication** — Mass texting/email by deal stage or buyer temperature. FUB explicitly lacks this; agents work around it manually.

---

## 3. AI-Assisted Value Articulation (Not AI Hype)

**Why now:** Fewer than 40% of agents have gone all-in on AI tools. The tools that win are the ones giving agents *specific, usable outputs* — not generic AI chat interfaces.

**Directions:**
- **Pre-Showing Buyer Brief** — Auto-generated one-pager per property: neighborhood stats, school ratings, price history, comparable sales. Agent reviews/edits, then shares with buyer. Saves ~45 min of manual research per showing.
- **Offer Strategy Draft** — AI pre-fills the offer strategy form (escalation clause rationale, comps summary, contingency recommendations) from deal data. Agent edits and owns it.
- **Buyer Intent Drift Detection** — When a buyer's saved search criteria diverges significantly from properties they've actually toured, flag it. Prompt agent to update their profile before they waste more time.
- **Post-Showing Summary** — After each showing, a structured prompt for the agent. AI drafts the summary; agent approves. Flows automatically to the buyer dashboard.

---

## 4. Market Timing & Rate Intelligence

**Why now:** Mortgage applications up 31% YoY. Freddie Mac hit 5.98% in Feb 2026 — first sub-6% rate in 3.5 years. A significant buyer pool has been sitting on the sidelines. Rates dropping will unlock demand fast.

**Directions:**
- **Rate Alert + Dormant Lead Reactivation** — When rates drop past a configured threshold, surface cold/dormant leads who may now qualify for a higher purchase price. "3 past leads could now afford $30k more."
- **Per-Buyer Affordability Tracker** — Per-lead estimate that recalculates as market rates change. Agent sees "at current rates, Chen family qualifies for $487k — up from $460k last month."
- **Market Timing Brief** — Weekly digest of local market conditions for each active buyer's search area. Agent forwards to clients or posts to buyer dashboard as a touchpoint.

---

## 5. Agent Productivity & Time Recapture

**Why now:** Agents spend 20–40% of time on admin that doesn't generate revenue. The top producers have systematized follow-up and eliminated manual tracking. This is where wins are compounded.

**Directions:**
- **Daily Digest / Action Queue** — Each morning, surface the 3–5 most important actions across all deals: follow-up due, buyer hasn't engaged in 7 days, offer deadline approaching. Not an inbox, a ranked task list.
- **Follow-Up Cadence Engine** — Agent-controlled reminder sequences per lead temperature. "Chen: 3 days since last contact. Suggested touchpoint: share new listing in their range."
- **Dead-Deal Rescue** — Flag deals quiet for a configurable period. Surface contextual re-engagement suggestions based on what the buyer previously responded to.
- **Showing Scheduler Integration** — Sync with Calendly or ShowingTime. Eliminate the back-and-forth of scheduling from inside the CRM.

---

## 6. Buyer Experience Differentiation

**Why now:** Agents who give buyers a better, more transparent experience can charge more and get referrals. The buyer dashboard is already a differentiator — make it a product buyers remember and tell friends about.

**Directions:**
- **Buyer Mobile PWA** — The buyer dashboard as a mobile-optimized progressive web app with push notifications: new listings added by agent, offer updates, showing confirmations.
- **Property Comparison Tool** — Buyer-facing side-by-side comparison of shortlisted properties. Agent controls what's visible; buyer ranks and annotates.
- **Agent Activity Transparency Feed** — Buyer dashboard shows a simple timeline: "Agent toured 3 properties on your behalf," "Agent submitted offer," "Agent pulled 5 comps this week." Turns invisible work visible and justifies commission.
- **Document Vault** — Secure per-deal document storage (inspection reports, disclosures, offers, buyer-broker agreement). Both agent and buyer can access. Eliminates email attachment chaos.

---

## 7. Emerging Competitive Threats to Monitor

**Why watch:** VC poured $16.7B into proptech in 2025 (+68% YoY). $1.7B in January 2026 alone (+176% vs Jan 2025). AI-native competitors are moving fast.

| Company | Move | Implication |
|---------|------|-------------|
| Lofty | Launched "Lofty AOS" — agentic AI that autonomously manages workflows | Agentic execution is coming; design data model to support it |
| Breezy | AI operating system for residential agents, VC-backed, Feb 2026 launch | Direct competition; watch positioning and pricing |
| Zillow/Realtor.com | Portal fragmentation trend may push buyers back to agent relationships | Could increase value of buyer's agent; good for HomeAgent positioning |
| Bridge Interactive / Spark API | MLS direct-feed access is increasingly viable and affordable | Build toward this; don't depend on portals long-term |

**Architectural considerations for future-proofing:**
- Design the communication/activity data model to support AI-autonomous task execution without requiring a rebuild
- Call log schema should accept transcripts/summaries (Whisper, Fireflies-style) as a first-class field — even before building transcription
- Property research schema should have MLS ID fields ready, even if populated manually for now

---

## Priority Stack

| # | Direction | Rationale |
|---|-----------|-----------|
| 1 | Work Log / Commission Justification | NAR settlement makes this the #1 agent pain point right now |
| 2 | Daily Action Queue | Biggest productivity win, small scope, high retention impact |
| 3 | Pre-Showing Buyer Brief | High perceived value, AI-assisted but agent-controlled |
| 4 | Rate Alert + Lead Reactivation | Rates just broke 6% — timing window is open |
| 5 | Buyer Mobile PWA | Differentiates buyer experience; drives referrals |
| 6 | Analytics / Commission Tracking | Fills the FUB/kvCORE gap for growing teams |
