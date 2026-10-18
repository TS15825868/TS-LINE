"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { applyMaster } = require("./product-sales-master");
const publicPartner = require("./line-partner-public-carousel.json");
const live = require("./line-public-catalog-runtime");
const lineProducts = applyMaster(JSON.parse(fs.readFileSync(path.join(__dirname, "data.json"), "utf8"))).products;
const source = fs.readFileSync(path.join(__dirname, "server.js"), "utf8");
const mediaSource = fs.readFileSync(path.join(__dirname, "line-image-safety.js"), "utf8");
const ids = [...lineProducts.map(p=>p.id), ...publicPartner.products.map(p=>p.id)];
assert.equal(ids.length, new Set(ids).size, "全部商品卡不可重複");
assert.ok(ids.length > 0, "LINE 正式商品展示不可為空");
assert.equal(live.PERIOD_MS, 15*60*1000, "新增公開商品定期檢查週期");
assert.deepEqual(live.current(), publicPartner.products, "首次載入沿用最後核准的正式商品快照");
assert.equal(publicPartner.products.find(p=>p.id==="danshen-tea-collection")?.name, "丹參茶包系列");
for (const product of publicPartner.products) {
  assert.ok(/^product-[a-z0-9-]+\.html$/.test(product.page), `${product.id} 詳細頁格式錯誤`);
  assert.ok(/^images\/catalog-owner-final-v20261017\/[^/]+\.webp(?:\?.*)?$/.test(product.image), `${product.id} 未使用核准實物主圖`);
  assert.ok(product.name && product.specification, `${product.id} 資料不完整`);
  assert.equal(product.price, undefined, `${product.id} 不得自創末端售價`);
}
assert.ok(source.includes("...publicCatalog.current().map(partnerProductBubble)"), "全部核准商品未進左右滑動 Flex carousel");
assert.ok(source.includes("const hasNextPage = remaining.length > 60"), "商品超過單次 LINE 回覆上限時不得截斷或報錯");
assert.ok(source.includes("const nextProductsMatch"), "大量新品必須有下一頁導覽");
assert.ok(source.includes("await publicCatalog.refresh()"), "LINE 查詢商品時必須同步官網最新已核准商品");
assert.ok(source.includes("return productCarousel();"), "產品入口應直接顯示同一組左右滑動卡片");
assert.ok(source.includes("const partnerInquiryMatch"), "其他商品詢價路由遺失");
assert.ok(source.includes("/assets/partner-product/"), "其他商品圖片沒有連到 LINE 相容 JPEG");
assert.ok(mediaSource.includes('app.get("/assets/partner-product/:id.jpg"'), "未安裝 LINE JPEG 轉換路由");
assert.ok(mediaSource.includes('fit: "inside", withoutEnlargement: true'), "正式原圖不得裁切放大");

// 用實際 productCarousel 函式模擬商品增加，避免未來超過 12 張直接失敗。
const vm = require("node:vm");
const start = source.indexOf("function productCarousel(start = 0) {");
const end = source.indexOf("\nfunction productMenuReply()", start);
assert.ok(start >= 0 && end > start, "找不到正式商品滑動函式");
const ctx = {
  DATA: { products: lineProducts },
  publicCatalog: { current: () => publicPartner.products },
  productBubble: p => ({ type:"bubble", id:p.id }),
  partnerProductBubble: p => ({ type:"bubble", id:p.id }),
  textMsg: (text, buttons) => ({ type:"text", text, buttons }),
};
const render = vm.runInNewContext("(" + source.slice(start,end).replace("function productCarousel", "function") + ")", ctx);
const currentRender = render();
assert.equal(currentRender.contents?.contents?.length, ids.length, "目前 LINE 公開商品應同組滑動");
ctx.publicCatalog.current = () => Array.from({length:15},(_,i)=>({id:"new-"+i}));
const moreThanTwelve = render();
assert.equal(moreThanTwelve.length,2,"超過 12 張應自動拆成多個左右滑動 carousel");
assert.deepEqual(Array.from(moreThanTwelve,x=>x.contents.contents.length),[12,7]);
ctx.publicCatalog.current = () => Array.from({length:70},(_,i)=>({id:"future-"+i}));
const many = render();
assert.equal(many.length,5,"大量新增商品時回覆最多五則");
assert.equal(many[4].type,"text","超過 60 張應顯示下一頁按鈕");
assert.equal(many[4].buttons[0].text,"商品下一頁｜48");
const next = render(48);
assert.equal(Array.isArray(next)?next[0].contents.contents.length:next.contents.contents.length,12,"第二頁應接續展示尚未瀏覽的商品");

console.log(`PASS：LINE ${ids.length} 項已核准商品可左右滑動；未來新增商品動態同步，超出 12／60 張時正常分組。`);
