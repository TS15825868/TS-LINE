"use strict";

const assert = require("assert");
const fs = require("fs");
const guard = require("./product-quote-only-guard");
const sales = require("./line-sales-master.json");

const source = fs.readFileSync("server.js", "utf8");
const transformed = guard.transformServer(source);
const jiao = sales.products["guilu-jiao"];

assert.strictEqual(guard.VERSION, "2026-07-25-quote-only-v2");
assert.strictEqual(jiao.quoteOnly, false);
assert.strictEqual(jiao.price, 9600);
assert.strictEqual(jiao.originalPrice, 12000);
assert.strictEqual(jiao.priceText, "$9,600 / 一斤裝");
assert.strictEqual(jiao.priceLabel, "售價12,000元，優惠價9,600元");

// 保留守門程式，讓未來任何真正設定 quoteOnly 的產品仍無法以 NT$0 進入購物車。
assert(transformed.includes('orderStatus: product.quoteOnly ? "洽詢客服" : "開放下單"'));
assert(transformed.includes('product.quoteOnly ? (product.priceLabel || "價格請洽詢客服")'));
assert(transformed.includes('action: { type: "uri", label: "LINE洽詢"'));
assert(transformed.includes('if (product.quoteOnly) return flexCard(product.displayName'));
assert(transformed.includes('function qtyMenu(product) {\n  if (product.quoteOnly)'));
assert(transformed.includes('if (product.quoteOnly) return { total: 0, label: "價格請洽詢" }'));
assert(transformed.includes('if (product.quoteOnly) return false'));
assert(transformed.includes('product.quoteOnly\n        ? { label: "LINE洽詢"'));
assert(transformed.includes('if (product.quoteOnly) return reply(event.replyToken, qtyMenu(product))'));
assert(!transformed.includes('product.quoteOnly ? `售價 ${money(product.price)}'));

console.log("PASS 龜鹿膠正式售價已開放，quote-only 安全守門仍保留");
