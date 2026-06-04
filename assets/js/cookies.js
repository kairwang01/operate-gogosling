/* ==========================================================================
   Go!Gosling — Cookie / storage consent (essential only by default)
   ========================================================================== */
(function () {
  "use strict";

  var CONSENT_KEY = "gosling-consent";
  var CONSENT_VERSION = 1;

  function readConsent() {
    try {
      var raw = localStorage.getItem(CONSENT_KEY);
      if (!raw) return null;
      var data = JSON.parse(raw);
      if (!data || data.v !== CONSENT_VERSION) return null;
      return data;
    } catch (e) {
      return null;
    }
  }

  function saveConsent(analytics) {
    try {
      localStorage.setItem(
        CONSENT_KEY,
        JSON.stringify({
          v: CONSENT_VERSION,
          essential: true,
          analytics: !!analytics,
          ts: new Date().toISOString()
        })
      );
    } catch (e) {}
    document.dispatchEvent(
      new CustomEvent("gosling:consent", {
        detail: { analytics: !!analytics }
      })
    );
  }

  function closeBanner(banner) {
    if (!banner) return;
    banner.classList.remove("is-open");
    banner.setAttribute("hidden", "");
    document.body.classList.remove("has-cookie-banner");
    syncBannerOffset(banner);
  }

  function syncBannerOffset(banner) {
    if (!banner) return;
    var h = banner.classList.contains("is-open") ? banner.offsetHeight : 0;
    document.documentElement.style.setProperty("--cookie-banner-h", h ? h + "px" : "0px");
  }

  function openBanner(banner) {
    if (!banner) return;
    banner.removeAttribute("hidden");
    banner.classList.add("is-open");
    document.body.classList.add("has-cookie-banner");
    syncBannerOffset(banner);
    var btn = banner.querySelector("[data-cookie-accept]");
    if (btn) btn.focus();
  }

  function bindBanner(banner) {
    var accept = banner.querySelector("[data-cookie-accept]");
    var essential = banner.querySelector("[data-cookie-essential]");
    if (accept) {
      accept.addEventListener("click", function () {
        saveConsent(false);
        closeBanner(banner);
      });
    }
    if (essential) {
      essential.addEventListener("click", function () {
        saveConsent(false);
        closeBanner(banner);
      });
    }
  }

  function init() {
    var banner = document.querySelector("[data-cookie-banner]");
    if (!banner) return;

    bindBanner(banner);

    if (readConsent()) {
      banner.setAttribute("hidden", "");
      return;
    }

    openBanner(banner);
  }

  function bindReopen() {
    document.querySelectorAll("[data-cookie-reopen]").forEach(function (el) {
      if (el.dataset.cookieReopenBound) return;
      el.dataset.cookieReopenBound = "1";
      el.addEventListener("click", function (e) {
        e.preventDefault();
        var existing = document.querySelector("[data-cookie-banner]");
        if (!existing && typeof window.GOSLING_RENDER_COOKIE_BANNER === "function") {
          existing = window.GOSLING_RENDER_COOKIE_BANNER(true);
          bindBanner(existing);
          if (window.GoslingI18n && window.GoslingI18n.apply) {
            window.GoslingI18n.apply(window.GoslingI18n.current());
          }
        }
        if (existing) openBanner(existing);
      });
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () {
      init();
      bindReopen();
    });
  } else {
    init();
    bindReopen();
  }
})();
