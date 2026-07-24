"use strict";

(() => {
  const VERSION = "20260724-shell-ipad-touch-4";
  const CONTROL_SELECTOR = "button,a[href],[data-view],summary,[role='button']";
  let refreshing = false;
  let touchState = null;
  let lastClickControl = null;
  let lastClickAt = 0;
  let fallbackTimer = null;

  function elementFrom(target) {
    if (target instanceof Element) return target;
    return target?.parentElement || null;
  }

  function controlFrom(target) {
    return elementFrom(target)?.closest?.(CONTROL_SELECTOR) || null;
  }

  function enabled(control) {
    return Boolean(control)
      && control.disabled !== true
      && control.getAttribute("aria-disabled") !== "true"
      && control.hidden !== true;
  }

  function controlAtPoint(x, y) {
    const stack = typeof document.elementsFromPoint === "function"
      ? document.elementsFromPoint(x, y)
      : [document.elementFromPoint(x, y)].filter(Boolean);
    for (const node of stack) {
      const control = controlFrom(node);
      if (enabled(control)) return control;
    }
    return null;
  }

  function showView(id) {
    if (!id || !document.getElementById(id)) return false;
    document.querySelectorAll(".view").forEach((node) => node.classList.toggle("active", node.id === id));
    document.querySelectorAll("[data-view]").forEach((node) => node.classList.toggle("active", node.dataset.view === id));
    window.scrollTo(0, 0);
    return true;
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
      if (typeof window.xjwSafeExtras?.refresh === "function") await window.xjwSafeExtras.refresh();
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

  function activateFallback(control) {
    if (!enabled(control)) return;
    const view = control.closest("[data-view]");
    if (view?.dataset.view) {
      showView(view.dataset.view);
      return;
    }
    if (isRefreshButton(control.closest("button"))) {
      refreshApp(control.closest("button"));
      return;
    }
    control.click();
  }

  function installTapRecovery() {
    const touchDevice = Number(navigator.maxTouchPoints || 0) > 0
      || window.matchMedia?.("(pointer: coarse)")?.matches;
    if (!touchDevice || document.documentElement.dataset.xjwTapRecovery === "1") return;
    document.documentElement.dataset.xjwTapRecovery = "1";

    const style = document.createElement("style");
    style.id = "xjwTapRecoveryStyle";
    style.textContent = `${CONTROL_SELECTOR}{touch-action:manipulation!important;-webkit-tap-highlight-color:rgba(11,31,59,.14)}#xjwMobileBackdrop:not(.open),#xjwMobileSheet:not(.open){pointer-events:none!important}`;
    document.head.appendChild(style);

    document.addEventListener("click", (event) => {
      const control = controlFrom(event.target);
      if (!control) return;
      lastClickControl = control;
      lastClickAt = Date.now();
    }, true);

    document.addEventListener("touchstart", (event) => {
      if (event.touches?.length !== 1) { touchState = null; return; }
      const point = event.touches[0];
      touchState = {
        control: controlFrom(event.target) || controlAtPoint(point.clientX, point.clientY),
        x: point.clientX,
        y: point.clientY,
        moved: false,
      };
    }, { capture: true, passive: true });

    document.addEventListener("touchmove", (event) => {
      if (!touchState || !event.touches?.length) return;
      const point = event.touches[0];
      if (Math.hypot(point.clientX - touchState.x, point.clientY - touchState.y) > 28) touchState.moved = true;
    }, { capture: true, passive: true });

    document.addEventListener("touchend", (event) => {
      const state = touchState;
      touchState = null;
      if (!state || state.moved) return;
      const point = event.changedTouches?.[0];
      if (!point) return;
      if (Math.hypot(point.clientX - state.x, point.clientY - state.y) > 28) return;
      const control = controlAtPoint(point.clientX, point.clientY) || state.control;
      if (!enabled(control)) return;
      const endedAt = Date.now();
      clearTimeout(fallbackTimer);
      fallbackTimer = setTimeout(() => {
        const nativeClickArrived = lastClickControl === control && lastClickAt >= endedAt - 40;
        if (!nativeClickArrived) activateFallback(control);
      }, 320);
    }, { capture: true, passive: true });

    document.addEventListener("touchcancel", () => { touchState = null; }, { capture: true, passive: true });
  }

  function bind() {
    document.querySelectorAll("button").forEach((button) => {
      if (String(button.textContent || "").trim() === "重新整理") {
        button.dataset.refreshApp = "true";
        button.type = "button";
      }
    });

    installTapRecovery();

    document.addEventListener("click", (event) => {
      const target = elementFrom(event.target);
      const button = target?.closest("button");
      if (isRefreshButton(button)) {
        event.preventDefault();
        event.stopImmediatePropagation();
        refreshApp(button);
        return;
      }
      const viewButton = target?.closest("[data-view]");
      if (viewButton?.dataset.view) {
        event.preventDefault();
        event.stopImmediatePropagation();
        showView(viewButton.dataset.view);
      }
    });

    window.addEventListener("error", (event) => showError(event.message || event.error?.message || "未知錯誤"));
    window.addEventListener("unhandledrejection", (event) => showError(event.reason?.message || String(event.reason || "未知非同步錯誤")));
    window.addEventListener("beforeunload", () => clearTimeout(fallbackTimer), { once: true });
  }

  window.showView = showView;
  window.xjwRefreshApp = refreshApp;
  window.xjwShell = { version: VERSION, showView, refreshApp, installTapRecovery };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", bind, { once: true });
  else bind();
})();