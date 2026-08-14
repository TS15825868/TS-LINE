"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const { applyMaster, getCurrentAuthority, getPhotoAuthority } = require("./product-sales-master");
const visual = require("./line-recording-ui-fix");

const authority = getPhotoAuthority();
const current = getCurrentAuthority();
const identityEntries = Object.entries(authority.products || {});
const raw = JSON.parse(fs.readFileSync("data.json", "utf8"));
const data = applyMaster(raw);
const currentById = Object.fromEntries((current.products || []).map((item) => [item.id, item]));

assert.match(String(authority.version || ""), /products-v3/i, "products-v3必須維持產品身份權威");
assert.ok(!/products-v2/i.test(String(authority.version || "")));
assert.equal(identityEntries.length, 6);
for (const [id, url] of identityEntries) {
  const value = String(url || "");
  assert.ok(value.includes("/images/products-v3/"), `${id}身份原圖不得離開products-v3`);
  assert.ok(!value.includes("/images/products-v2/"), `${id}不得回退products-v2`);
}

assert.equal(current.authority, "user-confirmed-current");
assert.equal((current.products || []).length, 6);
assert.equal(data.products.length, 6);
for (const product of data.products) {
  const official = currentById[product.id];
  assert.ok(official, `${product.id}缺少目前權威`);
  assert.equal(product.image, official.approvedProductImage, `${product.id}顧客產品圖不同步`);
  assert.equal(product.dmImage, official.approvedDm, `${product.id}詳細DM不同步`);
  assert.equal(product.officialOriginalImage, authority.products[product.id], `${product.id}身份原圖不同步`);
  assert.notEqual(product.image, product.dmImage, `${product.id}產品主圖不得拿DM代替`);
}

assert.match(visual.PRODUCT_IMAGE_VERSION, /20260814|current|product-modal-media-v3/i);
for (const [id, item] of Object.entries(visual.PRODUCTS || {})) {
  assert.match(String(item.image || ""), new RegExp(`/assets/formal-product/${id}\\.jpg\\?v=`), `${id}Flex hero不是目前正式產品JPEG route`);
  assert.equal(item.source, currentById[id].approvedProductImage, `${id}Flex hero來源不是目前核准產品圖`);
  assert.equal(item.original, authority.products[id], `${id}Flex products-v3身份參考不同步`);
  assert.match(String(item.dm || ""), new RegExp(`/assets/formal-dm/${id}\\.jpg\\?v=`), `${id}Flex DM route不同步`);
}
assert.match(visual.TRIAL_IMAGE, /\/assets\/formal-trial\/trial\.jpg\?v=/);

console.log(`PASS：LINE目前顧客產品圖與詳細DM分開，products-v3只作六項真實產品身份／比例參考；Flex使用LINE相容JPEG而不混用媒體角色。`);
