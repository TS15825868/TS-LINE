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
assert.equal(identityEntries.length, 6, "目前核准正式實物圖必須維持六項");
for (const [id, url] of identityEntries) {
  const value = String(url || "");
  assert.ok(value.includes("/images/products-v3/"), `${id}身份原圖不得離開products-v3`);
  assert.ok(!value.includes("/images/products-v2/"), `${id}不得回退products-v2`);
}

assert.equal(current.authority, "user-confirmed-current");
assert.equal((current.products || []).length, 7, "目前文字／AI產品知識必須七項");
assert.equal(data.products.length, 6, "LINE顧客產品卡目前只顯示六項已有核准實物圖產品");
assert.equal(currentById["qixuan-guilu-drink-powder"]?.specification, "2g／小包；20g／包（10小包）");
assert.ok(!authority.products?.["qixuan-guilu-drink-powder"], "柒玄茶尚未核准正式實物圖時不得建立假圖片權威");
for (const product of data.products) {
  const official = currentById[product.id];
  assert.ok(official, `${product.id}缺少目前權威`);
  assert.equal(product.image, official.approvedProductImage, `${product.id}顧客產品圖不同步`);
  assert.equal(product.dmImage, official.approvedDm, `${product.id}詳細DM不同步`);
  assert.equal(product.officialOriginalImage, authority.products[product.id], `${product.id}身份原圖不同步`);
  assert.notEqual(product.image, product.dmImage, `${product.id}產品主圖不得拿DM代替`);
}

// 媒體 readiness 驗能力與來源一致，不硬鎖歷史日期版號。
assert.ok(String(visual.PRODUCT_IMAGE_VERSION || "").trim(), "Flex產品媒體必須有目前版本識別");
assert.ok(!/products-v2|legacy|retired/i.test(String(visual.PRODUCT_IMAGE_VERSION || "")), "Flex產品媒體不得回退舊權威");
for (const [id, item] of Object.entries(visual.PRODUCTS || {})) {
  assert.match(String(item.image || ""), new RegExp(`/assets/formal-product/${id}\\.jpg\\?v=`), `${id}Flex hero不是目前正式產品JPEG route`);
  assert.equal(item.source, currentById[id].approvedProductImage, `${id}Flex hero來源不是目前核准產品圖`);
  assert.equal(item.original, authority.products[id], `${id}Flex products-v3身份參考不同步`);
  assert.match(String(item.dm || ""), new RegExp(`/assets/formal-dm/${id}\\.jpg\\?v=`), `${id}Flex DM route不同步`);
}
assert.match(visual.TRIAL_IMAGE, /\/assets\/formal-trial\/trial\.jpg\?v=/);

console.log(`PASS：LINE七項文字／AI產品知識下，六項核准顧客產品圖與詳細DM分開；products-v3只作六項真實產品身份／比例參考，柒玄茶未核准原圖前不建立假媒體。`);
