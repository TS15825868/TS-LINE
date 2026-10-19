"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { applyMaster } = require("./product-sales-master");
const publicPartner = require("./line-partner-public-carousel.json");
const live = require("./line-public-catalog-runtime");
const retail = require("./line-partner-retail-authority.json");
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
  assert.ok(((["royalherb-erzhenbao-64","uboss-sizhenbao"].includes(product.id)) ? product.image === `images/catalog-real-owner-v20261019/${product.id}-front.png` : /^images\/catalog-owner-final-v20261017\/[^/]+\.webp(?:\?.*)?$/.test(product.image)), `${product.id} 未使用核准實物主圖`);
  assert.ok(product.name && product.specification, `${product.id} 資料不完整`);
  assert.equal(product.price, undefined, `${product.id} 不得自創末端售價`);
}
assert.ok(source.includes("...otherCards.map(partnerProductBubble)"), "全部核准商品未進左右滑動 Flex carousel");
assert.ok(source.includes("!coreIds.has(product.id)"), "官網新增商品不得與核心商品卡重複");
assert.ok(source.includes("const hasNextPage = remaining.length > 60"), "商品超過單次 LINE 回覆上限時不得截斷或報錯");
assert.ok(source.includes("const nextProductsMatch"), "大量新品必須有下一頁導覽");
assert.ok(source.includes("await publicCatalog.refresh()"), "LINE 查詢商品時必須同步官網最新已核准商品");
assert.ok(source.includes("return productCarousel();"), "產品入口應直接顯示同一組左右滑動卡片");
assert.equal(retail.products["danshen-tea-collection"].price, 480, "六款丹參茶末端售價應為每盒480元");
assert.equal(retail.products["danshen-tea-collection"].label, "售價 NT$480／盒｜共六款可選", "商品卡應顯示一盒480元、六款可選");
assert.ok(!/六款各一盒|六盒共\s*NT\$?480|一盒含六款/.test(retail.products["danshen-tea-collection"].label), "丹參商品卡不得誤導 NT$480 含六盒");
assert.ok(fs.readFileSync("line-danshen-flavor-menu.js","utf8").includes("一盒 NT$480｜共六款可選"), "LINE 丹參選單須簡潔呈現一盒480元共六款可選");
assert.ok(source.includes("丹參茶包一盒 NT$480，共六款可選"), "LINE 價格 FAQ 須清楚說明一盒480元共六款可選");

assert.equal(retail.products["guilu-vitality"].price, 1800, "龜鹿活力飲核准末端售價應為1800元");
assert.equal(retail.products["jinan-sisheng-siwuyin"].price, 1000, "參仲四物飲核准售價");
assert.equal(retail.products["royalherb-erzhenbao-64"].price, 13800, "二珍寶核准定價");
assert.equal(retail.products["royalherb-erzhenbao-64"].promotionPrice, 12000, "二珍寶優惠價");
assert.equal(retail.products["uboss-sizhenbao"].price, 14800, "四珍寶包裝建議售價");
assert.equal(retail.products["uboss-sizhenbao"].promotionPrice, 12000, "四珍寶線上優惠價");
assert.match(retail.products["uboss-sizhenbao"].label, /^建議售價 /, "包裝印建議售價時應明確標示");
assert.equal(retail.products["royalherb-erzhenbao-64"].priceType, "suggested", "二珍寶須依使用者最新確認標示建議售價");
assert.equal(retail.products["uboss-sizhenbao"].priceType, "suggested", "四珍寶須標示建議售價");
assert.equal(retail.products["royalherb-erzhenbao-64"].label, "建議售價 NT$13,800／盒\n優惠價 NT$12,000／盒", "二珍寶價格顯示不得被舊規則回退");
assert.equal(retail.products["uboss-sizhenbao"].label, "建議售價 NT$14,800／盒\n優惠價 NT$12,000／盒", "四珍寶價格顯示需與最新確認一致");
for (const id of ["jinan-sisheng-siwuyin","guilu-vitality","danshen-tea-collection"]) {
  assert.match(retail.products[id].label, /^售價 /, `${id} 未核實印刷建議售價，應標售價`);
}

for (const [id, price] of Object.entries(retail.products)) {
  assert.equal(price.confirmed, true, `${id} 末端價必須經確認`);
  assert.ok(Number(price.price)>0 && typeof price.label==="string", `${id} 價格與文字異常`);
}
for (const item of publicPartner.products) {
  if (!retail.products[item.id]) assert.equal(item.price, undefined, `${item.id} 未核准零售價格不得推算`);
}
assert.ok(source.includes("const retail = partnerRetail(product)"), "LINE 新品卡未讀核准售價");
assert.ok(source.includes("retail ? retail.label"), "LINE 新品卡未顯示核准售價");
assert.ok(source.includes("const partnerInquiryMatch"), "其他商品詢價路由遺失");
assert.ok(source.includes("/assets/partner-product/"), "其他商品圖片沒有連到 LINE 相容 JPEG");
assert.ok(mediaSource.includes('app.get("/assets/partner-product/:id.jpg"'), "未安裝 LINE JPEG 轉換路由");
assert.ok(mediaSource.includes('fit: "inside", withoutEnlargement: true'), "正式原圖不得裁切放大");

// 以真正 LINE Flex bubble 產生器檢查價格文字與圖片，而不是只搜尋程式碼片段。
const vmBubble = require("node:vm");
const bubbleStart = source.indexOf("function partnerProductBubble(product) {");
const bubbleEnd = source.indexOf("\nfunction productCarousel(", bubbleStart);
assert.ok(bubbleStart >= 0 && bubbleEnd > bubbleStart, "LINE 其他產品 bubble 函式不存在");
const renderBubble = vmBubble.runInNewContext(
  "(" + source.slice(bubbleStart, bubbleEnd).replace("function partnerProductBubble", "function") + ")",
  {
    absoluteUrl: asset => "https://ts15825868.github.io/xianjiawei/" + asset,
    partnerRetail: product => retail.products[product.id],
    PARTNER_CAROUSEL_VERSION: publicPartner.version,
    require: name => name === "./line-image-safety-core"
      ? { PUBLIC_BASE_URL: "https://ts-line.onrender.com" }
      : (() => { throw new Error("不允許不相關模組：" + name); })(),
  }
);
for (const product of publicPartner.products) {
  const bubble = renderBubble(product);
  assert.equal(bubble.type, "bubble", product.id + " 不是 LINE 商品卡");
  assert.equal(bubble.hero?.aspectMode, "fit", product.id + " 主圖不得裁切");
  assert.match(bubble.hero?.url || "", /\/assets\/partner-product\/[a-z0-9-]+\.jpg\?v=/, product.id + " 未使用 LINE JPEG 圖片");
  const price = retail.products[product.id];
  const bodyText = bubble.body?.contents?.map(x => x.text).join("\n") || "";
  assert.ok(bodyText.includes(price.label), product.id + " 顧客卡片價格錯誤");
  assert.equal(bubble.footer?.contents?.length, 3, product.id + " 商品卡需有三個操作入口");
  assert.ok(!/成本|批發價/.test(bodyText), product.id + " 顧客端不得出現成本或批發價");
}
assert.match(mediaSource, /Date\.now\(\) - cached\.createdAt >= 15 \* 60 \* 1000/, "新品更換原圖需要快取失效機制");
assert.ok(mediaSource.includes('role === "partner-product" ? "public, max-age=900'), "原廠商品照片 HTTP 快取不應鎖定一天");
assert.ok(source.includes('PARTNER_CAROUSEL_VERSION + ":" + product.image'), "正式原圖換路徑後 LINE 圖片網址必須改變");

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
ctx.publicCatalog.current = () => [{id:lineProducts[0].id}, ...publicPartner.products];
const deduped = render();
assert.equal(deduped.contents.contents.length, ids.length, "LINE 重複核心商品不得出現第二張卡");
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
