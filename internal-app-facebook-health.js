"use strict";

(() => {
  const VERSION = "20260724-facebook-health-polling-2";
  let health = null;
  let healthTimer = null;
  let uiTimer = null;

  async function loadHealth(force = false) {
    const separator = force ? "?refresh=1&" : "?";
    const response = await fetch(`/social/facebook-healthz${separator}t=${Date.now()}`, { cache: "no-store" });
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

  function setText(node, value) {
    if (node && node.textContent !== value) node.textContent = value;
  }

  function setStyle(node, key, value) {
    if (node && node.style[key] !== value) node.style[key] = value;
  }

  function setBoolean(node, key, value) {
    if (node && node[key] !== value) node[key] = value;
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
    setText(node, `${ig}／${fb}`);
    const warning = health?.expired || health?.usable === false;
    setStyle(node, "color", warning ? "#8d2024" : "");
    setStyle(node, "fontWeight", warning ? "800" : "");
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
    let message = "";
    if (health?.expired) {
      message = "Facebook Page Token 已過期，但立即發布不會被鎖住。Instagram 可先發布；Facebook 若失敗會保留為待補發，更新 META_PAGE_ACCESS_TOKEN 後再按『重試失敗平台』。";
    } else if (health?.usable === false) {
      message = `Facebook 連線異常，但立即發布仍可操作：${health.error || "請檢查 Page Token 與粉絲專頁權限。"}`;
    }
    setBoolean(warning, "hidden", !message);
    setText(warning, message);
  }

  function applyFailureFilter() {
    const button = document.querySelector('[data-social-filter="failed"]');
    if (!button) return;
    const textNode = [...button.childNodes].find((node) => node.nodeType === Node.TEXT_NODE);
    if (textNode && textNode.textContent !== "待補發 ") textNode.textContent = "待補發 ";
    if (!textNode && !button.textContent.includes("待補發")) button.insertAdjacentText("afterbegin", "待補發 ");
  }

  function applyRetryButtons() {
    const expired = health?.expired === true;
    failurePosts().forEach((card) => {
      const button = card.querySelector('[data-social-action="publish"]');
      if (!button) return;
      setBoolean(button, "disabled", false);
      button.removeAttribute("aria-disabled");
      setStyle(button, "pointerEvents", "auto");
      const title = expired
        ? "立即發布仍可使用；Instagram 可先發布，Facebook 若失敗會保留為待補發。"
        : "立即重試尚未成功的平台。";
      if (button.title !== title) button.title = title;
      setText(button, "重試失敗平台");
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
    healthTimer = setInterval(() => loadHealth(false).catch(() => {}), 30000);
    uiTimer = setInterval(apply, 2500);
    window.addEventListener("beforeunload", () => {
      clearInterval(healthTimer);
      clearInterval(uiTimer);
    }, { once: true });
    window.addEventListener("xjw:app-refreshed", () => loadHealth(true).catch(() => {}));
    window.xjwFacebookHealth = { version: VERSION, refresh: () => loadHealth(true), get health() { return health; } };
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
  else start();
})();