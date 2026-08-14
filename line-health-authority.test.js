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
assert.equal(payload.productMainImageSource, "products-v3-user-approved-originals");
assert.equal(payload.productsV2Use, "legacy-reference-only-forbidden-in-live-cards");
assert.match(payload.imagePolicy, /products-v3|approved-original|no-crop|no-ai-redraw/i);
assert.equal(payload.customerDisplayPolicy, "copy-validated-formal-dm-or-products-v3-fallback");
assert.equal(payload.guiluDrink30Specification, "30cc／罐（小玻璃罐）");
assert.match(payload.guiluDrink30PhysicalScale, /Ø42.*H51|小玻璃裸罐/i);
assert.equal(payload.guiluDrink180Specification, "180cc／包（鋁袋）");
assert.match(payload.guiluDrink180PhysicalScale, /0\.64|0\.60.*0\.68|狹長直立鋁袋/i);
assert.equal(payload.guiluGaoSpecification, "100g／罐");
assert.equal(payload.guiluGaoUsagePrimary, "每日早上及下午各一小匙");
assert.equal(payload.guiluTangkuaiSpecification, "75g／盒｜8塊裝");
assert.equal(payload.guiluJiaoSpecification, "600g（1斤）／盒｜32塊裝");
assert.equal(payload.luerongFenSpecification, "75g／罐");
assert.match(payload.guardPolicy, /current-authority|capability/i);
const serialized=JSON.stringify(payload);
for (const forbidden of ["publishingReview", "lineVoom", "schedulePolicy", "products-v2-actual-photos", "marketing-layout-reference-only", "一天一次一小匙"]) {
  assert.ok(!serialized.includes(forbidden), `LINE健康診斷不得保留舊／非LINE目前正式欄位：${forbidden}`);
}

const safetySource = fs.readFileSync("line-image-safety.js", "utf8");
assert.ok(!safetySource.includes('require("./social-schedule-policy-fix")'), "LINE安全層不得載入社群排程");
assert.ok(!safetySource.includes('require("./product-fulfillment-message-fix")'), "LINE安全層不得載入舊出貨補丁");
assert.ok(safetySource.includes('serviceMode: "standalone-line-oa"'), "LINE安全層必須標示獨立服務模式");

console.log("PASS：LINE健康診斷只描述目前獨立LINE OA正式狀態；六項規格、龜鹿膏目前用法、products-v3與copy-validated顧客媒體fallback一致，無退役規格／舊用法／貼文社群欄位。");
