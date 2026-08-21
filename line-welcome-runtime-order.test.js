"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const source = fs.readFileSync(path.join(__dirname, "line-app-bootstrap.js"), "utf8");

const entry = source.indexOf('require("./line-entry-trial-guard")');
const safety = source.indexOf('require("./line-image-safety")');
const finalHero = source.indexOf('require("./line-final-card-hero-guard")');
const compact = source.indexOf('require("./line-card-compact-guard")');
const productActions = source.indexOf('require("./line-product-card-action-guard")');

for (const [name, index] of Object.entries({ entry, safety, finalHero, compact, productActions })) {
  assert.ok(index >= 0, `${name} runtime require 不得遺失`);
}

assert.ok(entry < safety, "歡迎試喝 guard 必須先於 line-image-safety 載入，才能成為最內層 final outbound transform");
assert.ok(entry < finalHero, "歡迎試喝 guard 必須先於 final hero guard 載入");
assert.ok(entry < compact, "歡迎試喝 guard 必須先於卡片瘦身 guard 載入");
assert.ok(entry < productActions, "歡迎試喝 guard 必須先於產品動作 guard 載入");

console.log("PASS：歡迎卡試喝 guard 載入順序正確，會在其他卡片規則處理後最後固定申請試喝／看產品／幫我推薦。");
