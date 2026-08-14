"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const core = require("./line-image-safety-core");
const plain = require("./line-plain-text-safety");

const payload = plain.healthPayload(core);
assert.equal(payload.ok, true);
assert.equal(payload.serviceMode, "standalone-line-oa");
assert.equal(payload.productCount, 6);
assert.equal(payload.sellableSpecificationCount, 6);
assert.equal(payload.productMainImageSource, "current-approved-product-image-line-compatible-jpeg");
assert.equal(payload.detailedDmImageSource, "current-approved-dm-line-compatible-jpeg");
assert.equal(payload.trialImageSource, "20260814-user-approved-trial-line-compatible-jpeg");
assert.equal(payload.productIdentitySource, "products-v3-user-approved-originals");
assert.equal(payload.productsV2Use, "legacy-reference-only-forbidden-in-live-cards");
assert.match(payload.imagePolicy, /product-dm-trial-identity-separated|no-crop|no-ai-redraw/i);
assert.match(payload.customerDisplayPolicy, /current-approved-product-image.*separate-dm.*separate-trial/i);
assert.equal(payload.guiluDrink30Specification, "30cc／罐（小玻璃罐）");
assert.match(payload.guiluDrink30PhysicalScale, /Ø42.*H51|小玻璃裸罐/i);
assert.equal(payload.guiluDrink180Specification, "180cc／包（鋁袋）");
assert.match(payload.guiluDrink180PhysicalScale, /0\.64|0\.60.*0\.68|狹長直立鋁袋/i);
assert.equal(payload.guiluGaoSpecification, "100g／罐");
assert.equal(payload.guiluGaoUsagePrimary, "每日早上及下午各一小匙");
assert.equal(payload.guiluTangkuaiSpecification, "75g／盒｜8塊裝");
assert.match(payload.guiluTangkuaiDetailUnitApprox, /9\.375g.*僅詳細資料/);
assert.equal(payload.guiluJiaoSpecification, "600g（1斤）／盒｜32塊裝");
assert.match(payload.guiluJiaoDetailUnitApprox, /18\.75g.*僅詳細資料/);
assert.equal(payload.luerongFenSpecification, "75g／罐");
assert.match(payload.guardPolicy, /current-authority|capability/i);

const serialized = JSON.stringify(payload);
for (const forbidden of ["publishingReview", "lineVoom", "schedulePolicy", "products-v2-actual-photos", "一天一次一小匙", "30cc／瓶"]) {
  assert.ok(!serialized.includes(forbidden), `LINE健康診斷不得保留舊／非LINE目前正式欄位：${forbidden}`);
}

const safetySource = fs.readFileSync("line-image-safety.js", "utf8");
assert.ok(!safetySource.includes('require("./social-schedule-policy-fix")'));
assert.ok(!safetySource.includes('require("./product-fulfillment-message-fix")'));
assert.ok(safetySource.includes('app.get("/assets/formal-product/:id.jpg"'), "缺少產品JPEG路由");
assert.ok(safetySource.includes('app.get("/assets/formal-dm/:id.jpg"'), "缺少DM JPEG路由");
assert.ok(safetySource.includes('app.get("/assets/formal-trial/trial.jpg"'), "缺少試喝JPEG路由");
assert.ok(safetySource.includes('serviceMode: "standalone-line-oa"'));

console.log("PASS：LINE健康診斷只描述目前獨立LINE OA；產品、DM、試喝、products-v3身份四種媒體角色分離，六項正式規格與目前龜鹿膏用法一致。");
