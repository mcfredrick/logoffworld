# People Over Tech

A daily human check-in. One prompt. Two choices. No algorithms.

## Stack

- **Frontend**: Vanilla HTML/CSS/JS — Cloudflare Pages
- **API**: Cloudflare Pages Functions (`/functions`)
- **Database**: Upstash Redis (ephemeral, 24h TTL)
- **Content**: Python + OpenRouter (GitHub Actions daily cron)
- **Analytics**: Plausible (self-hosted)

## Local development

### Prerequisites

- Node.js 18+
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/): `npm install -g wrangler`
- Python 3.11+ (for content generation only)

### Setup

1. Clone the repo and create `.dev.vars` in the root:
   ```
   UPSTASH_REDIS_REST_URL=your_url_here
   UPSTASH_REDIS_REST_TOKEN=your_token_here
   ```

2. Start the local dev server:
   ```sh
   wrangler pages dev public --compatibility-date=2024-09-23
   ```
   The site runs at `http://localhost:8788`.

### Content generation

```sh
cd scripts
pip install -r requirements.txt
OPENROUTER_API_KEY=your_key python generate_content.py
```

## Deployment

Pushes to `main` auto-deploy via Cloudflare Pages CI.

## Environment variables

| Variable | Where to set | Used by |
|---|---|---|
| `UPSTASH_REDIS_REST_URL` | Cloudflare Pages → Settings → Variables | API functions |
| `UPSTASH_REDIS_REST_TOKEN` | Cloudflare Pages → Settings → Variables | API functions |
| `OPENROUTER_API_KEY` | GitHub → Settings → Secrets → Actions | Content generation |
