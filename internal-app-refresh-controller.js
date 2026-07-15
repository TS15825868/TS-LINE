"use strict";

(() => {
  const VERSION = "20260715-refresh-1";
  let running = false;

  function findRefreshButtons() {
    return [...document.querySelectorAll("button,a")].filter((node) => {
      const label = String(node.textContent || "").trim();
      return label === "重新整理" || node.id === "opsRefreshBtn" || node.dataset.refreshApp === "true";
    });
  }

  function setButtonState(button, state) {
    if (!button.dataset.originalLabel) button.dataset.originalLabel = String(button.textContent || "重新整理").trim();
    if (state === "loading") {
      button.textContent = "更新中…";
      button.setAttribute("aria-busy", "true");
      button.disabled = true;
      button.style.opacity = ".65";
      return;
    }
    if (state === "done") button.textContent = "已更新";
    else if (state === "error") button.textContent = "更新失敗";
    else button.textContent = button.dataset.originalLabel || "重新整理";
    button.removeAttribute("aria-busy");
    button.disabled = false;
    button.style.opacity = "";
  }

  async function requestJson(url) {
    const response = await fetch(url, {
      cache: "no-store",
      headers: { "X-XJW-Requested-With": "internal-app-v2" },
    });
    if (response.status === 401) {
      location.href = "/internal/login";
      throw new Error("請重新登入");
    }
    const data = await response.json().catch(() => ({ ok: false, error: "系統回覆格式錯誤" }));
    if (!response.ok || data.ok === false) throw new Error(data.error || "資料更新失敗");
    return data;
  }

  async function refreshApp(sourceButton) {
    if (running) return;
    running = true;
    const buttons = findRefreshButtons();
    buttons.forEach((button) => setButtonState(button, "loading"));

    try {
      if (typeof window.loadAll === "function") {
        await window.loadAll();
      } else {
        await requestJson(`/internal/api/v2/state?t=${Date.now()}`);
      }

      await Promise.allSettled([
        requestJson(`/internal/api/v2/ops/analytics?t=${Date.now()}`),
        requestJson(`/internal/api/v2/ops/diagnostics?t=${Date.now()}`),
        requestJson(`/internal/db-healthz?t=${Date.now()}`),
      ]);

      const lastSync = document.getElementById("lastSync");
      if (lastSync) {
        lastSync.textContent = `更新：${new Date().toLocaleString("zh-TW", { hour12: false })}`;
      }

      buttons.forEach((button) => setButtonState(button, "done"));
      setTimeout(() => buttons.forEach((button) => setButtonState(button, "idle")), 1200);
      document.dispatchEvent(new CustomEvent("xjw:app-refreshed", { detail: { at: Date.now(), version: VERSION } }));
    } catch (error) {
      buttons.forEach((button) => setButtonState(button, "error"));
      alert(error.message || "重新整理失敗");
      setTimeout(() => buttons.forEach((button) => setButtonState(button, "idle")), 1600);
      if (typeof window.loadAll !== "function") {
        const url = new URL(location.href);
        url.searchParams.set("v", String(Date.now()));
        location.replace(url.toString());
      }
    } finally {
      running = false;
    }
  }

  function bind() {
    const buttons = findRefreshButtons();
    buttons.forEach((button) => {
      if (button.dataset.xjwRefreshBound === "1") return;
      button.dataset.xjwRefreshBound = "1";
      button.type = button.tagName === "BUTTON" ? "button" : button.type;
      button.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopImmediatePropagation();
        refreshApp(button);
      }, true);
    });
    return buttons.length > 0;
  }

  function start() {
    bind();
    const observer = new MutationObserver(() => bind());
    observer.observe(document.body, { childList: true, subtree: true });
    window.xjwRefreshApp = refreshApp;
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
