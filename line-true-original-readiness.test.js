"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const { applyMaster, getPhotoAuthority } = require("./product-sales-master");
const visual = require("./line-recording-ui-fix");

const authority = getPhotoAuthority();
const AUTHORITY_VERSION = String(authority?.version || "").trim();
const authorityEntries = Object.entries(authority.products || {});
const cacheVersions = new Set(authorityEntries.map(([, url]) => String(url || "").match(/[?&]v=([^&#]+)/)?.[1] || "").filter(Boolean));
const PHOTO_CACHE_VERSION = cacheVersions.size === 1 ? [...cacheVersions][0] : "";
const raw = JSON.parse(fs.readFileSync("data.json", "utf8"));
const data = applyMaster(raw);

assert.ok(AUTHORITY_VERSION, "產品圖片權威必須有版本號");
assert.match(AUTHORITY_VERSION, /products-v3/i, "產品圖片權威必須維持products-v3正式原圖系列");
assert.ok(!/products-v2/i.test(AUTHORITY_VERSION), "產品圖片權威不得回退products-v2");
assert.equal(authorityEntries.length, 6, "產品圖片權威必須剛好六項");
assert.ok(PHOTO_CACHE_VERSION && /products-v3/i.test(PHOTO_CACHE_VERSION), "六項正式產品照片必須使用一致的products-v3快取版本");
for (const [id, url] of authorityEntries) {
  const value = String(url || "");
  assert.ok(value.includes(`/images/products-v3/`), `${id} 不得離開 products-v3`);
  assert.ok(value.includes(`v=${PHOTO_CACHE_VERSION}`), `${id} 圖片網址快取版本必須跟六項正式原圖一致`);
  assert.ok(!value.includes("/images/products-v2/"), `${id} 不得回退 products-v2`);
}

assert.equal(data.products.length, 6, "LINE正式產品必須剛好六項");
for (const product of data.products) {
  for (const field of ["image", "imageUrl", "image_url", "dmImage", "officialOriginalImage"]) {
    const url = String(product[field] || "");
    assert.ok(url.includes("/images/products-v3/"), `${product.id}.${field} 未使用 products-v3`);
    assert.ok(url.includes(`v=${PHOTO_CACHE_VERSION}`), `${product.id}.${field} 未跟目前正式原圖快取版本同步`);
    assert.ok(!url.includes("/images/products-v2/"), `${product.id}.${field} 不得退回 products-v2`);
  }
}

assert.equal(visual.PRODUCT_IMAGE_VERSION, PHOTO_CACHE_VERSION, "LINE Flex產品圖版本必須直接跟六項正式原圖快取版本同步，不得另外寫死舊版號");
for (const [id, item] of Object.entries(visual.PRODUCTS || {})) {
  const url = String(item.image || "");
  assert.ok(url.includes("/images/products-v3/"), `${id} Flex hero 未使用 products-v3`);
  assert.ok(url.includes(`v=${PHOTO_CACHE_VERSION}`), `${id} Flex hero 未跟目前正式原圖快取版本同步`);
}

console.log(`PASS：Render prestart 已鎖定六項 products-v3 正式產品實拍；權威 ${AUTHORITY_VERSION}、圖片快取 ${PHOTO_CACHE_VERSION} 都由正式資料自行驗證，新版不再被舊版號誤擋。`);
