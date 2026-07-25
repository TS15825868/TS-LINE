"use strict";

const assert = require("assert");
const fs = require("fs");
const guard = require("./product-quote-only-guard");
const sales = require("./line-sales-master.json");

const source = fs.readFileSync("server.js", "utf8");
const transformed = guard.transformServer(source);

assert.strictEqual(guard.VERSION, "2026-07-25-quote-only-v2");
assert.strictEqual(sales.products["guilu-jiao"].quoteOnly, true);
assert.strictEqual(sales.products["guilu-jiao"].price, 0);
assert.strictEqual(sales.products["guilu-jiao"].priceText, "價格請洽詢");

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
console.log("PASS quote-only product shows LINE inquiry and cannot enter cart at NT$0");
