"use strict";

const assert = require("node:assert/strict");
const server = require("./server");
const { normalizeNode, DRINK_NOTICE, READY_STOCK_NOTICE } = require("./product-fulfillment-message-fix");

function text(value) {
  return JSON.stringify(normalizeNode(value));
}

const queryCases = [
  ["龜鹿膏", "guilu-gao"],
  ["30cc", "guilu-drink-30"],
  ["龜鹿飲30cc玻璃罐", "guilu-drink-30"],
  ["180cc", "guilu-drink-180"],
  ["龜鹿飲180cc鋁袋", "guilu-drink-180"],
  ["龜鹿湯塊", "guilu-tangkuai"],
  ["湯塊", "guilu-tangkuai"],
  ["龜鹿膠", "guilu-jiao"],
  ["一斤裝", "guilu-jiao"],
  ["鹿茸粉", "luerong-fen"],
];
for (const [query, expectedId] of queryCases) {
  assert.equal(server.detectProduct(query)?.id, expectedId, `${query} 應命中 ${expectedId}`);
}

const products = server.DATA.products;
assert.equal(products.length, 6);
assert.deepEqual(products.map((item) => item.id).sort(), [
  "guilu-drink-180",
  "guilu-drink-30",
  "guilu-gao",
  "guilu-jiao",
  "guilu-tangkuai",
  "luerong-fen",
].sort());

const gao = server.getProduct("guilu-gao");
assert.equal(gao.spec, "100g／罐");
assert.equal(gao.usage[0], "可依個人使用習慣與作息時間安排");
assert.deepEqual(gao.ingredients, ["鹿角萃取物", "龜板萃取物", "枸杞", "紅棗", "黃耆", "粉光蔘"]);

const drink30 = server.getProduct("guilu-drink-30");
assert.equal(drink30.displayName, "龜鹿飲30cc玻璃罐");
assert.equal(drink30.spec, "30cc／罐（小玻璃罐）");
assert.ok(!drink30.displayName.includes("瓶"));
assert.deepEqual(drink30.ingredients, ["水", "龜板萃取物", "鹿角萃取物", "粉光蔘", "枸杞", "紅棗", "黃耆"]);

const drink180 = server.getProduct("guilu-drink-180");
assert.equal(drink180.displayName, "龜鹿飲180cc鋁袋");
assert.equal(drink180.spec, "180cc／包（鋁袋）");
assert.deepEqual(drink180.ingredients, drink30.ingredients);

const soup = server.getProduct("guilu-tangkuai");
assert.equal(soup.spec, "75g／盒｜8塊裝｜每塊約9.375g");
assert.ok(!JSON.stringify(soup).includes("300g"));
assert.ok(!JSON.stringify(soup).includes("600g"));
assert.deepEqual(soup.ingredients, ["龜板萃取物", "鹿角萃取物"]);

const jiao = server.getProduct("guilu-jiao");
assert.equal(jiao.spec, "600g（1斤）／盒｜32塊裝｜每塊約18.75g");
assert.deepEqual(jiao.ingredients, ["龜板萃取物", "鹿角萃取物"]);

const antler = server.getProduct("luerong-fen");
assert.equal(antler.spec, "75g／罐");
assert.deepEqual(antler.ingredients, ["鹿茸"]);

const productCarousel = text(server.productCarousel());
assert.ok(productCarousel.includes(DRINK_NOTICE));
assert.ok(productCarousel.includes(READY_STOCK_NOTICE));
assert.ok(productCarousel.includes("龜鹿湯塊"));
assert.ok(productCarousel.includes("75g／盒"));
assert.ok(!productCarousel.includes("龜鹿湯塊300g"));
assert.ok(!productCarousel.includes("龜鹿湯塊600g"));
assert.ok(!productCarousel.includes("選擇規格"));

const priceCarousel = text(server.priceCarousel());
assert.ok(priceCarousel.includes("60"));
assert.ok(priceCarousel.includes("600"));
assert.ok(priceCarousel.includes("200"));
assert.ok(priceCarousel.includes("2,000") || priceCarousel.includes("2000"));
assert.ok(!priceCarousel.includes("龜鹿湯塊300g"));
assert.ok(!priceCarousel.includes("龜鹿湯塊600g"));

const gaoUsage = text(server.usageReply(gao));
assert.ok(gaoUsage.includes("可依個人使用習慣與作息時間安排"));
assert.ok(gaoUsage.includes("鹿角萃取物"));
assert.ok(gaoUsage.includes("粉光蔘"));
assert.ok(gaoUsage.includes(READY_STOCK_NOTICE));

const drinkUsage = text(server.usageReply(drink30));
assert.ok(drinkUsage.includes("30cc"));
assert.ok(drinkUsage.includes("水"));
assert.ok(drinkUsage.includes(DRINK_NOTICE));

console.log("PASS：LINE OA 常用客人問法、正式產品回覆、價格輪播與使用方式全部符合六項正式母本。");
