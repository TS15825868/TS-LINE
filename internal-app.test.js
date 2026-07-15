"use strict";

const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "xjw-internal-test-"));
process.env.INTERNAL_DATA_PATH = path.join(tempDir, "internal.json");
process.env.SOCIAL_DATA_PATH = path.join(tempDir, "social.json");
process.env.INTERNAL_APP_PASSWORD = "test-password-123";
process.env.INTERNAL_APP_SECRET = "test-secret-123";

const {
  readStore,
  writeStore,
  metrics,
  normalizeStore,
  socialPendingCount,
  hashPassword,
  verifyPassword,
  APP_VERSION,
  SCHEMA_VERSION,
  ORDER_STATUSES,
  mountInternalApp,
} = require("./internal-app");

assert.strictEqual(APP_VERSION, "2.0.0");
assert.strictEqual(SCHEMA_VERSION, 2);
assert.strictEqual(typeof mountInternalApp, "function");
assert.deepStrictEqual(ORDER_STATUSES, ["新訂單", "已聯絡", "已付款", "已出貨", "已完成", "已取消"]);

const passwordHash = hashPassword("12345678");
assert.ok(verifyPassword("12345678", passwordHash));
assert.ok(!verifyPassword("wrong", passwordHash));

const normalized = normalizeStore({
  schemaVersion: 1,
  orders: null,
  customers: null,
  inventory: [{ productId: "legacy", name: "舊品項", stock: -2, lowStock: "3" }],
  settings: { notifications: false },
});
assert.strictEqual(normalized.schemaVersion, 2);
assert.ok(Array.isArray(normalized.orders));
assert.ok(Array.isArray(normalized.customers));
assert.ok(normalized.inventory.some((item) => item.productId === "legacy" && item.stock === 0 && item.lowStock === 3));
assert.strictEqual(normalized.settings.notifications, false);
assert.strictEqual(normalized.settings.autoCreateCustomer, true);

const store = readStore();
assert.ok(Array.isArray(store.orders));
assert.ok(Array.isArray(store.customers));
assert.ok(Array.isArray(store.inventory));
assert.ok(Array.isArray(store.reminders));
assert.ok(Array.isArray(store.staff));
assert.ok(Array.isArray(store.activities));
assert.ok(store.inventory.length >= 1);

store.orders.push(
  { id: "ord-active", customerName: "測試客戶", total: 1500, status: "新訂單", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: "ord-done", customerName: "完成客戶", total: 500, status: "已完成", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: "ord-cancel", customerName: "取消客戶", total: 900, status: "已取消", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
);
store.customers.push({ id: "cus-test", name: "測試客戶", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
store.reminders.push({ id: "rem-test", title: "出貨", dueAt: new Date(Date.now() - 1000).toISOString(), done: false });
store.inventory[0].stock = 0;
store.inventory[0].lowStock = 5;
writeStore(store);

fs.writeFileSync(process.env.SOCIAL_DATA_PATH, JSON.stringify({
  posts: [
    { id: "draft", status: "draft" },
    { id: "approved", status: "approved" },
    { id: "published", status: "published" },
  ],
}), "utf8");

const loaded = readStore();
assert.strictEqual(loaded.orders.length, 3);
assert.strictEqual(loaded.customers.length, 1);
assert.strictEqual(loaded.reminders.length, 1);

const socialStore = JSON.parse(fs.readFileSync(process.env.SOCIAL_DATA_PATH, "utf8"));
assert.strictEqual(socialPendingCount(socialStore), 2);
const summary = metrics(loaded, socialStore);
assert.strictEqual(summary.orderCount, 3);
assert.strictEqual(summary.activeOrderCount, 1);
assert.strictEqual(summary.customerCount, 1);
assert.strictEqual(summary.totalSales, 2000);
assert.strictEqual(summary.averageOrderValue, 1000);
assert.ok(summary.lowStockCount >= 1);
assert.strictEqual(summary.dueReminderCount, 1);
assert.strictEqual(summary.pendingSocialCount, 2);

fs.rmSync(tempDir, { recursive: true, force: true });
console.log("PASS internal management app v2 storage, security, social and metrics");
