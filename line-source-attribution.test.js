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

assert.strictEqual(attribution.remember("U-current-prefill-test", currentCases.at(-1)[0], 10000),null);
const currentPayload = attribution.augmentCrmPayload({userId:"U-current-prefill-test",source:"LINE OA",campaignId:"keep-existing"},10001);
assert.strictEqual(currentPayload.sourceDetail,undefined);
assert.strictEqual(attribution.detectWebsiteOrigin(currentCases.at(-1)[0]).sourceEvidence,"prefill_match_only");
assert.strictEqual(currentPayload.campaignId,"keep-existing");
assert.strictEqual(attribution.getRemembered("U-current-prefill-test",10000+24*60*60*1000+1),null);

assert.strictEqual(attribution.detectWebsiteOrigin("申請試喝"), null, "LINE OA 內部快速回覆不得誤判成官網試喝頁");
assert.strictEqual(attribution.detectWebsiteOrigin("我想看產品"), null, "一般對話不得誤判官網來源");

const now = Date.now();
const userId = "U-attribution-test";
attribution.remember(userId, currentCases[0][0], now);
assert.strictEqual(attribution.remember(userId,cases[4][0],now+1),null);
const enriched = attribution.augmentCrmPayload({
  userId,
  source: "LINE OA",
  orderType: "trial",
  campaignId: "guilu-drink-30-evergreen-trial",
}, now + 1000);

assert.strictEqual(enriched.source, "官網→LINE OA｜首頁");
assert.strictEqual(enriched.orderSource, "官網→LINE OA｜首頁");
assert.strictEqual(enriched.sourceDetail, "website:home");
assert.strictEqual(enriched.campaignTag, "website-home-line");
assert.strictEqual(enriched.sourceEvidence,"website_self_report");
assert.strictEqual(enriched.lineOaStatus, "connected");
assert.strictEqual(enriched.campaignId, "guilu-drink-30-evergreen-trial", "既有試喝 campaignId 必須保留");

const customUser = "U-custom-source-test";
attribution.remember(customUser, currentCases[1][0], now);
const custom = attribution.augmentCrmPayload({ userId: customUser, source: "人工活動名單", orderType: "purchase" }, now + 1000);
assert.strictEqual(custom.source, "人工活動名單", "既有非預設來源不可被官網歸因覆寫");
assert.strictEqual(custom.sourceDetail, undefined, "人工來源不可混入網站歸因");
const groupUser="U-group-offline";
attribution.captureEvents({events:[{type:"message",source:{type:"group",userId:groupUser},message:{type:"text",text:currentCases[0][0]}}]});
assert.equal(attribution.getRemembered(groupUser),null);
const privateUser="U-private-offline";
attribution.captureEvents({events:[{type:"message",source:{type:"user",userId:privateUser},message:{type:"text",text:currentCases[0][0]}}]});
assert.equal(attribution.getRemembered(privateUser)?.sourceEvidence,"website_self_report");
attribution.captureEvents({events:[{type:"unfollow",source:{type:"user",userId:privateUser}}]});
assert.equal(attribution.getRemembered(privateUser),null);
const first="U-first-source";
attribution.remember(first,currentCases[0][0],now);
attribution.remember(first,currentCases[1][0],now+1);
assert.equal(attribution.getRemembered(first,now+2).sourceDetail,"website:home");
assert.equal(attribution.getRemembered(first,now+24*60*60*1000+1),null);
console.log("PASS source evidence: self-report only, first source, group exclusion, unfollow removal, explicit attribution preserved");

assert.strictEqual(attribution.isCrmRequest(process.env.CRM_URL || "https://script.google.com/macros/s/AKfycbwAFBxeROd2ZYGJ_h0O7_H2MMxptOMoj3EXIErZpbKuTYFOzOVwQkrk8X1MoxapkHVGSA/exec", { method: "POST" }), true);
assert.strictEqual(attribution.isCrmRequest("https://api.line.me/v2/bot/message/push", { method: "POST" }), false, "LINE API 不得被 CRM bridge 攔截");

console.log("line-source-attribution tests passed");

// Cross-system exact self-report contract. Old generic messages stay unknown.
const entryContract={
  "home": [
    "我從仙加味官網首頁進來，想了解目前產品怎麼選。"
  ],
  "choose": [
    "我從仙加味官網怎麼選頁面進來，想請你幫我比較產品。"
  ],
  "trial": [
    "我從仙加味官網試喝頁進來，想申請龜鹿飲30cc試喝組。"
  ]
};
for(const [page,messages] of Object.entries(entryContract))for(const message of messages){const origin=attribution.detectWebsiteOrigin(message);assert.equal(origin.sourceEvidence,"website_self_report");assert.equal(origin.sourceDetail,"website:"+page);}
assert.equal(attribution.detectWebsiteOrigin("我從仙加味官網試喝頁進來，想了解別的事情。"),null);
assert.equal(attribution.detectWebsiteOrigin("我想申請龜鹿飲30cc試喝組。").sourceEvidence,"prefill_match_only");
assert.equal(attribution.detectWebsiteOrigin("我想依生活習慣比較仙加味產品。").sourceEvidence,"prefill_match_only");
// Exercise the real website-intent function in isolation, without starting LINE.
const fs=require("node:fs"),vm=require("node:vm");const server=fs.readFileSync("server.js","utf8");const intentSource=server.slice(server.indexOf("function detectWebsiteIntent("),server.indexOf("async function handleMessage("));const sandbox={};vm.runInNewContext(intentSource+"\nthis.detect=detectWebsiteIntent;",sandbox);assert.equal(sandbox.detect(entryContract.choose[0]),"recommend");assert.equal(sandbox.detect(entryContract.trial[0]),"trial");
// Trial page price inquiries must not be routed to trial by a source prefix.
console.log("PASS explicit trial/choose website source contract");

// Voluntary referral self-report, not an inferred share, click or new purchase.
const referralPhrase="我是經親友介紹認識仙加味，想申請龜鹿飲30cc試喝組。";
const referral=attribution.detectWebsiteOrigin(referralPhrase);
assert.equal(referral.sourceEvidence,"referral_self_report");
assert.equal(referral.sourceDetail,"referral:trial");
assert.equal(attribution.detectWebsiteOrigin("朋友介紹"),null);
assert.equal(attribution.detectWebsiteOrigin(referralPhrase+"其他"),null);
const referralUser="U-referral-offline";
attribution.remember(referralUser,referralPhrase,now);
const referred=attribution.augmentCrmPayload({userId:referralUser,source:"LINE OA",orderType:"trial"},now+1);
assert.equal(referred.source,"親友介紹→LINE OA｜試喝頁");
assert.equal(referred.campaignTag,"referral-trial-line");
assert.equal(referred.sourceEvidence,"referral_self_report");
assert.equal(referred.orderType,"trial");
assert.equal(attribution.augmentCrmPayload({userId:referralUser,source:"人工來源"},now+1).source,"人工來源");
attribution.remember(referralUser,currentCases[0][0],now+2);
assert.equal(attribution.getRemembered(referralUser,now+3).sourceDetail,"referral:trial");
assert.equal(attribution.getRemembered(referralUser,now+24*60*60*1000+1),null);
assert.equal(sandbox.detect(referralPhrase),"trial");
console.log("PASS exact voluntary referral contract");

// Explicit website contact and opt-in B2B entry; existing merchant permissions stay unchanged.
const contactEntry="我從仙加味官網聯絡頁進來，想詢問產品、規格、使用方式或購買配送。",b2bEntry="我從仙加味官網合作頁進來，想進行商家合作。",homeEntry="我從仙加味官網進來，想詢問產品、試喝、購買或合作。";
for(const [msg,detail] of [[contactEntry,"website:contact"],[b2bEntry,"website:contact-b2b"],[homeEntry,"website:home"]]){const o=attribution.detectWebsiteOrigin(msg);assert.equal(o.sourceDetail,detail);assert.equal(o.sourceEvidence,"website_self_report");}
assert.equal(attribution.normalizeBusinessEntry(b2bEntry),"商家合作");
assert.equal(attribution.normalizeBusinessEntry("商家合作"),"商家合作");
assert.equal(attribution.normalizeBusinessEntry(b2bEntry+"其他"),b2bEntry+"其他");
assert.equal(attribution.detectWebsiteOrigin("商家合作"),null);
assert.equal(sandbox.detect(homeEntry),"products");
assert.equal(sandbox.detect(contactEntry),"human");
assert(server.includes('normalizeBusinessEntry(sanitizeUserText(event.message.text, 500))'));
const b2bUser="U-b2b-source-offline";attribution.remember(b2bUser,b2bEntry,now);assert.equal(attribution.getRemembered(b2bUser,now+1).sourceDetail,"website:contact-b2b");
console.log("PASS opt-in contact and B2B entry contract");

// Source is included only in the existing internal commercial handoff notification.
const quoteUser="U-quote-attribution-offline",quoteEvent={source:{type:"user",userId:quoteUser}};
assert.equal(attribution.ownerOriginSummary(quoteEvent,now),"客源：尚未取得客戶自述來源");
attribution.remember(quoteUser,referralPhrase,now);
assert.equal(attribution.ownerOriginSummary(quoteEvent,now+1),"客源：親友介紹→LINE OA｜試喝頁（客戶自述）");
assert.equal(attribution.ownerOriginSummary({source:{type:"group",userId:quoteUser}},now+1),"");
assert.equal(attribution.ownerOriginSummary({source:{type:"user",userId:b2bUser}},now+1),"客源：官網→LINE OA｜合作頁（客戶自述）");
assert(!attribution.ownerOriginSummary(quoteEvent,now+1).includes(quoteUser));
assert.equal(attribution.ownerOriginSummary(quoteEvent,now+24*60*60*1000+1),"客源：尚未取得客戶自述來源");
const ownerSource=fs.readFileSync("line-owner-alert-runtime.js","utf8");
assert(ownerSource.includes('isOrderHandoff ? require("./line-source-attribution").ownerOriginSummary(event) : ""'));
assert.equal((ownerSource.match(/client\.pushMessage\(/g)||[]).length,1);
console.log("PASS verified self-reported source in existing owner handoff only");

// Exact product entry self-report; old product text retains original routing and is not source evidence.
const productEntries=[{"id":"guilu-gao","label":"龜鹿膏","path":"product-guilu-gao.html","original":"我想了解龜鹿膏100g的使用與購買方式。","message":"我從仙加味官網龜鹿膏商品頁進來，我想了解龜鹿膏100g的使用與購買方式。"},{"id":"guilu-drink-30","label":"龜鹿飲30cc玻璃罐","path":"product-guilu-drink-30cc.html","original":"我想了解龜鹿飲30cc玻璃罐的使用、交期與購買方式。","message":"我從仙加味官網龜鹿飲30cc玻璃罐商品頁進來，我想了解龜鹿飲30cc玻璃罐的使用、交期與購買方式。"},{"id":"guilu-drink-180","label":"龜鹿飲180cc鋁袋","path":"product-guilu-drink-180cc.html","original":"我想了解龜鹿飲180cc鋁袋的使用、交期與購買方式。","message":"我從仙加味官網龜鹿飲180cc鋁袋商品頁進來，我想了解龜鹿飲180cc鋁袋的使用、交期與購買方式。"},{"id":"luerong-fen","label":"鹿茸粉","path":"product-luerong-fen.html","original":"我想了解鹿茸粉75g的使用與購買方式。","message":"我從仙加味官網鹿茸粉商品頁進來，我想了解鹿茸粉75g的使用與購買方式。"}];
for(const item of productEntries){const o=attribution.detectWebsiteOrigin(item.message);assert.equal(o.sourceDetail,"website:product-"+item.id);assert.equal(o.sourceEvidence,"website_self_report");assert.equal(o.leadOrigin,"https://ts15825868.github.io/xianjiawei/"+item.path);assert.equal(attribution.normalizeProductEntry(item.message),item.original);assert.equal(attribution.normalizeProductEntry(item.original),item.original);assert.equal(attribution.detectWebsiteOrigin(item.original),null);assert.equal(attribution.detectWebsiteOrigin(item.message+"其他"),null);const id="offline-product-"+item.id;attribution.remember(id,item.message,now);assert.equal(attribution.augmentCrmPayload({userId:id,source:"LINE OA"},now+1).source,"官網→LINE OA｜"+item.label);assert.equal(attribution.ownerOriginSummary({source:{type:"user",userId:id}},now+1),"客源：官網→LINE OA｜"+item.label+"（客戶自述）");}
assert(server.includes("normalizeProductEntry(text)"));
console.log("PASS four explicit product entry sources and existing product inquiry routing");
