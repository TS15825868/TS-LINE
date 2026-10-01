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

assert.equal(store.publicAddressEnabled, false, "未設定 PUBLIC_STORE_ADDRESS 時不得公開固定門牌");
assert.equal(store.addressAuthority, "line-confirmation-only");
assert.match(String(store.address || ""), /LINE/);
assert.ok(!/西昌街|52號/.test(String(store.address || "")), "不得回退舊門牌備援");
assert.match(String(store.holidayNote || ""), /隨時留言/);
assert.match(String(store.holidayNote || ""), /週末/);
assert.match(String(store.holidayNote || ""), /配送/);
assert.match(String(store.holidayNote || ""), /自取/);
assert.equal(store.hours, "週一至週五 10:30－20:00；週六、週日休息", "門市營業時間應使用 2026-10-01 正式新版");
assert.match(serverSource, /官網：24 小時可瀏覽產品、品牌、使用方式與常見問題。/, "LINE 門市資訊應同步說明官網 24 小時可瀏覽");
assert.ok(!serverSource.includes("週一至週六 09:30–18:30"), "server.js 不得保留舊營業時間備援");
assert.ok(!serverSource.includes("下一個營業時段"), "server.js 不得回退成固定下一營業時段才回覆");
assert.equal(ecosystemAuthority.brand?.publicName, "仙加味", "公開主品牌必須是仙加味");
assert.equal(ecosystemAuthority.brandNaming?.publicBrandName, "仙加味", "品牌命名權威必須是仙加味");
assert.equal(ecosystemAuthority.brandNaming?.googleDesiredPublicName, "仙加味", "Google最終名稱必須是仙加味");
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
