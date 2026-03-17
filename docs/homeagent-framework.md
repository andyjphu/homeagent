# FoyerFind — Complete Product Framework

> **Read this first:** Phases 1–13 below describe the **long-term vision**, not the current product. Many phases reference Zillow scraping, full AI automation, and real-time call transcription that are not implemented and, in some cases, have been deliberately deprioritized. For current build priorities and what's actually being worked on, see [`CLAUDE.md`](../CLAUDE.md) in the project root and the [Strategic Addendum](#strategic-addendum-march-2026) at the end of this document.

---

# The Pitch (10 seconds)

The command center for buyer's agents — manage leads, curate property shortlists, share private dashboards with clients, and track deals from first contact to closing day. Built to help agents prove their value in a post-NAR settlement world.

> **Note on AI:** The platform can optionally leverage LLM capabilities (property matching, email classification, market analysis) as enhancements, but the core product stands on its own as a workflow tool. AI is the accelerant, not the product.

---

# The Two Users

**Agent Mike** (primary user, the one who pays) — a residential real estate agent juggling 8–15 active buyers at any time. He lives in his phone, his email, and his CRM. He doesn't want another tool. He wants his existing workflow to become smarter.

**Sarah Chen** (secondary user, the buyer) — she wants transparency. She wants to see what her agent is doing for her, see the properties ranked, and not have to call Mike every time she has a question. She gets a private dashboard with the ability to annotate, favorite, and comment.

---

# The Agent Command Center

When Mike logs in, he doesn't land on a single deal. He lands on his client portfolio. Think of it like a CRM, but every row is alive — it's not just a record, it's an active intelligence feed.

## The Home Screen

**New Leads (top priority)** — Draft client records automatically detected from emails and calls, waiting for Mike to confirm. Each shows the source (email/call/manual), confidence level, extracted info, and one-click actions: [Review & Confirm] or [Dismiss].

**Action Required** — Existing clients where something needs Mike's input. Sarah's counter-offer response is due today. David's intake form came back and research is ready to review. Lisa's inspection report just arrived. Sorted by urgency.

**Active Deals** — The full client list, filterable by stage. Each card shows:

- Buyer name and contact
- Deal stage (prospecting / touring / negotiating / under contract / closing)
- Buyer temperature (hot/warm/cool, derived from recent interactions)
- Property (if in negotiation or beyond)
- Last activity (what happened most recently — email, call, dashboard visit)
- Number of properties on their shortlist
- Next action due (with countdown)
- Link to that buyer's private dashboard

Mike can see at a glance: Sarah Chen is hot, she's in negotiation on Westgrove, and her counter-offer response is due today. James Park is warm, still touring, showing scheduled tomorrow. Emily Rodriguez is cool, hasn't logged into her dashboard in 9 days — Mike should reach out.

**Completed** — Closed deals with post-close monitoring status. The system still watches these properties for appreciation data and maintains the relationship for referrals.

**Unified Activity Feed** — A chronological stream across all clients. "2:34 PM — New lead detected: Lisa Wang (call)." "2:12 PM — Sarah Chen favorited 1923 Bordeaux Ave." "1:45 PM — Price drop: 5544 Monticello ($520k → $498k)." "11:30 AM — Email from listing agent re: Westgrove counter." Mike scans this to stay on top of everything without clicking into individual deals.

---

# Phase 1: Lead Detection & Intake

New clients enter the system through three channels. All three feed into the same pipeline.

## Channel 1: Agent Manual Entry

The simplest path. Mike meets someone at an open house, gets a referral at dinner. He opens his command center, hits "Add Client," fills in what he knows. Maybe just a name and phone number. Maybe the full picture. The system creates the record with whatever it has and marks missing fields as "needs discovery." The buyer intent profile starts thin and thickens over time.

## Channel 2: Email Detection

Mike's Gmail is already being monitored via MCP for deal-related emails. But the system isn't just watching threads on existing clients — it's also watching for new inbound leads.

A new lead in Mike's inbox looks like this: an email from someone not in the system. The sender isn't matched to any existing buyer record. The content contains real estate intent signals: "I'm looking to buy," "we're relocating to Dallas," "do you have time to talk about finding a home," "my friend Sarah recommended you," "I'm pre-approved and looking in the Richardson area."

Every unmatched inbound email runs through a lightweight lead classification. Not a deep analysis — a binary: is this a potential new buyer lead? If yes, the system extracts whatever information is present.

Sometimes that's a lot: "Hi Mike, my wife and I are moving from Austin to Dallas for work. We have two kids (8 and 12), budget around $500-600k, need good schools, hoping to close by August." That single email gives the system: name (from signature or sender), contact info, household size (4), budget ($500-600k), priority (schools), timeline (August), relocation context (Austin → Dallas).

Other times it's sparse: "Hey Mike, got your name from James Park. Would love to chat about buying in Dallas." The system still captures: name, referral source (James Park — and if James is a past client in the system, that connection is logged automatically), intent (wants to buy in Dallas), everything else unknown.

Either way, the system creates a draft client record and surfaces it: "New lead detected — David Kim, referred by James Park. Wants to buy in Dallas. Limited info. [Review & Confirm] [Dismiss]"

Mike confirms. The system immediately does two things: queues a Browser Use research job with whatever criteria it has (even just "Dallas" — it'll cast wide and narrow later), and drafts a response email for Mike that includes a link to the intake form so David can fill in his own preferences. The intake form URL is unique to David's record — when he fills it out, everything flows into his buyer profile automatically.

## Channel 3: Call Detection

Same concept, from calls. Mike takes 15–20 calls a day. The system is already transcribing and analyzing every call. After each call, it checks: is either party an existing client? If one speaker is unmatched, the system evaluates: was this a real estate inquiry? Did the unknown speaker express buying intent?

If Mike takes a 5-minute call from someone who says "I'm looking for a 4-bedroom in Lake Highlands, budget around $700k, need to move by summer because my lease is up in July," the system captures almost a complete buyer profile from the conversation alone.

Draft record surfaces: "New lead detected from call at 2:34 PM — Lisa Wang. Looking for 4 bed in Lake Highlands, ~$700k, timeline July. [Review & Confirm] [Dismiss]"

If Mike confirms and the system has enough criteria, it skips the intake form entirely and goes straight to the Browser Use pipeline. When results are ready, Mike can send the email with the dashboard link directly.

## The Classification Layer

**Deduplication.** David emails Monday, calls Wednesday. The system matches on email, phone, name similarity, and context clues (both mention James Park, both mention Dallas). Confident match → merge records and enrich. Uncertain → flag for Mike: "Possible duplicate — David Kim (email) and Dave Kim (call). [Merge] [Keep Separate]"

**Filtering non-leads.** Listing agents emailing about their listings are not leads. Mike's brokerage sending internal updates is not a lead. But a mortgage broker saying "I have a pre-approved client looking in your area, can I connect you?" IS a lead, and the system extracts the referred client's info.

**Confidence levels.** Direct email saying "I want to buy a house" = high confidence, full notification. Forwarded Zillow link from unknown sender with no message = low confidence, surfaced as "possible lead" with lower priority.

**Speed.** In real estate, first agent to respond often wins the client. High-confidence lead detection triggers notification within seconds. Draft response ready to send immediately.

## The Buyer Intent Profile

Whether the lead came from manual entry, email detection, or call detection, the system generates a buyer intent profile — a living document that evolves over time. It's not just "3 bed, $600k." It becomes:

"Family of 4, school-district-driven, pre-approved at $750k, risk-averse, relocating from Austin, needs to close by June, sensitive to monthly carrying costs (flagged HOA as a concern), both parents work downtown (commute matters)."

This profile drives every downstream AI decision. It gets enriched automatically as the system observes more signals: which properties the buyer clicks on in their dashboard, what they mention in emails, what concerns surface in calls, which listings they spend the most time viewing. It's a feedback loop — the more the buyer interacts, the smarter the system gets about what they actually want versus what they said they want.

---

# Phase 2: Autonomous Research (Browser Use Core)

Once a buyer profile exists with enough criteria, a Browser Use agent spins up and does what Mike would normally spend 2 hours doing manually.

## The Agent's Task Chain

First, it hits Zillow with the search criteria — location, price range, beds, baths, square footage. It doesn't just grab the first page. It paginates, applies different sort orders (newest, price low-to-high, price high-to-low), and captures 30–50 candidate listings. For each listing, the agent navigates into the detail page and extracts structured data: full address, price, price history, days on market, lot size, year built, HOA, tax history, listing agent info, photos, and the full description text.

Then it cross-references. For each property, it opens a new tab to the county tax assessor's site and pulls the assessed value vs. listing price delta. It checks GreatSchools.org for the assigned schools and ratings. It hits Walk Score for walkability and transit scores. If the buyer cares about commute, it opens Google Maps and grabs drive times to their workplace at 8 AM on a weekday.

## Passive Seller Intelligence (No Cooperation Needed)

The agent doesn't just scrape a listing once. It monitors over time — checking the listing page every few hours, tracking changes. Did the price drop? Description change? Photos updated? Relisted after being taken down? Each signal tells a story. A price drop after 21 days on market with refreshed photos means the seller is anxious. A relisting with a new agent means the previous deal fell through — they're probably motivated.

The agent builds a **seller motivation score** from these behavioral signals without anyone telling it anything.

It also profiles the listing agent. How many active listings do they have? If 20, they're spread thin and more likely to push their seller to accept quickly. If it's their only listing, they'll fight harder. Average days-on-market across their listings? Typical list-to-sale price ratio? Public data that tells Mike how the other side operates before he picks up the phone.

It scrapes recent sold properties in the same neighborhood for comparable sales intelligence. It segments comps into two groups: comps favoring the buyer's position and comps the seller's agent will likely cite. For each: sale price, DOM, list-to-sale ratio, notable differences from subject property.

## Scoring Pipeline

All raw data flows into a scoring pipeline. The scoring isn't a simple weighted average — it's an LLM call. The buyer intent profile and the property data go into Claude, which scores the match on a 0–100 scale with reasoning. The reasoning matters because it goes into the buyer's dashboard:

"Scored 94 because: top-rated school district matches your priority, price is 17% below your max giving negotiation room, pool and smart home match your amenity list. Flagged: HOA adds $1,800/year to carrying costs."

The output is a ranked shortlist of 5–10 properties with structured data, scores, reasoning, and a seller motivation score for each.

When scoring completes, the agent command center shows a notification: "Sarah Chen — 5 properties found, ready to send."

---

# Phase 3: The Email-to-Dashboard Bridge

Mike clicks into the notification, reviews the shortlist. He can reorder, remove properties, add agent notes. When he's satisfied, he hits "Send to Client."

## The Email

The system composes a personalized email through Gmail MCP. Claude writes it fresh using the buyer profile and specific properties found — not a template. It reads something like:

> Hi Sarah,
>
> I've done a deep dive into properties matching what you're looking for — 3+ beds, good school districts, pool preferred, $400–750k across North Dallas.
>
> Here are my top 5 picks:
>
> **#1 — 4821 Westgrove Dr** · $625,000 · 4 bed/3 bath · 2,850 sqft
> Richardson ISD (9/10 schools), pool, smart home, solar panels. Price has dropped twice — I think there's room to negotiate.
>
> **#2 — 1923 Bordeaux Ave** · $545,000 · 3 bed/2 bath · 2,200 sqft
> 12-min commute downtown, EV charger, no HOA. Only 5 days on market — this one could move fast.
>
> **#3 — 7650 Skillman St** · $589,000 · 4 bed/3 bath · 2,600 sqft
> Large lot, mature trees, updated kitchen. Lake Highlands. 21 days on market — gives us leverage.
>
> I've put together a full dashboard with detailed comparisons, school ratings, commute times, price histories, and neighborhood data:
>
> **[View Your Dashboard →]**
>
> Take a look and let me know which ones catch your eye — I can schedule tours this week.
>
> — Mike

Mike reviews, edits if needed, and confirms. The email sends from Mike's actual Gmail address via MCP — not a noreply. The dashboard link is a unique URL tied to Sarah's record.

---

# Phase 4: The Buyer's Private Dashboard

When Sarah clicks the link, she lands on her dashboard. It's clean, personal, and feels like Mike curated it just for her.

**What she sees:** Ranked property cards with scores and reasoning. Comparison table she can sort and filter. Price history charts. School district details. Commute time data. Neighborhood appreciation trends. For each property, the AI's reasoning for why it scored the way it did.

**What she can do:** Favorite properties. Leave comments on each one ("love the backyard," "worried about the busy road"). Request tours directly from the dashboard. Compare properties side by side. And critically — she can **update her search criteria directly from the dashboard.** There's a filters panel where she can adjust her budget range, beds, baths, minimum square footage, preferred areas, must-have amenities, school rating minimums, max commute time, HOA tolerance — everything from her original intake, plus more granular controls she may not have thought of initially.

When Sarah changes a filter, the system treats it as a high-signal intent update. If she bumps her max budget from $750k to $800k, or drops her bed requirement from 4 to 3, or adds "home office" to her amenities — that's not just a filter change, it's a window into how her thinking is evolving. The buyer intent profile updates immediately. And if the change is significant enough to affect results (new price range opens up listings that weren't captured before, or relaxing beds/baths brings in a different property type), the system automatically queues a new Browser Use research job to fill the gap. Mike gets a notification: "Sarah updated her criteria — max budget increased to $800k, bedroom minimum dropped to 3. 3 new properties found. [Review]"

Mike can review the new results, add them to Sarah's dashboard, or send a follow-up email: "I noticed you're open to 3-bedrooms now — here are a few that just opened up, including one in Uptown that wasn't in your original range." This makes Mike look attentive and responsive, even though the system did the work. Sarah feels heard. The feedback loop tightens.

**What Mike sees:** Everything Sarah does flows back to his command center. If Sarah favorites Westgrove and Bordeaux but ignores the others, Mike knows where to focus. If she comments about HOA concerns, the system flags it in the buyer intent profile and suggests Mike address it proactively. If she spends 8 minutes on the Westgrove page and 30 seconds on Skillman, the system logs that behavioral signal.

**The dashboard evolves.** When new listings match Sarah's criteria, they appear with a "new" badge. When a tracked property has a price change, it updates with a notification. As the deal progresses to negotiation, the dashboard shows the deal timeline with stage indicators. Sarah always knows what's happening without calling Mike.

If the system detects Sarah's interest is clustering (favorites 3 properties in the same neighborhood), it surfaces an insight to Mike: "Sarah is clustering in Far North Dallas — consider focusing future search here."

---

# Phase 5: Email Intelligence (Gmail MCP)

The system connects to Mike's Gmail via MCP. It runs periodic scans — every 15 minutes — looking for emails related to active buyers. Matching is fuzzy: property addresses, buyer names, listing agent names, real estate keywords.

But the email monitoring serves two parallel purposes: **deal intelligence on existing clients** AND **new lead detection** (as described in Phase 1). Every unmatched inbound email gets both analyses simultaneously.

## Deal-Relevant Email Analysis

When the system finds a relevant email for an existing deal, it runs it through Claude with the full deal context: "This email is part of a negotiation for 4821 Westgrove Dr. The buyer's max budget is $750k. The listing price is $625k. The agent previously offered $600k."

Claude extracts: the other side's position, deadlines mentioned, emotional tone, red flags (other offers, inspection issues), and action items for Mike.

## Cross-Referencing

If Sarah emails Mike saying "I'm worried about the HOA," and then on a call she mentions HOA again, the system flags this as a high-priority concern in the buyer profile. It drafts a response addressing the concern with data: "The HOA at Westgrove covers pool, landscaping, and exterior insurance. Comparable properties without HOA average $45k higher, which at current rates costs $280/month — nearly double the HOA fee."

## Seller-Side Email Intelligence

Every email from the listing agent gets analyzed in deal context. When the listing agent says "my sellers are reviewing multiple offers and would like best and final by Friday," the AI doesn't just extract the deadline. It cross-references: has the listing had increased Zillow activity? Did the listing agent post about an open house? Is this language consistent with genuine multiple-offer situations, or is it a pressure tactic?

The system flags its assessment: "Likely genuine — listing had 340 views this week, up from 120. Recommend submitting competitive offer but don't overbid out of panic."

Conversely, if the listing agent says "the sellers are flexible on closing timeline," the system flags this as a negotiation lever. Updated deal state: seller prioritizing speed or convenience over price. Mike can leverage — fast close in exchange for lower price.

## Alert Rules

Mike configures what triggers notifications: new listing matches criteria, price drop on saved property, tour confirmation, mortgage rate update, competing offer detected, legal document received.

---

# Phase 6: Call Intelligence

## Real-Time Mode

Mike is on a call with Sarah or the listing agent. Audio is transcribed live (Deepgram, AssemblyAI, or Whisper). Each utterance is classified: speaker identity (diarization), sentiment, and deal-critical signals — price mentions, objections, commitments, deadlines, competitor mentions. Mike sees a minimal live overlay: colored sentiment dots and auto-detected action items in a sidebar.

**New lead detection runs here too.** If Mike takes a call from an unrecognized number and the caller expresses buying intent, the system creates a draft client record from the call content (as described in Phase 1).

## Post-Call Mode

After the call ends, the full transcript goes to Claude with the deal context. Claude generates a structured debrief:

- Overall buyer temperature (hot/warm/cool)
- Key topics discussed
- Negotiation leverage points discovered
- Concerns to address
- Action items with deadlines
- Agent performance score with coaching

The coaching is subtle but powerful: "You addressed the school district question well with specific data, but when Sarah raised the HOA concern at 0:28, you could have preemptively compared HOA costs to non-HOA alternatives."

## Seller-Side Call Intelligence

When Mike calls the listing agent, the post-call analysis reads between the lines. Hedging language ("the sellers *might* consider..." = they'll probably take it), urgency signals ("they really want to close before summer" = deadline pressure on the seller), information leaks ("between us, the appraisal came in a bit low" = seller knows the price is high).

The system maintains a **seller-side intelligence dossier** for each deal. Every interaction adds to it. Over time, Mike has: seller motivation level, likely floor price, known time pressures, listing agent's negotiation style, and recommended tactics.

## Feedback Loop

Call insights feed back into the buyer intent profile. After a call where Sarah says "that's perfect" about schools but hedges on HOA, the system knows school concern is resolved, HOA is still open. Next time Mike prepares for a call, the system briefs him: "Open concerns: HOA cost. Resolved: school district. Buyer temperature: warm-to-hot. Recommended talking points: compare HOA to maintenance costs on non-HOA properties."

---

# Phase 7: Pre-Offer Intelligence

Sarah has toured 4821 Westgrove Dr twice. She loves it. She wants to make an offer. This is where most agents go with gut feel. The system replaces gut feel with data.

## Accumulated Intelligence

By now the system has:

**The property dossier.** Listing history (originally $649k eight months ago, dropped to $639k, then $625k), tax assessed value ($582k — seller asking 7.4% above), permit history (kitchen remodel 2023, no other major work), no liens, no code violations. Lot is 0.31 acres, 12% above neighborhood median. Listing photos updated twice (signals refreshing stale interest).

**The seller motivation profile.** Scored at 78/100. Two price drops in eight months. 34 DOM in a market where median is 18. Listing agent has 14 other active listings.

**The strategic comp analysis.** Two groups: comps favoring the buyer (lower $/sqft, similar condition, more recent) and comps the seller's agent will likely cite (higher price, better finishes). For each: sale price, DOM, list-to-sale ratio, notable differences.

**Fair market value range.** $595k low (price-per-sqft of three most similar sales, adjusted for larger lot), $620k midpoint, $635k high (crediting smart home and solar). Current ask of $625k is in the upper third.

**Listing agent profile.** Average list-to-sale ratio: 96.2% across last 20 deals. Historical pattern suggests closing around $601k on this listing. Average 2.3 counter-offer rounds. Biggest concession typically on first counter (2.8% drop).

## The Offer Strategy Brief

Claude synthesizes everything into a deal-specific document:

"Recommended opening offer: $595,000. This is 4.8% below fair market midpoint — aggressive but defensible given 34 DOM and two price reductions. The listing agent's pattern suggests they'll counter around $612–615k. Recommended escalation: accept anything below $605k immediately, counter at $602k if they come back $610–620k, hold firm at $605k as ceiling. Lead with Sarah's pre-approval at $750k for credibility. Standard contingencies — do not waive inspection (property is 7 years old, only kitchen professionally assessed). Offer 30-day close. A 21-day close could be a sweetener if negotiation stalls, but hold in reserve."

The system also drafts the offer email with narrative framing: "Sarah and her family fell in love with the home during their second visit. They're pre-approved, highly motivated, and can close within 30 days." It knows not to mention price drops or DOM — that telegraphs awareness of seller pressure.

Mike reviews, adjusts if needed, sends.

---

# Phase 8: The Negotiation

The offer is out. The system enters monitoring mode — watching Gmail for the listing agent's response, still watching the Zillow listing (if it goes to "pending" before Mike hears back, someone else may have gotten it).

## Counter-Offer Analysis

The listing agent emails: "The sellers appreciate the Chens' interest. They'd like to counter at $618,000 with a 25-day close. The sellers would also prefer to exclude the Ring doorbell and the mounted TV."

The system runs full analysis:

**Price analysis.** They came down $7k (1.1%). Based on the listing agent's historical 2.8% first-counter concession, this is tighter than expected — they'd typically come to ~$607k. This means either a firm floor or anchoring high for multiple rounds. System flags both interpretations.

**Terms analysis.** The 25-day close request (shorter than Mike's 30) confirms time pressure. Personal property exclusions (Ring, TV) signal sellers are mentally preparing to sell — positive indicators.

**Updated strategy.** "Counter at $603,000 with 28-day close. $603k is an $8k increase from opening (good faith) while staying within $605k ceiling. 28 days splits the timeline difference without giving away fast-close leverage. Accept the personal property exclusions — worth $500, conceding costs nothing and builds goodwill. If they counter above $610k, introduce the 21-day close as final concession paired with firm $605k."

**Deal probability update.** Before offer: 65%. After counter (they engaged, didn't reject): 74%. Risks: 12% chance undisclosed competing offer, 8% chance they pull listing.

Each round gets this treatment. The system tracks every exchange, recalibrates, and updates Mike's strategy in real time. The buyer's private dashboard shows deal progress updates so Sarah knows what's happening.

---

# Phase 9: Under Contract

They agree on $607,000, 25-day close, standard contingencies. Both sides sign.

## The Contingency Timeline

Generated automatically from contract terms:

- **Day 0 (today):** Contract executed. Earnest money ($6,070) due within 3 business days.
- **Day 1–10:** Inspection period. Inspector must be scheduled immediately.
- **Day 10:** Inspection contingency deadline. Accept, request repairs, or walk away.
- **Day 14–18:** Appraisal window. Lender orders appraisal.
- **Day 18:** Appraisal contingency deadline. If low, renegotiation begins.
- **Day 20:** Financing contingency deadline. Lender must issue clear-to-close.
- **Day 22:** Title commitment due.
- **Day 24:** Final walkthrough.
- **Day 25:** Closing.

The system creates active monitoring for each deadline — alerts 48 hours before, email monitoring for incoming documents, and pre-computed contingency plans for each stage. Sarah sees this timeline in her private dashboard with real-time stage indicators.

---

# Phase 10: Inspection

Before the inspection happens, the system has already researched common issues for 2018-built homes in this area: HVAC is 7 years into a 15–20 year life, roof should be fine, water heater may be nearing warranty expiration.

The inspection report arrives — a 40-page PDF. Mike forwards it (or the system picks it up from Gmail). The system reads the entire document and produces a prioritized summary:

**Critical (deal-impacting):** Foundation shows minor settling, inspector recommends structural engineer evaluation. HVAC condenser showing early refrigerant leak. Estimated repair: $3,500–8,000.

**Moderate (negotiation leverage):** Master bath exhaust not vented to exterior. Water stains in attic suggesting previous roof leak (repaired). Two GFCI outlets in kitchen non-functional.

**Minor (cosmetic, don't negotiate):** Paint touch-ups, caulking, loose deck handrail.

**Repair negotiation strategy:** "Request $6,000 credit at closing for foundation evaluation and HVAC. Don't ask sellers to perform repairs — credits give Sarah contractor control. Don't include minor items — too many requests creates adversarial dynamics. Frame as: 'Two items need professional attention. Rather than delay closing, we propose a $6,000 credit.' Fallback: split at $3,000."

**Risk assessment:** "Given seller motivation (78/100) and 10 days into a 25-day close, seller unlikely to walk over $6,000. Acceptance: 72%. Counter: 22%. Rejection: 6%."

---

# Phase 11: Appraisal

The system has been tracking comps throughout the process. Estimated appraisal range: $598k–$615k. Contract price $607k is within range but upper end.

## Pre-Computed Scenarios

**At or above $607k:** No action. Deal proceeds.

**$595–607k:** Three options. (1) Seller reduces to appraised value — most common when seller is motivated. (2) Sarah covers gap — pre-approval headroom makes this possible but last resort. (3) Mike challenges appraisal with comps, specifically any that closed after appraiser's data cutoff.

**Below $595k:** Red flag. Market shifting or poor comps. Recommend second appraisal if contract allows, or significant renegotiation.

For each scenario, the system has pre-drafted the communication to the listing agent.

**Market monitoring continues during contract.** The Browser Use agent watches for new comps closing during the contract period — if a nearby house sells for significantly less than $607k, that's ammunition for renegotiation if appraisal comes in low.

---

# Phase 12: The Closing Corridor

Last five days. The system becomes a project manager.

**Active monitoring:** Has the lender issued clear-to-close? (watching email for commitment letter) Has title confirmed clear title? (watching for commitment) Has seller completed agreed repairs? Is closing date confirmed?

**Final walkthrough (Day 24).** Deal-specific checklist: verify agreed repairs completed, confirm fixtures/appliances per contract present and functional, check for new damage since inspection, run water/electricity/gas, verify Ring doorbell and TV removed per exclusion.

If Sarah flags something during walkthrough (texts Mike "the dishwasher isn't working"), the system advises: "Dishwasher was functional during inspection — new issue. Recommend $500 credit at closing. Small enough seller won't fight it this close to finish."

**Closing day checklist:** Government-issued ID, certified check or wire confirmation, closing disclosure reviewed (system pre-analyzed against original estimate, flags discrepancies), homeowner's insurance bound, utility transfers scheduled.

---

# Phase 13: Post-Close & The Flywheel

The deal is done. The system's job isn't over.

**Immediately:** Satisfaction survey to Sarah. Responses feed NPS tracking. High scores trigger testimonial request.

**Within one week:** Drafts a "settling in" email from Mike, personalized from deal file: "Hope you're enjoying the pool! HOA contact: [from deal file]. First payment due: [from contract]. If the HVAC gives trouble, here are three contractors I recommend in Richardson."

**Ongoing:** The system continues monitoring 4821 Westgrove and the neighborhood. At 6 months: "Your home has appreciated approximately $12,000 based on recent comparable sales." Keeps Mike top of mind.

**The referral loop:** Sarah's coworker mentions looking for a house. Sarah refers Mike. The new lead enters through any channel — maybe an email, maybe a call, maybe Sarah gives Mike the coworker's number. The system detects it, creates the record, and the cycle restarts. But now the system already knows Dallas, has comp data, and has Mike's negotiation patterns calibrated. Every deal makes the next one smarter.

---

# Backend Architecture

## The Deal Graph

Every deal is a graph of connected entities: buyer profile, property, seller (inferred), listing agent (inferred), communications, documents, events, and action items. Every new piece of information — a scraped listing update, an email, a call transcript, a dashboard interaction — is a node that gets connected to the graph and triggers a re-evaluation.

When a new node is added (listing agent emails a counter-offer), the system pulls the relevant subgraph and passes it to Claude with a stage-specific prompt. Output: updated deal state, new action items, updated recommendations, alerts.

## Browser Use Agent Layer

Three types of agent tasks:

**One-shot tasks** fire on buyer onboarding — search, scrape, score, rank.

**Monitoring tasks** run on schedule — check tracked listings for changes, pull new comps, monitor listing agent's other properties.

**Triggered tasks** fire on events — counter-offer arrives → pull fresh comps; inspection report arrives → research flagged issues; new lead confirmed with limited criteria → run broad search.

Runs as a FastAPI backend accepting task requests and streaming progress events via WebSocket/SSE to the frontend. Every page navigation, extraction, and decision gets logged for replay in the UI.

## LLM Analysis Layer

Every piece of unstructured data (email body, call transcript, listing description, inspection report, buyer notes) goes through Claude with full deal context. These aren't one-off calls — each includes buyer profile, property data, conversation history, and deal stage.

The lead classification layer runs separately: lightweight, fast, binary classification on every unmatched inbound email and every call with an unrecognized speaker.

Sonnet for real-time interactions and lead classification. Opus for deep analysis (offer strategy, inspection analysis, negotiation intelligence).

## MCP Integration Layer

**Gmail MCP** for email access — read incoming, draft outgoing, send on Mike's behalf (with Mike's confirmation). Also serves as the email lead detection channel.

**Google Calendar MCP** for scheduling tours and tracking deadlines.

Critical design pattern: the system never sends anything without Mike's approval. It drafts, suggests, prepares — Mike clicks send.

## Data Model

**Agents** — Mike's account. Gmail connected, calendar connected, preferences, negotiation style profile (built over time from past deals), email signature and communication tone (for drafting emails in Mike's voice).

**Buyers** — Each client record. Profile data from intake (or extracted from email/call), buyer intent profile (living JSON that evolves), engagement metrics (dashboard visits, clicks, favorites, dwell time), communication preferences, source (manual/email/call) and referral chain, confidence level (for auto-detected leads).

**Properties** — Each scraped property. Structured data (address, price, beds, baths, sqft, year, HOA), scoring data (match score, reasoning, seller motivation score), monitoring data (price history snapshots, listing changes over time), listing agent profile, comp analysis.

**Deals** — Junction of buyer + property once interest is established. Deal stage (state machine), offer history (every offer and counter with timestamps and analysis), contingency timeline with deadlines, action items, intelligence dossier (aggregated insights from all communications).

**Communications** — Every email and call related to a deal or a buyer. Raw content, AI analysis (structured JSON: sentiment, action items, topics, risk flags), classification (deal-relevant / new lead / noise), linked deal/buyer IDs.

**Dashboard Sessions** — Buyer interactions with their private dashboard. Page views, property clicks with dwell time, favorites, comments. All timestamped and linked to buyer record.

**Agent Tasks** — Browser Use jobs. Task type (search, monitor, comp pull), status (queued/running/complete/failed), input parameters, output data, execution log for UI replay.

## The Event-Driven Architecture

The orchestration core is event-driven. Key events and what they trigger:

- **New buyer confirmed** → Generate intent profile → Queue Browser Use research
- **Research complete** → Notify agent → Enable "Send to Client" flow
- **Email sent to buyer** → Generate private dashboard → Track engagement
- **Buyer dashboard interaction** → Update intent profile → Surface insights to agent
- **Buyer criteria change** → Update intent profile → If change opens new search territory, auto-trigger Browser Use research → Notify agent with new results for review
- **Inbound email (matched)** → Analyze in deal context → Update deal state → Generate action items
- **Inbound email (unmatched)** → Run lead classification → If lead: create draft record
- **Call ended (existing client)** → Analyze transcript → Update intent profile → Generate debrief
- **Call ended (unknown speaker)** → Run lead classification → If lead: create draft record
- **Deal stage transition** → Trigger stage-specific actions (e.g., under contract → generate timeline)
- **Deadline approaching** → Alert agent 48 hours before
- **Price change detected** → Update property record → Alert agent and buyer
- **Document received (inspection/appraisal)** → Analyze → Generate summary and strategy
- **Deal closed** → Trigger post-close sequence → Move to monitoring mode

## The Complete Data Flow

1. Lead enters system (manual / email detection / call detection)
2. Agent confirms → buyer record created
3. Buyer fills intake form (if needed) OR system has enough from email/call
4. Intent profile generated/enriched
5. Browser Use runs full research pipeline (real scraping, real cross-referencing)
6. Scoring pipeline runs (Claude scores each property against buyer profile)
7. Results appear in agent command center with notification
8. Agent reviews shortlist, optionally adjusts
9. Agent hits "Send to Client" → system drafts personalized email with top picks + dashboard link
10. Agent reviews/edits → sends via Gmail MCP from their real email
11. Buyer receives email, clicks dashboard link
12. Buyer explores properties, favorites, comments
13. Buyer updates search criteria (budget, beds, baths, amenities, area) → intent profile updates → if change opens new territory, Browser Use auto-triggers new search → new results surface to agent for review
14. Engagement data flows to agent command center, updates buyer intent profile
15. Agent and buyer communicate (emails monitored, calls transcribed and analyzed)
16. All intelligence feeds into deal state and seller intelligence dossier
17. Buyer wants to make offer → system generates full offer strategy brief
18. Offer submitted → negotiation tracked round by round with real-time strategy updates
19. Under contract → contingency timeline generated, deadlines monitored
20. Inspection report analyzed, appraisal scenarios pre-computed
21. Closing corridor managed with checklists and final walkthrough
22. Post-close: satisfaction survey, ongoing monitoring, referral flywheel
23. Every interaction across every deal makes the system smarter for future deals

---

# Demo Script (5–6 minutes)

**"Meet Mike, a buyer's agent in Dallas. His phone rings."**

→ Show a call coming in from an unknown number. The system transcribes in real time. The caller says they're looking for a 4-bed in North Dallas, referred by a past client. Call ends. System surfaces: "New lead detected — Sarah Chen. 4 bed, North Dallas, $400–750k, good schools. Referred by James Park. [Confirm]"

**"Mike confirms with one click. Watch what happens."**

→ Browser Use agent fires up instantly. Live view showing it navigate Zillow, scrape listings, cross-reference schools, walk scores, comps. Properties appear ranked with scores and seller motivation indicators.

**"Results are ready. Mike sends them to Sarah."**

→ Show the personalized email draft with top 5 picks and the dashboard link. Mike hits send.

**"Sarah opens her private dashboard."**

→ Show the buyer's view — clean, ranked properties with reasoning, comparisons, price histories. Sarah favorites two properties, leaves a comment about HOA. Mike's command center updates in real time.

**"Meanwhile, the system is reading Mike's email."**

→ An email from the listing agent appears. AI analysis: sentiment, action items, detects a pressure tactic about "multiple offers." System cross-references with Zillow traffic data. Flags it as "likely genuine."

**"Sarah wants to make an offer. Here's where it gets powerful."**

→ Show the full offer strategy brief. Recommended price, escalation path, comps to cite, narrative framing. The listing agent's historical negotiation pattern visualized.

**"The seller counters. The system adapts."**

→ Counter-offer email arrives. Instant analysis. Updated strategy. Deal probability shifts from 65% to 74%.

**"They agree. Now the system manages the deal to close."**

→ Contingency timeline appears. Inspection report uploaded → 40-page PDF analyzed in seconds → prioritized summary with negotiation strategy. Appraisal scenarios pre-computed.

**"Every interaction — every email, every call, every click on the dashboard — makes the system smarter. Not just for this deal. For every deal Mike will ever do. That's FoyerFind."**

---

# Strategic Addendum (March 2026)

## Honest Assessment

The vision above (Phases 1–13) is the long-term north star. It is NOT the current product. The current build focuses on two core experiences:

1. **Agent Command Center** — lead management, buyer portfolio, deal tracking, property curation
2. **Buyer Private Dashboard** — token-based property browsing, favorites, comments, filters

Everything else is either a minimum viable stub or documented for future work. See `CLAUDE.md` at the project root for the full feature tier breakdown and build priorities.

## Key Strategic Shifts

### AI is the accelerant, not the product
The original pitch led with "AI-powered intelligence layer." This has been reframed. FoyerFind is a **workflow and productivity tool** for buyer's agents. AI features (property scoring, email classification, negotiation analysis) are optional enhancements that can be toggled on. The product must stand on its own without any LLM calls.

**Rationale:** Competing on "AI" puts us against Rechat, LionDesk, kvCORE and every other CRM adding AI features. Competing on "the best command center for buyer's agents in a post-NAR world" is a more defensible position.

### No scraping — legal data sources only
The original framework assumed Zillow/Redfin scraping via Browser Use. This has been dropped. Property data comes from:
- Agent manual entry (MVP)
- MLS API feeds (Bridge Interactive, Spark/RESO) when available
- Public APIs (GreatSchools, Google Maps) for enrichment

**Rationale:** Scraping is a ToS violation, technically fragile (CAPTCHAs, rate limiting), and a legal liability. MLS APIs are the correct path.

### NAR settlement is the market catalyst
The 2024 NAR settlement requires buyer-broker agreements before showings and decoupled buyer's agent compensation from MLS. This means:
- Agents must demonstrate value to earn their commission
- The buyer dashboard serves as a transparent work log
- Property curation with reasoning proves expertise
- Deal tracking shows complexity being managed

All feature design and marketing copy should frame FoyerFind as **the tool that helps agents prove their worth**, not "AI that replaces agent work."

## Competitive Landscape

Direct competitors (agent CRMs with AI):
- **Follow Up Boss** — lead management, automated follow-ups
- **kvCORE (Inside Real Estate)** — full platform, IDX, AI assistant
- **LionDesk** — AI-integrated CRM, texting, video messaging
- **Rechat** — AI-first, marketing + CRM + transaction mgmt
- **Lofty (formerly Chime)** — AI assistant + CRM + IDX

Our gap: None of these focus on the **buyer's agent workflow specifically** or on **buyer transparency** (the private dashboard). Most are lead-gen focused (seller/listing side). The NAR settlement creates new demand for buyer-agent-specific tooling that these platforms haven't addressed.

## What to Build Next (Priority Order)

1. Make Tier 1 features (command center + buyer dashboard) production-quality with real data flowing
2. Connect Supabase auth end-to-end (signup → agent record → dashboard access)
3. Build manual property entry flow (agent adds properties, ranks them, sends to buyer)
4. Add basic email integration (Gmail read-only, grouped by buyer)
5. Evaluate MLS API providers and pricing for property data feed
6. Add optional AI scoring toggle (Cerebras for fast scoring, clearly labeled as AI-suggested)