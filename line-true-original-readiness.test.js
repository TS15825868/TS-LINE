"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const { applyMaster, getPhotoAuthority } = require("./product-sales-master");
const visual = require("./line-recording-ui-fix");

const CACHE = "20260810-products-v3-true-originals-v2";
const authority = getPhotoAuthority();
const raw = JSON.parse(fs.readFileSync("data.json", "utf8"));
const data = applyMaster(raw);

assert.equal(Object.keys(authority.products || {}).length, 6, "產品圖片權威必須剛好六項");
for (const [id, url] of Object.entries(authority.products || {})) {
  assert.ok(String(url).includes(`/images/products-v3/`), `${id} 不得離開 products-v3`);
  assert.ok(String(url).includes(CACHE), `${id} 未使用真正產品原圖快取版本`);
}

assert.equal(data.products.length, 6, "LINE正式產品必須剛好六項");
for (const product of data.products) {
  for (const field of ["image", "imageUrl", "image_url", "dmImage", "officialOriginalImage"]) {
    const url = String(product[field] || "");
    assert.ok(url.includes("/images/products-v3/"), `${product.id}.${field} 未使用 products-v3`);
    assert.ok(url.includes(CACHE), `${product.id}.${field} 未使用真正產品原圖快取版本`);
    assert.ok(!url.includes("/images/products-v2/"), `${product.id}.${field} 不得退回 products-v2`);
  }
}

assert.equal(visual.PRODUCT_IMAGE_VERSION, CACHE, "LINE Flex產品圖快取版本與正式權威不同步");
for (const [id, item] of Object.entries(visual.PRODUCTS || {})) {
  assert.ok(String(item.image || "").includes("/images/products-v3/"), `${id} Flex hero 未使用 products-v3`);
  assert.ok(String(item.image || "").includes(CACHE), `${id} Flex hero 未使用真正產品原圖快取版本`);
}

console.log("PASS：Render prestart 已鎖定六項 products-v3 真正產品實拍與 2026-08-10 快取版本，LINE Flex 與銷售母本不得回退舊海報圖。");
