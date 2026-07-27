"use strict";

const express = require("express");

const VERSION = "1.1.0";
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

function offerPricing(product = {}, quantity, fallbackUnitPrice) {
  const qty = Math.max(0, numeric(quantity));
  const unitPrice = Math.max(0, numeric(fallbackUnitPrice || product.price));
  const offers = (Array.isArray(product.offers) ? product.offers : [])
    .filter((offer) => offer && typeof offer === "object" && numeric(offer.qty) > 0 && numeric(offer.total) >= 0)
    .sort((a, b) => numeric(b.qty) - numeric(a.qty));
  let remain = qty;
  let total = 0;
  const labels = [];
  for (const offer of offers) {
    const offerQty = numeric(offer.qty);
    const groups = Math.floor(remain / offerQty);
    if (!groups) continue;
    remain -= groups * offerQty;
    total += groups * numeric(offer.total);
    labels.push(`${clean(offer.label, 80)}×${groups}`);
  }
  if (remain) {
    total += remain * unitPrice;
    labels.push(`單${product.unit || "件"}×${remain}`);
  }
  return { subtotal: Math.round(total), pricingLabel: labels.join("＋") };
}

function parseTextLines(items, inventory = []) {
  return String(items || "")
    .split(/\n|；|;/)
    .map((raw) => {
      const line = raw.trim();
      if (!line) return null;
      const match = line.match(/^(.+?)\s*[×xX*]\s*(\d+(?:\.\d+)?)(?:\s*[｜|]\s*單價\s*\$?([\d,]+(?:\.\d+)?))?(?:\s*[｜|]\s*(?:方案\s*([^｜|]+)\s*[｜|]\s*)?小計\s*\$?([\d,]+(?:\.\d+)?))?\s*$/);
      if (!match) return null;
      const product = resolveProduct({ name: match[1] }, inventory);
      const qty = Math.max(0, numeric(match[2]));
      const explicitPrice = numeric(match[3]);
      const explicitSubtotal = numeric(match[5]);
      const basePrice = explicitPrice || numeric(product?.price);
      const manualPrice = Boolean(explicitPrice && product && Math.abs(explicitPrice - numeric(product.price)) > 0.0001);
      return {
        productId: clean(product?.productId || "", 120),
        name: clean(product?.name || match[1], 200),
        qty,
        unitPrice: Math.max(0, basePrice),
        explicitSubtotal: explicitSubtotal > 0 ? explicitSubtotal : null,
        pricingLabel: clean(match[4], 200),
        offers: Array.isArray(product?.offers) ? product.offers : [],
        unit: clean(product?.unit || "件", 20),
        manualPrice,
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
    const suppliedUnitPrice = numeric(line.unitPrice ?? line.price);
    const unitPrice = Math.max(0, suppliedUnitPrice || numeric(product?.price));
    const explicitSubtotal = numeric(line.subtotal ?? line.lineTotal);
    const manualPrice = Boolean(suppliedUnitPrice && product && Math.abs(suppliedUnitPrice - numeric(product.price)) > 0.0001);
    return {
      productId: clean(product?.productId || line.productId || "", 120),
      name: clean(product?.name || line.name || line.productName || "", 200),
      qty,
      unitPrice,
      explicitSubtotal: explicitSubtotal > 0 ? explicitSubtotal : null,
      pricingLabel: clean(line.pricingLabel || line.label, 200),
      offers: Array.isArray(product?.offers) ? product.offers : [],
      unit: clean(product?.unit || "件", 20),
      manualPrice,
    };
  }).filter((line) => line.name && line.qty > 0);
}

function mergeLines(lines) {
  const result = new Map();
  for (const line of lines) {
    const key = `${line.productId || normalized(line.name)}::${line.unitPrice}::${line.manualPrice ? "manual" : "official"}`;
    const previous = result.get(key) || { ...line, qty: 0, explicitSubtotal: 0, pricingLabels: [] };
    previous.qty += line.qty;
    if (line.explicitSubtotal) previous.explicitSubtotal += line.explicitSubtotal;
    if (line.pricingLabel) previous.pricingLabels.push(line.pricingLabel);
    result.set(key, previous);
  }
  return [...result.values()].map((line) => {
    let subtotal;
    let pricingLabel = [...new Set(line.pricingLabels || [])].join("；");
    if (line.explicitSubtotal > 0) {
      subtotal = Math.round(line.explicitSubtotal);
    } else if (!line.manualPrice && Array.isArray(line.offers) && line.offers.length) {
      const priced = offerPricing({ price: line.unitPrice, offers: line.offers, unit: line.unit }, line.qty, line.unitPrice);
      subtotal = priced.subtotal;
      pricingLabel = pricingLabel || priced.pricingLabel;
    } else {
      subtotal = Math.round(Number(line.qty) * Number(line.unitPrice));
    }
    return {
      productId: line.productId,
      name: line.name,
      qty: Number(line.qty),
      unitPrice: Number(line.unitPrice),
      subtotal,
      pricingLabel,
    };
  });
}

function formatItems(lines) {
  return lines.map((line) => {
    const subtotal = `$${Math.round(line.subtotal).toLocaleString("zh-TW")}`;
    if (line.pricingLabel) return `${line.name} × ${line.qty}｜方案 ${line.pricingLabel}｜小計 ${subtotal}`;
    return `${line.name} × ${line.qty}｜單價 $${Math.round(line.unitPrice).toLocaleString("zh-TW")}｜小計 ${subtotal}`;
  }).join("\n");
}

function normalizeOrderPayload(body = {}, inventory = []) {
  const source = parseJsonLines(body.orderLinesJson || body.orderLines, inventory);
  const fallback = source.length ? source : parseTextLines(body.items, inventory);
  const lines = mergeLines(fallback);
  delete body.orderLinesJson;
  if (!lines.length) return body;
  body.orderLines = lines;
  body.items = formatItems(lines);
  body.subtotal = lines.reduce((sum, line) => sum + Number(line.subtotal || 0), 0);
  body.total = body.subtotal;
  body.pricingManaged = true;
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
  offerPricing,
};
