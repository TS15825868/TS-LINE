"use strict";

const fs = require("fs");
const path = require("path");

function readCatalog() {
  const file = path.join(__dirname, "data.json");
  const data = JSON.parse(fs.readFileSync(file, "utf8"));
  return Array.isArray(data.products) ? data.products : [];
}

function promotionFields(product = {}) {
  return {
    offers: Array.isArray(product.offers)
      ? product.offers.filter((offer) => offer && typeof offer === "object").map((offer) => ({
          qty: Number(offer.qty || 0),
          total: Number(offer.total || 0),
          label: String(offer.label || ""),
        })).filter((offer) => offer.qty > 0 && offer.total >= 0 && offer.label)
      : [],
    promotionTexts: Array.isArray(product.promotionTexts) ? [...product.promotionTexts] : [],
    quoteOnly: product.quoteOnly === true,
  };
}

function seedInventory(readStore, writeStore) {
  const store = readStore();
  store.inventory = Array.isArray(store.inventory) ? store.inventory : [];
  const products = readCatalog();
  const existing = new Map(store.inventory.map((item) => [String(item.productId || item.id || ""), item]));
  let added = 0;
  let updated = 0;

  for (const product of products) {
    const productId = String(product.id || "").trim();
    if (!productId) continue;
    const current = existing.get(productId);
    const promotions = promotionFields(product);
    if (current) {
      const next = {
        name: String(product.displayName || product.name || productId),
        spec: String(product.size || product.spec || ""),
        unit: String(product.unit || current.unit || "件"),
        // Public catalogue is quote-only; never overwrite private ERP prices here.
        // Quote-only public data does not carry private promotion authority.
        // Preserve any confirmed internal promotions instead of wiping them.
        ...(promotions.quoteOnly ? {} : {
          offers: promotions.offers,
          promotionTexts: promotions.promotionTexts,
        }),
        quoteOnly: promotions.quoteOnly,
      };
      let changed = false;
      Object.entries(next).forEach(([key, value]) => {
        if (JSON.stringify(current[key]) !== JSON.stringify(value)) {
          current[key] = value;
          changed = true;
        }
      });
      if (changed) {
        current.updatedAt = new Date().toISOString();
        updated += 1;
      }
      continue;
    }

    const item = {
      productId,
      name: String(product.displayName || product.name || productId),
      spec: String(product.size || product.spec || ""),
      unit: String(product.unit || "件"),
      // No verified retail price in public data; new internal items start as unpriced.
      price: 0,
      originalPrice: 0,
      offers: promotions.offers,
      promotionTexts: promotions.promotionTexts,
      quoteOnly: promotions.quoteOnly,
      stock: 0,
      reserved: 0,
      lowStock: 5,
      lastAdjustment: 0,
      lastReason: "系統依正式產品目錄建立",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    store.inventory.push(item);
    existing.set(productId, item);
    added += 1;
  }

  if (added > 0 || updated > 0) {
    store.activities = Array.isArray(store.activities) ? store.activities : [];
    store.activities.push({
      id: `act-inventory-${Date.now().toString(36)}`,
      actor: "系統",
      action: "同步產品庫存目錄",
      detail: `新增 ${added} 項，更新商品資料與展示規則 ${updated} 項；內部售價未被公開目錄覆寫`,
      createdAt: new Date().toISOString(),
    });
    writeStore(store);
  }

  return { added, updated, total: store.inventory.length, promotionRulesSynchronized: true };
}

module.exports = { readCatalog, seedInventory, promotionFields };
