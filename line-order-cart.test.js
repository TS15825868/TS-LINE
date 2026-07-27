"use strict";

const assert = require("assert");
const { displayCart, expandCart, comboForItem, productPrice } = require("./line-order-cart");

assert.strictEqual(productPrice({ price: 50, unit: "瓶", offers: [{ qty: 12, total: 500, label: "買10送2" }] }, 12).total, 500);
assert.strictEqual(productPrice({ price: 200, unit: "包", offers: [{ qty: 12, total: 2000, label: "買10送2" }] }, 12).total, 2000);

const cart = [
  { id: "combo-0", comboIndex: 0, name: "日常節奏組", qty: 2, total: 5000, label: "每組 $2,500 × 2" },
  { id: "guilu-gao", name: "龜鹿膏", qty: 1, total: 1500, label: "單罐×1" },
  { id: "guilu-drink-30", name: "龜鹿飲30cc", qty: 12, total: 500, label: "買10送2×1" },
];

assert.strictEqual(comboForItem(cart[0]).id, "daily-rhythm");
const lines = expandCart(cart);
const paste = lines.find((item) => item.productId === "guilu-gao");
const drink180 = lines.find((item) => item.productId === "guilu-drink-180");
const drink30 = lines.find((item) => item.productId === "guilu-drink-30");

assert.strictEqual(paste.qty, 3);
assert.strictEqual(paste.subtotal, 4500);
assert.strictEqual(drink180.qty, 10);
assert.strictEqual(drink180.subtotal, 2000);
assert.strictEqual(drink30.qty, 12);
assert.strictEqual(drink30.subtotal, 500);
assert.strictEqual(Math.round(lines.reduce((sum, item) => sum + item.subtotal, 0)), 7000);
assert.ok(drink30.pricingLabel.includes("買10送2"));
assert.ok(displayCart(cart).includes("日常節奏組 × 2"));
assert.ok(displayCart(cart).includes("小計 $5,000"));

console.log("PASS LINE combo expansion, buy-ten-get-two pricing and ERP order subtotals");
