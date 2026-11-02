"use strict";

const assert = require("assert");
const attribution = require("./line-source-attribution");

const cases = [
  ["我從仙加味官網首頁來，想先了解龜鹿系列產品，請協助我從適合自己的方案開始。", "home", "首頁"],
  ["我正在看仙加味龜鹿產品，想了解各產品差異、目前價格與適合的下單方式。", "products", "產品頁"],
  ["我看過仙加味「怎麼選」頁面，想請你依我的使用情境，推薦比較適合的產品。", "choose", "怎麼選"],
  ["我看過仙加味品牌故事，想更了解龜鹿產品與日常使用方式。", "brand", "品牌故事"],
  ["我想申請試喝，請協助我從試喝方案開始。", "trial", "試喝頁"],
];

for (const [text, page, label] of cases) {
  const result = attribution.detectWebsiteOrigin(text);
  assert(result, `應辨識 ${label}`);
  assert.strictEqual(result.sourceDetail, `website:${page}`);
  assert.strictEqual(result.sourceLabel, label);
  assert(result.leadOrigin.startsWith("https://ts15825868.github.io/xianjiawei/"));
}

// Reproduce the current production CTA contract, not only saved 2026/09 links.
const currentCases = [
  ["我從仙加味官網首頁進來，想了解產品與怎麼選。", "home"],
  ["我從仙加味商品總覽進來，想了解商品規格、供貨與購買方式。", "products"],
  ["我想比較仙加味目前產品與規格。", "products"],
  ["我不確定仙加味目前產品怎麼選，想請你依我的使用習慣整理。", "products"],
  ["我不確定怎麼選，想請你依我的生活方式幫我整理。", "choose"],
  ["我想依生活習慣比較仙加味產品。", "choose"],
  ["我從品牌故事頁進來，想認識仙加味與產品。", "brand"],
  ["我看完仙加味品牌故事，想了解產品與怎麼選。", "brand"],
  ["我想申請龜鹿飲30cc試喝組。", "trial"],
];
for (const [text, page] of currentCases) {
  assert.strictEqual(attribution.detectWebsiteOrigin(text)?.sourceDetail, `website:${page}`);
}
assert.strictEqual(attribution.detectWebsiteOrigin("我不確定怎麼選"), null);
assert.strictEqual(attribution.detectWebsiteOrigin("龜鹿飲30cc試喝"), null);
assert.strictEqual(attribution.detectWebsiteOrigin("我想了解仙加味產品。"), null);

attribution.remember("U-current-prefill-test", currentCases.at(-1)[0], 10000);
const currentPayload = attribution.augmentCrmPayload({userId:"U-current-prefill-test",source:"LINE OA",campaignId:"keep-existing"},10001);
assert.strictEqual(currentPayload.sourceDetail,"website:trial");
assert.strictEqual(currentPayload.campaignId,"keep-existing");
assert.strictEqual(attribution.getRemembered("U-current-prefill-test",10000+24*60*60*1000+1),null);

assert.strictEqual(attribution.detectWebsiteOrigin("申請試喝"), null, "LINE OA 內部快速回覆不得誤判成官網試喝頁");
assert.strictEqual(attribution.detectWebsiteOrigin("我想看產品"), null, "一般對話不得誤判官網來源");

const now = Date.now();
const userId = "U-attribution-test";
attribution.remember(userId, cases[4][0], now);
const enriched = attribution.augmentCrmPayload({
  userId,
  source: "LINE OA",
  orderType: "trial",
  campaignId: "guilu-drink-30-evergreen-trial",
}, now + 1000);

assert.strictEqual(enriched.source, "官網→LINE OA｜試喝頁");
assert.strictEqual(enriched.orderSource, "官網→LINE OA｜試喝頁");
assert.strictEqual(enriched.sourceDetail, "website:trial");
assert.strictEqual(enriched.campaignTag, "website-trial-line");
assert.strictEqual(enriched.lineOaStatus, "connected");
assert.strictEqual(enriched.campaignId, "guilu-drink-30-evergreen-trial", "既有試喝 campaignId 必須保留");

const customUser = "U-custom-source-test";
attribution.remember(customUser, cases[1][0], now);
const custom = attribution.augmentCrmPayload({ userId: customUser, source: "人工活動名單", orderType: "purchase" }, now + 1000);
assert.strictEqual(custom.source, "人工活動名單", "既有非預設來源不可被官網歸因覆寫");
assert.strictEqual(custom.sourceDetail, "website:products");

assert.strictEqual(attribution.isCrmRequest(process.env.CRM_URL || "https://script.google.com/macros/s/AKfycbwAFBxeROd2ZYGJ_h0O7_H2MMxptOMoj3EXIErZpbKuTYFOzOVwQkrk8X1MoxapkHVGSA/exec", { method: "POST" }), true);
assert.strictEqual(attribution.isCrmRequest("https://api.line.me/v2/bot/message/push", { method: "POST" }), false, "LINE API 不得被 CRM bridge 攔截");

console.log("line-source-attribution tests passed");
