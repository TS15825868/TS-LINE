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
const visibleIds = Array.isArray(current.websitePublicProductIds) ? current.websitePublicProductIds : [];
const qixuanId = "qixuan-guilu-drink-powder";

assert.ok(String(authority.version || "").trim(), "正式圖片權威必須有目前版本識別，不鎖死舊版本名稱");
assert.ok(!/products-v2/i.test(String(authority.version || "")));
assert.ok(visibleIds.length > 0, "目前公開產品清單不得為空");
assert.equal(identityEntries.length, visibleIds.length, "目前核准正式實物圖數量必須與最新公開產品清單一致");
for (const [id, url] of identityEntries) {
  const value = String(url || "");
  assert.ok(value.includes("/images/products-v3/"), `${id}身份原圖不得離開products-v3`);
  assert.ok(!value.includes("/images/products-v2/"), `${id}不得回退products-v2`);
}

assert.equal(current.authority, "user-confirmed-current");
assert.deepEqual(current.knowledgeProductIds, visibleIds, "目前LINE可見文字／AI產品知識必須與最新公開產品清單一致");
assert.deepEqual(data.products.map((product) => product.id), visibleIds, "LINE顧客產品卡必須與最新公開產品清單一致");
assert.equal(data.runtime.knowledgeProductCount, visibleIds.length);
const qixuan = currentById[qixuanId];
if (!visibleIds.includes(qixuanId)) {
  assert.equal(qixuan?.specification, "2g／小包；20g／包（10小包）");
  assert.equal(qixuan?.temporarilyHidden, true);
  assert.equal(qixuan?.lineKnowledgeVisible, false);
  assert.ok(!current.knowledgeProductIds.includes(qixuanId));
  assert.ok(!authority.products?.[qixuanId], "柒玄茶隱藏且尚未核准正式實物圖時不得建立假圖片權威");
}

for (const product of data.products) {
  const official = currentById[product.id];
  assert.ok(official, `${product.id}缺少目前權威`);
  assert.equal(product.image, official.approvedProductImage, `${product.id}顧客產品圖不同步`);
  assert.equal(product.dmImage, official.approvedDm, `${product.id}詳細DM不同步`);
  assert.equal(product.officialOriginalImage, authority.products[product.id], `${product.id}身份原圖不同步`);
  assert.notEqual(product.image, product.dmImage, `${product.id}產品主圖不得拿DM代替`);
}

assert.equal(data.products.find((p)=>p.id==="guilu-drink-30")?.usage?.[0], "每日 1–2 罐");
assert.equal(data.products.find((p)=>p.id==="guilu-drink-180")?.usage?.[0], "每日一包");

assert.ok(String(visual.PRODUCT_IMAGE_VERSION || "").trim(), "Flex產品媒體必須有目前版本識別");
assert.ok(!/products-v2|legacy/i.test(String(visual.PRODUCT_IMAGE_VERSION || "")), "Flex產品媒體不得回退舊權威；新版暫緩標記不是舊版");
for (const [id, item] of Object.entries(visual.PRODUCTS || {})) {
  if (!visibleIds.includes(id)) {
    assert.equal(String(item.source || ""), "", `${id}暫緩產品不得重建公開來源`);
    assert.equal(String(item.original || ""), "", `${id}暫緩產品不得重建公開身份原圖`);
    continue;
  }
  assert.match(String(item.image || ""), new RegExp(`/assets/formal-product/${id}\\.jpg\\?v=`), `${id}Flex hero不是目前正式產品JPEG route`);
  assert.equal(item.source, currentById[id].approvedProductImage, `${id}Flex hero來源不是目前核准產品圖`);
  assert.equal(item.original, authority.products[id], `${id}Flex products-v3身份參考不同步`);
  assert.match(String(item.dm || ""), new RegExp(`/assets/formal-dm/${id}\\.jpg\\?v=`), `${id}Flex DM route不同步`);
}
assert.match(visual.TRIAL_IMAGE, /\/assets\/formal-trial\/trial\.jpg\?v=/);

console.log(`PASS：LINE ${visibleIds.length} 項可見產品知識與核准媒體一致；暫緩產品保留內部資料，30cc維持每日 1–2 罐。`);
