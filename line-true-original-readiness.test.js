"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const { applyMaster, getPhotoAuthority } = require("./product-sales-master");
const visual = require("./line-recording-ui-fix");

const authority = getPhotoAuthority();
const PHOTO_VERSION = String(authority?.version || "").trim();
const raw = JSON.parse(fs.readFileSync("data.json", "utf8"));
const data = applyMaster(raw);

assert.ok(PHOTO_VERSION, "產品圖片權威必須有版本號");
assert.match(PHOTO_VERSION, /products-v3/i, "產品圖片權威必須維持products-v3正式原圖系列");
assert.ok(!/products-v2/i.test(PHOTO_VERSION), "產品圖片權威不得回退products-v2");
assert.equal(Object.keys(authority.products || {}).length, 6, "產品圖片權威必須剛好六項");
for (const [id, url] of Object.entries(authority.products || {})) {
  const value = String(url || "");
  assert.ok(value.includes(`/images/products-v3/`), `${id} 不得離開 products-v3`);
  assert.ok(value.includes(`v=${PHOTO_VERSION}`), `${id} 圖片網址版本必須跟目前圖片權威同步`);
  assert.ok(!value.includes("/images/products-v2/"), `${id} 不得回退 products-v2`);
}

assert.equal(data.products.length, 6, "LINE正式產品必須剛好六項");
for (const product of data.products) {
  for (const field of ["image", "imageUrl", "image_url", "dmImage", "officialOriginalImage"]) {
    const url = String(product[field] || "");
    assert.ok(url.includes("/images/products-v3/"), `${product.id}.${field} 未使用 products-v3`);
    assert.ok(url.includes(`v=${PHOTO_VERSION}`), `${product.id}.${field} 未跟目前圖片權威版本同步`);
    assert.ok(!url.includes("/images/products-v2/"), `${product.id}.${field} 不得退回 products-v2`);
  }
}

assert.equal(visual.PRODUCT_IMAGE_VERSION, PHOTO_VERSION, "LINE Flex產品圖版本必須直接跟正式圖片權威同步，不得另外寫死版本號");
for (const [id, item] of Object.entries(visual.PRODUCTS || {})) {
  const url = String(item.image || "");
  assert.ok(url.includes("/images/products-v3/"), `${id} Flex hero 未使用 products-v3`);
  assert.ok(url.includes(`v=${PHOTO_VERSION}`), `${id} Flex hero 未跟目前圖片權威版本同步`);
}

console.log(`PASS：Render prestart 已鎖定六項 products-v3 正式產品實拍與目前圖片權威 ${PHOTO_VERSION}；未來核准新版只要同步權威檔與正式圖，就不會被舊版號誤擋。`);
