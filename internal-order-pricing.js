"use strict";

const express = require("express");

const VERSION = "1.0.0";
const json = express.json({ limit: "2mb" });
const mountedApps = new WeakSet();
const clean = (value, max = 500) => String(value ?? "").replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, max);
const numeric = (value) => {
  const result = Number(String(value ?? "").replace(/,/g, ""));
  return Number.isFinite(result) ? result : 0;
};
const normalized = (value) => clean(value, 300).toLowerCase().replace(/[\s　()（）\[\]【】]/g, "");

function resolveProduct(line, inventory = []) {
  const wantedId = clean(line.productId, 120);
  const wantedName = normalized(line.name || line.productName || line.displayName);
  return inventory.find((item) => wantedId && String(item.productId) === wantedId)
    || inventory.find((item) => normalized(item.name) === wantedName)
    || inventory.find((item) => wantedName && (normalized(item.name).includes(wantedName) || wantedName.includes(normalized(item.name))));
}

function parseTextLines(items, inventory = []) {
  return String(items || "")
    .split(/\n|；|;/)
    .map((raw) => {
      const line = raw.trim();
      if (!line) return null;
      const match = line.match(/^(.+?)\s*[×xX*]\s*(\d+(?:\.\d+)?)(?:\s*[｜|]\s*單價\s*\$?([\d,]+(?:\.\d+)?))?(?:\s*[｜|]\s*小計\s*\$?([\d,]+(?:\.\d+)?))?\s*$/);
      if (!match) return null;
      const product = resolveProduct({ name: match[1] }, inventory);
      const qty = Math.max(0, numeric(match[2]));
      const explicitPrice = numeric(match[3]);
      const explicitSubtotal = numeric(match[4]);
      const unitPrice = explicitPrice || (qty && explicitSubtotal ? explicitSubtotal / qty : numeric(product?.price));
      return {
        productId: clean(product?.productId || "", 120),
        name: clean(product?.name || match[1], 200),
        qty,
        unitPrice: Math.max(0, unitPrice),
      };
    })
    .filter((line) => line && line.qty > 0);
}

function parseJsonLines(value, inventory = []) {
  let parsed = value;
  if (typeof parsed === "string") {
    try { parsed = JSON.parse(parsed); } catch { parsed = []; }
  }
  if (!Array.isArray(parsed)) return [];
  return parsed.map((line) => {
    const product = resolveProduct(line, inventory);
    const qty = Math.max(0, numeric(line.qty ?? line.quantity));
    const unitPrice = Math.max(0, numeric(line.unitPrice ?? line.price ?? product?.price));
    return {
      productId: clean(product?.productId || line.productId || "", 120),
      name: clean(product?.name || line.name || line.productName || "", 200),
      qty,
      unitPrice,
    };
  }).filter((line) => line.name && line.qty > 0);
}

function mergeLines(lines) {
  const result = new Map();
  for (const line of lines) {
    const key = `${line.productId || normalized(line.name)}::${line.unitPrice}`;
    const previous = result.get(key) || { ...line, qty: 0 };
    previous.qty += line.qty;
    result.set(key, previous);
  }
  return [...result.values()].map((line) => ({
    ...line,
    qty: Number(line.qty),
    unitPrice: Number(line.unitPrice),
    subtotal: Math.round(Number(line.qty) * Number(line.unitPrice)),
  }));
}

function formatItems(lines) {
  return lines.map((line) => `${line.name} × ${line.qty}｜單價 $${Math.round(line.unitPrice).toLocaleString("zh-TW")}｜小計 $${Math.round(line.subtotal).toLocaleString("zh-TW")}`).join("\n");
}

function normalizeOrderPayload(body = {}, inventory = []) {
  const source = parseJsonLines(body.orderLinesJson || body.orderLines, inventory);
  const fallback = source.length ? source : parseTextLines(body.items, inventory);
  const lines = mergeLines(fallback);
  delete body.orderLinesJson;
  if (!lines.length) return body;
  body.orderLines = lines;
  body.items = formatItems(lines);
  body.total = lines.reduce((sum, line) => sum + Number(line.subtotal || 0), 0);
  return body;
}

function mountOrderPricing(app, { readStore }) {
  if (!app || mountedApps.has(app)) return;
  mountedApps.add(app);
  app.use("/internal/api/v2/orders", json, (req, _res, next) => {
    if (["POST", "PATCH"].includes(req.method.toUpperCase())) {
      const store = typeof readStore === "function" ? readStore() : { inventory: [] };
      normalizeOrderPayload(req.body || {}, store.inventory || []);
    }
    next();
  });
}

module.exports = {
  VERSION,
  parseTextLines,
  parseJsonLines,
  mergeLines,
  formatItems,
  normalizeOrderPayload,
  mountOrderPricing,
};
