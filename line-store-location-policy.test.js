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
const approved = ecosystemAuthority.lineBusinessProfile?.hours || {};
const approvedText = "週一至週五 "+approved.monday;
assert.ok(store.hours.includes(approvedText),
  "Runtime weekday timetable must follow latest approved LINE business profile");
assert.equal(policy.resolvePublicHours(
  "週一至週五 10:30－20:00；週六、週日休息"),store.hours,
  "Known outdated Render override must not supersede approved business hours");
assert.equal(policy.resolvePublicHours(
  "週一至週五 09:30－18:30；週六、週日休息"),store.hours,
  "Retired timetable cannot flow back from environment");
const newSchedule = "僅接受預約營業時段；請先以官方 LINE 聯繫";
assert.equal(policy.resolvePublicHours(newSchedule),newSchedule,
  "Unrelated newer permitted schedules should not be frozen by old version guards");


assert.equal(store.publicAddressEnabled, false, "未設定 PUBLIC_STORE_ADDRESS 時不得公開固定門牌");
assert.equal(store.addressAuthority, "line-confirmation-only");
assert.match(String(store.address || ""), /LINE/);
assert.ok(!/西昌街|52號/.test(String(store.address || "")), "不得回退舊門牌備援");
assert.match(String(store.holidayNote || ""), /隨時留言/);
assert.match(String(store.holidayNote || ""), /週末/);
assert.match(String(store.holidayNote || ""), /配送/);
assert.match(String(store.holidayNote || ""), /自取/);
assert.match(store.hours,/週六.*預約/,"週六預約安排須與正式核准簡介一致");
assert.match(store.hours,/週日休息/,"核准週日休息狀態必須正確");
assert.match(serverSource, /官網：24 小時可瀏覽產品、品牌、使用方式與常見問題。/, "LINE 門市資訊應同步說明官網 24 小時可瀏覽");

assert.doesNotMatch(serverSource, /store\.address\s*\|\|\s*"台北市萬華區西昌街52號"/,
  "門市資料缺失時不得公開固定門牌");
assert.doesNotMatch(serverSource, /store\.hours\s*\|\|\s*"週一至週五 10:30/,
  "門市資料缺失時不得回流過時營業時間");
const vm = require("node:vm");
const fallbackStart=serverSource.indexOf("function storeServiceText() {");
const fallbackEnd=serverSource.indexOf("\nfunction flexCard(",fallbackStart);
assert.ok(fallbackStart>0 && fallbackEnd>fallbackStart,"門市客服回覆函式位置必須存在");
const fallbackFactory=vm.runInNewContext(
  "(function(DATA,storeLocationPolicy){"+
  serverSource.slice(fallbackStart,fallbackEnd)+
  ";return storeServiceText;})"
);
const safeFallback=fallbackFactory({store:{}},policy)();
assert.match(safeFallback,/最新門市／自取資訊請先透過官方 LINE 確認/);
assert.match(safeFallback,/週一至週五 10:00－20:00/);
assert.doesNotMatch(safeFallback,/西昌街52號|10:30－20:00|09:30－18:30/);
const liveStore=fallbackFactory({store:{address:"官方 LINE 確認自取",
  hours:"週一至週五 11:00－19:00",holidayNote:"休假提前公告"}},policy)();
assert.match(liveStore,/週一至週五 11:00－19:00/,"不應覆蓋已提供的正式新設定");

assert.ok(!serverSource.includes("週一至週六 09:30–18:30"), "server.js 不得保留舊營業時間備援");
assert.ok(!serverSource.includes("下一個營業時段"), "server.js 不得回退成固定下一營業時段才回覆");
assert.equal(ecosystemAuthority.brand?.publicName, "仙加味", "公開主品牌必須是仙加味");
assert.equal(ecosystemAuthority.brandNaming?.publicBrandName, "仙加味", "品牌命名權威必須是仙加味");
assert.equal(ecosystemAuthority.brandNaming?.googleBusiness?.currentName, "仙加味｜台興山產有限公司", "Google商家目前應使用品牌＋法律主體名稱");
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

console.log("PASS：LINE OA 為唯一主要客服／交易導流；社群只供選擇性交流；服務時間與舊資料防回退正常。");
