#!/usr/bin/env python3
"""One-off helper: split index.html sections into dedicated pages (idempotent)."""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
INDEX = (ROOT / "index.html").read_text(encoding="utf-8")
lines = INDEX.splitlines(keepends=True)

def slice_lines(start, end):
    return "".join(lines[start - 1 : end])

HEAD_COMMON = """  <link rel="icon" href="assets/img/favicon-32.png" sizes="32x32" type="image/png" />
  <link rel="icon" href="assets/img/favicon-16.png" sizes="16x16" type="image/png" />
  <link rel="apple-touch-icon" href="assets/img/apple-touch-icon.png" />
  <link rel="manifest" href="site.webmanifest" />
  <meta name="color-scheme" content="light" />
  <link rel="alternate" hreflang="en" href="{canonical}" />
  <link rel="alternate" hreflang="fr" href="{canonical}" />
  <link rel="alternate" hreflang="zh-Hans" href="{canonical}" />
  <link rel="alternate" hreflang="x-default" href="{canonical}" />
  <link rel="stylesheet" href="assets/css/tokens.css" />
  <link rel="stylesheet" href="assets/css/base.css" />
  <link rel="stylesheet" href="assets/css/components.css" />
  <link rel="stylesheet" href="assets/css/site.css" />
"""

FOOT = """
  <div id="site-footer"></div>
  <script src="assets/js/chrome.js"></script>
  <script src="assets/js/i18n-fr.js"></script>
  <script src="assets/js/i18n.js"></script>
  <script src="assets/js/main.js"></script>
</body>
</html>
"""

def page(slug, title_attr, desc_attr, desc_en, canonical, page_id, body, subhero=False):
    sub = ' class="section subhero"' if subhero else ""
    return f"""<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
  <title data-i18n="{title_attr}">{desc_en.split('—')[0].strip()} — Go!Gosling</title>
  <meta name="description" data-i18n-attr="content:{desc_attr}" content="{desc_en}" />
  <meta name="robots" content="index,follow" />
  <link rel="canonical" href="{canonical}" />
{HEAD_COMMON.format(canonical=canonical)}
</head>
<body>
  <a class="skip-link" href="#main">Skip to content</a>
  <script>window.GOSLING_PAGE = "{page_id}";</script>
  <div id="site-header"></div>
  <main id="main">
{body}
  </main>
{FOOT}
"""

ROADMAP = """
    <section class="section section--inset" id="roadmap">
      <div class="container">
        <div class="sec-head center">
          <span class="eyebrow eyebrow--brand" data-i18n="road.eyebrow">The road ahead</span>
          <h2 class="section-title" style="margin-top:var(--space-4)" data-i18n="road.title">v1 ships Chat, Health &amp; Maps. More skills unlock over time.</h2>
          <p class="lead mx-auto measure" style="margin-inline:auto" data-i18n="road.lead">Go!Gosling is your private conversation space. Launch ships Chat, Health, and Maps on your iPhone, with Calendar, Reminders, Contacts, and Siri Shortcuts; recipes, search, media, and store follow as each becomes ready.</p>
        </div>
        <div class="roadmap__group">
          <h4 data-i18n="road.live">Available at launch</h4>
          <div class="roadmap__chips">
            <span class="chip chip--live"><span class="chip__dot" aria-hidden="true"></span><span data-i18n="road.chat">Chat</span></span>
            <span class="chip chip--live"><span class="chip__dot" aria-hidden="true"></span><span data-i18n="road.health">Health</span></span>
            <span class="chip chip--live"><span class="chip__dot" aria-hidden="true"></span><span data-i18n="road.routes">Routes</span></span>
          </div>
        </div>
        <div class="roadmap__group">
          <h4 data-i18n="road.soon">Planned for later</h4>
          <div class="roadmap__chips">
            <span class="chip chip--soon"><span class="chip__dot" aria-hidden="true"></span><span data-i18n="road.recipes">Recipes</span></span>
            <span class="chip chip--soon"><span class="chip__dot" aria-hidden="true"></span><span data-i18n="road.search">Search</span></span>
            <span class="chip chip--soon"><span class="chip__dot" aria-hidden="true"></span><span data-i18n="road.media">Media</span></span>
            <span class="chip chip--soon"><span class="chip__dot" aria-hidden="true"></span><span data-i18n="road.store">Store</span></span>
          </div>
        </div>
      </div>
    </section>
"""

meet_body = slice_lines(104, 176)
spotlight_body = slice_lines(178, 218)
features_body = slice_lines(220, 292) + ROADMAP
how_body = slice_lines(294, 318)
priv_body = slice_lines(320, 360)
canada_body = slice_lines(362, 399)
faq_body = slice_lines(401, 439)

(ROOT / "meet.html").write_text(
    page("meet", "meet.metaTitle", "meet.metaDesc",
         "Meet Gosli — the face of Go!Gosling. See how your on-device assistant listens, thinks, and acts.",
         "https://gogosling.ca/meet.html", "meet", meet_body),
    encoding="utf-8",
)
(ROOT / "features.html").write_text(
    page("features", "features.metaTitle", "features.metaDesc",
         "What Go!Gosling can do — chat, health, maps, and more from one conversation on iPhone.",
         "https://gogosling.ca/features.html", "features", features_body),
    encoding="utf-8",
)
(ROOT / "how.html").write_text(
    page("how", "how.metaTitle", "how.metaDesc",
         "How Go!Gosling works — three steps to turn what you say into action on iPhone.",
         "https://gogosling.ca/how.html", "how", how_body),
    encoding="utf-8",
)
(ROOT / "privacy.html").write_text(
    page("privacy", "privPage.metaTitle", "privPage.metaDesc",
         "Your health stays on your iPhone — Go!Gosling privacy promise and on-device design.",
         "https://gogosling.ca/privacy.html", "privacy",
         spotlight_body + priv_body),
    encoding="utf-8",
)
(ROOT / "canada.html").write_text(
    page("canada", "canada.metaTitle", "canada.metaDesc",
         "Go!Gosling is a Canadian company aligned with AI for All — built in Ontario for iPhone.",
         "https://gogosling.ca/canada.html", "canada", canada_body, subhero=True),
    encoding="utf-8",
)
(ROOT / "faq.html").write_text(
    page("faq", "faq.metaTitle", "faq.metaDesc",
         "Frequently asked questions about Go!Gosling — privacy, launch, pricing, and more.",
         "https://gogosling.ca/faq.html", "faq", faq_body),
    encoding="utf-8",
)
print("Wrote meet, features, how, privacy, canada, faq")
