"use strict";

const assert = require("assert");
const assets = require("./social-approved-originals");

const entries = Object.entries(assets.ASSETS);
assert.strictEqual(entries.length, 13, "必須是 10 張固定排程＋3 張氣候替換素材");
assert.strictEqual(entries.filter(([key]) => key.startsWith("product-")).length, 5, "產品素材必須剛好 5 張");
assert.strictEqual(entries.filter(([key]) => key.startsWith("care-")).length, 5, "一般關心素材必須剛好 5 張");
assert.strictEqual(entries.filter(([key]) => key.startsWith("weather-")).length, 3, "氣候替換素材必須剛好 3 張");
for (const [key, item] of entries) {
  assert.match(assets.assetUrl(key), /^https:\/\//, `${key} 必須是公開 HTTPS 圖片`);
  if (key.startsWith("product-")) {
    assert.match(assets.assetUrl(key), /ts15825868\.github\.io\/xianjiawei\/images\/dm-final\//);
  } else {
    assert.match(assets.assetUrl(key), /raw\.githubusercontent\.com\/TS15825868\/TS-LINE\/main\/public\/mascot\//);
  }
  assert.ok(item.sourceFile, `${key} 缺少來源檔名`);
}
console.log("PASS production assets: 5 approved mascot images, 5 official product DMs and 3 weather replacements");
