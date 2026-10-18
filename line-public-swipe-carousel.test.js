"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { applyMaster } = require("./product-sales-master");
const publicPartner = require("./line-partner-public-carousel.json");
const lineProducts = applyMaster(JSON.parse(fs.readFileSync(path.join(__dirname, "data.json"), "utf8"))).products;
const source = fs.readFileSync(path.join(__dirname, "server.js"), "utf8");
const mediaSource = fs.readFileSync(path.join(__dirname, "line-image-safety.js"), "utf8");
const ids = [...lineProducts.map(p=>p.id), ...publicPartner.products.map(p=>p.id)];
assert.equal(ids.length, new Set(ids).size, "全部商品卡不可重複");
assert.ok(ids.length <= 12, "單組 LINE Flex carousel 上限為 12");
assert.equal(ids.length, 9, "目前正式官網公開商品為 9 項，丹參六款合併為一張");
assert.equal(publicPartner.products.length, 5, "其他五項原廠商品需要獨立商品卡");
assert.equal(publicPartner.products.find(p=>p.id==="danshen-tea-collection")?.name, "丹參茶包系列");
for (const product of publicPartner.products) {
  assert.ok(/^product-[a-z0-9-]+\.html$/.test(product.page), `${product.id} 詳細頁格式錯誤`);
  assert.ok(/^images\/catalog-owner-final-v20261017\/[^/]+\.webp(?:\?.*)?$/.test(product.image), `${product.id} 未使用核准實物主圖`);
  assert.ok(product.name && product.specification, `${product.id} 資料不完整`);
  assert.equal(product.price, undefined, `${product.id} 不得自創末端售價`);
}
assert.ok(source.includes("...PARTNER_CAROUSEL.map(partnerProductBubble)"), "全部商品未進左右滑動 Flex carousel");
assert.ok(source.includes("return productCarousel();"), "產品入口應直接顯示同一組左右滑動卡片");
assert.ok(source.includes("const partnerInquiryMatch"), "其他商品詢價路由遺失");
assert.ok(source.includes("/assets/partner-product/"), "其他商品圖片沒有連到 LINE 相容 JPEG");
assert.ok(mediaSource.includes('app.get("/assets/partner-product/:id.jpg"'), "未安裝 LINE JPEG 轉換路由");
assert.ok(mediaSource.includes('fit: "inside", withoutEnlargement: true'), "正式原圖不得裁切放大");
console.log("PASS：LINE 9 項正式公開產品同一組左右滑動；五項原廠產品 JPEG、完整介紹與詢價入口有效。");
