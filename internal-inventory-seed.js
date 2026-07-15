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

  for (const product of products) {
    const productId = String(product.id || "").trim();
    if (!productId || existing.has(productId)) continue;
    const item = {
      productId,
      name: String(product.displayName || product.name || productId),
      spec: String(product.size || product.spec || ""),
      unit: String(product.unit || "件"),
      stock: 0,
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

  if (added > 0) {
    store.activities = Array.isArray(store.activities) ? store.activities : [];
    store.activities.push({
      id: `act-inventory-${Date.now().toString(36)}`,
      actor: "系統",
      action: "建立產品庫存",
      detail: `依正式產品目錄新增 ${added} 項`,
      createdAt: new Date().toISOString(),
    });
    writeStore(store);
  }

  return { added, total: store.inventory.length };
}

module.exports = { readCatalog, seedInventory };