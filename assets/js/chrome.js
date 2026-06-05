/* ==========================================================================
   Go!Gosling — shared site chrome (header + footer)
   ========================================================================== */
(function () {
  "use strict";

  var NAV = [
    { page: "features", href: "features.html", key: "nav.features", en: "Features" },
    { page: "privacy",  href: "privacy.html",  key: "nav.privacy",  en: "Privacy" },
    { page: "how",      href: "how.html",      key: "nav.how",      en: "How it works" },
    { page: "faq",      href: "faq.html",      key: "nav.faq",      en: "FAQ" },
    { page: "about",    href: "about.html",    key: "nav.about",    en: "About" },
    { page: "careers",  href: "careers.html",  key: "nav.careers",  en: "Careers" }
  ];

  var active = window.GOSLING_PAGE || "";

  var LOGO = '' +
    '<a class="logo" href="index.html" aria-label="Go!Gosling home">' +
      '<span class="logo__mark" aria-hidden="true"><img src="assets/img/icon-192.png" alt="" width="32" height="32" /></span>' +
      '<span class="logo__word">Go!Gosling</span>' +
    '</a>';

  function navLinks(extraClass) {
    return NAV.map(function (n) {
      var cur = (n.page === active) ? ' aria-current="page"' : '';
      return '<a class="' + (extraClass || "") + '" href="' + n.href + '"' + cur + ' data-i18n="' + n.key + '">' + n.en + '</a>';
    }).join("");
  }

  var LANG_TOGGLE = '' +
    '<div class="lang-toggle lang-toggle--3" role="group" aria-label="Language">' +
      '<button type="button" data-lang-set="en" aria-pressed="true" aria-label="English" title="English">EN</button>' +
      '<button type="button" data-lang-set="fr" aria-pressed="false" aria-label="Français" title="Français">FR</button>' +
      '<button type="button" data-lang-set="zh" aria-pressed="false" aria-label="中文" title="中文">中</button>' +
    '</div>';

  var notifyBtn = window.GOSLING_CHROME_MINIMAL
    ? '<a href="index.html" class="btn btn--ghost" data-i18n="legal.back">Back to home</a>'
    : '<a href="index.html#notify" class="btn btn--primary" data-i18n="nav.notify">Notify me</a>';

  var HEADER = '' +
    '<header class="nav" id="top">' +
      '<div class="container nav__inner">' +
        LOGO +
        '<nav class="nav__links" aria-label="Primary">' + navLinks() + '</nav>' +
        '<div class="nav__actions">' +
          LANG_TOGGLE +
          notifyBtn +
          '<button class="nav__menu-btn" type="button" data-menu-btn aria-expanded="false" aria-controls="mobile-menu" data-i18n-attr="aria-label:nav.menu" aria-label="Open menu">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><path d="M3 6h18M3 12h18M3 18h18"/></svg>' +
          '</button>' +
        '</div>' +
      '</div>' +
    '</header>' +
    '<div class="mobile-menu" id="mobile-menu" data-mobile-menu>' +
      navLinks() +
      (window.GOSLING_CHROME_MINIMAL
        ? '<a href="index.html" data-i18n="legal.back">Back to home</a>'
        : '<a href="index.html#notify" data-i18n="nav.notify">Notify me</a>') +
    '</div>';

  function footCol(titleKey, titleEn, items) {
    var lis = items.map(function (it) {
      return '<li><a href="' + it.href + '"' + (it.aria ? ' aria-label="' + it.aria + '"' : "") +
        (it.key ? ' data-i18n="' + it.key + '"' : "") + '>' + it.en + '</a></li>';
    }).join("");
    return '<div class="footer__col"><h4 data-i18n="' + titleKey + '">' + titleEn + '</h4><ul>' + lis + '</ul></div>';
  }

  var FOOTER = '' +
    '<footer class="site-footer">' +
      '<div class="container">' +
        '<div class="footer__top">' +
          '<div class="footer__brand">' +
            LOGO +
            '<p class="footer__tagline" data-i18n="foot.tagline">Go!Gosling — say it, and it\'s handled, with your health kept on your iPhone.</p>' +
            '<p class="footer__canada" data-i18n="foot.canada">A Canadian company · Built in Canada</p>' +
          '</div>' +
          '<div class="footer__cols">' +
            footCol("foot.product", "Product", [
              { href: "meet.html",      key: "nav.meet",      en: "Gosli" },
              { href: "features.html",  key: "foot.features", en: "Features" },
              { href: "privacy.html",   key: "foot.privacy",  en: "Privacy" },
              { href: "how.html",       key: "foot.how",      en: "How it works" },
              { href: "features.html#roadmap", key: "foot.roadmap", en: "Roadmap" },
              { href: "faq.html",       key: "foot.faq",      en: "FAQ" }
            ]) +
            footCol("foot.company", "Company", [
              { href: "canada.html",  key: "foot.canadaLink", en: "Built in Canada" },
              { href: "about.html",   key: "foot.about",   en: "About" },
              { href: "careers.html", key: "foot.careers", en: "Careers" },
              { href: "mailto:hello@gogosling.ca", key: "foot.contact", en: "Contact" }
            ]) +
            footCol("foot.legal", "Legal", [
              { href: "privacy-policy.html", key: "foot.privacyPolicy", en: "Privacy Policy" },
              { href: "terms.html",          key: "foot.terms",         en: "Terms of Service" },
              { href: "faq.html",            key: "foot.health",        en: "Health disclaimer" }
            ]) +
            footCol("foot.connect", "Connect", [
              { href: "mailto:hello@gogosling.ca", key: "foot.email", en: "hello@gogosling.ca" }
            ]) +
          '</div>' +
        '</div>' +
        '<div class="footer__bottom">' +
          '<p class="footer__disclaimer" data-i18n="foot.ai">Go!Gosling uses on-device AI. AI-generated content can be incomplete or wrong — please use your own judgment, and never rely on it for medical, legal, or financial decisions.</p>' +
          '<p class="footer__disclaimer" data-i18n="foot.healthFull">Go!Gosling is a wellness and information tool, not a medical device. It does not diagnose, treat, or prevent any condition. Always consult a qualified clinician for medical decisions, and call your local emergency number in an emergency.</p>' +
          '<div class="footer__legal-row">' +
            '<span data-i18n="foot.copyright">© 2026 Go!Gosling. All rights reserved.</span>' +
            '<button type="button" class="footer__cookie-btn" data-cookie-reopen data-i18n="foot.cookies">Cookie settings</button>' +
            '<span data-i18n="foot.madeWith">Designed for privacy. Built for iPhone.</span>' +
          '</div>' +
        '</div>' +
      '</div>' +
    '</footer>';

  var COOKIE_BANNER = '' +
    '<div class="cookie-banner" data-cookie-banner role="region" aria-labelledby="cookie-banner-title" hidden>' +
      '<div class="cookie-banner__inner container">' +
        '<div class="cookie-banner__copy">' +
          '<p class="cookie-banner__title" id="cookie-banner-title" data-i18n="cookies.title">Cookies on this site</p>' +
          '<p class="cookie-banner__desc" id="cookie-banner-desc" data-i18n-html="cookies.body">' +
            'We use essential browser storage on <strong>gogosling.ca</strong> to remember your language and this notice. ' +
            'We do not use advertising or cross-site tracking cookies. ' +
            '<a href="privacy-policy.html#cookies">Privacy Policy</a>.' +
          '</p>' +
        '</div>' +
        '<div class="cookie-banner__actions">' +
          '<button type="button" class="btn btn--ghost" data-cookie-essential data-i18n="cookies.essential">Essential only</button>' +
          '<button type="button" class="btn btn--primary" data-cookie-accept data-i18n="cookies.accept">Accept</button>' +
        '</div>' +
      '</div>' +
    '</div>';

  window.GOSLING_RENDER_COOKIE_BANNER = function (forceOpen) {
    var existing = document.querySelector("[data-cookie-banner]");
    if (existing) {
      if (forceOpen) {
        existing.removeAttribute("hidden");
        existing.classList.add("is-open");
        document.body.classList.add("has-cookie-banner");
      }
      return existing;
    }
    document.body.insertAdjacentHTML("beforeend", COOKIE_BANNER);
    var banner = document.querySelector("[data-cookie-banner]");
    if (banner && typeof document.dispatchEvent === "function") {
      document.dispatchEvent(new CustomEvent("gosling:chrome-cookies"));
    }
    return banner;
  };

  function inject(id, html) {
    var el = document.getElementById(id);
    if (el) el.innerHTML = html;
  }
  inject("site-header", HEADER);
  inject("site-footer", FOOTER);
  window.GOSLING_RENDER_COOKIE_BANNER(false);
  requestAnimationFrame(function () {
    document.dispatchEvent(new CustomEvent("gosling:chrome-ready"));
  });
})();
