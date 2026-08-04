"use strict";

const assert = require("assert");
const {
  VERSION,
  ORDER_STATUSES,
  normalizeOrderPayload,
  parseOrderLines,
  applyOrderTransition,
  statusMessage,
  validateOrderAvailability,
  validateShipment,
} = require("./internal-line-order-sync");

assert.strictEqual(VERSION, "1.3.0");
const inventory = [
  { productId: "paste-100", name: "龜鹿膏100g", price: 1800, stock: 10, reserved: 0, lowStock: 2, movements: [] },
  { productId: "guilu-drink-30", name: "龜鹿飲30cc", price: 50, stock: 100, reserved: 0, lowStock: 11, movements: [] },
];
const store = { inventory, activities: [], customers: [] };
const priced = normalizeOrderPayload({
  id: "ord-1",
  customerName: "測試",
  orderLines: [{ productId: "paste-100", name: "龜鹿膏100g", qty: 2, unitPrice: 1800 }],
  discount: 100,
  shippingFee: 60,
  paidAmount: 1000,
  status: "新訂單",
}, inventory);

assert.ok(ORDER_STATUSES.has("待送貨"));
assert.deepStrictEqual(parseOrderLines(priced, inventory), [{ productId: "paste-100", name: "龜鹿膏100g", qty: 2, unitPrice: 1800, subtotal: 3600, pricingLabel: "" }]);
assert.strictEqual(priced.subtotal, 3600);
assert.strictEqual(priced.total, 3560);
assert.strictEqual(priced.balance, 2560);
assert.strictEqual(priced.paymentStatus, "部分付款");
assert.ok(priced.items.includes("單價 $1,800"));
assert.strictEqual(validateOrderAvailability(store, null, priced), null);

const promotion = normalizeOrderPayload({
  id: "ord-promo",
  customerName: "活動測試",
  source: "LINE OA",
  orderLines: [{
    productId: "guilu-drink-30",
    name: "龜鹿飲30cc",
    qty: 11,
    unitPrice: 500 / 11,
    subtotal: 500,
    pricingLabel: "買10送1×1",
  }],
  total: 500,
  status: "新訂單",
}, inventory);
assert.strictEqual(promotion.subtotal, 500);
assert.strictEqual(promotion.total, 500);
assert.strictEqual(promotion.orderLines[0].subtotal, 500);
assert.ok(promotion.items.includes("方案 買10送1×1"));
assert.ok(promotion.items.includes("小計 $500"));

applyOrderTransition(store, null, priced, "test");
assert.strictEqual(inventory[0].stock, 10);
assert.strictEqual(inventory[0].reserved, 2);
assert.strictEqual(inventory[0].availableStock, 8);
assert.strictEqual(priced.inventoryMode, "reserved");
assert.strictEqual(priced.total, 3560);

applyOrderTransition(store, null, promotion, "LINE OA");
assert.strictEqual(inventory[1].stock, 100);
assert.strictEqual(inventory[1].reserved, 11);
assert.strictEqual(promotion.total, 500);

const pendingDelivery = { ...priced, status: "待送貨" };
applyOrderTransition(store, priced, pendingDelivery, "test");
assert.strictEqual(inventory[0].stock, 10);
assert.strictEqual(inventory[0].reserved, 2);
assert.strictEqual(pendingDelivery.inventoryMode, "reserved");
assert.ok(statusMessage(pendingDelivery, priced).includes("等待安排寄送"));

const shipped = { ...pendingDelivery, status: "已出貨", trackingNo: "ABC123" };
assert.strictEqual(validateShipment(store, pendingDelivery, shipped), null);
applyOrderTransition(store, pendingDelivery, shipped, "test");
assert.strictEqual(inventory[0].stock, 8);
assert.strictEqual(inventory[0].reserved, 0);
assert.strictEqual(shipped.inventoryMode, "shipped");
assert.ok(statusMessage(shipped, pendingDelivery).includes("已出貨"));
assert.ok(statusMessage(shipped, pendingDelivery).includes("ABC123"));

const cancelled = { ...shipped, status: "已取消" };
applyOrderTransition(store, shipped, cancelled, "test");
assert.strictEqual(inventory[0].stock, 10);
assert.strictEqual(inventory[0].reserved, 0);
assert.strictEqual(cancelled.inventoryMode, "cancelled");

const shortageStore = { inventory: [{ productId: "paste-100", name: "龜鹿膏100g", price: 1800, stock: 1, reserved: 0 }] };
const shortageOrder = normalizeOrderPayload({ orderLines: [{ productId: "paste-100", name: "龜鹿膏100g", qty: 2, unitPrice: 1800 }], status: "新訂單" }, shortageStore.inventory);
assert.ok(validateOrderAvailability(shortageStore, null, shortageOrder).includes("庫存不足"));
assert.ok(validateShipment(shortageStore, null, { ...shortageOrder, status: "已出貨" }).includes("庫存不足"));

console.log("PASS priced orders, buy-ten-get-one subtotal, reservations, shipment and cancellation lifecycle");
