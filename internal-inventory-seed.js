"use strict";

const fs = require("fs");
const path = require("path");

function readCatalog() {
  const file = path.join(__dirname, "data.json");
  const data = JSON.parse(fs.readFileSync(file, "utf8"));
  return Array.isArray(data.products) ? data.products : [];
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
    if (current) {
      const next = {
        name: String(product.displayName || product.name || productId),
        spec: String(product.size || product.spec || ""),
        unit: String(product.unit || current.unit || "件"),
        price: Number(product.price || 0),
        originalPrice: Number(product.originalPrice || 0),
      };
      let changed = false;
      Object.entries(next).forEach(([key, value]) => {
        if (current[key] !== value) {
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
      price: Number(product.price || 0),
      originalPrice: Number(product.originalPrice || 0),
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
      detail: `新增 ${added} 項，更新價格與規格 ${updated} 項`,
      createdAt: new Date().toISOString(),
    });
    writeStore(store);
  }

  return { added, updated, total: store.inventory.length };
}

module.exports = { readCatalog, seedInventory };
