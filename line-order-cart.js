"use strict";

const DATA = require("./data.json");

const products = Array.isArray(DATA.products) ? DATA.products : [];
const combos = Array.isArray(DATA.offers?.comboOffers) ? DATA.offers.comboOffers : [];
const productMap = new Map(products.map((item) => [item.id, item]));
const comboMap = new Map(combos.map((item) => [item.id, item]));

function qty(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : 1;
}

function itemId(item = {}) {
  return String(item.productId || item.id || "").trim();
}

function comboForItem(item = {}) {
  const id = itemId(item);
  if (comboMap.has(id)) return comboMap.get(id);
  const explicitIndex = Number(item.comboIndex);
  if (Number.isInteger(explicitIndex) && explicitIndex >= 0 && combos[explicitIndex]) return combos[explicitIndex];
  const match = id.match(/^combo-(\d+)$/);
  if (match && combos[Number(match[1])]) return combos[Number(match[1])];
  return null;
}

function itemName(item = {}) {
  const id = itemId(item);
  const product = productMap.get(id);
  const combo = comboForItem(item);
  return String(item.name || item.displayName || product?.displayName || product?.name || combo?.name || id || "商品").trim();
}

function displayCart(cart = []) {
  return cart.map((item) => {
    const count = qty(item.qty || item.quantity);
    const total = Number(item.total);
    const totalText = Number.isFinite(total) && total >= 0 ? `｜小計 $${Math.round(total).toLocaleString("zh-TW")}` : "";
    const label = String(item.label || "").trim();
    const labelText = label ? `｜${label}` : "";
    return `${itemName(item)} × ${count}${labelText}${totalText}`;
  }).join("\n");
}

function productPrice(product, quantity) {
  const count = Math.max(0, Number(quantity) || 0);
  const offers = (Array.isArray(product?.offers) ? product.offers : [])
    .filter((offer) => offer && typeof offer === "object" && Number(offer.qty) > 0 && Number(offer.total) >= 0)
    .sort((a, b) => Number(b.qty) - Number(a.qty));
  let remain = count;
  let total = 0;
  const labels = [];
  for (const offer of offers) {
    const groups = Math.floor(remain / Number(offer.qty));
    if (!groups) continue;
    remain -= groups * Number(offer.qty);
    total += groups * Number(offer.total);
    labels.push(`${offer.label}×${groups}`);
  }
  if (remain) {
    total += remain * Number(product?.price || 0);
    labels.push(`單${product?.unit || "件"}×${remain}`);
  }
  return { total: Math.round(total), label: labels.join("＋") || `${count}${product?.unit || "件"}` };
}

function expandCart(cart = []) {
  const merged = new Map();
  const add = (productId, quantity, subtotal, pricingLabel = "") => {
    const product = productMap.get(productId);
    const count = Number(quantity) || 0;
    if (!product || count <= 0) return;
    const lineSubtotal = Number.isFinite(Number(subtotal)) ? Number(subtotal) : productPrice(product, count).total;
    const row = merged.get(productId) || {
      productId,
      name: product.displayName || product.name || productId,
      qty: 0,
      subtotal: 0,
      pricingLabels: [],
    };
    row.qty += count;
    row.subtotal += lineSubtotal;
    if (pricingLabel) row.pricingLabels.push(pricingLabel);
    merged.set(productId, row);
  };

  for (const item of cart) {
    const id = itemId(item);
    const count = qty(item.qty || item.quantity);
    const combo = comboForItem(item);
    if (combo && Array.isArray(combo.products)) {
      for (const component of combo.products) {
        const product = productMap.get(component.productId);
        if (!product) continue;
        const componentQtyPerCombo = qty(component.qty);
        const pricedPerCombo = productPrice(product, componentQtyPerCombo);
        add(
          component.productId,
          componentQtyPerCombo * count,
          pricedPerCombo.total * count,
          `${combo.name}：${pricedPerCombo.label}×${count}組`
        );
      }
      continue;
    }

    const product = productMap.get(id);
    if (!product) continue;
    const calculated = productPrice(product, count);
    const submittedTotal = Number(item.total);
    add(id, count, Number.isFinite(submittedTotal) && submittedTotal >= 0 ? submittedTotal : calculated.total, String(item.label || calculated.label));
  }

  return [...merged.values()].map((row) => ({
    productId: row.productId,
    name: row.name,
    qty: row.qty,
    unitPrice: row.qty ? row.subtotal / row.qty : 0,
    subtotal: Math.round(row.subtotal),
    pricingLabel: [...new Set(row.pricingLabels.filter(Boolean))].join("；"),
  }));
}

module.exports = { displayCart, expandCart, comboForItem, productPrice };
