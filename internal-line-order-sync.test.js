"use strict";

const assert = require("assert");
const {
  parseOrderLines,
  applyOrderTransition,
  statusMessage,
  validateShipment,
} = require("./internal-line-order-sync");

const inventory = [{ productId: "paste-100", name: "龜鹿膏100g", stock: 10, reserved: 0, lowStock: 2, movements: [] }];
const store = { inventory, activities: [], customers: [] };
const created = { id: "ord-1", customerName: "測試", items: "龜鹿膏100g × 2", status: "新訂單" };

assert.deepStrictEqual(parseOrderLines(created, inventory), [{ productId: "paste-100", name: "龜鹿膏100g", qty: 2 }]);
applyOrderTransition(store, null, created, "test");
assert.strictEqual(inventory[0].stock, 10);
assert.strictEqual(inventory[0].reserved, 2);
assert.strictEqual(created.inventoryMode, "reserved");

const shipped = { ...created, status: "已出貨", trackingNo: "ABC123" };
assert.strictEqual(validateShipment(store, created, shipped), null);
applyOrderTransition(store, created, shipped, "test");
assert.strictEqual(inventory[0].stock, 8);
assert.strictEqual(inventory[0].reserved, 0);
assert.strictEqual(shipped.inventoryMode, "shipped");
assert.ok(statusMessage(shipped, created).includes("已出貨"));
assert.ok(statusMessage(shipped, created).includes("ABC123"));

const cancelled = { ...shipped, status: "已取消" };
applyOrderTransition(store, shipped, cancelled, "test");
assert.strictEqual(inventory[0].stock, 10);
assert.strictEqual(inventory[0].reserved, 0);
assert.strictEqual(cancelled.inventoryMode, "cancelled");

const shortageStore = { inventory: [{ productId: "paste-100", name: "龜鹿膏100g", stock: 1, reserved: 0 }] };
assert.ok(validateShipment(shortageStore, created, shipped).includes("庫存不足"));

console.log("PASS LINE order inventory lifecycle");
