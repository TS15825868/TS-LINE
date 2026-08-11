"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const safety = require("./line-image-safety");

assert.match(String(safety.VERSION || ""), /current|line|media|safety/i, "LINE安全層必須有目前能力識別");
assert.match(String(safety.photoAuthority?.version || ""), /products-v3/i, "產品圖片權威必須維持products-v3");
assert.ok(!/products-v2/i.test(String(safety.photoAuthority?.version || "")), "產品圖片權威不得回退products-v2");
assert.match(String(safety.recordingUiFix?.VERSION || ""), /recording-ui/i, "LINE Flex視覺層缺少能力識別");
assert.match(String(safety.richMenuSync?.VERSION || ""), /rich-menu/i, "Rich Menu缺少能力識別");
assert.equal(safety.richMenuSync.SINGLE_IMAGE_ONLY, true);
assert.equal(safety.richMenuSync.RUNTIME_COMPOSITE_FORBIDDEN, true);
assert.equal(safety.richMenuSync.LEGACY_BASE_TEMPLATE_FORBIDDEN, true);
assert.match(String(safety.richMenuSync.STATIC_ARTWORK || ""), /^assets\/rich-menu\/.*\.svg(?:\.gz\.b64)?$/, "Rich Menu必須使用單一SVG正式母稿");
assert.equal(safety.schedulePolicy, undefined, "LINE獨立安全層不得載入社群排程模組");
assert.equal(safety.fulfillmentSafety, undefined, "LINE獨立安全層不得依賴舊出貨補丁");
assert.equal(safety.FORMAL_MEDIA_VERSION, "current-formal-media", "正式媒體快取識別應跟目前authority，不應鎖歷史日期版本");

const safetySource = fs.readFileSync(path.join(__dirname, "line-image-safety.js"), "utf8");
assert.ok(!safetySource.includes('require("./social-schedule-policy-fix")'), "LINE安全層不得載入社群排程");
assert.ok(!safetySource.includes('require("./product-fulfillment-message-fix")'), "LINE安全層不得載入舊出貨補丁");
assert.ok(safetySource.includes('app.get("/assets/formal-dm/:id.jpg"'), "LINE正式啟動必須提供目前正式DM JPEG route");
assert.ok(safetySource.includes('fit: "inside"'), "正式媒體轉LINE JPEG必須等比例contain，不可裁切");
assert.ok(safetySource.includes('withoutEnlargement: true'), "正式媒體不得不必要放大");
assert.equal(fs.existsSync(path.join(__dirname, "social-final-approved-batch.js")), false, "退役自動核准社群batch不得回到LINE repo");
assert.equal(fs.existsSync(path.join(__dirname, "social-final-posts.js")), false, "退役社群排程模板不得回到LINE repo");

const richSource = fs.readFileSync(path.join(__dirname, "line-rich-menu-sync.js"), "utf8");
const richArtwork = safety.richMenuSync.readArtwork();
for (const forbidden of ["BASE_TEMPLATE", "BOSS_SOURCES", "CELL_LAYOUTS", ".composite("]) assert.ok(!richSource.includes(forbidden), `Rich Menu不得回退拼貼能力：${forbidden}`);
assert.ok(!/<image\b/i.test(richArtwork), "Rich Menu不得內嵌舊底圖或照片拼貼");
assert.ok(!/<text\b/i.test(richArtwork), "Rich Menu顧客可見繁中不得依賴主機字型");
assert.ok(/xjw-text-outlined-/i.test(richArtwork), "Rich Menu正式母稿必須使用繁中向量字");
for (const label of ["看產品", "購物車", "幫我推薦", "搭配組合", "怎麼使用", "直接下單"]) assert.ok(richArtwork.includes(label), `Rich Menu正式母稿缺少${label}`);

const raw = fs.readFileSync(path.join(__dirname, "data.json"), "utf8");
const data = JSON.parse(raw);
assert.equal(data.products.length, 6, "LINE正式產品必須維持六項");
const byId = Object.fromEntries(data.products.map((product) => [product.id, product]));
for (const product of data.products) {
  for (const field of ["image", "imageUrl", "image_url", "dmImage", "officialOriginalImage"]) {
    const value=String(product[field] || "");
    assert.ok(value.includes("/images/products-v3/"), `${product.id}.${field} direct-start產品識別必須使用products-v3`);
    assert.ok(!value.includes("/images/products-v2/"), `${product.id}.${field}不得回退products-v2`);
  }
  assert.ok(String(product.physicalScalePolicy || "").trim(), `${product.id}缺少產品個別尺寸／比例規則`);
}
assert.match(String(byId["guilu-drink-30"]?.physicalScalePolicy || ""), /Ø42.*H51|小玻璃/i, "30cc必須保留小玻璃罐尺寸規則");
assert.match(String(byId["guilu-drink-180"]?.physicalScalePolicy || ""), /0\.60.*0\.68|狹長.*鋁袋/i, "180cc必須保留狹長鋁袋比例規則");
assert.deepEqual(byId["guilu-drink-30"].quantityOptions.slice(0, 4), [1, 2, 5, 11], "30cc買10送1數量必須可直接選");
assert.deepEqual(byId["guilu-drink-180"].quantityOptions.slice(0, 4), [1, 2, 5, 11], "180cc買10送1數量必須可直接選");
assert.equal(byId["guilu-drink-30"].offers.find((offer) => offer.qty === 11)?.total, 600);
assert.equal(byId["guilu-drink-180"].offers.find((offer) => offer.qty === 11)?.total, 2000);
assert.ok(!/(300g|600g).*龜鹿湯塊|龜鹿湯塊.*(300g|600g)/.test(JSON.stringify(byId["guilu-tangkuai"])), "龜鹿湯塊不得回復退役規格");
assert.equal(data.runtime.serviceMode, "standalone-line-oa");
assert.equal(data.runtime.productMainImageSource, "products-v3-user-approved-originals");
assert.equal(data.runtime.productsV2Use, "legacy-reference-only");
assert.equal(data.runtime.productScalePolicy, "uniform-only-no-equal-height-equal-width");
assert.equal(data.runtime.promotionQuantityPolicy, "promotion-qty-must-appear-within-first-four-options");
assert.equal(data.runtime.schedulePolicyVersion, undefined, "LINE執行資料不得掛社群排程版本");

const formal=safety.formalMedia || {};
assert.match(String(formal.runtime || ""), /current/i, "LINE正式媒體authority必須是目前權威");
assert.equal(String(formal.approval_batch || ""), "current-user-approved-media");
assert.ok(String(formal.source_trial || "").includes("guilu-drink-trial"), "LINE試喝圖必須跟目前正式海報來源同步");
assert.ok(String(formal.source_product_dm?.["龜鹿飲30cc玻璃罐"] || "").includes("guilu-drink-30cc.webp"), "30cc顧客DM來源必須是目前核准DM");
for (const key of ["龜鹿膏","龜鹿飲180cc鋁袋","龜鹿湯塊","龜鹿膠","鹿茸粉"]) assert.match(String(formal.source_product_dm?.[key]||""), /\/images\/dm-final\/.*\.jpg\?v=current$/, `${key}正式顯示來源必須跟目前網站有效二進位同步`);

assert.equal(safety.CLEAN_MASCOT_PATH_PREFIX, "/assets/mascot-clean");
assert.equal(safety.CLEAN_DRINK_IMAGE_PATH, "/assets/guilu-drink-30-clean.jpg");
assert.equal(typeof safety.installImageRoutes, "function", "獨立server必須保留圖片route安裝器");

const menu = safety.richMenuSync.menuDefinition();
assert.deepEqual(menu.size,{width:2500,height:1686});
assert.equal(menu.areas.length,6);
assert.equal(menu.areas.at(0).bounds.y, 176, "品牌Header不得成為熱區");
assert.equal(menu.areas.at(-1).action.text, "直接下單");

console.log("PASS：LINE直接啟動守門改為目前能力驗收：products-v3產品識別、目前核准正式媒體、等比例JPEG route、六格繁中向量Rich Menu、個別產品比例與促銷數量都存在；不再綁歷史安全層／照片／Rich Menu版號。");
