/* ==========================================================================
   Go!Gosling — Careers page logic
   Loads roles from the live API when window.GOSLING_CAREERS_API is set,
   otherwise from the static data/jobs.json (so the page works before the
   PostgreSQL backend exists). Submits applications to the API when present,
   with a graceful email fallback until then. See docs/careers-system.md.
   ========================================================================== */
(function () {
  "use strict";

  var API = (window.GOSLING_CAREERS_API || "").replace(/\/$/, "");
  var CAREERS_EMAIL = "careers@gogosling.ca";

  // Self-contained UI strings (job CONTENT comes from the data source).
  var STR = {
    en: {
      loading: "Loading open roles…",
      emptyTitle: "No open roles right now",
      emptyBody: "We're always glad to meet thoughtful people. Tell us why you'd be a great fit at " ,
      open: "Open roles",
      apply: "Apply",
      applyAria: "Apply for this role",
      details: "View role details",
      noFile: "No file chosen",
      chooseFile: "Choose file",
      applyEyebrow: "Application",
      sectionContact: "Contact",
      sectionLinks: "Links (optional)",
      sectionAbout: "About you",
      messagePh: "What excites you about Go!Gosling?",
      privacyPolicy: "Privacy Policy",
      close: "Close",
      inquiryBtn: "Email careers@gogosling.ca",
      responsibilities: "What you'll do",
      requirements: "What we're looking for",
      nice: "Nice to have",
      comp: "Compensation",
      applyFor: "Apply for",
      name: "Full name",
      email: "Email",
      phone: "Phone (optional)",
      portfolio: "Portfolio / website (optional)",
      linkedin: "LinkedIn (optional)",
      github: "GitHub (optional)",
      message: "Why Go!Gosling? (optional)",
      resume: "Résumé (PDF/DOC, max 8MB)",
      consent: "I agree that Go!Gosling may store this information to process my application.",
      submit: "Submit application",
      cancel: "Cancel",
      sending: "Sending…",
      okTitle: "Thanks — application received.",
      okBody: "We'll be in touch. Everything you shared stays private.",
      softTitle: "In-app applications open at launch.",
      softBody: "We're not accepting online applications just yet. Please email your résumé and a note to ",
      errName: "Please enter your name.",
      errEmail: "Please enter a valid email.",
      errConsent: "Please confirm consent to continue.",
      errSend: "Something went wrong sending your application. Please email us instead.",
      type_full_time: "Full-time", type_part_time: "Part-time", type_contract: "Contract", type_internship: "Internship",
      mode_remote: "Remote", mode_hybrid: "Hybrid", mode_onsite: "On-site"
    },
    zh: {
      loading: "正在加载在招岗位…",
      emptyTitle: "暂无在招岗位",
      emptyBody: "我们始终乐于结识用心的人。欢迎来信告诉我们你为什么适合 ",
      open: "在招岗位",
      apply: "申请",
      applyAria: "申请该岗位",
      details: "查看岗位详情",
      noFile: "未选择文件",
      chooseFile: "选择文件",
      applyEyebrow: "职位申请",
      sectionContact: "联系方式",
      sectionLinks: "链接（选填）",
      sectionAbout: "关于你",
      messagePh: "是什么让你对 Go!Gosling 心动？",
      privacyPolicy: "隐私政策",
      close: "关闭",
      inquiryBtn: "发送邮件至 careers@gogosling.ca",
      responsibilities: "你将负责",
      requirements: "我们期待",
      nice: "加分项",
      comp: "薪酬",
      applyFor: "申请职位：",
      name: "姓名",
      email: "邮箱",
      phone: "电话（选填）",
      portfolio: "作品集 / 网站（选填）",
      linkedin: "LinkedIn（选填）",
      github: "GitHub（选填）",
      message: "为什么选择 Go!Gosling？（选填）",
      resume: "简历（PDF/DOC，≤8MB）",
      consent: "我同意 Go!Gosling 存储以上信息用于处理我的申请。",
      submit: "提交申请",
      cancel: "取消",
      sending: "提交中…",
      okTitle: "已收到你的申请，谢谢！",
      okBody: "我们会尽快联系你。你提供的一切都将保密。",
      softTitle: "应用内申请将于发布时开放。",
      softBody: "目前暂未开放在线申请。请将简历和简介发送至 ",
      errName: "请填写你的姓名。",
      errEmail: "请输入有效的邮箱。",
      errConsent: "请先确认同意。",
      errSend: "提交时出错，请改用邮件联系我们。",
      type_full_time: "全职", type_part_time: "兼职", type_contract: "合同", type_internship: "实习",
      mode_remote: "远程", mode_hybrid: "混合办公", mode_onsite: "坐班"
    },
    fr: {
      loading: "Chargement des postes ouverts…",
      emptyTitle: "Aucun poste ouvert pour le moment",
      emptyBody: "Nous sommes toujours heureux de rencontrer des personnes réfléchies. Dites-nous pourquoi vous seriez un bon fit chez ",
      open: "Postes ouverts",
      apply: "Postuler",
      applyAria: "Postuler pour ce poste",
      details: "Voir les détails du poste",
      noFile: "Aucun fichier",
      chooseFile: "Choisir un fichier",
      applyEyebrow: "Candidature",
      sectionContact: "Coordonnées",
      sectionLinks: "Liens (facultatif)",
      sectionAbout: "À propos de vous",
      messagePh: "Qu'est-ce qui vous attire chez Go!Gosling?",
      privacyPolicy: "Politique de confidentialité",
      close: "Fermer",
      inquiryBtn: "Écrire à careers@gogosling.ca",
      responsibilities: "Ce que vous ferez",
      requirements: "Ce que nous recherchons",
      nice: "Atouts",
      comp: "Rémunération",
      applyFor: "Postuler pour",
      name: "Nom complet",
      email: "Courriel",
      phone: "Téléphone (facultatif)",
      portfolio: "Portfolio / site web (facultatif)",
      linkedin: "LinkedIn (facultatif)",
      github: "GitHub (facultatif)",
      message: "Pourquoi Go!Gosling? (facultatif)",
      resume: "CV (PDF/DOC, max. 8 Mo)",
      consent: "J'accepte que Go!Gosling conserve ces renseignements pour traiter ma candidature.",
      submit: "Soumettre la candidature",
      cancel: "Annuler",
      sending: "Envoi en cours…",
      okTitle: "Merci — candidature reçue.",
      okBody: "Nous vous contacterons. Tout ce que vous avez partagé reste confidentiel.",
      softTitle: "Les candidatures en ligne ouvrent au lancement.",
      softBody: "Nous n'acceptons pas encore les candidatures en ligne. Veuillez envoyer votre CV et une note à ",
      errName: "Veuillez entrer votre nom.",
      errEmail: "Veuillez entrer un courriel valide.",
      errConsent: "Veuillez confirmer votre consentement pour continuer.",
      errSend: "Une erreur s'est produite. Veuillez nous écrire par courriel.",
      type_full_time: "Temps plein", type_part_time: "Temps partiel", type_contract: "Contrat", type_internship: "Stage",
      mode_remote: "À distance", mode_hybrid: "Hybride", mode_onsite: "Sur place"
    }
  };

  function lang() {
    var html = document.documentElement.lang;
    if (html === "zh-Hans") return "zh";
    if (html === "fr") return "fr";
    return "en";
  }
  function t(k) { return (STR[lang()] && STR[lang()][k] != null) ? STR[lang()][k] : STR.en[k]; }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]; }); }

  var jobs = [];

  function jobMeta(j) {
    var parts = [esc(j.location), t("type_" + j.employmentType), t("mode_" + j.workMode)].filter(Boolean);
    return parts.join(" · ");
  }
  function jobTags(j) {
    var tags = [];
    if (j.team) tags.push('<span class="job-card__tag">' + esc(j.team) + "</span>");
    if (j.employmentType) tags.push('<span class="job-card__tag">' + esc(t("type_" + j.employmentType)) + "</span>");
    if (j.workMode) tags.push('<span class="job-card__tag job-card__tag--muted">' + esc(t("mode_" + j.workMode)) + "</span>");
    return tags.length ? '<div class="job-card__tags">' + tags.join("") + "</div>" : "";
  }
  var APPLY_ICON = '<svg class="btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';
  function list(items) {
    if (!items || !items.length) return "";
    return "<ul>" + items.map(function (i) { return "<li>" + esc(i) + "</li>"; }).join("") + "</ul>";
  }

  function render() {
    var wrap = document.getElementById("jobs-list");
    if (!wrap) return;
    if (!jobs.length) {
      wrap.innerHTML =
        '<div class="jobs-empty">' +
          '<h3>' + esc(t("emptyTitle")) + '</h3>' +
          '<p>' + esc(t("emptyBody")) + '<a href="mailto:' + CAREERS_EMAIL + '">' + CAREERS_EMAIL + '</a>.</p>' +
          '<a class="btn btn--primary btn--lg" href="mailto:' + CAREERS_EMAIL + '">' + esc(t("inquiryBtn")) + '</a>' +
        '</div>';
      return;
    }
    wrap.innerHTML = jobs.map(function (j) {
      return '' +
        '<article class="job-card">' +
          jobTags(j) +
          '<div class="job-card__head">' +
            '<div class="job-card__intro">' +
              '<h3 class="job-card__title">' + esc(j.title) + '</h3>' +
              '<p class="job-card__meta">' + jobMeta(j) + '</p>' +
            '</div>' +
            '<button type="button" class="btn btn--primary job-card__apply" data-apply="' + esc(j.slug) + '" aria-label="' + esc(t("applyAria") + " — " + j.title) + '">' +
              esc(t("apply")) + APPLY_ICON +
            '</button>' +
          '</div>' +
          '<p class="job-card__summary">' + esc(j.summary) + '</p>' +
          '<details class="job-card__details">' +
            '<summary><span>' + esc(t("details")) + '</span></summary>' +
            '<div class="job-card__body">' +
              (j.descriptionMd ? '<p>' + esc(j.descriptionMd) + '</p>' : "") +
              (j.responsibilities && j.responsibilities.length ? '<h4>' + esc(t("responsibilities")) + '</h4>' + list(j.responsibilities) : "") +
              (j.requirements && j.requirements.length ? '<h4>' + esc(t("requirements")) + '</h4>' + list(j.requirements) : "") +
              (j.niceToHave && j.niceToHave.length ? '<h4>' + esc(t("nice")) + '</h4>' + list(j.niceToHave) : "") +
              (j.compRange ? '<h4>' + esc(t("comp")) + '</h4><p>' + esc(j.compRange) + '</p>' : "") +
            '</div>' +
          '</details>' +
        '</article>';
    }).join("");

    wrap.querySelectorAll("[data-apply]").forEach(function (btn) {
      btn.addEventListener("click", function () { openApply(btn.getAttribute("data-apply")); });
    });
  }

  /* --- Apply dialog --- */
  function openApply(slug) {
    var job = jobs.filter(function (j) { return j.slug === slug; })[0];
    var dlg = document.getElementById("apply-dialog");
    if (!dlg) return;
    dlg.querySelector("[data-apply-role]").textContent = job ? job.title : "";
    dlg.querySelector('input[name="jobSlug"]').value = slug;
    var form = dlg.querySelector("form");
    form.hidden = false;
    form.reset();
    dlg.querySelector('input[name="jobSlug"]').value = slug;
    var resumeName = dlg.querySelector("[data-resume-name]");
    if (resumeName) resumeName.textContent = t("noFile");
    var errBox = dlg.querySelector("[data-apply-error]");
    if (errBox) errBox.hidden = true;
    var done = dlg.querySelector("[data-apply-done]");
    if (done) done.hidden = true;
    relabel(dlg);
    if (typeof dlg.showModal === "function") dlg.showModal(); else dlg.setAttribute("open", "");
  }

  function relabel(scope) {
    (scope || document).querySelectorAll("[data-c]").forEach(function (el) {
      el.textContent = t(el.getAttribute("data-c"));
    });
    (scope || document).querySelectorAll("[data-c-ph]").forEach(function (el) {
      el.setAttribute("placeholder", t(el.getAttribute("data-c-ph")));
    });
  }

  var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  function wireDialog() {
    var dlg = document.getElementById("apply-dialog");
    if (!dlg) return;
    var form = dlg.querySelector("form");
    dlg.querySelectorAll("[data-apply-close]").forEach(function (b) {
      b.addEventListener("click", function () { if (dlg.close) dlg.close(); else dlg.removeAttribute("open"); });
    });
    var resumeInput = dlg.querySelector("#resume-input");
    var resumeName = dlg.querySelector("[data-resume-name]");
    if (resumeInput && resumeName) {
      resumeInput.addEventListener("change", function () {
        var f = resumeInput.files && resumeInput.files[0];
        resumeName.textContent = f ? f.name : t("noFile");
        resumeName.classList.toggle("is-set", !!f);
      });
    }
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var fd = new FormData(form);
      // honeypot
      if ((fd.get("company_website") || "").trim() !== "") return;
      if (!(fd.get("applicantName") || "").trim()) return err("errName");
      if (!EMAIL_RE.test((fd.get("email") || "").trim())) return err("errEmail");
      if (fd.get("consent") !== "on" && fd.get("consent") !== "true") return err("errConsent");

      if (API) {
        fd.set("consent", "true");
        var btn = form.querySelector('button[type="submit"]');
        var labelEl = btn.querySelector("[data-c=\"submit\"]");
        var label = labelEl ? labelEl.textContent : btn.textContent;
        btn.disabled = true;
        if (labelEl) labelEl.textContent = t("sending");
        fetch(API + "/api/careers/applications", { method: "POST", body: fd })
          .then(function (r) { if (!r.ok) throw new Error("bad"); return r.json(); })
          .then(function () { success(t("okTitle"), t("okBody")); })
          .catch(function () { err("errSend"); })
          .then(function () {
            btn.disabled = false;
            if (labelEl) labelEl.textContent = label;
          });
      } else {
        // No backend yet → graceful email fallback.
        var role = dlg.querySelector("[data-apply-role]").textContent;
        var mail = "mailto:" + CAREERS_EMAIL + "?subject=" + encodeURIComponent("Application — " + role);
        success(t("softTitle"), t("softBody"), mail);
      }
    });

    function err(key) {
      var box = dlg.querySelector("[data-apply-error]");
      if (box) { box.textContent = t(key); box.hidden = false; setTimeout(function () { box.hidden = true; }, 5000); }
    }
    function success(title, body, mail) {
      form.hidden = true;
      var done = dlg.querySelector("[data-apply-done]");
      done.hidden = false;
      done.querySelector("[data-done-title]").textContent = title;
      var b = done.querySelector("[data-done-body]");
      b.textContent = body;
      if (mail) {
        var a = document.createElement("a");
        a.href = mail; a.textContent = CAREERS_EMAIL; a.className = "apply-done__mail";
        b.appendChild(a);
      }
    }
  }

  /* --- Load --- */
  function loadJobs() {
    var url = API ? (API + "/api/careers/jobs") : "data/jobs.json";
    fetch(url, { headers: { "Accept": "application/json" } })
      .then(function (r) { return r.json(); })
      .then(function (data) { jobs = (data && data.jobs) || []; render(); })
      .catch(function () {
        // If the API fails, fall back to the static file once.
        if (API) { API = ""; loadJobs(); return; }
        jobs = []; render();
      });
  }

  function init() {
    relabel(document);
    wireDialog();
    loadJobs();
    // Re-render on language toggle (observe <html lang>).
    if ("MutationObserver" in window) {
      new MutationObserver(function () { render(); relabel(document); })
        .observe(document.documentElement, { attributes: true, attributeFilter: ["lang"] });
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
