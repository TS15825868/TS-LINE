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

console.log("PASS：LINE OA 店面週一至週五 10:30－20:00、週末店休；LINE 可隨時留言、官網24小時可瀏覽、週末配送／自取採事先詢問協調；舊時間備援不得回流。");
