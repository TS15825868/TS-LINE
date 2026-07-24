"use strict";

(() => {
  const VERSION = "20260724-shell-ipad-touch-3";
  let refreshing = false;
  let touchState = null;

  function showView(id) {
    document.querySelectorAll(".view").forEach((node) => node.classList.toggle("active", node.id === id));
    document.querySelectorAll("[data-view]").forEach((node) => node.classList.toggle("active", node.dataset.view === id));
    window.scrollTo(0, 0);
  }

  function showError(message) {
    let banner = document.getElementById("xjwShellError");
    if (!banner) {
      banner = document.createElement("div");
      banner.id = "xjwShellError";
      banner.className = "notice error";
      const top = document.querySelector(".top");
      if (top) top.insertAdjacentElement("afterend", banner);
    }
    banner.textContent = `管理 App 發生前端錯誤：${message}`;
    banner.hidden = false;
  }

  function isRefreshButton(button) {
    const label = String(button?.textContent || "").trim();
    return button?.dataset?.refreshApp === "true"
      || ["重新整理", "更新中…", "已更新", "更新失敗"].includes(label);
  }

  async function refreshApp(button) {
    if (refreshing) return;
    refreshing = true;
    const original = button?.dataset?.originalLabel || "重新整理";
    if (button) {
      button.dataset.originalLabel = original;
      button.type = "button";
      button.disabled = true;
      button.textContent = "更新中…";
      button.setAttribute("aria-busy", "true");
    }

    try {
      if (typeof window.loadAll !== "function") {
        const url = new URL(location.href);
        url.searchParams.set("v", String(Date.now()));
        location.replace(url.toString());
        return;
      }
      await window.loadAll();
      if (typeof window.xjwSafeExtras?.refresh === "function") {
        await window.xjwSafeExtras.refresh();
      }
      const lastSync = document.getElementById("lastSync");
      if (lastSync) lastSync.textContent = `更新：${new Date().toLocaleString("zh-TW", { hour12: false })}`;
      if (button) button.textContent = "已更新";
      window.xjwSocialRetry?.refresh?.();
      setTimeout(() => { if (button) button.textContent = original; }, 1200);
    } catch (error) {
      if (button) button.textContent = "更新失敗";
      showError(error.message || "重新整理失敗");
      setTimeout(() => { if (button) button.textContent = original; }, 1800);
    } finally {
      if (button) {
        button.disabled = false;
        button.removeAttribute("aria-busy");
      }
      refreshing = false;
    }
  }

  function controlFrom(target) {
    return target?.closest?.("button,a[href],[data-view],summary,[role='button']") || null;
  }

  function installTouchFallback() {
    const touchDevice = Number(navigator.maxTouchPoints || 0) > 0
      || window.matchMedia?.("(pointer: coarse)")?.matches;
    if (!touchDevice || document.documentElement.dataset.xjwTouchFallback === "1") return;
    document.documentElement.dataset.xjwTouchFallback = "1";

    const style = document.createElement("style");
    style.id = "xjwTouchFallbackStyle";
    style.textContent = "button,a[href],[data-view],summary,[role='button']{touch-action:manipulation!important;-webkit-tap-highlight-color:rgba(11,31,59,.14);pointer-events:auto!important}#xjwMobileBackdrop:not(.open),#xjwMobileSheet:not(.open){pointer-events:none!important}";
    document.head.appendChild(style);

    document.addEventListener("touchstart", (event) => {
      if (event.touches?.length !== 1) { touchState = null; return; }
      const control = controlFrom(event.target);
      if (!control) { touchState = null; return; }
      const point = event.touches[0];
      touchState = { control, x: point.clientX, y: point.clientY, moved: false };
    }, { capture: true, passive: true });

    document.addEventListener("touchmove", (event) => {
      if (!touchState || !event.touches?.length) return;
      const point = event.touches[0];
      if (Math.hypot(point.clientX - touchState.x, point.clientY - touchState.y) > 14) touchState.moved = true;
    }, { capture: true, passive: true });

    document.addEventListener("touchend", (event) => {
      const state = touchState;
      touchState = null;
      if (!state || state.moved || state.control.disabled || state.control.getAttribute("aria-disabled") === "true") return;
      const point = event.changedTouches?.[0];
      if (point && Math.hypot(point.clientX - state.x, point.clientY - state.y) > 14) return;
      event.preventDefault();
      state.control.click();
    }, { capture: true, passive: false });

    document.addEventListener("touchcancel", () => { touchState = null; }, { capture: true, passive: true });
  }

  function bind() {
    document.querySelectorAll("button").forEach((button) => {
      if (String(button.textContent || "").trim() === "重新整理") {
        button.dataset.refreshApp = "true";
        button.type = "button";
      }
    });

    installTouchFallback();

    document.addEventListener("click", (event) => {
      const refreshButton = event.target.closest("button[data-refresh-app='true']");
      if (refreshButton || isRefreshButton(event.target.closest("button"))) {
        event.preventDefault();
        event.stopImmediatePropagation();
        refreshApp(refreshButton || event.target.closest("button"));
        return;
      }

      const viewButton = event.target.closest("[data-view]");
      if (viewButton) {
        event.preventDefault();
        showView(viewButton.dataset.view);
      }
    }, true);

    window.addEventListener("error", (event) => {
      const message = event.message || event.error?.message || "未知錯誤";
      showError(message);
    });
    window.addEventListener("unhandledrejection", (event) => {
      const message = event.reason?.message || String(event.reason || "未知非同步錯誤");
      showError(message);
    });
  }

  window.showView = showView;
  window.xjwRefreshApp = refreshApp;
  window.xjwShell = { version: VERSION, showView, refreshApp, installTouchFallback };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", bind, { once: true });
  else bind();
})();