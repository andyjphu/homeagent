# HomeAgent Audit — TODO

## BROKEN (will crash or fail)

- [ ] **Activity Feed crashes at runtime** — `cn()` function used but not imported. Component has never been tested. Remove or fix before shipping.
- [ ] **Email scan "completion" is a lie** — Scan button fires request, immediately says "done", but classification is async. Shimmer animation creates illusion of progress then stops. Agent thinks scan finished when it hasn't.
- [ ] **Create Lead deduplication is client-side only** — `createdLeads` Set lives in React state. Page refresh = gone = duplicate leads created.

---

## SECURITY (must fix before real users)

- [ ] **No ownership validation on API routes** — `/api/properties/score`, `/api/email/buyer-summary`, `/api/deals/[dealId]/strategy` don't verify buyer/deal belongs to authenticated agent. Any agent could access another's data.
- [ ] **Property create doesn't validate buyerIds belong to agent** — Could link properties to another agent's buyers.
- [ ] **OAuth callback has no CSRF protection** — No `state` parameter validation.
- [ ] **Buyer dashboard comments aren't scoped** — Buyer with token could post comments on properties not shared with them.

---

## AI SLOP (sounds impressive, does nothing useful)

- [ ] **"Save & Update Search" on buyer dashboard is misleading** — Buyer adjusts criteria, clicks save, expects new properties. Nothing happens. Criteria just stored. No re-search, no notification, no expectation-setting.
- [ ] **Email Summary silently falls back to generic template** — If LLM fails, agent sends boilerplate thinking it's personalized. No indication which version was used.
- [ ] **"Run Research" is vague** — Doesn't explain what it does. Triggers Zillow scraping (CLAUDE.md says PROHIBITED). Agent has no idea what's happening.
- [ ] **Scan New vs Re-scan All** — Both buttons do nearly the same thing. Distinction is meaningless to agent. Just have one button.
- [ ] **Deal probability displayed with zero explanation** — Shows "73%" but where did it come from? Can't override. Erodes trust.

---

## DEAD UI (remove or finish)

- [ ] **"Request Tour" button on property card** — Disabled, does nothing. Remove it.
- [ ] **"Upload Recording" on calls page** — Disabled "Coming soon". Page is otherwise empty. Can't log calls manually either. Useless page.
- [ ] **Google Calendar "Coming Soon" badge** — Just taking up space in settings.
- [ ] **Inspection tab on deals** — Shows raw JSON or blank. No upload, no manual entry.

---

## MISSING CORE FUNCTIONALITY (agents will hit walls)

- [ ] **Can't edit anything** — No edit for buyer profiles, properties, deals, leads, or calls. Everything is create-once, read-forever. Wrong AI extraction? Can't fix without Supabase.
- [ ] **Can't create a deal from UI** — Deals list exists but no "Create Deal" button.
- [ ] **Can't add offers from UI** — Offers tab shows history but no way to record new offer.
- [ ] **Can't go backwards on deal stages** — Accidentally advanced? Stuck forever.
- [ ] **Can't manually log a call** — Calls page exists with zero way to add data.
- [ ] **No search or filtering anywhere** — Leads, emails, properties, deals are all flat lists.
- [ ] **Can't manually classify/reclassify emails** — LLM gets it wrong? Too bad.

---

## UX CONFUSION

- [ ] **Property comparison highlights "highest" not "best match"** — Highlights most bedrooms instead of closest to buyer criteria. Misleading.
- [ ] **Noise emails at 40% opacity** — Misclassified important email = invisible.
- [ ] **No way back from dismissed leads** — Accidentally dismiss? Gone forever.

---

## BACKEND QUALITY

- [ ] **JSON parsing without try-catch in cerebras.ts** — LLM returns malformed JSON = unhandled crash.
- [ ] **No env var validation** — Missing GEMINI_API_KEY silently passes empty string, fails with cryptic error.
- [ ] **Token refresh failure not handled** — If Supabase save fails after Gmail token refresh, new tokens lost. Next call uses stale creds.
- [ ] **Hardcoded 14-day email window** — Not configurable without redeployment.
- [ ] **Click vs view tracking identical** — Both increment `view_count` in buyer dashboard tracking. Loses analytics fidelity.
- [ ] **No rate limiting on any endpoint** — `/api/email/scan` could spawn unlimited LLM requests.

---

## PRIORITY ORDER

1. Security fixes (ownership validation, CSRF)
2. Broken features (activity feed, scan honesty, lead dedup)
3. Edit flows (buyer profile, properties, deals)
4. Dead UI cleanup (remove disabled buttons, stubs)
5. Missing CRUD (create deal, add offer, log call)
6. Search/filtering
7. UX polish (comparison logic, email opacity, undo dismiss)
