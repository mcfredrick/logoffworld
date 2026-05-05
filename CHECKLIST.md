# Pre-Launch Checklist

Manual tasks required before driving real traffic.

---

- [ ] Register `peopleover.tech` via Cloudflare Registrar and point to the Pages project
- [ ] Create Stripe Payment Link (one-time donation) and replace `https://buy.stripe.com/placeholder` in `public/index.html`
- [ ] Set up Liberapay (recurring donations) and add link alongside Stripe in the footer `<nav>` in `public/index.html`
- [ ] Create Tally form ("Suggest a prompt") and replace `https://tally.so/r/placeholder` in `public/index.html`
- [ ] Once domain is live: add `data-domain="peopleover.tech"` to the Plausible `<script>` tag in `public/index.html`
- [ ] Replace the programmatic OG image with a designed version at `public/assets/og-image.png` (1200×630 PNG)
