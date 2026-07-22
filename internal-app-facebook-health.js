"use strict";

(() => {
  const VERSION = "20260722-facebook-health-1";
  let health = null;
  let timer = null;

  async function loadHealth(force = false) {
    const response = await fetch(`/social/facebook-healthz${force ? "?refresh=1" : ""}&t=${Date.now()}`.replace("z&", "z?"), {
      cache: "no-store",
    });
    const data = await response.json().catch(() => ({}));
    health = data;
    apply();
    return data;
  }

  function failurePosts() {
    return [...document.querySelectorAll("#socialList > .item")].filter((card) => {
      const text = String(card.textContent || "");
      return text.includes("Facebook：失敗") || text.includes("Facebook Token") || text.includes("Access Token 已過期");
    });
  }

  function applyConfig() {
    const node = document.getElementById("socialConfig");
    if (!node) return;
    const igConfigured = !/IG 未設定/.test(node.textContent || "");
    const ig = igConfigured ? "IG 已設定" : "IG 未設定";
    let fb = "FB 檢查中";
    if (health?.expired) fb = "FB Token 已過期";
    else if (health?.usable === true) fb = "FB 已連線";
    else if (health?.configured === false) fb = "FB 未設定";
    else if (health?.usable === false) fb = "FB 連線異常";
    node.textContent = `${ig}／${fb}`;
    node.style.color = health?.expired || health?.usable === false ? "#8d2024" : "";
    node.style.fontWeight = health?.expired || health?.usable === false ? "800" : "";
  }

  function applySummary() {
    const summary = document.getElementById("xjwSocialSummary");
    if (!summary) return;
    let warning = document.getElementById("xjwFacebookTokenWarning");
    if (!warning) {
      warning = document.createElement("div");
      warning.id = "xjwFacebookTokenWarning";
      warning.className = "notice error";
      warning.style.margin = "0 0 9px";
      summary.insertAdjacentElement("afterend", warning);
    }
    if (health?.expired) {
      warning.hidden = false;
      warning.textContent = "Facebook Page Token 已過期。Instagram 已成功的貼文不會重複發布；更新 Render 的 META_PAGE_ACCESS_TOKEN 後，再按「重試失敗平台」。";
    } else if (health?.usable === false) {
      warning.hidden = false;
      warning.textContent = `Facebook 連線異常：${health.error || "請檢查 Page Token 與粉絲專頁權限。"}`;
    } else {
      warning.hidden = true;
      warning.textContent = "";
    }
  }

  function applyFailureFilter() {
    const button = document.querySelector('[data-social-filter="failed"]');
    if (!button) return;
    const count = button.querySelector('[data-filter-count="failed"]')?.textContent || "";
    button.childNodes.forEach((node) => {
      if (node.nodeType === Node.TEXT_NODE) node.textContent = `待補發 `;
    });
    if (!button.textContent.includes("待補發")) button.insertAdjacentText("afterbegin", "待補發 ");
    const countNode = button.querySelector('[data-filter-count="failed"]');
    if (countNode) countNode.textContent = count;
  }

  function applyRetryButtons() {
    const expired = health?.expired === true;
    failurePosts().forEach((card) => {
      const button = card.querySelector('[data-social-action="publish"]');
      if (!button) return;
      button.disabled = expired;
      button.title = expired ? "先更新 Facebook Page Token，再重新整理後補發 Facebook" : "";
      button.textContent = expired ? "Facebook Token 已過期" : "重試失敗平台";
    });
  }

  function apply() {
    applyConfig();
    applySummary();
    applyFailureFilter();
    applyRetryButtons();
  }

  function start() {
    loadHealth(true).catch(() => {});
    timer = setInterval(() => loadHealth(false).catch(() => {}), 30000);
    const observer = new MutationObserver(apply);
    observer.observe(document.body, { childList: true, subtree: true });
    window.addEventListener("beforeunload", () => {
      clearInterval(timer);
      observer.disconnect();
    }, { once: true });
    window.addEventListener("xjw:app-refreshed", () => loadHealth(true).catch(() => {}));
    window.xjwFacebookHealth = { version: VERSION, refresh: () => loadHealth(true), get health() { return health; } };
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
  else start();
})();
