"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { applyMaster } = require("./product-sales-master");
const sales = require("./line-sales-master.json");
const raw = JSON.parse(fs.readFileSync(path.join(__dirname, "data.json"), "utf8"));
const products = applyMaster(raw).products;
const server = fs.readFileSync(path.join(__dirname, "server.js"), "utf8");

assert.ok(products.length > 0, "LINE 商品清單不可為空");
for (const product of products) {
  const source = sales.products?.[product.id];
  assert.ok(source, `${product.id} 缺少 LINE 銷售母資料`);
  const approved = source.quoteOnly === false && Number.isFinite(Number(source.price)) && Number(source.price) > 0;
  assert.equal(product.quoteOnly, !approved, `${product.id} 詢價狀態錯誤`);
  if (approved) {
    assert.equal(product.price, Number(source.price), `${product.id} 末端售價沒有從核准銷售母資料同步`);
    assert.ok(product.offers.every(o => Number(o.qty)>0 && Number(o.total)>=0), `${product.id} 優惠格式不正確`);
  } else {
    assert.equal(product.price, undefined, `${product.id} 未核准售價不得顯示`);
    assert.deepEqual(product.offers, [], `${product.id} 未核准優惠不得套用`);
  }
}
assert.match(server, /function productBubble\(product\)/, "缺少商品卡");
assert.match(server, /function qtyMenu\(product\)/, "缺少選擇數量");
assert.ok(server.includes('canOrder ? "加入購物車" : "詢價數量"'), "已核准售價與未核准詢價的動作不得混用");
assert.ok(server.includes("售價："), "商品卡須顯示已核准末端售價");
assert.ok(server.includes("const addMatch = text.match"), "加入購物車處理不可遺失");
assert.ok(server.includes("const quoteQtyMatch = text.match"), "人工詢價處理不可遺失");
console.log("PASS：LINE 末端售價、詢價與購物車資料權威一致。");
