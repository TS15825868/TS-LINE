"use strict";

const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const { applyMaster, getPhotoAuthority } = require("./product-sales-master");

const rawText = fs.readFileSync(path.join(__dirname, "data.json"), "utf8");
const masterText = fs.readFileSync(path.join(__dirname, "line-sales-master.json"), "utf8");
assert.ok(!rawText.includes("/images/products-v2/"), "data.json 原始主檔不得再保存 products-v2 正式圖路徑");
assert.ok(!masterText.includes("/images/products-v2/"), "line-sales-master.json 不得再保存 products-v2 正式圖路徑");
assert.ok(rawText.includes("products-v3-user-approved-originals"), "data.json 原始主檔必須直接標示 products-v3 正式圖權威");

const raw = JSON.parse(rawText);
const data = applyMaster(raw);
const photoAuthority = getPhotoAuthority();

assert.equal(photoAuthority.version, "2026-08-09-products-v3-user-approved-size-lock-v1");
assert.equal(Object.keys(photoAuthority.products || {}).length, 6);
assert.equal(data.products.length, 6);
assert.equal(data.productPhotoAuthorityVersion, photoAuthority.version);

for (const product of data.products) {
  for (const field of ["image", "imageUrl", "image_url", "dmImage", "officialOriginalImage"]) {
    assert.ok(String(product[field] || "").includes("/images/products-v3/"), `${product.id}.${field} 未使用products-v3`);
    assert.ok(!String(product[field] || "").includes("/images/products-v2/"), `${product.id}.${field} 仍含products-v2`);
  }
  assert.equal(product.imagePolicy, "approved-original-product-photo-contain-no-crop");
  assert.equal(product.physicalScalePolicy, "uniform-only-preserve-realistic-product-scale");
}

assert.equal(data.runtime.imagePolicy.productMainImageSource, "products-v3-user-approved-originals");
assert.equal(data.runtime.imagePolicy.productsV2Use, "legacy-reference-only");
assert.equal(data.runtime.imagePolicy.productScalePolicy, "uniform-only-no-equal-height-equal-width");
assert.equal(data.runtime.imagePolicy.dmFallback, "approved-original-photo-until-current-dm-reviewed");

const byId = Object.fromEntries(data.products.map((product) => [product.id, product]));
assert.equal(byId["guilu-drink-30"].name, "龜鹿飲30cc玻璃罐");
assert.equal(byId["guilu-drink-30"].specification, "30cc／罐（小玻璃罐）");
assert.ok(!byId["guilu-drink-30"].aliases.includes("玻璃瓶"));
assert.equal(byId["guilu-drink-30"].price, 60);
assert.ok(byId["guilu-drink-30"].offers.some((offer) => offer.label === "買10送1" && offer.qty === 11 && offer.total === 600));
assert.equal(byId["guilu-drink-180"].price, 200);
assert.ok(byId["guilu-drink-180"].offers.some((offer) => offer.label === "買10送1" && offer.qty === 11 && offer.total === 2000));
assert.equal(byId["guilu-tangkuai"].specification, "75g／盒｜8塊裝｜每塊約9.375g");
assert.equal(byId["guilu-jiao"].specification, "600g（1斤）／盒｜32塊裝｜每塊約18.75g");
assert.equal(byId["luerong-fen"].specification, "75g／罐");

console.log("PASS：LINE OA原始主檔與執行時六項產品皆鎖定products-v3正式原圖、實際比例、售價與規格權威。");
