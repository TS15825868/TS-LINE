"use strict";

const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "xjw-internal-test-"));
process.env.INTERNAL_DATA_PATH = path.join(tempDir, "internal.json");
process.env.INTERNAL_APP_PASSWORD = "test-password-123";
process.env.INTERNAL_APP_SECRET = "test-secret-123";

const { readStore, writeStore, metrics, APP_VERSION, mountInternalApp } = require("./internal-app");

assert.strictEqual(APP_VERSION, "1.0.0");
assert.strictEqual(typeof mountInternalApp, "function");

const store = readStore();
assert.ok(Array.isArray(store.orders));
assert.ok(Array.isArray(store.customers));
assert.ok(Array.isArray(store.inventory));
assert.ok(Array.isArray(store.reminders));
assert.ok(Array.isArray(store.staff));
assert.ok(Array.isArray(store.activities));
assert.ok(store.inventory.length >= 1);

store.orders.push({ id: "ord-test", customerName: "測試客戶", total: 1500, status: "新訂單", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
store.customers.push({ id: "cus-test", name: "測試客戶", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
store.reminders.push({ id: "rem-test", title: "出貨", dueAt: new Date(Date.now() - 1000).toISOString(), done: false });
store.inventory[0].stock = 0;
store.inventory[0].lowStock = 5;
writeStore(store);

const loaded = readStore();
assert.strictEqual(loaded.orders.length, 1);
assert.strictEqual(loaded.customers.length, 1);
assert.strictEqual(loaded.reminders.length, 1);

const summary = metrics(loaded);
assert.strictEqual(summary.orderCount, 1);
assert.strictEqual(summary.activeOrderCount, 1);
assert.strictEqual(summary.customerCount, 1);
assert.strictEqual(summary.totalSales, 1500);
assert.ok(summary.lowStockCount >= 1);
assert.strictEqual(summary.dueReminderCount, 1);

fs.rmSync(tempDir, { recursive: true, force: true });
console.log("PASS internal management app storage and metrics");
