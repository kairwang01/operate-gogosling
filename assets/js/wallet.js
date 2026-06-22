/* ==========================================================================
   Go!Gosling — Web3 early-access (EIP-1193 wallet connect)
   A safe, closed-loop Web3 integration: connect an Ethereum wallet, then sign
   a plain message (NO transaction, NO funds, NO gas) to reserve an early-access
   spot. We only ever read the public address. State-driven + full edge states.
   Posts to window.GOSLING_WEB3_API when set, else stores locally (pre-backend).
   ========================================================================== */
(function () {
  "use strict";
  var root = document.querySelector("[data-wallet]");
  if (!root) return;

  var API = (window.GOSLING_WEB3_API || "").replace(/\/$/, "");
  var STORE_KEY = "gosling-earlyaccess";
  var SIGN_MSG = "I'm reserving early access to Go!Gosling — private, on-device AI.";
  var CHAINS = { "0x1": "Ethereum", "0x89": "Polygon", "0xa": "Optimism", "0xa4b1": "Arbitrum", "0x2105": "Base", "0xaa36a7": "Sepolia" };

  var MSG = {
    en: {
      rejected: "Connection cancelled. You can try again anytime.",
      signRejected: "Signature cancelled — your spot isn't reserved yet.",
      failed: "Something went wrong. Please try again.",
      noAccounts: "No account found. Unlock your wallet and retry."
    },
    zh: {
      rejected: "已取消连接，随时可以再试。",
      signRejected: "已取消签名——你的名额尚未保留。",
      failed: "出了点问题，请重试。",
      noAccounts: "未找到账户，请解锁钱包后重试。"
    }
  };
  function lang() { return (document.documentElement.lang === "zh-Hans") ? "zh" : "en"; }
  function msg(k) { return (MSG[lang()] && MSG[lang()][k]) || MSG.en[k]; }

  var eth = window.ethereum || null;
  var account = null;

  function setState(s) { root.setAttribute("data-state", s); }
  function shorten(a) { return a ? a.slice(0, 6) + "…" + a.slice(-4) : ""; }
  function setText(sel, val) { root.querySelectorAll(sel).forEach(function (el) { el.textContent = val; }); }

  function showAccount(addr) {
    account = addr;
    setText("[data-wallet-address]", shorten(addr));
    if (eth && eth.request) {
      eth.request({ method: "eth_chainId" }).then(function (id) {
        setText("[data-wallet-chain]", CHAINS[id] || ("Chain " + parseInt(id, 16)));
      }).catch(function () {});
    }
  }
  function err(text) { setText("[data-wallet-error]", text); }

  function joinedLocally() {
    try { var v = JSON.parse(localStorage.getItem(STORE_KEY) || "null"); return v && v.address; }
    catch (e) { return null; }
  }

  /* --- Actions --- */
  function connect() {
    if (!eth) { setState("unsupported"); return; }
    setState("connecting");
    eth.request({ method: "eth_requestAccounts" })
      .then(function (accs) {
        if (!accs || !accs.length) { err(msg("noAccounts")); setState("error"); return; }
        showAccount(accs[0]);
        setState(joinedLocally() === accs[0] ? "joined" : "connected");
      })
      .catch(function (e) {
        err(e && e.code === 4001 ? msg("rejected") : msg("failed"));
        setState("error");
      });
  }

  function reserve() {
    if (!eth || !account) { connect(); return; }
    setState("signing");
    eth.request({ method: "personal_sign", params: [SIGN_MSG, account] })
      .then(function (sig) {
        var rec = { address: account, signature: sig };
        try { localStorage.setItem(STORE_KEY, JSON.stringify(rec)); } catch (e) {}
        if (API) {
          // Fire-and-best-effort; UI does not block on it (pre-backend safe).
          fetch(API + "/api/web3/early-access", {
            method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(rec)
          }).catch(function () {});
        }
        setState("joined");
      })
      .catch(function (e) {
        err(e && e.code === 4001 ? msg("signRejected") : msg("failed"));
        setState("connected");
        // surface the inline note in the connected panel
        var note = root.querySelector("[data-wallet-note]");
        if (note) { note.textContent = err && msg("signRejected"); note.hidden = false; setTimeout(function () { note.hidden = true; }, 5000); }
      });
  }

  function disconnect() {
    // dApps can't force-disconnect a wallet; we clear our local reservation only.
    try { localStorage.removeItem(STORE_KEY); } catch (e) {}
    account = null;
    setState(eth ? "idle" : "unsupported");
  }

  /* --- Wiring --- */
  root.querySelectorAll("[data-wallet-connect]").forEach(function (b) { b.addEventListener("click", connect); });
  root.querySelectorAll("[data-wallet-reserve]").forEach(function (b) { b.addEventListener("click", reserve); });
  root.querySelectorAll("[data-wallet-disconnect]").forEach(function (b) { b.addEventListener("click", disconnect); });
  root.querySelectorAll("[data-wallet-retry]").forEach(function (b) { b.addEventListener("click", connect); });

  if (eth) {
    if (eth.on) {
      eth.on("accountsChanged", function (accs) {
        if (!accs || !accs.length) { disconnect(); return; }
        showAccount(accs[0]);
        setState(joinedLocally() === accs[0] ? "joined" : "connected");
      });
      eth.on("chainChanged", function () { if (account) showAccount(account); });
    }
    // Silent check: already connected? (no prompt)
    eth.request({ method: "eth_accounts" }).then(function (accs) {
      if (accs && accs.length) {
        showAccount(accs[0]);
        setState(joinedLocally() === accs[0] ? "joined" : "connected");
      } else {
        setState("idle");
      }
    }).catch(function () { setState("idle"); });
  } else {
    setState("unsupported");
  }
})();
