"use strict";

const assert = require("assert");
const { displayCart, expandCart } = require("./line-order-cart");

const cart = [
  { productId: "daily-rhythm", name: "日常節奏組", qty: 2 },
  { productId: "guilu-gao", name: "龜鹿膏", qty: 1 },
];
const lines = expandCart(cart);
const paste = lines.find((item) => item.productId === "guilu-gao");
const drink = lines.find((item) => item.productId === "guilu-drink-180");
assert.strictEqual(paste.qty, 3);
assert.strictEqual(drink.qty, 10);
assert.ok(displayCart(cart).includes("日常節奏組 × 2"));
console.log("PASS LINE combo inventory expansion");
