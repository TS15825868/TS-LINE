"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

// 正式啟動順序先載入 product-sales-master，再載入門市地址政策。
require("./product-sales-master");
require("./line-store-location-policy");

const data = JSON.parse(fs.readFileSync(path.join(__dirname, "data.json"), "utf8"));
const store = data.store || {};

assert.equal(store.publicAddressEnabled, false, "未設定 PUBLIC_STORE_ADDRESS 時不得公開固定門牌");
assert.equal(store.addressAuthority, "line-confirmation-only");
assert.match(String(store.address || ""), /LINE/);
assert.ok(!/西昌街|52號/.test(String(store.address || "")), "不得回退舊門牌備援");
assert.match(String(store.holidayNote || ""), /到店|自取/);

console.log("PASS：LINE OA 預設不公開固定門牌；門市／自取資訊改由官方 LINE 確認，未來地址可用單一環境值更新。");
