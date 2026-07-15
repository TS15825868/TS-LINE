"use strict";

const assert = require("assert");
const {
  ORDER_STATUSES,
  normalizeOrderPayload,
  parseOrderLines,
  applyOrderTransition,
  statusMessage,
  validateOrderAvailability,
  validateShipment,
} = require("./internal-line-order-sync");

const inventory = [{ productId: "paste-100", name: "龜鹿膏100g", price: 1500, stock: 10, reserved: 0, lowStock: 2, movements: [] }];
const store = { inventory, activities: [], customers: [] };
const priced = normalizeOrderPayload({
  id: "ord-1",
  customerName: "測試",
  orderLines: [{ productId: "paste-100", name: "龜鹿膏100g", qty: 2, unitPrice: 1500 }],
  discount: 100,
  shippingFee: 60,
  paidAmount: 1000,
  status: "新訂單",
}, inventory);

assert.ok(ORDER_STATUSES.has("待送貨"));
assert.deepStrictEqual(parseOrderLines(priced, inventory), [{ productId: "paste-100", name: "龜鹿膏100g", qty: 2, unitPrice: 1500, subtotal: 3000 }]);
assert.strictEqual(priced.subtotal, 3000);
assert.strictEqual(priced.total, 2960);
assert.strictEqual(priced.balance, 1960);
assert.strictEqual(priced.paymentStatus, "部分付款");
assert.ok(priced.items.includes("單價 $1,500"));
assert.strictEqual(validateOrderAvailability(store, null, priced), null);

applyOrderTransition(store, null, priced, "test");
assert.strictEqual(inventory[0].stock, 10);
assert.strictEqual(inventory[0].reserved, 2);
assert.strictEqual(inventory[0].availableStock, 8);
assert.strictEqual(priced.inventoryMode, "reserved");
assert.strictEqual(priced.total, 2960);

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

const shortageStore = { inventory: [{ productId: "paste-100", name: "龜鹿膏100g", price: 1500, stock: 1, reserved: 0 }] };
const shortageOrder = normalizeOrderPayload({ orderLines: [{ productId: "paste-100", name: "龜鹿膏100g", qty: 2, unitPrice: 1500 }], status: "新訂單" }, shortageStore.inventory);
assert.ok(validateOrderAvailability(shortageStore, null, shortageOrder).includes("庫存不足"));
assert.ok(validateShipment(shortageStore, null, { ...shortageOrder, status: "已出貨" }).includes("庫存不足"));

console.log("PASS priced order totals, payment balance, reservation, pending delivery, shipment and cancellation lifecycle");
