# Gmail API — Integration Reference

> Documentation for our Gmail integration using `googleapis` v171+. Written to capture known gotchas, architectural decisions, and anticipated problem areas based on current code (Mar 2026).

---

## Architecture Overview

```
Agent connects Gmail (OAuth 2.0 consent)
         ↓
Tokens stored in agents table (Supabase)
         ↓
Agent triggers scan (POST /api/email/scan)
         ↓
lib/gmail/tokens.ts → getAuthedClient()   ← token refresh happens here
         ↓
lib/gmail/client.ts → fetchRecentEmails() ← Gmail API calls happen here
         ↓
Emails classified via LLM (Cerebras)
         ↓
Stored in communications table
         ↓
EmailInbox component fetches /api/email/inbox and renders
```

**Key files:**
| File | Purpose |
|------|---------|
| `lib/gmail/oauth.ts` | OAuth2 client factory, auth URL generation |
| `lib/gmail/tokens.ts` | Token retrieval from DB + auto-refresh setup |
| `lib/gmail/client.ts` | Gmail API message fetching + parsing |
| `app/api/email/connect/route.ts` | Initiates OAuth flow |
| `app/api/email/callback/route.ts` | Handles OAuth redirect, stores tokens |
| `app/api/email/scan/route.ts` | Full scan: fetch → classify → store |
| `app/api/email/inbox/route.ts` | Real-time inbox view (fetch live + merge DB classifications) |
| `app/api/email/disconnect/route.ts` | Nulls out tokens in DB |
| `components/email/email-inbox.tsx` | Client component, polling via custom event |
| `components/email/scan-button.tsx` | Triggers POST /api/email/scan |
| `components/email/gmail-connect-button.tsx` | Connect/disconnect UI |

---

## OAuth Setup

### Required Google Cloud Configuration

1. **OAuth 2.0 Client ID** — Type: Web application
2. **Authorized redirect URIs** must include:
   - `http://localhost:3000/api/email/callback` (local dev)
   - `https://your-production-domain.com/api/email/callback` (production)
   - **Common break point:** Redirect URI mismatch. Google rejects the callback if the URI in the request doesn't exactly match what's registered — including trailing slashes, http vs https, and port numbers.
3. **OAuth Consent Screen** — must be configured with the correct scopes. In development you can use "External" with test users, but the app must be verified for production use with Gmail scopes.

### Required Scopes

Currently using:
```
https://www.googleapis.com/auth/gmail.readonly
```

**If we add sending capability** (reply from FoyerFind, future feature), we'll need:
```
https://www.googleapis.com/auth/gmail.send
```
Or the broader:
```
https://www.googleapis.com/auth/gmail.modify
```

> **Note:** Adding scopes post-launch requires re-consent from all existing users (their stored tokens will only have the old scope). Plan scope additions carefully.

### Consent Screen Verification

Gmail's `gmail.readonly` scope is a **restricted scope** under Google's OAuth policy. This means:
- In development/testing: works fine with "External" app + listed test user emails
- For production with real users: must complete Google's **OAuth app verification** — requires privacy policy URL, app homepage, and a security review if requesting restricted scopes
- **Without verification:** non-test users see a scary "This app isn't verified" warning before consent. Many will abandon.
- **Timeline:** Google verification can take 4–6 weeks. Start this process before launch.

### Environment Variables Required

```bash
GOOGLE_OAUTH_CLIENT_ID=
GOOGLE_OAUTH_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=https://your-domain.com/api/email/callback
NEXT_PUBLIC_APP_URL=https://your-domain.com
```

**Note:** `GOOGLE_REDIRECT_URI` takes precedence in `oauth.ts`. If not set, it falls back to `NEXT_PUBLIC_APP_URL + /api/email/callback`. Both must be registered in Google Cloud Console.

---

## Token Storage & Refresh

### Current Schema (agents table)

```sql
gmail_connected         boolean
gmail_access_token      text   -- short-lived (~1hr)
gmail_refresh_token     text   -- long-lived, use to get new access token
gmail_token_expires_at  timestamptz
gmail_last_scan_at      timestamptz
```

### Token Refresh Flow

`tokens.ts:getAuthedClient()` sets credentials and registers an `on("tokens")` listener:

```typescript
oauth2Client.on("tokens", async (tokens) => {
  // Fires automatically when googleapis refreshes the access token
  // Persists new access_token (and refresh_token if rotated) back to DB
});
```

**Known issues and gotchas with this pattern:**

1. **Race condition on concurrent requests** — If two requests call `getAuthedClient()` for the same agent simultaneously and the access token is expired, both will attempt to refresh. The second persist will overwrite the first, which is usually fine, but if Google rotates the refresh token (it does this occasionally), one of the writes may clobber the new refresh token with an old one, permanently breaking the connection for that agent. **Mitigation:** Add a DB-level mutex or use `upsert` with a version field; or short-circuit by checking `expiry_date` before calling the API at all and refreshing proactively.

2. **Refresh token loss at first connection** — In the OAuth callback, if `tokens.refresh_token` is null (can happen if the user had previously consented and `prompt: "consent"` wasn't used), we bail with an error. Current code handles this by always passing `prompt: "consent"`. Do not remove this — it forces Google to re-issue a refresh token every time.

3. **Token expiry field type mismatch** — `gmail_token_expires_at` is stored as `timestamptz` in Supabase but `expiry_date` from Google's API is a Unix epoch millisecond integer. `tokens.ts` does `new Date(tokens.expiry_date).toISOString()` on write and `new Date(agent.gmail_token_expires_at).getTime()` on read. Both conversions must be present — dropping either causes `oauth2Client` to treat the token as never-expiring or always-expired.

4. **Supabase `as any` casts** — The admin client is cast as `any` throughout. This suppresses TypeScript errors but hides type bugs. Future: generate Supabase types and remove the casts.

---

## Message Fetching

### Query Strategy

Current query in `client.ts`:
```
in:inbox OR in:sent
```
With optional `after:{epoch}` suffix.

**Known limitations:**
- `in:inbox OR in:sent` does NOT include Spam, Trash, or All Mail. This is intentional — agents don't want spam surfaced — but it means some lead emails that land in Spam are silently missed.
- The `after:` filter uses epoch seconds. The conversion from ISO date string to epoch is `Math.floor(new Date(after).getTime() / 1000)`. This must stay as integer seconds — Gmail rejects fractional seconds.
- `maxResults` on the list call controls how many message IDs come back, not how many we fully fetch. We always fetch all returned IDs in full. Keep `maxResults` ≤ 25 for the inbox endpoint to avoid timeouts.

### Batching

Messages are fetched in batches of 5 with `Promise.all` per batch:

```typescript
const BATCH_SIZE = 5;
for (let i = 0; i < messageIds.length; i += BATCH_SIZE) {
  const batch = messageIds.slice(i, i + BATCH_SIZE);
  const results = await Promise.all(batch.map(...));
  messages.push(...results);
}
```

**Anticipated issues:**
- At 15–25 emails this is fine. At higher volumes (>50), the sequential batches will hit Vercel's 10s function timeout on the `/api/email/scan` route. If we increase `maxResults` significantly, we need to either move to a background job (FastAPI + Celery) or implement streaming response.
- Gmail API quota: 250 quota units per user per second. Each `messages.get` costs 5 units. At batch size 5 = 25 units/batch, we're well under limit — but if we increase concurrency, watch for 429 errors.

### Body Parsing

`extractTextBody()` handles three cases:
1. `text/plain` directly on payload
2. `text/plain` in a top-level `parts` array
3. Recursive descent through nested `parts`

**Known failure cases:**
- **HTML-only emails** — Many modern emails have no `text/plain` part at all. The function returns `""` in this case. We should add `text/html` as a fallback and strip tags. Currently the email body shows blank for HTML-only messages.
- **Deeply nested multipart** — Some emails (especially forwarded chains or rich-client emails) put text 3+ levels deep. The recursive fallback handles this but can be slow for very large MIME trees.
- **Base64 padding** — Gmail uses `base64url` encoding. `Buffer.from(data, "base64url")` is correct. Do NOT use `"base64"` — it will fail on strings with `-` and `_` characters (which base64url uses instead of `+` and `/`).
- **Encoding beyond UTF-8** — Some older email clients send `ISO-8859-1` or `Windows-1252`. `Buffer.toString("utf-8")` on these produces garbled text. For correctness, check the `Content-Type` charset header and decode accordingly. Not a priority now but will appear.

### Direction Detection

```typescript
const direction = from.toLowerCase().includes(agentEmail.toLowerCase())
  ? "outbound"
  : "inbound";
```

**Fragile cases:**
- Agent email must match exactly what's in `From:` header. Gmail sometimes formats as `"First Last <email@domain.com>"` — the `.includes()` handles this since it just checks if the email substring appears anywhere.
- If agent has multiple email aliases or a Google Workspace account, this check may incorrectly mark emails from aliases as inbound. Future: store all aliases in agent profile and check against all of them.

---

## Scan Endpoint (`/api/email/scan`)

### Rescan Logic

The `?rescan=1` query param:
1. Deletes all communications of `type: "email"` for the agent
2. Sets the `after` window to 14 days ago

**Risk:** Rescan is a destructive operation — all prior classifications are deleted before re-fetching. If the Gmail fetch fails partway through, the agent ends up with fewer emails than before and no way to recover without scanning again. Consider a soft-delete or a staging approach for resilience.

### LLM Classification in Scan

All emails are classified in parallel:
```typescript
const classifications = await Promise.all(
  newEmails.map(async (email) => llmJSON(...))
);
```

**Anticipated failure modes:**
- **LLM timeout/rate limit** — Currently caught per-email with a try/catch, storing `null` classification on failure. The email is still inserted, just unclassified. This is correct behavior.
- **Cerebras API instability** — We use Cerebras for `email_classification` (fast/cheap). If Cerebras is down, all classifications fail. The scan "succeeds" but nothing gets classified. No retry logic currently.
- **Parallel LLM calls at scale** — 15 simultaneous LLM calls is fine for Cerebras. If we increase `maxResults`, watch for rate limits. Add exponential backoff if we go beyond 25 concurrent.

### Deduplication

```typescript
const { data: existing } = await admin
  .from("communications")
  .select("gmail_message_id")
  .eq("agent_id", agent.id)
  .in("gmail_message_id", messageIds);
```

This is a correct pattern — checking existing `gmail_message_id`s before inserting. However:
- The `in()` filter has a practical limit of ~1000 values in Supabase (PostgreSQL `IN` clause). Won't matter now but matters if we ever do bulk historical sync.
- If the same Gmail message arrives in two near-simultaneous scan requests (unlikely but possible), both will pass the dedup check and we'll get a duplicate insert. Add a `UNIQUE` constraint on `(agent_id, gmail_message_id)` in the DB to enforce this at the DB level.

---

## Inbox Endpoint (`/api/email/inbox`)

This route fetches emails live from Gmail on every call, then merges stored classifications from the DB. This is intentional — it means the inbox always shows the latest emails, even ones not yet scanned/classified.

**Anticipated issues:**
- **Vercel function timeout** — Live Gmail fetch + DB query on every page load. With 25 emails, this is ~2–4 seconds. Acceptable now; at 50+ emails it will regularly hit the 10s Vercel limit. Mitigation: cache the Gmail fetch in Redis or Supabase, or move to a background-refreshed inbox with optimistic UI.
- **No pagination** — Currently returns all emails in the window. As the window grows or `maxResults` increases, the response payload grows. Add pagination before going to high-volume users.
- **Classification join** — `buyers(full_name)` is joined via the `communications` table. This only works if a communication record has a `buyer_id` linked. Currently the scan route doesn't link buyer IDs — this join always returns null. Future: during scan, attempt to match `from_address` against known buyer emails.

---

## Known Issues Summary

| Issue | Severity | File | Status |
|-------|----------|------|--------|
| HTML-only email bodies show blank | Medium | `lib/gmail/client.ts:extractTextBody` | Not fixed |
| Token refresh race condition (concurrent requests) | Medium | `lib/gmail/tokens.ts` | Not fixed |
| `UNIQUE` constraint missing on `gmail_message_id` | Medium | DB schema | Not fixed |
| Rescan is destructive (no soft-delete) | Low-Medium | `api/email/scan/route.ts` | Not fixed |
| buyer_id never linked during scan (buyer name always null) | Low | `api/email/scan/route.ts` | Not fixed |
| No retry/backoff on LLM classification failures | Low | `api/email/scan/route.ts` | Not fixed |
| OAuth app not verified (blocks non-test users) | High | Google Cloud Console | Pre-launch blocker |
| No pagination on inbox | Low | `api/email/inbox/route.ts` | Not fixed |
| Agent email alias mismatch in direction detection | Low | `lib/gmail/client.ts` | Not fixed |

---

## Pre-Launch Checklist

- [ ] Register both local and production redirect URIs in Google Cloud Console
- [ ] Add `UNIQUE(agent_id, gmail_message_id)` constraint to `communications` table
- [ ] Submit for Google OAuth app verification (allow 4–6 weeks)
- [ ] Test token refresh flow: let access token expire naturally, verify new token persists to DB
- [ ] Test disconnect → reconnect flow: verify old tokens are fully cleared
- [ ] Test rescan with empty Gmail result (no emails in window) — verify `gmail_last_scan_at` still updates
- [ ] Add HTML-only email body fallback (`text/html` strip)
- [ ] Verify `NEXT_PUBLIC_APP_URL` and `GOOGLE_REDIRECT_URI` are consistent in production env

---

## Future Work

**Near-term (before scaling):**
- HTML body fallback in `extractTextBody()`
- Soft-delete rescan (stage new emails, swap atomically)
- DB-level unique constraint on `(agent_id, gmail_message_id)`
- Buyer email → `buyer_id` matching during scan

**When adding sending capability:**
- New scope: `gmail.send` or `gmail.modify`
- All existing users must re-consent
- Rate limits: Gmail send API is 100 messages/day for non-Workspace accounts; Workspace accounts vary
- Consider `Reply-To` threading (send as a reply to an existing thread using `threadId`)

**When moving to higher volume:**
- Move scan to background job (FastAPI + Celery, or Vercel background functions)
- Add pagination to inbox endpoint
- Cache inbox response in Redis/Supabase with 60s TTL
- Gmail Push Notifications (`watch()` API + Pub/Sub) instead of poll-on-demand — this fires a webhook when new mail arrives, eliminating the need for manual "Scan" button entirely

**Gmail Push Notification architecture (for reference):**
```
Google Pub/Sub topic → Webhook → /api/email/webhook
Agent registers watch via gmail.users.watch()
  → topic: projects/{project}/topics/{topic}
  → labelIds: ["INBOX"]
Watch expires every 7 days — must renew via cron
Each notification = historyId, not full message
Must call gmail.users.history.list(startHistoryId) to get changed messages
```
This is more complex but eliminates all polling and the manual scan button.
