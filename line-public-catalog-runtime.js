"use strict";
// 唯一公開來源：官網 partner-catalog.json 的 public=true，且 products.html 實際有商品卡。
// 未核准商品、個別丹參口味、藥品與未上架商品一律不自動進 LINE 展示。
const snapshot = require("./line-partner-public-carousel.json");
const BASE = "https://raw.githubusercontent.com/TS15825868/xianjiawei/main/";
const PERIOD_MS = 15 * 60 * 1000;
let approved = (snapshot.products || []).filter(isValid);
let nextRefresh = 0;
let activeRefresh = null;
function isValid(p) {
  return p && /^[a-z0-9-]+$/.test(String(p.id || "")) &&
    !!String(p.name || "").trim() && !!String(p.size || p.specification || "").trim() &&
    /^product-[a-z0-9-]+\.html$/.test(String(p.page || "")) &&
    /^images\/[a-z0-9_./-]+\.(?:webp|jpe?g|png)$/i.test(String(p.image || "")) &&
    !String(p.image).includes("..");
}
function current() { return approved; }
async function refresh({ force = false } = {}) {
  if (!force && Date.now() < nextRefresh) return approved;
  if (activeRefresh) return activeRefresh;
  activeRefresh = (async () => {
    try {
      const [catalogResponse, pageResponse] = await Promise.all([
        fetch(BASE + "partner-catalog.json", { signal: AbortSignal.timeout(8500) }),
        fetch(BASE + "products.html", { signal: AbortSignal.timeout(8500) }),
      ]);
      if (!catalogResponse.ok || !pageResponse.ok) throw new Error("官網正式目錄暫時無法讀取");
      const catalog = await catalogResponse.json();
      const html = await pageResponse.text();
      if (!Array.isArray(catalog.products)) throw new Error("官網 partner-catalog 格式不正確");
      const liveIds = new Set([...html.matchAll(/data-fallback-product="([^"]+)"/g)].map(x => x[1]));
      if (!liveIds.size) throw new Error("官網商品卡清單為空，暫保留上次已核准展示");
      const candidates = catalog.products.filter(p =>
        p.public === true && !p.medicine && isValid(p) && liveIds.has(p.id)
      ).map(p => ({
        id: p.id, name: p.name, specification: p.size || p.specification,
        image: p.image, page: p.page,
      }));
      if (!candidates.length) throw new Error("未取得任何已公開其他商品，暫保留已核准展示");
      if (candidates.length !== new Set(candidates.map(p => p.id)).size) throw new Error("已公開商品 ID 重複");
      approved = candidates;
    } catch (error) {
      console.warn("LINE 官網新品自動同步暫保留上次已核准商品：", error.message);
    } finally {
      nextRefresh = Date.now() + PERIOD_MS;
      activeRefresh = null;
    }
    return approved;
  })();
  return activeRefresh;
}
module.exports = { current, refresh, PERIOD_MS, isValid };
