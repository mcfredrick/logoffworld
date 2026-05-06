# Log Off — Daily Census MVP: Implementation Plan
Version: 1.1 | Date: 2026-05-04

---

## Architecture Decisions

| Concern | Decision | Rationale |
|---|---|---|
| Hosting | **Cloudflare Pages** (static frontend) | You already have a Cloudflare account. Free tier, global CDN, no config overhead. Deploy URL: `logoff-world.pages.dev` until custom domain. |
| API | **Cloudflare Workers** (co-located with Pages) | Edge functions, same Cloudflare project, no CORS config needed. Uses Web standard `Request`/`Response` APIs. |
| Stats caching | `Cache-Control: public, max-age=3, s-maxage=3` on `/api/stats` | Cloudflare CDN serves cached stats to concurrent pollers — 1000 users polling every 5s costs ~1–2 Worker invocations per cache window instead of 1000. Keeps costs near-free at scale. |
| Database | Upstash Redis (REST API, free tier) | Atomic counters, 24h TTL, works in serverless with no persistent connection |
| Real-time | **Polling (5s)** behind `PulseClient` abstraction | Simplest possible; delivers live pulse with ~5s lag. Upgrade path: Cloudflare Durable Objects (native WS, no extra dependency) or Supabase Realtime — swap by passing `wsUrl` to `PulseClient`. |
| Content generation | Python + OpenRouter free tier (adapted from `autonomous-blog-template`) | Reuses your existing patterns: `model_selector.py`, dedup via `used_*.json` rolling window |
| Analytics | Plausible at `traffic.dayjob.dev` | Already set up on your Cloudflare tunnel |

---

## Project Structure

```
logoff-world/
  public/
    index.html
    css/
      style.css
    js/
      main.js          ← init, state, vote action
      pulse.js         ← PulseClient abstraction + animation
    data/
      prompts.json     ← [{text, date_added}]
      phrases.json     ← {connection: [...], rebel: [...]}
      charity.json     ← {name, url, month}
  api/
    vote.js            ← POST /api/vote
    stats.js           ← GET /api/stats
  scripts/
    generate_content.py
    model_selector.py  ← adapted from autonomous-blog-template
    used_prompts.json  ← dedup tracking (rolling 90-day window)
    used_phrases.json  ← dedup tracking
  .github/
    workflows/
      daily-content.yml
  wrangler.toml
```

---

## Build Tasks (Subagent Sequence)

Tasks are ordered by dependency. Tasks 2, 3, and 4 can run in parallel after Task 1.
Tasks 5 and 6 can run in parallel. Task 7 depends on Task 2. Task 8 is final.

---

### Task 1: Repo Scaffold + Deployment Config
**Deliverables:** `wrangler.toml`, `functions/api/vote.js`, `functions/api/stats.js` (stubs), skeleton `public/index.html`, `.gitignore`, `README.md`

- `wrangler.toml`: Cloudflare Pages config — `pages_build_output_dir = "public"`, Workers routes for `/api/*`
- `public/index.html`: semantic HTML shell (no content yet — just structure, meta tags, script/link references)
- `.gitignore`: node_modules, `.wrangler`, `__pycache__`, `*.pyc`, `.dev.vars`
- `README.md`: setup instructions (env vars needed, how to run `wrangler pages dev public` locally)

**Env vars required (must be set in Cloudflare dashboard before Task 4 tests pass):**
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`

**Local dev:** secrets go in `.dev.vars` (same key=value format as `.env`, loaded automatically by `wrangler`)

---

### Task 2: Frontend UI
**Deliverables:** `public/index.html` (complete), `public/css/style.css`, `public/js/main.js`

**HTML structure:**
- Single centered card: daily prompt text, two vote buttons, ghost counter display
- Prompt submission link (modal or separate section)
- Footer: charity info, Plausible disclosure, donation link placeholder

**CSS (`style.css`):**
- Mobile-first, single breakpoint at 768px
- CSS custom properties for theming (colors, spacing)
- `@keyframes floatUp` per spec (reused by `pulse.js`)
- `.floating-pulse` class per spec
- Vote buttons: min 44px height, high contrast, disabled state style
- Counter: large typography, CSS transition on number change

**JS (`main.js`):**
- On load: read today's prompt from `data/prompts.json` (by date index or random), read phrases from `data/phrases.json`
- LocalStorage check: `pot_has_voted_YYYY-MM-DD` → if set, disable buttons + show "You voted today"
- Vote handler: POST `/api/vote` → on success: set localStorage, disable buttons, trigger `PulseClient.triggerLocal(type)`
- Stats display: update connection/rebel counters from API response
- Plausible custom event: `plausible('vote_cast', {props: {choice}})` on successful vote

---

### Task 3: PulseClient (Live Pulse)
**Deliverable:** `public/js/pulse.js`

```js
class PulseClient {
  constructor({ pollUrl, wsUrl = null, interval = 5000 }) { ... }
  start(onPulse) { ... }   // onPulse({type, prevCount, newCount})
  stop() { ... }
  triggerLocal(type) { ... }  // immediate local animation on own vote
}
```

**Phase 1 (polling):**
- Polls `pollUrl` every `interval` ms
- Compares connection + rebel counts to last known values
- Calls `onPulse` for each detected delta

**Phase 2 hook (WebSocket):**
- If `wsUrl` provided, connects WebSocket and listens for `pulse` events instead of polling
- Falls back to polling if WS connection fails

**Animation (triggered by `onPulse` and `triggerLocal`):**
- Create `div.floating-pulse`, set emoji (`☁️` or `🥁`), random left 10–90%
- Append to body, remove after 2.5s
- Counter update: animate number transition via CSS class toggle

**Throttling:** if >5 pulses queued within 1s, collapse into a single "wave" effect (scale pulse emoji larger, skip individual floats)

---

### Task 4: API Functions
**Deliverables:** `api/vote.js`, `api/stats.js`

**`POST /api/vote`:**
- Input validation: `choice` must be `'connection'` or `'rebel'`
- Rate limit: Upstash INCR `ratelimit:{IP}:{minute}`, TTL 60s, reject if >10
- Increment: `INCR vote:{YYYY-MM-DD}:{choice}`, set TTL to end of UTC day
- Response: `{success: true, connection: int, rebel: int, total: int}`
- CORS: allow `*.pages.dev` + `logoff.world`

**`GET /api/stats`:**
- GET `vote:{date}:connection` and `vote:{date}:rebel` (pipeline/MGET)
- Response: `{connection: int, rebel: int, total: int}`
- **Caching:** return header `Cache-Control: public, max-age=3, s-maxage=3` — Cloudflare CDN caches and serves this to all concurrent pollers, collapsing N polling clients into ~1 upstream Redis read per 3 seconds
- CORS: same as above

**Note on Workers API style:** Cloudflare Workers use the Web standard `Request`/`Response` APIs (not Node.js `req`/`res`). Export a `fetch` handler: `export default { async fetch(request, env) { ... } }`

**Note on IP rate limiting vs privacy:** IP is used only as a transient rate-limit key (1-min TTL in Redis), never logged or stored persistently. Satisfies the "no PII stored" constraint.

---

### Task 5: Content Data Files
**Deliverables:** `public/data/prompts.json`, `public/data/phrases.json`, `public/data/charity.json`

Hand-crafted seed content (10+ entries each) aligned with brand voice (actionable, positive, nature/human-focused, non-political):

**`prompts.json`** format: `[{id, text, date_added}]`
- Example: `"Go outside and consider a cloud."`, `"Call someone you haven't spoken to in a year."`

**`phrases.json`** format: `{connection: [{id, text}], rebel: [{id, text}]}`
- Connection: empathy, nature, bonds — `"I found my sky today"`, `"I listened to the wind"`
- Rebel: autonomy, individuality — `"I marched to my own drum"`, `"I chose a different quiet"`

**`charity.json`**: `{name, tagline, url, month, logo_url}`

---

### Task 6: Content Generator
**Deliverables:** `scripts/generate_content.py`, `scripts/model_selector.py`, `.github/workflows/daily-content.yml`

**`model_selector.py`** — directly adapted from `autonomous-blog-template`:
- Queries OpenRouter `/models` for free-tier models
- Returns best available (prefer: `mistralai/mistral-7b-instruct:free` or similar)
- Falls back gracefully if preferred models unavailable

**`generate_content.py`:**
1. Load `used_prompts.json` + `used_phrases.json` (rolling 90-day dedup window)
2. Generate 5 new prompts via LLM:
   - System prompt enforces brand voice: "1 sentence, actionable, observational, nature or human connection focus, non-political, non-toxic, no streaks or scores"
   - Reject if text similarity >70% to any entry in rolling window (difflib ratio)
3. Generate 5 new connection phrases + 5 rebel phrases via LLM with brand-specific prompts
4. Validate: min 3 words, max 12 words, no profanity filter wordlist
5. Append new entries to respective JSON files
6. Update `used_*.json` with today's generated content, prune entries older than 90 days
7. Exit with code 1 (no commit) if fewer than 2 valid new items generated for any category

**`daily-content.yml`:**
- Trigger: `schedule: cron('0 0 * * *')` (midnight UTC) + `workflow_dispatch`
- Steps: checkout → setup Python → install deps → run `generate_content.py` → commit + push if files changed

---

### Task 7: Plausible Analytics Integration
**Deliverable:** updates to `public/index.html`, `public/js/main.js`

- Add to `<head>`: `<script defer data-domain="logoff-world.pages.dev" src="https://traffic.dayjob.dev/js/script.js"></script>`
- Fire custom event in `main.js` on successful vote: `window.plausible?.('vote_cast', {props: {choice}})`
- Footer copy: "We use Plausible Analytics. No cookies. No tracking." with link to Plausible's about page

---

### Task 8: Integration Smoke Tests
**Deliverable:** `tests/smoke.py` (or simple manual test checklist in `README.md`)

Verifiable with `wrangler pages dev public` (local) before deploying:

1. Vote increments both connection and rebel counters correctly
2. Second vote from same browser blocked by localStorage (buttons disabled)
3. `/api/stats` returns correct counts after votes
4. Rate limiter blocks >10 requests/min from same IP
5. PulseClient fires animation when stats delta detected (open two tabs, vote in one)
6. `generate_content.py` runs without API key and fails gracefully (mock mode or error message)
7. Plausible `vote_cast` event visible in `traffic.dayjob.dev` dashboard after vote

---

## Manual Checklist (You Must Do)

### Before any coding starts
- [ ] GitHub repo already created: `mcfredrick/logoff-world`
- [ ] In your Cloudflare dashboard → Workers & Pages → Create → Pages → Connect to Git → select `mcfredrick/logoff-world`
  - Build output directory: `public` (no build command needed — static files)
  - Note the assigned URL: `logoff-world.pages.dev`
- [ ] Install Wrangler locally: `npm install -g wrangler` then `wrangler login`

### Before Task 4 can be tested end-to-end
- [ ] Create Upstash account at upstash.com → "Create Database" (free tier, Global region)
  - Copy `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`
- [ ] Add both to Cloudflare: Workers & Pages → `logoff-world` project → Settings → Environment Variables
- [ ] Create `.dev.vars` in repo root for local testing (gitignored): `UPSTASH_REDIS_REST_URL=...` and `UPSTASH_REDIS_REST_TOKEN=...`

### Before Task 6 can run
- [ ] Get OpenRouter API key at openrouter.ai (free, no credit card required)
- [ ] Add `OPENROUTER_API_KEY` to GitHub repo: Settings → Secrets and variables → Actions → New secret

### Before Task 7 can be verified
- [ ] Add `logoff-world.pages.dev` as a new site in your Plausible instance at `traffic.dayjob.dev`

### After PoC is working — launch prep
- [ ] Register `logoff.world` via Cloudflare Registrar (you already have the account — cheapest option, includes proxy + DDoS protection)
- [ ] Add custom domain in Cloudflare: Workers & Pages → `logoff-world` → Custom domains → SSL auto-provisioned
- [ ] Update Plausible site domain from `logoff-world.pages.dev` to `logoff.world`
- [ ] Select Month 1 charity and populate `public/data/charity.json`
- [ ] Generate first full batch of 50+ prompts and phrases (run `generate_content.py` manually a few times)
- [ ] Create Ko-fi page and set up membership tier for recurring support

### Phase 2: Audio Pipeline (separate sprint — do not block PoC)
- [ ] Create ElevenLabs account → select warm voice → copy API key
- [ ] Create Cloudflare R2 bucket (or AWS S3) → copy credentials
- [ ] Source royalty-free ambient soundscape tracks (freesound.org or similar)
- [ ] Add all secrets to GitHub Actions

---

## Upgrade Path Notes (clean abstractions)

| Component | Phase 1 | Upgrade trigger | Phase 2 target |
|---|---|---|---|
| Real-time | Polling (5s) + CDN cache | UX feels laggy or >1k concurrent users | Cloudflare Durable Objects (native WS, no new dependency) or Supabase Realtime — pass `wsUrl` to `PulseClient` |
| Content | OpenRouter free tier | Quality degrades or rate limits | OpenRouter paid tier or direct Anthropic API |
| Hosting | Cloudflare free | 100k Worker req/day free limit hit | Cloudflare Workers Paid — $5/month flat, 10M req/month included |
| Domain | `*.pages.dev` | PoC validated | `logoff.world` on Cloudflare (same account, 2-click setup) |
