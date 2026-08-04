"use strict";

const assert = require("assert");
const { displayCart, expandCart, comboForItem, productPrice } = require("./line-order-cart");

assert.strictEqual(productPrice({ price: 50, unit: "罐", offers: [{ qty: 11, total: 500, label: "買10送1" }] }, 11).total, 500);
assert.strictEqual(productPrice({ price: 200, unit: "包", offers: [{ qty: 11, total: 2000, label: "買10送1" }] }, 11).total, 2000);
assert.deepStrictEqual(
  productPrice({ price: 200, unit: "包", offers: [{ qty: 11, total: 2000, label: "買10送1" }] }, 12),
  { total: 2200, label: "買10送1×1＋單包×1" }
);

const cart = [
  { id: "combo-0", comboIndex: 0, name: "日常節奏組", qty: 2, total: 5600, label: "每組 $2,800 × 2" },
  { id: "guilu-gao", name: "龜鹿膏", qty: 1, total: 1800, label: "單罐×1" },
  { id: "guilu-drink-30", name: "龜鹿飲30cc玻璃罐", qty: 11, total: 500, label: "買10送1×1" },
];

assert.strictEqual(comboForItem(cart[0]).id, "daily-rhythm");
const lines = expandCart(cart);
const paste = lines.find((item) => item.productId === "guilu-gao");
const drink180 = lines.find((item) => item.productId === "guilu-drink-180");
const drink30 = lines.find((item) => item.productId === "guilu-drink-30");

assert.strictEqual(paste.qty, 3);
assert.strictEqual(paste.subtotal, 5400);
assert.strictEqual(drink180.qty, 10);
assert.strictEqual(drink180.subtotal, 2000);
assert.strictEqual(drink30.qty, 11);
assert.strictEqual(drink30.subtotal, 500);
assert.strictEqual(Math.round(lines.reduce((sum, item) => sum + item.subtotal, 0)), 7900);
assert.ok(drink30.pricingLabel.includes("買10送1"));
assert.ok(displayCart(cart).includes("日常節奏組 × 2"));
assert.ok(displayCart(cart).includes("小計 $5,600"));

console.log("PASS LINE combo expansion, buy-ten-get-one pricing and ERP order subtotals");
