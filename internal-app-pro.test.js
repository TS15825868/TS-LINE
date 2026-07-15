"use strict";

const assert = require("assert");
const {
  PRO_VERSION,
  ORDER_STATUSES,
  normalizeOrder,
  dashboardMetrics,
  csvCell,
} = require("./internal-app-pro");

assert.strictEqual(PRO_VERSION, "2.0.0");
assert.ok(ORDER_STATUSES.includes("備貨中"));
assert.ok(ORDER_STATUSES.includes("已完成"));

const order = normalizeOrder({
  customerName: " 測試客戶 ",
  total: "1500",
  status: "已付款",
  payment: "匯款",
});
assert.strictEqual(order.customerName, "測試客戶");
assert.strictEqual(order.total, 1500);
assert.strictEqual(order.status, "已付款");
assert.strictEqual(order.payment, "匯款");

const summary = dashboardMetrics({
  orders: [
    { status: "新訂單", total: 1500 },
    { status: "已完成", total: 2000 },
    { status: "已取消", total: 9999 },
  ],
  customers: [{ id: "c1" }],
  inventory: [{ stock: 1, lowStock: 2 }],
  reminders: [{ done: false, dueAt: new Date(Date.now() - 1000).toISOString() }],
}, [{ status: "draft" }]);

assert.strictEqual(summary.orderCount, 3);
assert.strictEqual(summary.activeOrderCount, 1);
assert.strictEqual(summary.totalSales, 3500);
assert.strictEqual(summary.customerCount, 1);
assert.strictEqual(summary.lowStockCount, 1);
assert.strictEqual(summary.dueReminderCount, 1);
assert.strictEqual(summary.pendingSocialCount, 1);
assert.strictEqual(csvCell('a"b'), '"a""b"');

console.log("PASS internal management app v2 helpers");
