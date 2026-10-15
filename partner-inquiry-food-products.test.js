"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const { findPartnerInquiry } = require("./partner-inquiry.js");
const products = require("./partner-inquiry-catalog.json").products;
const er = products.find(p => p.id === "royalherb-erzhenbao-64");
const si = products.find(p => p.id === "uboss-sizhenbao");

assert.ok(er && si, "二珍寶及四珍寶都應有獨立商品識別");
assert.notEqual(er.id, si.id);
assert.equal(er.food.classification, "merchant-confirmed-food");
assert.equal(er.food.websitePublic, true);
assert.equal(er.food.autoCheckout, false);
assert.equal(er.publicPage, "product-er-zhen-bao.html");
assert.equal(er.food.size, "600g±15g／盒｜64塊裝");
assert.deepEqual(er.food.ingredients, ["全龜萃取物","馴鹿角萃取物","水","葡萄糖胺","鯊魚軟骨素"]);
for(const phrase of ["二珍寶","御漢堂二珍寶","二珍寶64片","二珍寶有貨嗎","請問二珍寶多少錢"]) {
  assert.equal(findPartnerInquiry(phrase)?.id,er.id,"二珍寶詢問不可配成四珍寶："+phrase);
}
for(const phrase of ["四珍寶","四珍寶精華膏湯塊","請問四珍寶有貨嗎"]) {
  assert.equal(findPartnerInquiry(phrase)?.id,si.id,"四珍寶詢問不可配成二珍寶："+phrase);
}
const server = fs.readFileSync("server.js","utf8");
assert.ok(server.includes("partnerInquiry.food?.classification === 'merchant-confirmed-food'"),"其他廠牌食品應獨立詢問");
assert.ok(server.includes("food.websitePublic"),"已公開食品應能導向實際產品頁");
assert.ok(server.includes("仙加味商品及購買諮詢"),"成交服務應回仙加味");
assert.ok(!er.medicine,"二珍寶食品不得誤標成中藥成藥");
console.log("PASS：二珍寶與四珍寶獨立、食品內容、LINE回流及圖片公開頁");
