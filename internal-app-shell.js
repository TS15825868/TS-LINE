"use strict";

(() => {
  const VERSION = "20260715-shell-2";
  let refreshing = false;

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

  function bind() {
    document.querySelectorAll("button").forEach((button) => {
      if (String(button.textContent || "").trim() === "重新整理") {
        button.dataset.refreshApp = "true";
        button.type = "button";
      }
    });

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
  window.xjwShell = { version: VERSION, showView, refreshApp };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", bind, { once: true });
  else bind();
})();