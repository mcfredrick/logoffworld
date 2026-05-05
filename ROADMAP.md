# People Over Tech — Feature Roadmap

## Payments & Donations
- [ ] Stripe one-time donation — create Payment Link, wire up "Support the movement" button in footer
- [ ] Liberapay recurring donations — account setup, embed widget or link alongside Stripe
- [ ] 80/15/5 split transparency — static page showing how funds are allocated
- [ ] Transparency dashboard — running total of funds raised and donated per month (can start as a hand-updated static page)
- [ ] Donor "Patron" badge — Stripe webhook sets a flag; frontend shows badge to donors (requires some form of lightweight session or token)
- [ ] Monthly charity rotation — process for selecting and updating `charity.json` each month

## Prompt Submission & Moderation
- [ ] "Suggest a prompt" form — simple form on main page (name optional, prompt text, submit)
- [ ] Pending queue — submitted prompts stored (GitHub Issue, Airtable, or simple JSON commit to a `pending/` branch)
- [ ] Admin vetting interface — password-protected page to review, approve, or reject pending prompts
- [ ] Cloudflare Turnstile CAPTCHA on submission form (per spec)
- [ ] Auto-notify founder on new submission (email via Cloudflare Email Routing or similar)

## Sponsored Prompts
- [ ] Sponsored prompt format — spec what a sponsored prompt looks like vs organic (subtle label? separate phrase set?)
- [ ] Sponsor intake — how sponsors submit a prompt and what the approval process looks like
- [ ] Sponsored prompt slot in rotation — flag in `prompts.json` (e.g. `"sponsored": true, "sponsor": "Brand Name"`)
- [ ] Disclosure label in UI when a sponsored prompt is shown

## Content & Rotation
- [ ] Grow prompt library to 50+ entries (content generator runs daily — will accumulate; can also run manually)
- [ ] Grow phrase libraries to 50+ connection and rebel entries
- [ ] Human-submitted prompts mixed into rotation (post-vetting)
- [ ] Holiday/seasonal theming hook (the blog template has a `holidays.py` pattern worth porting)

## Social & Sharing
- [ ] Share button after voting — pre-filled tweet/post: "I just [phrase] — People Over Tech peopleover.tech"
- [ ] Open Graph tags — `og:title`, `og:description`, `og:image` for clean social previews
- [ ] Daily share image — generated card with today's prompt (could be a simple Cloudflare Worker using Canvas API or a static template)

## Audio Pipeline (Phase 2)
- [ ] ElevenLabs TTS integration — select warm voice, store API key in GitHub secrets
- [ ] Python audio script — fetch prompt → LLM reflection → TTS → ffmpeg mix with soundscape
- [ ] Cloudflare R2 bucket — store daily MP3s (`episode-YYYY-MM-DD.mp3`)
- [ ] RSS feed (`podcast.xml`) — auto-updated by GitHub Actions after each episode
- [ ] Web player — embedded on main page (HTML5 audio or lightweight JS player)
- [ ] Submit RSS to Apple Podcasts and Spotify
- [ ] Source royalty-free ambient soundscape tracks

## Domain & Infrastructure
- [ ] Register `peopleover.tech` via Cloudflare Registrar
- [ ] Add custom domain to Cloudflare Pages project
- [ ] Update Plausible site domain
- [ ] Update `HTTP-Referer` in content generator and Plausible `data-domain`

## Polish & Accessibility
- [ ] Favicon and app icon
- [ ] `manifest.json` for PWA installability
- [ ] `robots.txt` and `sitemap.xml`
- [ ] Dark/light mode toggle (CSS custom properties are already set up for it)
- [ ] Full keyboard navigation audit
- [ ] Screen reader test pass
