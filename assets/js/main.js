/* ==========================================================================
   Go!Gosling — Interactions
   ========================================================================== */
(function () {
  "use strict";

  const prefersReduced =
    window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const WAITLIST_API = (
    window.GOSLING_WAITLIST_API || "https://api.gogosling.ca/v1/waitlist"
  ).replace(/\/$/, "");

  /* --- Sticky nav state ------------------------------------------------- */
  const nav = document.querySelector(".nav");
  if (nav) {
    const onScroll = function () {
      nav.classList.toggle("is-scrolled", window.scrollY > 8);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
  }

  /* --- Mobile menu + focus trap ----------------------------------------- */
  const menuBtn = document.querySelector("[data-menu-btn]");
  const mobileMenu = document.querySelector("[data-mobile-menu]");
  if (menuBtn && mobileMenu) {
    const focusableSel = 'a[href], button:not([disabled]), input:not([disabled])';
    const setOpen = function (open) {
      mobileMenu.classList.toggle("is-open", open);
      menuBtn.setAttribute("aria-expanded", String(open));
      document.body.style.overflow = open ? "hidden" : "";
      if (open) {
        const first = mobileMenu.querySelector(focusableSel);
        if (first) first.focus();
      } else {
        menuBtn.focus();
      }
    };
    menuBtn.addEventListener("click", function () {
      setOpen(!mobileMenu.classList.contains("is-open"));
    });
    mobileMenu.querySelectorAll("a").forEach(function (a) {
      a.addEventListener("click", function () { setOpen(false); });
    });
    document.addEventListener("keydown", function (e) {
      if (!mobileMenu.classList.contains("is-open")) return;
      if (e.key === "Escape") {
        setOpen(false);
        return;
      }
      if (e.key !== "Tab") return;
      const nodes = mobileMenu.querySelectorAll(focusableSel);
      if (!nodes.length) return;
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    });
  }

  /* --- Pre-launch store badge → waitlist focus -------------------------- */
  document.querySelectorAll("[data-store-badge]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var input = document.querySelector("#notify input[type=email], [data-waitlist] input[type=email]");
      if (input) {
        input.focus();
        input.scrollIntoView({ behavior: prefersReduced ? "auto" : "smooth", block: "center" });
      }
    });
  });

  /* --- Scroll reveal ---------------------------------------------------- */
  const revealEls = document.querySelectorAll(".reveal");
  if (revealEls.length) {
    if (prefersReduced || !("IntersectionObserver" in window)) {
      revealEls.forEach(function (el) { el.classList.add("is-visible"); });
    } else {
      const io = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            io.unobserve(entry.target);
          }
        });
      }, { rootMargin: "0px 0px -8% 0px", threshold: 0.12 });
      revealEls.forEach(function (el) { io.observe(el); });
    }
  }

  /* --- FAQ accordion (one open at a time) ------------------------------- */
  const accordionTriggers = document.querySelectorAll(".accordion__trigger");
  accordionTriggers.forEach(function (trigger) {
    const panel = document.getElementById(trigger.getAttribute("aria-controls"));
    if (!panel) return;
    trigger.addEventListener("click", function () {
      const wasOpen = trigger.getAttribute("aria-expanded") === "true";
      accordionTriggers.forEach(function (other) {
        const p = document.getElementById(other.getAttribute("aria-controls"));
        other.setAttribute("aria-expanded", "false");
        if (p) p.style.maxHeight = "0px";
      });
      if (!wasOpen) {
        trigger.setAttribute("aria-expanded", "true");
        panel.style.maxHeight = panel.scrollHeight + "px";
      }
    });
    const refresh = function () {
      if (trigger.getAttribute("aria-expanded") === "true") {
        panel.style.maxHeight = panel.scrollHeight + "px";
      }
    };
    document.addEventListener("gosling:langchange", function () { setTimeout(refresh, 30); });
    window.addEventListener("resize", refresh, { passive: true });
  });

  /* --- Device subtle tilt (desktop, pointer) ---------------------------- */
  if (!prefersReduced && window.matchMedia("(pointer:fine)").matches) {
    document.querySelectorAll("[data-tilt]").forEach(function (el) {
      const max = 5;
      el.style.transition = "transform 0.3s cubic-bezier(0.22,1,0.36,1)";
      el.addEventListener("pointermove", function (e) {
        const r = el.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width - 0.5;
        const py = (e.clientY - r.top) / r.height - 0.5;
        el.style.transform =
          "perspective(900px) rotateY(" + (px * max) + "deg) rotateX(" + (-py * max) + "deg)";
      });
      el.addEventListener("pointerleave", function () {
        el.style.transform = "perspective(900px) rotateY(0) rotateX(0)";
      });
    });
  }

  /* --- Waitlist form ---------------------------------------------------- */
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  function pageLang() {
    const html = document.documentElement.lang;
    if (html === "zh-Hans") return "zh";
    if (html === "fr") return "fr";
    return "en";
  }
  const t = function (key) {
    return window.GoslingI18n ? window.GoslingI18n.t(key, pageLang()) : key;
  };

  function showWaitlistSuccess(form) {
    const success = form.parentNode.querySelector("[data-waitlist-success]");
    form.hidden = true;
    if (success) {
      success.hidden = false;
      const live = success.querySelector("[data-success-text]");
      if (live) live.textContent = t("form.success");
    }
  }

  function persistWaitlistLocal(email) {
    try {
      const list = JSON.parse(localStorage.getItem("gosling-waitlist") || "[]");
      if (list.indexOf(email) === -1) list.push(email);
      localStorage.setItem("gosling-waitlist", JSON.stringify(list));
    } catch (err) {}
  }

  document.querySelectorAll("[data-waitlist]").forEach(function (form) {
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      const input = form.querySelector('input[type="email"]');
      const email = (input.value || "").trim();
      if (!EMAIL_RE.test(email)) {
        input.setAttribute("aria-invalid", "true");
        input.focus();
        showError(form);
        return;
      }
      input.removeAttribute("aria-invalid");
      const btn = form.querySelector('button[type="submit"]');
      if (btn) btn.disabled = true;

      function done() {
        if (btn) btn.disabled = false;
        persistWaitlistLocal(email);
        showWaitlistSuccess(form);
      }

      if (WAITLIST_API) {
        fetch(WAITLIST_API, {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({ email: email, source: "website", locale: pageLang() })
        }).then(function (res) {
          if (!res.ok) throw new Error("waitlist failed");
          done();
        }).catch(function () {
          if (btn) btn.disabled = false;
          showError(form, t("form.sendError"));
        });
        return;
      }
      done();
    });
  });

  function showError(form, msg) {
    const text = msg || t("form.invalid");
    let err = form.parentNode.querySelector("[data-form-error]");
    if (!err) {
      err = document.createElement("p");
      err.setAttribute("data-form-error", "");
      err.setAttribute("role", "alert");
      err.className = "form-note";
      err.style.color = "#c0564c";
      form.parentNode.insertBefore(err, form.nextSibling);
    }
    err.textContent = text;
    setTimeout(function () { if (err) err.textContent = ""; }, 5000);
  }

  document.querySelectorAll("[data-year]").forEach(function (el) {
    el.textContent = "2026";
  });
})();
