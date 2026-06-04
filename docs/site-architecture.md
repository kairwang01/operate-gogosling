# Go!Gosling Website — Site Architecture

> The Go!Gosling marketing site is a **zero-build static site** — semantic HTML, a layered CSS
> token system, and a little vanilla JavaScript. It deploys to any static host with no toolchain.
> This document describes the information architecture, the shared chrome component, the page map,
> the i18n approach, the design-token system, how to add a page, and the deploy story.
>
> **Current state:** multi-page marketing site with shared **`chrome.js`**, trilingual i18n
> (`i18n.js` + `i18n-fr.js`), slim **`index.html`**, and dedicated pages for product, privacy,
> Canada, FAQ, About, and Careers. Legal policy lives at **`privacy-policy.html`**; the marketing
> privacy promise is **`privacy.html`**.

---

## Table of contents

1. [Principles](#1-principles)
2. [Repository layout](#2-repository-layout)
3. [Shared chrome (`chrome.js`)](#3-shared-chrome-chromejs)
4. [Page map](#4-page-map)
5. [Internationalization (i18n)](#5-internationalization-i18n)
6. [Design-token system](#6-design-token-system)
7. [How to add a new page](#7-how-to-add-a-new-page)
8. [Accessibility](#8-accessibility)
9. [Performance](#9-performance)
10. [Deploy story](#10-deploy-story)

---

## 1. Principles

- **Zero build.** No bundler, no framework, no npm install to ship. Open `index.html` or serve the folder. This keeps the site deployable anywhere and trivial to reason about.
- **DRY chrome.** The header and footer are identical on every page, so they live in **one** JavaScript module (`chrome.js`) that injects into placeholders — edit nav/footer once, every page updates.
- **Content is grounded, not invented.** Marketing copy mirrors the app's shipped strings and contracts (see `README.md` → "Content sources of truth"). Visual tokens mirror the app's frozen `Contracts/Design/design-system-v1.md`.
- **Progressive enhancement.** Pages are fully readable with JS disabled; JS only adds behavior (nav state, scroll reveal, accordion, forms, language toggle). English ships as crawlable default text in the HTML.
- **Privacy-first.** No web fonts, no frameworks, no trackers, no analytics by default. System font stack only. **Cookie banner** (`assets/js/cookies.js`) records essential storage consent (`gosling-consent`); see `privacy-policy.html#cookies` and `docs/privacy-compliance-review.md`.

---

## 2. Repository layout

```
Website/
├── index.html              # Home (today: all marketing sections; → will slim to hero + highlights)
├── privacy.html            # ⚠️ being renamed → privacy-policy.html (legal)
├── terms.html              # Terms of Service (legal)
├── careers.html            # NEW — careers / open roles (see docs/careers-system.md)
├── about.html              # NEW — about / company
├── features.html           # (next step) split out of index.html
├── how.html                # (next step) "How it works"
├── privacy.html            # (next step) marketing privacy page (the promise/pillars)
├── faq.html                # (next step)
├── canada.html             # (next step) "Built in Canada / AI for All"
├── meet.html               # (next step) "Meet Gosli" state gallery
├── site.webmanifest        # PWA manifest
├── README.md
├── docs/
│   ├── careers-system.md   # Backend spec for the careers/hiring system
│   └── site-architecture.md# (this file)
├── data/
│   └── jobs.json           # NEW — offline fallback for careers (shape = GET /api/careers/jobs)
├── scripts/
│   └── render_og.swift     # OG-image render helper
└── assets/
    ├── css/
    │   ├── tokens.css      # Design tokens — mirrors app design-system-v1 + brand accent
    │   ├── base.css        # Reset, document defaults, type + layout primitives
    │   ├── components.css  # Nav, buttons, cards, forms, footer, iPhone mockup, accordion
    │   └── site.css        # Page-level section composition + responsive
    ├── js/
    │   ├── chrome.js       # NEW — injects shared header + footer into placeholders
    │   ├── i18n-fr.js      # French (fr-CA) locale — loaded before i18n.js
    │   ├── i18n.js         # Trilingual (EN / FR / 中文) string table + language toggle
    │   ├── main.js         # Nav state, scroll-reveal, FAQ accordion, waitlist form
    │   └── careers.js      # NEW — careers page: fetch jobs, render, apply-form POST
    ├── img/                # Icon set, favicons, apple-touch-icon, OG image
    └── anim/               # The animated "Gosli" state PNGs (idle/thinking/…)
```

> Lines marked **NEW** / **(next step)** are the in-progress and planned additions. Everything else exists today.

---

## 3. Shared chrome (`chrome.js`)

Every page must render the **same** sticky header (logo, primary nav, language toggle, "Notify me" CTA, mobile menu) and the **same** fat footer (4 link columns + legal + disclaimers + copyright). Duplicating that markup across 10 HTML files would guarantee drift. Instead, each page ships two empty placeholders and `chrome.js` injects the markup into them at load.

### The contract

Each HTML page includes, in `<body>`:

```html
<a class="skip-link" href="#main">Skip to content</a>

<div id="site-header"></div>   <!-- chrome.js injects the <header class="nav"> + mobile menu -->

<main id="main">
  <!-- page-specific content -->
</main>

<div id="site-footer"></div>   <!-- chrome.js injects the <footer class="site-footer"> -->
```

And, at the end of `<body>`, the scripts in this order:

```html
<script src="assets/js/chrome.js"></script>   <!-- inject header/footer FIRST -->
<script src="assets/js/i18n.js"></script>     <!-- then translate the injected DOM -->
<script src="assets/js/main.js"></script>     <!-- then wire nav/menu/forms behavior -->
<!-- careers.html additionally: <script src="assets/js/careers.js"></script> -->
```

### Why this order

`chrome.js` must inject the header/footer **before** `i18n.js` runs, so that `i18n.js`'s `applyLang()` (which queries `[data-i18n]` across the whole document on `DOMContentLoaded`) translates the injected nav/footer too. Likewise `main.js` queries `.nav`, `[data-menu-btn]`, `[data-mobile-menu]`, and footer `[data-year]` — those elements must already be in the DOM. All three scripts run synchronously in source order at end-of-body, so this holds.

### What `chrome.js` does

1. Builds the header HTML string (logo → `index.html`; nav links; `.lang-toggle` with `data-lang-set="en"|"zh"`; `.btn--ghost` "Notify me"; the `data-menu-btn` hamburger) and the mobile menu (`#mobile-menu` / `data-mobile-menu`).
2. Builds the footer HTML string (the four columns: Product / Company / Legal / Connect, the `data-i18n="foot.*"` links, the `data-year` span, and the AI + health disclaimers).
3. Injects them into `#site-header` and `#site-footer` (`innerHTML`).
4. Keeps the markup **identical to the current `index.html` nav/footer** — same classes (`.nav`, `.nav__inner`, `.logo`, `.nav__links`, `.nav__actions`, `.lang-toggle`, `.site-footer`), same `data-i18n` keys — so existing CSS (`components.css`) and behavior (`main.js`, `i18n.js`) apply unchanged.

> **Cross-page links:** because pages become separate documents, nav hrefs change from in-page anchors (`#features`) to page URLs (`features.html`). Where a page still has on-page sections (e.g. the home hero), keep the anchor. `chrome.js` is the single place that defines the nav link list, so updating navigation is a one-file edit.

### `chrome.js` skeleton

```js
/* assets/js/chrome.js — shared header/footer, zero deps, runs before i18n.js */
(function () {
  "use strict";

  // Single source of truth for primary navigation across all pages.
  const NAV = [
    { href: "features.html", key: "nav.features", en: "Features" },
    { href: "how.html",      key: "nav.how",      en: "How it works" },
    { href: "privacy.html",  key: "nav.privacy",  en: "Privacy" },
    { href: "canada.html",   key: "nav.canada",   en: "Canada" },
    { href: "faq.html",      key: "nav.faq",      en: "FAQ" },
    { href: "careers.html",  key: "foot.careers", en: "Careers" },
  ];

  const links = NAV.map(n =>
    `<a href="${n.href}" data-i18n="${n.key}">${n.en}</a>`).join("");

  const header = `
    <header class="nav" id="top">
      <div class="container nav__inner">
        <a class="logo" href="index.html" aria-label="Go!Gosling home">
          <span class="logo__mark" aria-hidden="true">
            <img src="assets/img/icon-192.png" alt="" width="32" height="32" />
          </span>
          <span class="logo__word">Go!Gosling</span>
        </a>
        <nav class="nav__links" aria-label="Primary">${links}</nav>
        <div class="nav__actions">
          <div class="lang-toggle" role="group" aria-label="Language">
            <button type="button" data-lang-set="en" aria-pressed="true">EN</button>
            <button type="button" data-lang-set="zh" aria-pressed="false">中</button>
          </div>
          <a href="index.html#notify" class="btn btn--ghost" data-i18n="nav.notify">Notify me</a>
          <button class="nav__menu-btn" type="button" data-menu-btn aria-expanded="false"
                  aria-controls="mobile-menu" data-i18n-attr="aria-label:nav.menu" aria-label="Open menu">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"
                 stroke-linecap="round"><path d="M3 6h18M3 12h18M3 18h18"/></svg>
          </button>
        </div>
      </div>
    </header>
    <div class="mobile-menu" id="mobile-menu" data-mobile-menu>
      ${links}
      <a href="index.html#notify" data-i18n="nav.notify">Notify me</a>
    </div>`;

  const footer = `
    <footer class="site-footer">
      <!-- four columns: Product / Company / Legal / Connect, all data-i18n="foot.*"
           plus <span data-year></span> and the AI + health disclaimers.
           Keep markup identical to the current index.html footer so components.css applies. -->
    </footer>`;

  const h = document.getElementById("site-header");
  const f = document.getElementById("site-footer");
  if (h) h.innerHTML = header;
  if (f) f.innerHTML = footer;
})();
```

> The footer body is elided here for brevity — copy it verbatim from the current `index.html` `<footer class="site-footer">…</footer>` block so the `foot.*` i18n keys and column structure match exactly.

---

## 4. Page map

| Path | Purpose | i18n key prefixes | Notes |
|------|---------|-------------------|-------|
| `index.html` | **Home** — hero, "say it, it's handled", primary CTA | `meta.*`, `hero.*`, `cta.*` | Today holds all sections; will slim to hero + section highlights once others split out. |
| `features.html` | What Go!Gosling can do (capabilities, roadmap) | `feat.*`, `cap.*`, `road.*` | Split from `index.html`. |
| `how.html` | "How it works" — three steps | `how.*` | Split from `index.html`. |
| `privacy.html` | **Marketing** privacy page — the promise, pillars, "what it does not do" | `priv.*`, `spot.*` | Marketing, not legal. **Renamed from the old legal file** (see below). |
| `privacy-policy.html` | **Legal** privacy policy | `pp.*` | **Renamed from the former `privacy.html`** to free that slug for the marketing page. |
| `terms.html` | Legal Terms of Service | `tos.*` | Exists today. |
| `canada.html` | "Built in Canada / AI for All" | `ca.*` | Split from `index.html`. |
| `faq.html` | FAQ accordion | `faq.*` | Split from `index.html`; uses `main.js` accordion. |
| `meet.html` | "Meet Gosli" — animated state gallery | `gal.*` | Uses `assets/anim/*` PNGs. |
| `careers.html` | **Careers** — open roles + apply form | `foot.careers`, `careers.*` | **NEW.** Reads jobs via `careers.js` (live API or `data/jobs.json` fallback). See `docs/careers-system.md`. |
| `about.html` | **About / company** | `about.*` | **NEW.** |

> **Naming gotcha — the privacy split:** there are *two* privacy pages with deliberately distinct roles. The **marketing** page keeps the friendly `privacy.html` slug (the brand "your health stays on your iPhone" promise). The **legal policy** moves to `privacy-policy.html`. Update every reference (footer `foot.privacy` → `privacy.html`, `foot.privacyPolicy` → `privacy-policy.html`, and any `<link rel="canonical">`/sitemap entries) when the rename lands.

Legal pages (`privacy-policy.html`, `terms.html`) use a simpler "legal" layout (a centered prose column with `legal.back` / `legal.updated`) rather than the full marketing chrome sections, but they still use the **same** `chrome.js` header/footer and `i18n.js`.

---

## 5. Internationalization (i18n)

The site is **trilingual (EN / FR / 中文)** via `assets/js/i18n.js` plus `assets/js/i18n-fr.js`.

### How it works (as implemented)

- English ships as the **crawlable default text** in the HTML. `i18n.js` holds an `I18N` table (`{ en: {...}, zh: {...} }`) and swaps text to the selected language on load.
- **Language detection / persistence:** the choice is stored in `localStorage` under the key **`gosling-lang`**; on first visit it respects the browser language (`zh*` → Chinese, `fr*` → French, else English). `SUPPORTED = ["en", "fr", "zh"]`.
- **Applying translations** — three attribute hooks, all resolved by `applyLang()`:

  | Attribute | Effect |
  |-----------|--------|
  | `data-i18n="key"` | sets `textContent` |
  | `data-i18n-html="key"` | sets `innerHTML` (use sparingly; for markup like emphasized spans) |
  | `data-i18n-attr="placeholder:key;aria-label:key"` | sets one or more attributes |

- `applyLang(lang)` also sets `document.documentElement.lang` (`en`, `fr`, or `zh-Hans`), updates each `[data-lang-set]` toggle's `aria-pressed`, persists the choice, and dispatches a **`gosling:langchange`** `CustomEvent`. `main.js` listens for that event to recompute the FAQ accordion's open-panel height after the text length changes.
- Public mini-API: `window.GoslingI18n = { apply, t, current }`. `main.js`'s form code uses `GoslingI18n.t("form.success", lang)` to localize dynamically-inserted strings.

### Keys

Keys are **dot-namespaced by section** (`hero.*`, `priv.*`, `faq.*`, `foot.*`, `pp.*`, `tos.*`, …). When a page splits out of `index.html`, its keys move with it conceptually but stay in the single shared `I18N` table (one table serves all pages). Missing keys fall back to English, then to the raw key string.

### French locale file

- **`assets/js/i18n-fr.js`** defines `window.GOSLING_I18N_FR` (professional **fr-CA** copy). Load it **before** `i18n.js` on every page.
- `i18n.js` merges it as `I18N.fr`. Missing keys fall back to English.

### Primary navigation pattern (corporate)

- **Header:** ≤6 items — Features, Privacy, How it works, FAQ, About, Careers (`chrome.js` `NAV` array).
- **Footer:** deeper IA — Gosli (#meet), Built in Canada (#canada), legal links, contact.
- **Legal pages:** set `window.GOSLING_CHROME_MINIMAL = true` before `chrome.js` for a compact header (full footer + EN/FR/中 still available).

---

## 6. Design-token system

All visual styling derives from CSS custom properties in **`assets/css/tokens.css`**, which **mirrors the app's frozen `Contracts/Design/design-system-v1.md`** so the marketing site and the product never drift apart. The other stylesheets consume only tokens — no hard-coded colors, type sizes, spacing, radii, shadows, or motion values.

### Layered CSS

| File | Responsibility |
|------|----------------|
| `tokens.css` | The single source of truth: `:root` custom properties (brand, surfaces, text, lines, section tints, type scale, spacing, radius, elevation, motion, layout). |
| `base.css` | Reset, document defaults, typographic + layout primitives. |
| `components.css` | Reusable components: nav, buttons, cards, forms, footer, iPhone mockup, accordion. |
| `site.css` | Page-level section composition + responsive breakpoints. |

Load order in every page's `<head>`: `tokens.css` → `base.css` → `components.css` → `site.css`.

### Token groups (excerpt)

```css
:root {
  /* Brand — calm soft-blue sampled from the App Icon backdrop (one restrained accent) */
  --brand: #5B93F2;  --brand-ink: #2F5DB0;  --brand-gradient: linear-gradient(135deg,#5B93F2,#6AA0F5);

  /* Neutral surfaces (light canvas) */
  --bg-start:#FFFFFF; --bg-end:#F5F7FB; --surface:#FFFFFF; --surface-strong:#161A22;

  /* Text */
  --text-primary:#1C1F21; --text-secondary:#57595E; --text-muted:#82858A; --text-on-strong:#FFFFFF;

  /* Section identity tints (from AppTheme.tint(for:)) */
  --tint-chat:#1A1C21; --tint-health:#4F6E61; --tint-ai:#61738A; --tint-maps:#91754A; --tint-store:#595E69;

  /* Typography — system stack (≈ San Francisco), fluid clamp() scale */
  --font-sans: -apple-system, BlinkMacSystemFont, "SF Pro Text", … "PingFang SC", …;
  --fs-display: clamp(2.6rem, 1.7rem + 4.4vw, 4.6rem);  --fs-body:1.0625rem; /* 17px iOS body */

  /* Spacing (4px base), container widths, radii, elevation, motion */
  --space-4:16px; --space-8:32px; --container:1140px; --section-y:clamp(80px,6vw+48px,152px);
  --radius-card:28px; --radius-pill:999px;
  --elev-floating:0 6px 14px rgba(22,26,34,.07),0 20px 44px rgba(22,26,34,.08);
  --dur-standard:0.24s; --ease-emphasized:cubic-bezier(0.22,1,0.36,1); --nav-h:64px;
}
@media (prefers-reduced-motion: reduce){ :root{ --dur-standard:.12s; --dur-reveal:.12s; } }
```

> **Rule:** new components reference tokens (`var(--brand)`, `var(--space-6)`, `var(--radius-card)`). If a needed value is missing, add a token — never inline a magic number. This is what keeps the site visually locked to `design-system-v1`.

---

## 7. How to add a new page

Adding a page is a copy-paste-template operation (zero build):

1. **Copy the template.** Duplicate `index.html` (or a slimmer page once they exist) to `your-page.html`. Keep the `<head>` block (meta, icons, OG, the four stylesheets in order, JSON-LD) and the body skeleton: `skip-link` → `<div id="site-header"></div>` → `<main id="main">` → `<div id="site-footer"></div>` → the four scripts in order (`chrome.js`, `i18n.js`, `main.js`).
2. **Write the page content** inside `<main id="main">`, using existing components (`.container`, cards, buttons) and **tokens only**. Tag every visible string with `data-i18n="section.key"` (and `data-i18n-attr` for attributes).
3. **Add the nav entry in `chrome.js`.** Add an item to the `NAV` array (`{ href, key, en }`). It appears in both the desktop nav and the mobile menu automatically, on every page.
4. **Add i18n keys.** For each new `data-i18n` key, add the string to **both** `en` and `zh` in `i18n.js`'s `I18N` table (and `fr` if added). Missing keys fall back to English.
5. **Set page meta.** Update `<title data-i18n="…">`, the `meta.desc`, `<link rel="canonical">`, and OG tags to the new page's URL.
6. **Test locally** (`python3 -m http.server 8080`): check the header/footer inject, the language toggle translates the new content, links work, and JS-disabled rendering is sensible.

---

## 8. Accessibility

Carried over from the current build and required on every new page:

- **Semantic landmarks** — `<header>`, `<nav aria-label="Primary">`, `<main id="main">`, `<footer>`; a **skip link** (`.skip-link` → `#main`) is the first focusable element.
- **Keyboard & focus** — visible `:focus-visible` rings; all interactive elements are real `<a>`/`<button>`; the mobile menu closes on `Escape`.
- **ARIA state** — the FAQ accordion uses `aria-expanded` / `aria-controls`; the language toggle uses `aria-pressed`; the hamburger uses `aria-expanded` + `aria-controls`.
- **Forms** — every field is labelled (`aria-label` via `data-i18n-attr`); invalid inputs get `aria-invalid="true"`; the careers apply form maps API field errors back to inputs and moves focus to the first invalid field.
- **Language** — `document.documentElement.lang` is updated on toggle so assistive tech and the browser know the content language.
- **Reduced motion** — a full `prefers-reduced-motion` path: scroll-reveal animations resolve immediately and the device tilt is disabled (`main.js`), and motion-duration tokens shrink (`tokens.css`).
- **Contrast** — text tokens (`--text-primary`, `--brand-ink`) are chosen for AA contrast on the light canvas.

---

## 9. Performance

- **No frameworks, no web fonts, no trackers.** System font stack (`--font-sans`) → zero font requests, no FOUT. Three small vanilla scripts.
- **Static, cacheable assets** — long-cache `assets/**`; images are sized (`width`/`height`) to avoid layout shift; the hero icon uses `fetchpriority="high"` + `decoding="async"`.
- **Lazy/scroll reveal** via `IntersectionObserver` (degrades to "all visible" when unsupported or reduced-motion).
- **Chrome injection cost** is negligible (string `innerHTML` into two placeholders) and runs before paint-relevant scripts; it does not block first contentful paint of `<main>` content, which is server-shipped HTML.
- **Careers data** loads after first paint; the page renders its shell immediately, then fills job cards from the API or `data/jobs.json`.
- Keep the per-page HTML lean once sections split out of `index.html` — that split is itself a perf win (smaller documents, faster TTI).

---

## 10. Deploy story

- **Host:** any static host — **Vercel, Netlify, Cloudflare Pages, or GitHub Pages**. **No build step**; deploy the `Website/` folder as-is.
- **Domain:** point the apex `gogosling.ca` at it over **HTTPS**. Update the absolute URLs (`<link rel="canonical">`, OG `og:url` / `og:image`, JSON-LD) to the real domain.
- **Careers backend wiring:** set `window.GOSLING_CAREERS_API` (per environment) for `careers.js` to read live jobs / accept applications; leave it unset to ship in **offline mode** backed by `data/jobs.json`. The backend's CORS allowlist must include the exact marketing origin(s). Full backend + launch sequence: see **`docs/careers-system.md`**.
- **Run locally:** `python3 -m http.server 8080` → `http://localhost:8080`.
- **Launch checklist** lives in `README.md` (swap the pre-launch CTA to the official App Store badge, fill footer Company/Connect links, replace template legal copy with counsel-reviewed text, set the real domain everywhere, add analytics only if it stays consistent with the on-page privacy promise).
