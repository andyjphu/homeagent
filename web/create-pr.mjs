import https from 'https';

const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
if (!token) { console.log('NO_TOKEN'); process.exit(0); }

const body = JSON.stringify({
  title: 'feat: notification system — SMS + email alerts for critical buyer events',
  head: 'claude/nervous-bardeen',
  base: 'main',
  body: `## Summary
- **Notification service** (\`web/src/lib/notifications/\`) — dispatcher that checks agent preferences, quiet hours (no SMS 9pm–8am), and batching (1-hour dedup for low-priority events like dashboard views), then sends via Twilio SMS and/or email (Resend or Gmail API fallback)
- **8 event types wired**: \`property_favorited\`, \`comment_added\`, \`buyer_updated\`, \`dashboard_viewed\`, \`lead_detected\`, \`deadline_approaching\`, \`call_analyzed\`, \`buyer_criteria_changed\`
- **Hooked into \`createActivityEntry\`** — fire-and-forget dispatch after every activity insert, with \`skipNotification\` escape hatch
- **Deal deadline checker** cron route scans contingencies + closing dates within 48h, dedupes per-day
- **Queue flusher** cron route sends quiet-hours SMS at 8am
- **\`notifications\` table** logs all sent/failed/queued notifications for history + debugging
- **Settings UI** adds SMS notifications toggle; profile route accepts timezone
- **Metadata fixes** for \`lead_detected\`, \`call_analyzed\`, and \`buyer_updated\` so notification templates get the data they need

## Test plan
- [ ] Run migration \`00005_create_notifications.sql\` against Supabase
- [ ] Set \`TWILIO_ACCOUNT_SID\`, \`TWILIO_AUTH_TOKEN\`, \`TWILIO_FROM_NUMBER\` env vars
- [ ] Buyer favorites a property → agent receives SMS + email within 30s
- [ ] Buyer submits intake form → agent gets email with budget/beds/areas summary
- [ ] New lead from email scan → agent gets SMS with name/budget/area
- [ ] Agent disables SMS in settings → no SMS sent, only email
- [ ] 5 dashboard views in 10 min → 1 batched notification, not 5
- [ ] Quiet hours (9pm–8am) → SMS queued, sent at 8am; email sent immediately
- [ ] \`GET /api/notifications/history\` returns notification log for authenticated agent
- [ ] \`GET /api/notifications/check-deadlines\` finds deals with deadlines within 48h

🤖 Generated with [Claude Code](https://claude.com/claude-code)`
});

const options = {
  hostname: 'api.github.com',
  path: '/repos/andyjphu/homeagent/pulls',
  method: 'POST',
  headers: {
    'Authorization': 'token ' + token,
    'Content-Type': 'application/json',
    'User-Agent': 'FoyerFind-CI',
    'Accept': 'application/vnd.github.v3+json',
    'Content-Length': Buffer.byteLength(body)
  }
};

const req = https.request(options, (res) => {
  let data = '';
  res.on('data', (chunk) => data += chunk);
  res.on('end', () => {
    try {
      const parsed = JSON.parse(data);
      if (parsed.html_url) {
        console.log(parsed.html_url);
      } else {
        console.log('Error:', parsed.message || JSON.stringify(parsed.errors));
      }
    } catch {
      console.log('Raw response:', data.substring(0, 500));
    }
  });
});
req.on('error', (e) => console.log('Error:', e.message));
req.write(body);
req.end();
