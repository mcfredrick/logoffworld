# Log Off — CLAUDE.md

## Project Overview

**Log Off** (`logoff.world`) is a minimalist daily check-in app. One prompt per day, two vote options (Connection / Rebel), no accounts, no algorithms. Data resets at midnight UTC.

## Tech Stack

- **Frontend**: Vanilla HTML/CSS/JS — no frameworks, no build step
- **Hosting**: Cloudflare Pages (`public/` is the web root)
- **API**: Cloudflare Pages Functions (`/functions/api/`)
- **Database**: Upstash Redis (ephemeral, 24h TTL keys)
- **Content generation**: Python + OpenRouter (`/scripts/generate_content.py`), runs via GitHub Actions cron
- **Analytics**: Plausible (self-hosted at `traffic.dayjob.dev`)

## File Structure

```
public/
  index.html          # Only HTML page — the full app
  css/style.css       # Single stylesheet with CSS custom properties
  js/main.js          # Vote logic, UI updates, share flow
  js/pulse.js         # Polls /api/stats every 5s for live counters
  data/               # JSON: daily prompts, vote phrases, charity info
  assets/             # OG image, favicon, PWA icons
  manifest.json       # PWA manifest
  sw.js               # Service worker (offline resilience)

functions/api/
  vote.js             # POST /api/vote — records vote, rate-limits 10/min/IP
  stats.js            # GET /api/stats — returns { connection, rebel, total }

scripts/
  generate_content.py # Generates daily prompts via OpenRouter LLM
```

## CSS Architecture

Single file (`public/css/style.css`) with CSS custom properties in `:root`. No preprocessor, no modules.

### Design Tokens

```css
--bg              /* body background */
--surface         /* card/panel background */
--border          /* border color */
--text-primary    /* headings, body */
--text-secondary  /* subtitles, counters */
--text-muted      /* labels, footnotes */
--connection      /* "Connection" vote accent (blue) */
--connection-bg   /* button bg for connection */
--connection-hover
--rebel           /* "Rebel" vote accent (gold/amber) */
--rebel-bg        /* button bg for rebel */
--rebel-hover
--btn-disabled-bg / --btn-disabled-text
--radius / --radius-sm
--space-xs/sm/md/lg/xl  /* 8px base unit scale */
```

### Key Classes

- `.card` — main centered panel (max-width 560px)
- `.btn`, `.btn-connection`, `.btn-rebel` — vote buttons
- `.counter-*` — live participation display
- `.brag-card` — share card shown after voting
- `.share-*` — share dropdown UI
- `@keyframes floatUp` — emoji animation on vote

## Local Dev

```bash
npx wrangler pages dev public --compatibility-date=2024-09-23
```

Requires `.dev.vars` with Upstash Redis credentials (`UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`).

## Workflow Standards

- No build step — edits to `public/` are live immediately on deploy
- Deploy via `git push` to `main` → Cloudflare Pages auto-deploys
- CSS changes: edit `public/css/style.css` only — all theming is centralized there
- JS changes: `main.js` owns vote flow + UI; `pulse.js` owns polling — keep them separate

## Theme

The site uses a **blue sky / solar flare** aesthetic: a layered CSS gradient background (light cyan-blue sky with a warm sun in the upper-right corner and lens-flare effects), frosted glass card, dark navy text. The Connection accent is sky blue; the Rebel accent is warm amber matching the solar flare.
