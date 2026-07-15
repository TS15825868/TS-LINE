"use strict";

const assert = require("assert");
const fs = require("fs");
const vm = require("vm");

const source = fs.readFileSync(require.resolve("./internal-order-entry-controller"), "utf8");
new vm.Script(source);
[
  "商品與金額",
  "單價",
  "數量",
  "商品小計",
  "折扣",
  "運費",
  "已收金額",
  "未收餘額",
  "付款狀態",
  "預計送貨日",
  "待送貨",
  "orderLines",
  "shippingFee",
  "discount",
  "paidAmount",
  "balance",
  "paymentStatus",
  "expectedDeliveryAt",
  "可用庫存",
  "自訂商品／服務",
].forEach((token) => assert.ok(source.includes(token), `missing order entry token: ${token}`));
assert.ok(source.includes("window.xjwOrderEntry"));
assert.ok(!source.includes("MutationObserver"));
console.log("PASS itemized order price, quantity, totals, payment and pending delivery controller");
