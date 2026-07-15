"use strict";

(() => {
  const VERSION = "20260715-postboot-1";
  async function run() {
    try {
      if (typeof window.loadAll === "function") await window.loadAll();
      if (typeof window.xjwSafeExtras?.refresh === "function") await window.xjwSafeExtras.refresh();
      document.documentElement.dataset.xjwAppReady = "1";
      window.xjwPostboot = { version: VERSION, ready: true };
    } catch (error) {
      console.error("internal app postboot failed", error);
      const event = new CustomEvent("xjw:postboot-error", { detail: { message: error.message || String(error) } });
      window.dispatchEvent(event);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => setTimeout(run, 120), { once: true });
  } else {
    setTimeout(run, 120);
  }
})();
