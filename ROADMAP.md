# People Over Tech — Roadmap

Prioritized by: launch readiness → viral/growth impact → charitable impact → effort.

---

## Phase 0 — Pre-Launch (Target: this week)
*Everything needed before driving real traffic. Nothing here should block the other.*

- [ ] Register `peopleover.tech` via Cloudflare Registrar + point to Pages
- [ ] Stripe one-time donation — create Payment Link, replace `https://buy.stripe.com/placeholder` in footer
- [ ] Liberapay recurring donations — link alongside Stripe in footer
- [ ] Fix "Suggest a prompt" — create Tally form, replace `https://tally.so/r/placeholder` in footer
- [ ] Update `data-domain="peopleover.tech"` in Plausible `<script>` tag once custom domain is live
- [x] Open Graph meta tags (`og:title`, `og:description`, `og:image`)
- [x] Static OG image — programmatic 1200×630 PNG at `public/assets/og-image.png` (replace with designed version before launch)
- [x] Favicon — `public/favicon.ico` (16px + 32px)
- [x] App icons (192px, 512px PNGs)
- [x] `manifest.json` + service worker → PWA installable to home screen
- [x] Share button + brag card — all platforms, Web Share API on mobile, dropdown on desktop
- [x] Daily generated share copy per prompt (anti-social-media angle)

---

## Phase 1 — Soft Launch (Week 2–3)
*Ship to personal network + relevant communities. Validate the loop before scaling.*

- [ ] Milestone reactions — at auspicious counts (100, 500, 1000...) show a special animation + shareable moment ("You were the 1,000th human to pause today")
- [ ] Holiday themes — detect date, swap prompt/phrase color palette and emoji for major holidays (template's `holidays.py` pattern is a direct port)
- [ ] Year-ahead charity list — publish the planned rotation publicly; gives charities advance notice and builds anticipation
- [ ] Charity outreach — email Month 1 charity (Crisis Text Line), tell them X people paused for them today, ask them to share with their audience
- [ ] Prompt submission form — Tally or Typeform embed (free tier) feeding into a simple review queue; no custom admin needed yet
- [ ] Encourage recurring donations — after one-time donation completes, Stripe redirect page links to Liberapay

---

## Phase 2 — Growth (Month 2)
*Once the viral loop is validated, invest in channels and content.*

- [ ] Sponsored prompts — define format (subtle "Supported by [Brand]" label), intake process, approval criteria (must be in spirit of app), `"sponsored": true` flag in `prompts.json`
- [ ] App-as-a-service for charities — same engine, charity-branded, same 80/20 split; use peopleovertech as the proof of concept in the pitch
- [ ] Transparency dashboard — static page updated monthly: funds raised, donated, charity impact (can be hand-updated to start)
- [ ] Patron badge — lightweight: Stripe webhook sets a signed cookie or short-lived token; badge shown in UI
- [ ] Admin vetting interface — simple password-protected page for reviewing submitted prompts once volume warrants it
- [ ] Podcast / media outreach — see MARKETING.md for target list
- [ ] Daily social bot — GitHub Actions cron posts each day's prompt + previous day's vote counts to Bluesky and X; requires API credentials as repo secrets; low effort, good ambient traffic

---

## Phase 3 — Scale (Month 3+)
*High-effort, high-reward features once there's an audience to justify them.*

- [ ] Daily Audio Pipeline — ElevenLabs TTS + ffmpeg soundscape mix + R2 storage + RSS feed + web player + Apple/Spotify submission
- [ ] Native home screen widget — requires a React Native or Swift/Kotlin shell; significant effort; revisit after PWA traction data
- [ ] Real Human Thoughts — sister site (realhumanthoughts.com), crowd-sourced philosophical insights
- [ ] Aggregate Discovery App — interest-stack content discovery with Horizon Breaker mechanic
- [ ] Bespoke social engagement apps — use peopleovertech as portfolio piece for white-label pitches

---

## Launch Timeline

| Date | Milestone |
|---|---|
| This week | Phase 0 complete — domain live, payments wired, PWA installable, share button working |
| Week 2 | First soft-launch posts (personal network, Hacker News, r/nosurf) |
| Week 3 | Charity outreach email sent; milestone reactions live |
| Month 2 | Sponsored prompt pilot; transparency dashboard; media outreach begins |
| Month 3+ | Audio pipeline; evaluate native widget based on PWA install data |
