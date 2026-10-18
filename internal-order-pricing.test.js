"use strict";

const assert = require("assert");
const {
  VERSION, parseTextLines, parseJsonLines, mergeLines,
  formatItems, normalizeOrderPayload, offerPricing,
} = require("./internal-order-pricing");

assert.strictEqual(VERSION, "1.1.0");
// Synthetic fixtures only. Never use live product names or prices in public tests.
const inventory = [
  { productId: "test-item-a", name: "測試品甲", price: 100, unit: "件", offers: [] },
  { productId: "test-item-b", name: "測試品乙", price: 50, unit: "件",
    offers: [{ qty: 11, total: 500, label: "測試優惠" }] },
];

assert.deepStrictEqual(offerPricing(inventory[1], 11, 50), { subtotal: 500, pricingLabel: "測試優惠×1" });
assert.deepStrictEqual(offerPricing(inventory[1], 12, 50), { subtotal: 550, pricingLabel: "測試優惠×1＋單件×1" });

const text = parseTextLines("測試品甲 × 2｜單價 $100｜小計 $200", inventory);
assert.strictEqual(text.length, 1);
assert.strictEqual(text[0].productId, "test-item-a");
assert.strictEqual(text[0].qty, 2);
assert.strictEqual(text[0].unitPrice, 100);
assert.strictEqual(text[0].explicitSubtotal, 200);

const json = parseJsonLines(JSON.stringify([
  { productId: "test-item-a", qty: 1, unitPrice: 95 },
  { productId: "test-item-b", qty: 11, unitPrice: 50 },
]), inventory);
assert.strictEqual(json.length, 2);
assert.strictEqual(json[0].manualPrice, true);
assert.strictEqual(json[1].manualPrice, false);

const merged = mergeLines([
  { productId: "test-item-a", name: "測試品甲", qty: 1, unitPrice: 100, explicitSubtotal: null, pricingLabel: "", offers: [], unit: "件", manualPrice: false },
  { productId: "test-item-a", name: "測試品甲", qty: 2, unitPrice: 100, explicitSubtotal: null, pricingLabel: "", offers: [], unit: "件", manualPrice: false },
]);
assert.deepStrictEqual(merged, [{ productId: "test-item-a", name: "測試品甲", qty: 3, unitPrice: 100, subtotal: 300, pricingLabel: "" }]);
assert.ok(formatItems(merged).includes("單價 $100"));
assert.ok(formatItems(merged).includes("小計 $300"));

const body = {
  customerName: "測試客戶",
  orderLinesJson: JSON.stringify([
    { productId: "test-item-a", qty: 2, unitPrice: 100 },
    { productId: "test-item-b", qty: 11, unitPrice: 50 },
  ]),
  total: 1,
};
normalizeOrderPayload(body, inventory);
assert.strictEqual(body.subtotal, 700);
assert.strictEqual(body.total, 700);
assert.strictEqual(body.orderLines.length, 2);
assert.strictEqual(body.orderLines[1].subtotal, 500);
assert.strictEqual(body.orderLines[1].pricingLabel, "測試優惠×1");
assert.ok(!("orderLinesJson" in body));
assert.ok(body.items.includes("測試品甲 × 2"));
assert.ok(body.items.includes("測試品乙 × 11"));
assert.ok(body.items.includes("方案 測試優惠×1"));

const manualPrice = normalizeOrderPayload({
  orderLines: [{ productId: "test-item-b", qty: 11, unitPrice: 45 }],
}, inventory);
assert.strictEqual(manualPrice.total, 495);
assert.strictEqual(manualPrice.orderLines[0].pricingLabel, "");

console.log("PASS ERP order calculations using non-production price fixtures");
