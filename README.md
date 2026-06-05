# Go!Gosling — Marketing Website

The official pre-launch promotional site for **Go!Gosling** — the assistant that turns what you say
into action on iPhone, with your Apple Health data kept on device (v1: Chat + Health).

> **Status:** Pre-launch. The release date is to be announced. The primary call to
> action is a **waitlist email capture**, not an App Store link (see
> [Launch-day checklist](#launch-day-checklist)).

---

## Design direction

A clean, light, mainstream app-launch page — **not** cyberpunk. The direction was
set by researching the conventions of leading AI-assistant sites (Tencent **Yuanbao**,
ByteDance **Doubao**, **Kimi**, Tencent **Marvis**) and company-grade global product
pages (Apple, Claude, Signal, Proton, DuckDuckGo). The shared playbook:

- **Light, white-led canvas with one calm brand accent.** Go!Gosling's accent is the
  indigo→violet of the app icon (`#6C5CE9 → #8944ED`), used only for the logo, the
  primary CTA, and a soft hero glow. Everything else is the app's real neutral system.
- **Privacy framed as a promise** — the "your health stays on your iPhone" line and the
  "What Go!Gosling does not do" list.
- **Company-grade scaffolding** — structured nav, a fat 4-column footer, a locked
  design-token system, legal pages, SEO/Open Graph/manifest, JSON-LD.

The visual tokens **mirror the app's frozen `Contracts/Design/design-system-v1.md`**
so the site and the product never drift. See `assets/css/tokens.css`.

---

## Architecture

Zero-build static site — semantic HTML + a layered CSS token system + a little
vanilla JS. Deployable to any static host with no toolchain.

**Languages:** English, French (fr-CA), and Simplified Chinese — toggle in the shared header (`EN` / `FR` / `中`). French strings live in `assets/js/i18n-fr.js`; load order is `chrome.js` → `i18n-fr.js` → `i18n.js` → `main.js`.

**Shared chrome:** `assets/js/chrome.js` injects one corporate header + footer into `#site-header` / `#site-footer` on every page (see `docs/site-architecture.md`).

```
Website/
├── index.html              # Home — hero, explore grid, waitlist
├── meet.html, features.html, how.html, privacy.html, canada.html, faq.html
├── about.html, careers.html
├── privacy-policy.html, terms.html   # Legal (counsel review before launch)
├── sitemap.xml
└── assets/js/chrome.js, i18n.js, i18n-fr.js, main.js, …
```

See [Site map (multi-page)](#site-map-multi-page) below for URLs.

### Trilingual (EN / FR / 中文)

English ships as the crawlable default text in the HTML; `i18n.js` swaps to the
defaults to **English** on first visit; the visitor’s explicit choice is remembered (`localStorage` key `gosling-lang`). It also
respects the browser language on first visit. Translate by editing the `I18N` table —
keys are referenced from markup via:

- `data-i18n="key"` → sets `textContent`
- `data-i18n-html="key"` → sets `innerHTML`
- `data-i18n-attr="placeholder:key;aria-label:key"` → sets attributes

### Accessibility & performance

Semantic landmarks, skip link, `:focus-visible` rings, `aria-expanded` accordion,
labelled form fields, and a full `prefers-reduced-motion` path (reveal animations and
device tilt are disabled). No web fonts (system font stack), no frameworks, no trackers.

---

## Run locally

It's static — open `index.html`, or serve the folder:

```bash
cd Website
python3 -m http.server 8080
# → http://localhost:8080
```

## Deploy

Drop the `Website/` folder on any static host — **Vercel, Netlify, Cloudflare Pages,
or GitHub Pages**. No build step. Point the apex domain (e.g. `gogosling.ca`) at it over
HTTPS and update the absolute URLs in `index.html` (`<link rel="canonical">`, the
Open Graph `og:url` / `og:image`) to the real domain.

---

## Wiring the waitlist

`main.js` validates the email, shows success UI, and always keeps a local backup in
`localStorage` (`gosling-waitlist`).

When your endpoint is ready, set this **before** `main.js` on `index.html` (and any
page with a waitlist form):

```html
<script>window.GOSLING_WAITLIST_API = "https://api.gogosling.ca/api/waitlist";</script>
```

It POSTs JSON: `{ "email", "source": "website", "locale": "en"|"fr"|"zh" }`.
If the request fails, the user sees `form.sendError` and can retry.

**Careers** uses the same pattern: `window.GOSLING_CAREERS_API` (see `docs/careers-system.md`).

## Site map (multi-page)

| Page | URL |
|------|-----|
| Home (hero + explore) | `/` |
| Meet Gosli | `/meet.html` |
| Features + roadmap | `/features.html` |
| How it works | `/how.html` |
| Privacy promise (marketing) | `/privacy.html` |
| Built in Canada | `/canada.html` |
| FAQ | `/faq.html` |
| About | `/about.html` |
| Careers | `/careers.html` |
| Privacy Policy (legal) | `/privacy-policy.html` |
| Terms (legal) | `/terms.html` |

`assets/js/chrome.js` owns nav/footer links. `sitemap.xml` lists all public URLs.

---

## Launch-day checklist

The site is intentionally pre-launch-correct. When Go!Gosling ships:

- [ ] **Swap the CTA to the App Store.** Replace the custom "Coming soon" store
      badge (`.store-badge` in `index.html`) with the **official black "Download on
      the App Store" badge** from Apple's Marketing Tools
      (`toolbox.marketingtools.apple.com/app-store/`). Keep it ≥40px tall with
      ¼-height clear space, unmodified. *(Apple forbids a recolored/disabled badge,
      which is why the pre-launch CTA is a custom button, not a greyed-out Apple badge.)*
- [ ] Point the badge/links at the real App Store URL; optionally add a QR code that
      opens the listing (the layout leaves room for one in the hero store row).
- [ ] Update copy: "Coming soon" → live; remove the `Soon` tag; adjust the hero badge.
- [ ] Set the real domain in `canonical` / `og:url` / `og:image` / JSON-LD.
- [ ] Replace the **template** Privacy Policy and Terms with counsel-reviewed copy.
- [ ] Fill the footer Company/Connect links (About, Blog, Careers, social).
- [ ] Add analytics **only if** it stays consistent with the privacy promise on the page.

---

## Content sources of truth

Marketing copy is grounded in the app's shipped strings and contracts, not invented:

- Tagline / on-device claims → `Gosling/Features/Onboarding/...`, `Gosling/Shared/GoslingLegalCopy.swift`
- Health disclaimer (App Store 1.4.1) → `GoslingLegalCopy.healthDisclaimer`
- Privacy posture → `Gosling/PrivacyInfo.xcprivacy`, `Gosling/Core/Privacy/PrivacyGuardPolicy.md`, `Docs/submission/privacy-policy-v1.md`
- Shipped vs. coming-soon surfaces → `Gosling/Shared/Utilities/FeatureFlag.swift` (v1 = Chat + Health)
- Visual tokens → `Contracts/Design/design-system-v1.md`
