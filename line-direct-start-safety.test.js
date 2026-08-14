"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const rawText = fs.readFileSync(path.join(__dirname, "data.json"), "utf8");
const rawData = JSON.parse(rawText);
const safety = require("./line-image-safety");

assert.match(String(safety.VERSION || ""), /current|line|media/i);
assert.ok(String(safety.FORMAL_MEDIA_VERSION || "").trim(), "正式媒體版本識別不得為空");
assert.ok(!/products-v2|legacy|retired/i.test(String(safety.FORMAL_MEDIA_VERSION || "")), "正式媒體版本不得回退舊權威");
assert.match(String(safety.photoAuthority?.version || ""), /products-v3/i);
assert.equal(safety.currentAuthority?.authority, "user-confirmed-current");
assert.equal(safety.richMenuSync.SINGLE_IMAGE_ONLY, true);
assert.equal(safety.richMenuSync.RUNTIME_COMPOSITE_FORBIDDEN, true);
assert.equal(safety.richMenuSync.LEGACY_BASE_TEMPLATE_FORBIDDEN, true);
assert.equal(safety.schedulePolicy, undefined);
assert.equal(safety.fulfillmentSafety, undefined);

const safetySource = fs.readFileSync("line-image-safety.js", "utf8");
for (const route of [
  'app.get("/assets/formal-product/:id.jpg"',
  'app.get("/assets/formal-dm/:id.jpg"',
  'app.get("/assets/formal-trial/trial.jpg"',
]) assert.ok(safetySource.includes(route), `缺少正式媒體路由：${route}`);
assert.ok(safetySource.includes('fit: "inside"'));
assert.ok(safetySource.includes('withoutEnlargement: true'));
assert.ok(!safetySource.includes('require("./social-schedule-policy-fix")'));
assert.ok(!safetySource.includes('require("./product-fulfillment-message-fix")'));

assert.equal(rawData.products.length, 6);
const currentById = Object.fromEntries((safety.currentAuthority.products || []).map((item) => [item.id,item]));
for (const product of rawData.products) {
  const official = currentById[product.id];
  assert.ok(official, `${product.id}缺少目前權威`);
  assert.equal(product.image, official.approvedProductImage, `${product.id}母資料產品圖不同步`);
  assert.equal(product.dmImage, official.approvedDm, `${product.id}母資料DM不同步`);
  assert.equal(product.officialOriginalImage, safety.photoAuthority.products[product.id], `${product.id}身份原圖不同步`);
  assert.ok(String(product.physicalScalePolicy || "").trim());
}

const customerData = safety.normalizeProductPhotos(JSON.parse(rawText));
assert.equal(customerData.products.length, 6);
for (const product of customerData.products) {
  assert.match(String(product.image || ""), new RegExp(`/assets/formal-product/${product.id}\\.jpg\\?v=`), `${product.id}顧客hero不是formal-product`);
  assert.match(String(product.dmImage || ""), new RegExp(`/assets/formal-dm/${product.id}\\.jpg\\?v=`), `${product.id}DM不是formal-dm`);
  assert.notEqual(product.image, product.dmImage, `${product.id}產品與DM角色混用`);
  assert.ok(String(product.officialOriginalImage || "").includes("/images/products-v3/"), `${product.id}身份原圖不是products-v3`);
  assert.equal(product.formalProductSource, currentById[product.id].approvedProductImage);
  assert.equal(product.formalDmSource, currentById[product.id].approvedDm);
}
assert.equal(customerData.runtime?.serviceMode, "standalone-line-oa");
assert.equal(customerData.runtime?.productMainImageSource, "current-approved-product-image-line-compatible-jpeg");
assert.equal(customerData.runtime?.detailedDmImageSource, "current-approved-dm-line-compatible-jpeg");
assert.equal(customerData.runtime?.trialImageSource, "20260814-user-approved-trial-line-compatible-jpeg");
assert.equal(customerData.runtime?.productIdentitySource, "products-v3-user-approved-originals");
assert.equal(customerData.runtime?.productsV2Use, "legacy-reference-only");
assert.equal(customerData.runtime?.productScalePolicy, "uniform-only-no-equal-height-equal-width");
assert.equal(customerData.runtime?.promotionQuantityPolicy, "promotion-qty-must-appear-within-first-four-options");
assert.ok(customerData.products.find(p=>p.id==='guilu-drink-30').quantityOptions.slice(0,4).includes(11));
assert.ok(customerData.products.find(p=>p.id==='guilu-drink-180').quantityOptions.slice(0,4).includes(11));

assert.ok(String(safety.formalSourceUrl("trial")).includes("trial-poster-small-boss-official-v20260814.jpg"));
assert.match(safety.formalLineTrialImageUrl(), /\/assets\/formal-trial\/trial\.jpg\?v=/);

const richArtwork = safety.richMenuSync.readArtwork();
assert.ok(!/<image\b/i.test(richArtwork));
assert.ok(!/<text\b/i.test(richArtwork));
assert.ok(/xjw-text-outlined-/i.test(richArtwork));
const menu = safety.richMenuSync.menuDefinition();
assert.equal(menu.areas.length,6);
assert.equal(menu.areas.at(-1).action.text,"直接下單");

console.log("PASS：LINE直接啟動以能力與目前權威驗收，不鎖歷史日期版號；產品JPEG、獨立DM、試喝JPEG、products-v3身份原圖與六格Rich Menu維持正常。");
