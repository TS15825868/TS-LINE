"use strict";

const assert = require("assert");
const {
  parseTextLines,
  parseJsonLines,
  mergeLines,
  formatItems,
  normalizeOrderPayload,
} = require("./internal-order-pricing");

const inventory = [
  { productId: "guilu-gao", name: "龜鹿膏", price: 1500 },
  { productId: "guilu-drink-30", name: "龜鹿飲30cc", price: 50 },
];

const text = parseTextLines("龜鹿膏 × 2｜單價 $1,500｜小計 $3,000", inventory);
assert.deepStrictEqual(text, [{ productId: "guilu-gao", name: "龜鹿膏", qty: 2, unitPrice: 1500 }]);

const json = parseJsonLines(JSON.stringify([
  { productId: "guilu-gao", qty: 1, unitPrice: 1400 },
  { productId: "guilu-drink-30", qty: 12, unitPrice: 50 },
]), inventory);
assert.strictEqual(json.length, 2);

const merged = mergeLines([
  { productId: "guilu-gao", name: "龜鹿膏", qty: 1, unitPrice: 1500 },
  { productId: "guilu-gao", name: "龜鹿膏", qty: 2, unitPrice: 1500 },
]);
assert.deepStrictEqual(merged, [{ productId: "guilu-gao", name: "龜鹿膏", qty: 3, unitPrice: 1500, subtotal: 4500 }]);
assert.ok(formatItems(merged).includes("單價 $1,500"));
assert.ok(formatItems(merged).includes("小計 $4,500"));

const body = {
  customerName: "測試客戶",
  orderLinesJson: JSON.stringify([
    { productId: "guilu-gao", qty: 2, unitPrice: 1500 },
    { productId: "guilu-drink-30", qty: 12, unitPrice: 50 },
  ]),
  total: 1,
};
normalizeOrderPayload(body, inventory);
assert.strictEqual(body.total, 3600);
assert.strictEqual(body.orderLines.length, 2);
assert.ok(!("orderLinesJson" in body));
assert.ok(body.items.includes("龜鹿膏 × 2"));
assert.ok(body.items.includes("龜鹿飲30cc × 12"));

console.log("PASS order unit price, quantity, subtotal and automatic total normalization");
