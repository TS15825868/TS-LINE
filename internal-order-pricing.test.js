"use strict";

const assert = require("assert");
const {
  VERSION,
  parseTextLines,
  parseJsonLines,
  mergeLines,
  formatItems,
  normalizeOrderPayload,
  offerPricing,
} = require("./internal-order-pricing");

assert.strictEqual(VERSION, "1.1.0");
const inventory = [
  { productId: "guilu-gao", name: "龜鹿膏", price: 1500, unit: "罐", offers: [] },
  { productId: "guilu-drink-30", name: "龜鹿飲30cc", price: 50, unit: "瓶", offers: [{ qty: 12, total: 500, label: "買10送2" }] },
];

assert.deepStrictEqual(offerPricing(inventory[1], 12, 50), { subtotal: 500, pricingLabel: "買10送2×1" });
assert.deepStrictEqual(offerPricing(inventory[1], 13, 50), { subtotal: 550, pricingLabel: "買10送2×1＋單瓶×1" });

const text = parseTextLines("龜鹿膏 × 2｜單價 $1,500｜小計 $3,000", inventory);
assert.strictEqual(text.length, 1);
assert.strictEqual(text[0].productId, "guilu-gao");
assert.strictEqual(text[0].qty, 2);
assert.strictEqual(text[0].unitPrice, 1500);
assert.strictEqual(text[0].explicitSubtotal, 3000);

const json = parseJsonLines(JSON.stringify([
  { productId: "guilu-gao", qty: 1, unitPrice: 1400 },
  { productId: "guilu-drink-30", qty: 12, unitPrice: 50 },
]), inventory);
assert.strictEqual(json.length, 2);
assert.strictEqual(json[0].manualPrice, true);
assert.strictEqual(json[1].manualPrice, false);

const merged = mergeLines([
  { productId: "guilu-gao", name: "龜鹿膏", qty: 1, unitPrice: 1500, explicitSubtotal: null, pricingLabel: "", offers: [], unit: "罐", manualPrice: false },
  { productId: "guilu-gao", name: "龜鹿膏", qty: 2, unitPrice: 1500, explicitSubtotal: null, pricingLabel: "", offers: [], unit: "罐", manualPrice: false },
]);
assert.deepStrictEqual(merged, [{ productId: "guilu-gao", name: "龜鹿膏", qty: 3, unitPrice: 1500, subtotal: 4500, pricingLabel: "" }]);
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
assert.strictEqual(body.subtotal, 3500);
assert.strictEqual(body.total, 3500);
assert.strictEqual(body.orderLines.length, 2);
assert.strictEqual(body.orderLines[1].subtotal, 500);
assert.strictEqual(body.orderLines[1].pricingLabel, "買10送2×1");
assert.ok(!("orderLinesJson" in body));
assert.ok(body.items.includes("龜鹿膏 × 2"));
assert.ok(body.items.includes("龜鹿飲30cc × 12"));
assert.ok(body.items.includes("方案 買10送2×1"));

const manualPrice = normalizeOrderPayload({
  orderLines: [{ productId: "guilu-drink-30", qty: 12, unitPrice: 45 }],
}, inventory);
assert.strictEqual(manualPrice.total, 540);
assert.strictEqual(manualPrice.orderLines[0].pricingLabel, "");

console.log("PASS ERP order pricing, official buy-ten-get-two promotion, manual overrides and total normalization");
