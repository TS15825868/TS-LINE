"use strict";

const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const { applyMaster, getCurrentAuthority, getPhotoAuthority } = require("./product-sales-master");

const rawText = fs.readFileSync(path.join(__dirname, "data.json"), "utf8");
const data = applyMaster(JSON.parse(rawText));
const currentAuthority = getCurrentAuthority();
const photoAuthority = getPhotoAuthority();
const officialById = Object.fromEntries((currentAuthority.products || []).map((product) => [product.id, product]));
const visibleIds = ["guilu-gao","guilu-drink-30","guilu-drink-180","guilu-tangkuai","guilu-jiao","luerong-fen"];
const qixuanId = "qixuan-guilu-drink-powder";

assert.equal(currentAuthority.authority, "user-confirmed-current");
assert.deepEqual(currentAuthority.knowledgeProductIds, visibleIds, "LINE可見文字／AI產品知識必須維持六項");
assert.match(String(photoAuthority?.version || ""), /products-v3/i);
assert.ok(!/products-v2/i.test(String(photoAuthority?.version || "")));
assert.equal(Object.keys(photoAuthority?.products || {}).length, 6, "目前核准正式實物圖維持六項");

for (const [id, identityUrl] of Object.entries(photoAuthority.products || {})) {
  const value = String(identityUrl || "");
  assert.ok(value.includes("/images/products-v3/"), `${id}產品身份參考不得離開products-v3`);
  assert.ok(!value.includes("/images/products-v2/"), `${id}產品身份參考不得回退products-v2`);
}

assert.equal(data.products.length, 6, "LINE顧客產品卡目前只顯示六項正式產品");
for (const product of data.products) {
  const official = officialById[product.id];
  assert.ok(official, `${product.id} 缺少目前正式產品權威`);
  assert.equal(product.name, official.name);
  assert.equal(product.specification, official.specification);
  assert.equal(product.size, official.specification);
  assert.equal(product.spec, official.specification);
  assert.equal(product.image, official.approvedProductImage, `${product.id}產品主圖必須使用目前正式顧客產品圖`);
  assert.equal(product.imageUrl, official.approvedProductImage);
  assert.equal(product.image_url, official.approvedProductImage);
  assert.equal(product.dmImage, official.approvedDm, `${product.id}詳細DM必須與產品主圖分離`);
  assert.equal(product.officialOriginalImage, photoAuthority.products[product.id], `${product.id} products-v3只作身份原圖`);
  assert.notEqual(product.image, product.dmImage, `${product.id}產品主圖不得等於詳細DM`);
  assert.ok(String(product.physicalScalePolicy || "").trim(), `${product.id}缺少產品尺寸／比例規則`);
}

const qixuan = officialById[qixuanId];
assert.ok(qixuan, "柒玄茶資料必須保留供日後重新啟用");
assert.equal(qixuan.name, "柒玄茶・龜鹿調飲粉");
assert.equal(qixuan.specification, "2g／小包；20g／包（10小包）");
assert.equal(qixuan.mediaStatus, "formal-product-image-pending");
assert.equal(qixuan.temporarilyHidden, true);
assert.equal(qixuan.lineKnowledgeVisible, false);
assert.equal(qixuan.publicVisible, false);
assert.ok(!currentAuthority.knowledgeProductIds.includes(qixuanId));
assert.ok(!photoAuthority.products?.[qixuanId], "隱藏且尚未核准正式實物圖時不得建立假圖片權威");

const byId = Object.fromEntries(data.products.map((product) => [product.id, product]));
assert.equal(byId["guilu-gao"].usage?.[0], "食用時間可依個人使用習慣與作息時間安排");
assert.ok(!(byId["guilu-gao"].usage || []).some((line) => /一天一次一小匙|早晚各一小匙|每日早上及下午各一小匙/.test(String(line))));
assert.equal(byId["guilu-drink-30"].usage?.[0], "每日 1–2 罐");
assert.ok(!(byId["guilu-drink-30"].usage || []).some((line) => /^每日一罐$/.test(String(line).trim())));
assert.equal(byId["guilu-drink-180"].usage?.[0], "每日一包");
assert.equal(byId["guilu-drink-30"].name, "龜鹿飲30cc玻璃罐");
assert.equal(byId["guilu-drink-30"].specification, "30cc／罐（小玻璃罐）");
assert.ok(!byId["guilu-drink-30"].aliases.some((alias) => /瓶/.test(String(alias))));
assert.match(byId["guilu-drink-30"].physicalScalePolicy, /Ø42.*H51|小玻璃裸罐/i);
assert.equal(byId["guilu-drink-30"].price, 60);
assert.ok(byId["guilu-drink-30"].offers.some((offer) => offer.label === "買10送1" && offer.qty === 11 && offer.total === 600));
assert.equal(byId["guilu-drink-180"].price, 200);
assert.match(byId["guilu-drink-180"].physicalScalePolicy, /0\.60.*0\.68|狹長直立鋁袋/i);
assert.ok(byId["guilu-drink-180"].offers.some((offer) => offer.label === "買10送1" && offer.qty === 11 && offer.total === 2000));
assert.equal(byId["guilu-tangkuai"].specification, "75g （2兩）／盒｜8塊裝");
assert.equal(byId["guilu-jiao"].specification, "600g （1斤）／盒｜32塊裝");
assert.equal(byId["luerong-fen"].specification, "75g／罐");
assert.equal(data.runtime.knowledgeProductCount, 6);
assert.equal(data.runtime.approvedMediaProductCount, 6);
assert.equal(data.runtime.productMainImageSource, "six-user-confirmed-product-images");
assert.equal(data.runtime.detailedDmSource, "separate-corrected-dm");
assert.equal(data.runtime.productIdentityReference, "products-v3-user-approved-originals");
assert.equal(data.runtime.productsV2Use, "legacy-reference-only");

console.log("PASS：LINE OA六項可見產品知識＋六項核准正式實物圖；30cc每日 1–2 罐，柒玄茶暫時隱藏且不建立假媒體。");
