"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

// 正式啟動順序先載入 product-sales-master，再載入門市地址政策。
require("./product-sales-master");
require("./line-store-location-policy");

const data = JSON.parse(fs.readFileSync(path.join(__dirname, "data.json"), "utf8"));
const store = data.store || {};
const serverSource = fs.readFileSync(path.join(__dirname, "server.js"), "utf8");
const ecosystemAuthority = JSON.parse(fs.readFileSync(path.join(__dirname, "config/ecosystem-authority-v20260910.json"), "utf8"));
const policy = require("./line-store-location-policy");
const approved = ecosystemAuthority.serviceHours;
assert.equal(approved.publicStorefrontHours,false);
assert.equal(store.hours,approved.lineOA);
for(const override of ["週一至週五 10:00－20:00","週一至週五 09:30－18:30","週一至週五 11:00－19:00","僅接受預約營業時段"]){
  assert.equal(policy.resolvePublicHours(override),approved.lineOA,"環境設定不得覆蓋未確認門市的公開規則");
}
assert.equal(store.publicAddressEnabled,false);
assert.equal(store.addressAuthority,"line-confirmation-only");
assert.match(store.address,/台北萬華.*官方 LINE/);
assert.equal(store.holidayNote,approved.weekendFulfillment);
assert.doesNotMatch(JSON.stringify(store),/西昌街|52號|10:00|週日休息|週六.*預約/);
const vm=require("node:vm");
const fallbackStart=serverSource.indexOf("function storeServiceText() {");
const fallbackEnd=serverSource.indexOf("\nfunction flexCard(",fallbackStart);
assert.ok(fallbackStart>0&&fallbackEnd>fallbackStart);
const factory=vm.runInNewContext("(function(DATA,storeLocationPolicy){"+serverSource.slice(fallbackStart,fallbackEnd)+";return storeServiceText;})");
for(const input of [{store:{}},{store:{address:"舊地址",hours:"10:00－20:00"}}]){
  const reply=factory(input,policy)();
  assert.match(reply,/商品諮詢、訂購及配送.*官方 LINE/);
  assert.doesNotMatch(reply,/舊地址|10:00|週日休息|週六.*預約/);
}

assert.ok(!serverSource.includes("週一至週六 09:30–18:30"), "server.js 不得保留舊營業時間備援");
assert.ok(!serverSource.includes("下一個營業時段"), "server.js 不得回退成固定下一營業時段才回覆");
assert.equal(ecosystemAuthority.brand?.publicName, "仙加味", "公開主品牌必須是仙加味");
assert.equal(ecosystemAuthority.brandNaming?.publicBrandName, "仙加味", "品牌命名權威必須是仙加味");
assert.equal(ecosystemAuthority.brandNaming?.googleBusiness?.currentName, "仙加味");
assert.equal(ecosystemAuthority.brandNaming?.googleBusiness?.currentPrimaryCategory, "食品供應商");
assert.equal(ecosystemAuthority.brandNaming?.googleBusiness?.doNotTreatAsMainBrand, true, "Google例外名稱不得取代仙加味主品牌");
assert.equal(ecosystemAuthority.funnel?.lineCommunity?.name, "仙加味｜日常交流", "LINE 社群名稱應為仙加味｜日常交流");
assert.ok(!serverSource.includes("仙加味・龜鹿"), "LINE OA runtime 不得把仙加味・龜鹿當品牌名稱");
assert.equal(ecosystemAuthority.funnel?.lineOA?.id, "@762jybnm");
assert.equal(ecosystemAuthority.funnel?.lineOA?.url, "https://lin.ee/sHZW7NkR");
assert.equal(ecosystemAuthority.funnel?.lineOA?.primary, true, "LINE OA 必須是主要入口");
assert.equal(ecosystemAuthority.funnel?.lineOA?.defaultCta, true, "LINE OA 必須是預設CTA");
assert.equal(ecosystemAuthority.funnel?.lineCommunity?.notTransactionCenter, true, "LINE 社群不得成為交易中心");
assert.equal(ecosystemAuthority.funnel?.lineCommunity?.defaultCta, false, "LINE 社群不得成為預設CTA");
assert.equal(ecosystemAuthority.funnel?.lineCommunity?.optionalOnly, true, "LINE 社群只能選擇性提及");
assert.equal(ecosystemAuthority.funnel?.lineCommunity?.noPersonalOrTransactionData, true, "LINE 社群不得承接個資或交易資料");
assert.ok(!serverSource.includes("line.me/ti/g2"), "LINE OA runtime 不得把社群邀請連結做成預設客服／交易導流");

console.log("PASS：LINE OA 個別服務確認與舊環境資料防回退；維持社群交易隔離。");
