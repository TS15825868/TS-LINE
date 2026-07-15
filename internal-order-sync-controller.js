"use strict";

(() => {
  const VERSION = "20260715-order-sync-1";
  const HEADERS = { "Content-Type": "application/json", "X-XJW-Requested-With": "internal-app-v2" };
  let state = null;
  let refreshing = false;

  const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[char]));

  async function api(url) {
    const response = await fetch(url, { headers: HEADERS });
    if (response.status === 401) {
      location.href = "/internal/login";
      throw new Error("請重新登入");
    }
    const data = await response.json().catch(() => ({ ok: false }));
    if (!response.ok || data.ok === false) throw new Error(data.error || "讀取失敗");
    return data;
  }

  function decorateInventory() {
    if (!state) return;
    const rows = state.inventory || [];
    document.querySelectorAll("#inventoryList > .item").forEach((card) => {
      const title = card.querySelector("h3")?.textContent?.trim();
      const item = rows.find((row) => row.name === title);
      if (!item) return;
      let area = card.querySelector(".xjw-reserved-summary");
      if (!area) {
        area = document.createElement("div");
        area.className = "xjw-reserved-summary notice";
        card.querySelector(".toolbar")?.insertAdjacentElement("afterend", area);
      }
      const stock = Number(item.stock || 0);
      const reserved = Number(item.reserved || 0);
      const available = Math.max(0, stock - reserved);
      area.innerHTML = `<strong>可用庫存：${available}</strong><span style="margin-left:12px">實體 ${stock}｜已保留 ${reserved}</span>`;
      area.classList.toggle("error", available <= Number(item.lowStock || 0));
    });
  }

  function decorateOrders() {
    if (!state) return;
    const rows = state.orders || [];
    document.querySelectorAll("#orderList > .item").forEach((card) => {
      const edit = card.querySelector("[data-order-edit]");
      const id = edit?.dataset.orderEdit;
      const item = rows.find((row) => row.id === id);
      if (!item) return;
      let area = card.querySelector(".xjw-order-sync-summary");
      if (!area) {
        area = document.createElement("div");
        area.className = "xjw-order-sync-summary meta";
        card.querySelector(".actions")?.insertAdjacentElement("beforebegin", area);
      }
      const source = item.source || "內部 App";
      const mode = item.inventoryMode === "shipped" ? "已扣庫存" : item.inventoryMode === "cancelled" ? "已釋放／回補" : "已保留庫存";
      const line = item.lineUserId
        ? (item.lastLineNotificationError ? `LINE 通知失敗：${item.lastLineNotificationError}` : item.lastLineNotificationAt ? `LINE 已通知 ${new Date(item.lastLineNotificationAt).toLocaleString("zh-TW", { hour12:false })}` : "LINE 訂單，可自動通知")
        : "無 LINE userId，不會自動推播";
      area.innerHTML = `<span class="pill">${esc(source)}</span>　${esc(mode)}｜${esc(line)}`;
    });
  }

  function render() {
    decorateInventory();
    decorateOrders();
  }

  async function refresh() {
    if (refreshing) return;
    refreshing = true;
    try {
      state = await api("/internal/api/v2/state");
      render();
    } catch (error) {
      console.warn("order sync controller", error.message);
    } finally {
      refreshing = false;
    }
  }

  function start() {
    const observer = new MutationObserver(() => render());
    ["inventoryList", "orderList"].forEach((id) => {
      const node = document.getElementById(id);
      if (node) observer.observe(node, { childList: true, subtree: true });
    });
    const originalLoadAll = window.loadAll;
    if (typeof originalLoadAll === "function" && !originalLoadAll.__xjwOrderSyncWrapped) {
      const wrapped = async (...args) => {
        const result = await originalLoadAll(...args);
        await refresh();
        return result;
      };
      wrapped.__xjwOrderSyncWrapped = true;
      window.loadAll = wrapped;
    }
    refresh();
    window.xjwOrderSync = { version: VERSION, refresh };
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
