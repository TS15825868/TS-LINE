"use strict";

(() => {
  const VERSION = "20260716-mobile-2";
  const MOBILE_QUERY = "(max-width: 760px)";
  const PRIMARY = [
    { view: "dashboard", label: "總覽", icon: "⌂" },
    { view: "orders", label: "訂單", icon: "▤" },
    { view: "customers", label: "客戶", icon: "◎" },
    { view: "inventory", label: "庫存", icon: "▦" },
  ];
  const LABELS = {
    dashboard: "總覽", orders: "訂單", customers: "客戶 CRM", inventory: "庫存",
    reminders: "提醒", social: "社群排程", reports: "報表", backup: "備份",
    staff: "員工權限", tools: "營運工具",
  };
  const byId = (id) => document.getElementById(id);
  const isMobile = () => window.matchMedia(MOBILE_QUERY).matches;
  let refreshTimer = null;
  let moreSignature = "";

  function installStyles() {
    if (byId("xjwMobileStyles")) return;
    const style = document.createElement("style");
    style.id = "xjwMobileStyles";
    style.textContent = `
      #xjwMobileNav,#xjwMobileSheet,#xjwMobileBackdrop{display:none}
      @media(max-width:760px){
        html{scroll-padding-bottom:112px}
        body{padding-bottom:calc(94px + env(safe-area-inset-bottom))!important;overflow-x:hidden}
        main.shell{padding-bottom:28px!important}
        nav.tabs{display:none!important}
        .top{align-items:flex-start!important;gap:10px!important}
        .top .actions{gap:8px!important;flex-wrap:wrap!important;justify-content:flex-end!important}
        .top .btn,.top button{min-height:44px!important}
        .cards{grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:10px!important}
        .grid2,.grid3{grid-template-columns:1fr!important}
        .panel{padding:16px!important;border-radius:20px!important}
        .item{padding:14px!important;border-radius:17px!important;overflow-wrap:anywhere}
        .toolbar{align-items:flex-start!important;gap:10px!important;flex-wrap:wrap!important}
        .actions{gap:8px!important;flex-wrap:wrap!important}
        .actions .btn,.actions button,.actions a{min-height:42px!important;display:inline-flex!important;align-items:center!important;justify-content:center!important}
        input,select,textarea,button{font-size:16px!important}
        textarea{min-height:112px}
        .xjw-safe-online{right:10px!important;bottom:calc(94px + env(safe-area-inset-bottom))!important;max-width:190px!important;font-size:11px!important;pointer-events:none!important;transition:opacity .25s ease,transform .25s ease!important}
        .xjw-safe-online.xjw-mobile-hidden{opacity:0!important;transform:translateY(8px)!important}
        .xjw-safe-online.offline{opacity:1!important;transform:none!important}
        #xjwMobileNav{display:grid;position:fixed;left:0;right:0;bottom:0;z-index:900;grid-template-columns:repeat(5,1fr);padding:7px 7px calc(7px + env(safe-area-inset-bottom));background:rgba(255,255,255,.97);border-top:1px solid #ded5c5;box-shadow:0 -8px 28px #0b1f3b18;backdrop-filter:blur(16px)}
        #xjwMobileNav button{appearance:none;border:0;background:transparent;color:#087bea;min-width:0;min-height:54px;padding:4px 2px;border-radius:14px;font-weight:800;font-size:12px!important;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px}
        #xjwMobileNav button .xjw-mobile-icon{font-size:20px;line-height:1}
        #xjwMobileNav button.active{color:#8d2024;background:#f6efe7}
        #xjwMobileBackdrop{display:block;position:fixed;inset:0;z-index:910;background:#06132688;opacity:0;pointer-events:none;transition:opacity .2s ease}
        #xjwMobileBackdrop.open{opacity:1;pointer-events:auto}
        #xjwMobileSheet{display:block;position:fixed;left:10px;right:10px;bottom:calc(78px + env(safe-area-inset-bottom));z-index:920;background:#fffdf8;border:1px solid #d8c6a4;border-radius:24px;padding:14px;box-shadow:0 22px 60px #06132655;transform:translateY(120%);opacity:0;pointer-events:none;transition:transform .22s ease,opacity .22s ease}
        #xjwMobileSheet.open{transform:translateY(0);opacity:1;pointer-events:auto}
        #xjwMobileSheetHeader{display:flex;align-items:center;justify-content:space-between;margin:0 2px 10px}
        #xjwMobileSheetHeader strong{font-size:18px}
        #xjwMobileSheetClose{border:0;background:#f0ece4;border-radius:12px;width:40px;height:40px;font-size:22px!important}
        #xjwMobileMoreGrid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}
        #xjwMobileMoreGrid button{border:1px solid #ded5c5;background:#fff;border-radius:15px;min-height:50px;text-align:left;padding:10px 12px;font-weight:800;color:#0b1f3b}
        #xjwMobileMoreGrid button.active{background:#0b1f3b;color:#fff;border-color:#0b1f3b}
      }
    `;
    document.head.appendChild(style);
  }

  function availableViews() {
    const seen = new Set();
    const result = [];
    document.querySelectorAll("[data-view]").forEach((node) => {
      const view = String(node.dataset.view || "");
      if (!view || seen.has(view) || !byId(view)) return;
      seen.add(view);
      result.push({ view, label: LABELS[view] || String(node.textContent || view).trim() });
    });
    document.querySelectorAll(".view[id]").forEach((node) => {
      if (!node.id || seen.has(node.id)) return;
      seen.add(node.id);
      result.push({ view: node.id, label: LABELS[node.id] || node.id });
    });
    return result;
  }

  function activeView() { return document.querySelector(".view.active")?.id || "dashboard"; }
  function closeMore() {
    byId("xjwMobileBackdrop")?.classList.remove("open");
    byId("xjwMobileSheet")?.classList.remove("open");
    byId("xjwMobileMore")?.setAttribute("aria-expanded", "false");
  }
  function openMore() {
    buildMoreItems();
    byId("xjwMobileBackdrop")?.classList.add("open");
    byId("xjwMobileSheet")?.classList.add("open");
    byId("xjwMobileMore")?.setAttribute("aria-expanded", "true");
  }
  function syncActive() {
    const active = activeView();
    document.querySelectorAll("#xjwMobileNav [data-mobile-view],#xjwMobileMoreGrid [data-mobile-view]").forEach((button) => {
      button.classList.toggle("active", button.dataset.mobileView === active);
    });
    const primaryViews = new Set(PRIMARY.map((item) => item.view));
    byId("xjwMobileMore")?.classList.toggle("active", !primaryViews.has(active));
  }
  function navigate(view) {
    if (!view || !byId(view)) return;
    if (typeof window.showView === "function") window.showView(view);
    else {
      document.querySelectorAll(".view").forEach((node) => node.classList.toggle("active", node.id === view));
      document.querySelectorAll("[data-view]").forEach((node) => node.classList.toggle("active", node.dataset.view === view));
      window.scrollTo(0, 0);
    }
    closeMore();
    syncActive();
  }
  function buildMoreItems() {
    const grid = byId("xjwMobileMoreGrid");
    if (!grid) return;
    const primaryViews = new Set(PRIMARY.map((item) => item.view));
    const items = availableViews().filter((item) => !primaryViews.has(item.view));
    const signature = items.map((item) => `${item.view}:${item.label}`).join("|");
    if (signature === moreSignature) return;
    moreSignature = signature;
    grid.innerHTML = items.map((item) => `<button type="button" data-mobile-view="${item.view}">${item.label}</button>`).join("");
    syncActive();
  }
  function buildNavigation() {
    if (byId("xjwMobileNav")) return;
    const nav = document.createElement("nav");
    nav.id = "xjwMobileNav";
    nav.setAttribute("aria-label", "手機版主要功能");
    nav.innerHTML = PRIMARY.map((item) => `<button type="button" data-mobile-view="${item.view}" aria-label="${item.label}"><span class="xjw-mobile-icon" aria-hidden="true">${item.icon}</span><span>${item.label}</span></button>`).join("") + '<button id="xjwMobileMore" type="button" aria-expanded="false" aria-controls="xjwMobileSheet"><span class="xjw-mobile-icon" aria-hidden="true">•••</span><span>更多</span></button>';
    document.body.appendChild(nav);
    const backdrop = document.createElement("div");
    backdrop.id = "xjwMobileBackdrop";
    document.body.appendChild(backdrop);
    const sheet = document.createElement("section");
    sheet.id = "xjwMobileSheet";
    sheet.setAttribute("aria-label", "更多功能");
    sheet.innerHTML = '<div id="xjwMobileSheetHeader"><strong>更多功能</strong><button id="xjwMobileSheetClose" type="button" aria-label="關閉">×</button></div><div id="xjwMobileMoreGrid"></div>';
    document.body.appendChild(sheet);
    nav.addEventListener("click", (event) => {
      const button = event.target.closest("button");
      if (!button) return;
      if (button.id === "xjwMobileMore") openMore();
      else if (button.dataset.mobileView) navigate(button.dataset.mobileView);
    });
    backdrop.addEventListener("click", closeMore);
    byId("xjwMobileSheetClose")?.addEventListener("click", closeMore);
    sheet.addEventListener("click", (event) => {
      const button = event.target.closest("[data-mobile-view]");
      if (button) navigate(button.dataset.mobileView);
    });
    document.addEventListener("keydown", (event) => { if (event.key === "Escape") closeMore(); });
  }
  function tameConnectionBadge() {
    const badge = byId("xjwSafeConnection");
    if (!badge || badge.dataset.xjwMobileManaged === "1") return;
    badge.dataset.xjwMobileManaged = "1";
    const fade = () => {
      badge.classList.remove("xjw-mobile-hidden");
      if (isMobile() && navigator.onLine) setTimeout(() => badge.classList.add("xjw-mobile-hidden"), 2200);
    };
    window.addEventListener("online", fade);
    window.addEventListener("offline", () => badge.classList.remove("xjw-mobile-hidden"));
    fade();
  }
  function scheduleRefresh() {
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(() => {
      if (!isMobile()) return;
      buildMoreItems();
      syncActive();
      tameConnectionBadge();
    }, 80);
  }
  function install() {
    installStyles();
    buildNavigation();
    buildMoreItems();
    syncActive();
    tameConnectionBadge();
    const observer = new MutationObserver(scheduleRefresh);
    observer.observe(document.body, { childList: true, subtree: true });
    document.addEventListener("click", () => setTimeout(syncActive, 0), true);
    window.matchMedia(MOBILE_QUERY).addEventListener?.("change", () => { closeMore(); scheduleRefresh(); });
    window.xjwMobile = { version: VERSION, navigate, openMore, closeMore, syncActive };
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", install, { once: true });
  else install();
})();
