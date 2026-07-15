"use strict";

const DATA = require("./data.json");

const productMap = new Map((DATA.products || []).map((item) => [item.id, item]));
const comboMap = new Map(((DATA.offers && DATA.offers.comboOffers) || []).map((item) => [item.id, item]));

function qty(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : 1;
}

function itemId(item = {}) {
  return String(item.productId || item.id || "").trim();
}

function itemName(item = {}) {
  const id = itemId(item);
  const product = productMap.get(id);
  const combo = comboMap.get(id);
  return String(item.name || item.displayName || product?.displayName || product?.name || combo?.name || id || "商品").trim();
}

function displayCart(cart = []) {
  return cart.map((item) => `${itemName(item)} × ${qty(item.qty || item.quantity)}`).join("\n");
}

function expandCart(cart = []) {
  const merged = new Map();
  const add = (productId, quantity) => {
    const product = productMap.get(productId);
    if (!product || !quantity) return;
    const row = merged.get(productId) || {
      productId,
      name: product.displayName || product.name || productId,
      qty: 0,
    };
    row.qty += quantity;
    merged.set(productId, row);
  };

  for (const item of cart) {
    const id = itemId(item);
    const count = qty(item.qty || item.quantity);
    const combo = comboMap.get(id);
    if (combo && Array.isArray(combo.products)) {
      for (const component of combo.products) add(component.productId, qty(component.qty) * count);
    } else {
      add(id, count);
    }
  }

  return [...merged.values()];
}

module.exports = { displayCart, expandCart };
