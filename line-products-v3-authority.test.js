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
const authorityVersion = String(photoAuthority?.version || "").trim();
const authorityEntries = Object.entries(photoAuthority?.products || {});
const cacheVersions = new Set(authorityEntries.map(([, url]) => String(url || "").match(/[?&]v=([^&#]+)/)?.[1] || "").filter(Boolean));

assert.ok(authorityVersion, "產品圖片權威必須有版本識別");
assert.equal(authorityEntries.length, 6, "產品圖片權威必須剛好六項");
assert.equal(cacheVersions.size, 1, "六項正式產品照片必須使用一致的快取版本");
const currentCacheVersion = [...cacheVersions][0];
assert.ok(currentCacheVersion, "正式產品照片必須提供快取版本，避免顧客端沿用舊圖");
for (const [id, url] of authorityEntries) {
  const value = String(url || "");
  assert.ok(value.includes("/images/products-v3/"), `${id} 圖片權威不得離開products-v3正式原圖目錄`);
  assert.ok(value.includes(`v=${currentCacheVersion}`), `${id} 未跟目前正式產品圖快取版本同步`);
  assert.ok(!value.includes("/images/products-v2/"), `${id} 不得回退 products-v2`);
}
assert.equal(data.products.length, 6);
assert.equal(data.productPhotoAuthorityVersion, authorityVersion);

for (const product of data.products) {
  for (const field of ["image", "imageUrl", "image_url", "dmImage", "officialOriginalImage"]) {
    const value = String(product[field] || "");
    assert.ok(value.includes("/images/products-v3/"), `${product.id}.${field} 未使用products-v3正式原圖`);
    assert.ok(value.includes(`v=${currentCacheVersion}`), `${product.id}.${field} 未使用目前正式產品圖快取版本`);
    assert.ok(!value.includes("/images/products-v2/"), `${product.id}.${field} 仍含products-v2`);
  }
  assert.equal(product.imagePolicy, "approved-original-product-photo-contain-no-crop");
  assert.ok(String(product.physicalScalePolicy || "").trim(), `${product.id} 缺少個別產品尺寸／比例規則`);
}

assert.equal(data.runtime.imagePolicy.productMainImageSource, "products-v3-user-approved-originals");
assert.equal(data.runtime.imagePolicy.productsV2Use, "legacy-reference-only");
assert.equal(data.runtime.imagePolicy.productScalePolicy, "uniform-only-no-equal-height-equal-width");
assert.equal(data.runtime.imagePolicy.dmFallback, "approved-original-photo-until-current-dm-reviewed");

const byId = Object.fromEntries(data.products.map((product) => [product.id, product]));
assert.equal(byId["guilu-gao"].usage?.[0], "每日早上及下午各一小匙");
assert.equal(byId["guilu-drink-30"].name, "龜鹿飲30cc玻璃罐");
assert.equal(byId["guilu-drink-30"].specification, "30cc／罐（小玻璃罐）");
assert.ok(!byId["guilu-drink-30"].aliases.includes("玻璃瓶"));
assert.match(byId["guilu-drink-30"].physicalScalePolicy, /Ø42.*H51|小玻璃裸罐/i);
assert.equal(byId["guilu-drink-30"].price, 60);
assert.ok(byId["guilu-drink-30"].offers.some((offer) => offer.label === "買10送1" && offer.qty === 11 && offer.total === 600));
assert.equal(byId["guilu-drink-180"].price, 200);
assert.match(byId["guilu-drink-180"].physicalScalePolicy, /0\.60.*0\.68|狹長直立鋁袋/i);
assert.ok(byId["guilu-drink-180"].offers.some((offer) => offer.label === "買10送1" && offer.qty === 11 && offer.total === 2000));
assert.equal(byId["guilu-tangkuai"].specification, "75g／盒｜8塊裝｜每塊約9.375g");
assert.ok(!/(300g|600g).*龜鹿湯塊|龜鹿湯塊.*(300g|600g)/.test(JSON.stringify(byId["guilu-tangkuai"])), "龜鹿湯塊不得帶回舊規格");
assert.equal(byId["guilu-jiao"].specification, "600g（1斤）／盒｜32塊裝｜每塊約18.75g");
assert.equal(byId["luerong-fen"].specification, "75g／罐");

console.log(`PASS：LINE OA六項產品鎖定目前 products-v3 正式產品原圖；權威 ${authorityVersion}、快取 ${currentCacheVersion} 由現行資料動態取得，後續換新正式圖不會因舊版號被誤擋。`);
