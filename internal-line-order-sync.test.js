"use strict";

const assert = require("assert");
const {
  parseOrderLines,
  applyOrderTransition,
  statusMessage,
  validateShipment,
} = require("./internal-line-order-sync");

const inventory = [{ productId: "paste-100", name: "龜鹿膏100g", price: 1500, stock: 10, reserved: 0, lowStock: 2, movements: [] }];
const store = { inventory, activities: [], customers: [] };
const created = { id: "ord-1", customerName: "測試", items: "龜鹿膏100g × 2｜單價 $1,500｜小計 $3,000", status: "新訂單" };

assert.deepStrictEqual(parseOrderLines(created, inventory), [{ productId: "paste-100", name: "龜鹿膏100g", qty: 2, unitPrice: 1500, subtotal: 3000 }]);
applyOrderTransition(store, null, created, "test");
assert.strictEqual(inventory[0].stock, 10);
assert.strictEqual(inventory[0].reserved, 2);
assert.strictEqual(created.inventoryMode, "reserved");
assert.strictEqual(created.total, 3000);

const pendingDelivery = { ...created, status: "待送貨" };
applyOrderTransition(store, created, pendingDelivery, "test");
assert.strictEqual(inventory[0].stock, 10);
assert.strictEqual(inventory[0].reserved, 2);
assert.strictEqual(pendingDelivery.inventoryMode, "reserved");
assert.ok(statusMessage(pendingDelivery, created).includes("等待安排寄送"));

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
assert.ok(validateShipment(shortageStore, pendingDelivery, shipped).includes("庫存不足"));

console.log("PASS LINE order priced inventory lifecycle with pending delivery status");
