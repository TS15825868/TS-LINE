"use strict";

const assert = require("assert");
const { analytics, parseProductLines } = require("./internal-operations-suite");

const store = {
  orders: [
    { id: "1", customerName: "王小姐", phone: "0911", items: "龜鹿膏 × 2\n鹿茸粉 × 1", total: 3500, status: "已完成", createdAt: "2026-07-01T00:00:00.000Z" },
    { id: "2", customerName: "王小姐", phone: "0911", items: "龜鹿膏 × 1", total: 1500, status: "已付款", createdAt: "2026-07-02T00:00:00.000Z" },
    { id: "3", customerName: "李先生", phone: "0922", items: "龜鹿飲30cc × 12", total: 500, status: "已取消", createdAt: "2026-07-03T00:00:00.000Z" },
  ],
  customers: [{ id: "a" }, { id: "b" }],
  inventory: [{ stock: 2, lowStock: 5 }, { stock: 10, lowStock: 5 }],
};

assert.deepStrictEqual(parseProductLines(store.orders).slice(0, 2), [
  { name: "龜鹿膏", qty: 3 },
  { name: "鹿茸粉", qty: 1 },
]);

const result = analytics(store);
assert.strictEqual(result.orderCount, 3);
assert.strictEqual(result.validOrderCount, 2);
assert.strictEqual(result.completedOrderCount, 1);
assert.strictEqual(result.totalSales, 5000);
assert.strictEqual(result.completedSales, 3500);
assert.strictEqual(result.averageOrderValue, 2500);
assert.strictEqual(result.repeatCustomerCount, 1);
assert.strictEqual(result.lowStockCount, 1);
assert.strictEqual(result.topCustomers[0].name, "王小姐");
assert.strictEqual(result.topCustomers[0].orders, 2);

console.log("PASS complete internal operations analytics");