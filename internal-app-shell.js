"use strict";

(() => {
  const VERSION = "20260715-shell-1";

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

  function bind() {
    document.addEventListener("click", (event) => {
      const viewButton = event.target.closest("[data-view]");
      if (viewButton) {
        event.preventDefault();
        showView(viewButton.dataset.view);
        return;
      }

      const button = event.target.closest("button");
      if (!button) return;
      const label = String(button.textContent || "").trim();
      if (label === "重新整理" && typeof window.loadAll !== "function") {
        event.preventDefault();
        const url = new URL(location.href);
        url.searchParams.set("v", String(Date.now()));
        location.replace(url.toString());
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
  window.xjwShell = { version: VERSION, showView };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", bind, { once: true });
  else bind();
})();
