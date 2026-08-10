"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const safety = require("./line-image-safety");

assert.equal(safety.VERSION, "20260809-direct-start-products-v3-standalone-v5");
assert.equal(safety.photoAuthority.version, "2026-08-09-products-v3-user-approved-size-lock-v1");
assert.ok(safety.recordingUiFix.VERSION.includes("recording-ui-v6"));
assert.equal(safety.richMenuSync.VERSION, "20260810-rich-menu-vector-outline-v12");
assert.equal(safety.richMenuSync.SINGLE_IMAGE_ONLY, true);
assert.equal(safety.richMenuSync.RUNTIME_COMPOSITE_FORBIDDEN, true);
assert.equal(safety.richMenuSync.LEGACY_BASE_TEMPLATE_FORBIDDEN, true);
assert.equal(safety.richMenuSync.STATIC_ARTWORK, "assets/rich-menu/xianjiawei-rich-menu-v12.svg.gz.b64");
assert.equal(safety.schedulePolicy, undefined, "LINE獨立安全層不得再載入社群排程模組");
assert.equal(safety.fulfillmentSafety, undefined, "LINE獨立安全層不得再依賴舊出貨補丁");

const safetySource = fs.readFileSync(path.join(__dirname, "line-image-safety.js"), "utf8");
assert.ok(!safetySource.includes('require("./social-schedule-policy-fix")'), "LINE安全層不得載入社群排程");
assert.ok(!safetySource.includes('require("./product-fulfillment-message-fix")'), "LINE安全層不得載入舊出貨補丁");
assert.equal(fs.existsSync(path.join(__dirname, "social-final-approved-batch.js")), false, "退役的自動核准社群batch不得回到LINE repo");
assert.equal(fs.existsSync(path.join(__dirname, "social-final-posts.js")), false, "退役的2026/7社群排程模板不得回到LINE repo");

const richSource = fs.readFileSync(path.join(__dirname, "line-rich-menu-sync.js"), "utf8");
const richArtwork = safety.richMenuSync.readArtwork();
assert.ok(!richSource.includes("BASE_TEMPLATE"));
assert.ok(!richSource.includes("BOSS_SOURCES"));
assert.ok(!richSource.includes("CELL_LAYOUTS"));
assert.ok(!richSource.includes(".composite("));
assert.ok(!/<image\b/i.test(richArtwork), "Rich Menu不得內嵌舊底圖或照片拼貼");
assert.ok(!/<text\b/i.test(richArtwork), "Rich Menu顧客可見繁中不得依賴主機字型");
assert.ok(richArtwork.includes("xjw-text-outlined-v12"), "Rich Menu正式母稿必須使用繁中向量字");
for (const label of ["看產品", "購物車", "幫我推薦", "搭配組合", "怎麼使用", "直接下單"]) {
  assert.ok(richArtwork.includes(label), `Rich Menu正式母稿缺少${label}`);
}
assert.equal((richArtwork.match(/rx=\"38\"/g) || []).length, 6, "Rich Menu應有六個原生完整面板");

const raw = fs.readFileSync(path.join(__dirname, "data.json"), "utf8");
const data = JSON.parse(raw);
assert.equal(data.products.length, 6);
const byId = Object.fromEntries(data.products.map((product) => [product.id, product]));
for (const product of data.products) {
  for (const field of ["image", "imageUrl", "image_url", "dmImage", "officialOriginalImage"]) {
    assert.ok(String(product[field] || "").includes("/images/products-v3/"), `${product.id}.${field} direct-start仍非products-v3正式原圖`);
    assert.ok(!String(product[field] || "").includes("/images/products-v2/"), `${product.id}.${field} direct-start仍含舊products-v2`);
    assert.ok(!String(product[field] || "").includes("/images/dm-final/"), `${product.id}.${field} direct-start仍含舊DM`);
  }
  assert.equal(product.imagePolicy, "approved-original-product-photo-contain-no-crop");
  assert.ok(String(product.physicalScalePolicy || "").trim(), `${product.id} 缺少產品個別尺寸／比例規則`);
}
assert.match(byId["guilu-drink-30"].physicalScalePolicy, /Ø42.*H51|30cc.*小玻璃|小玻璃.*30cc/i, "30cc必須保留小玻璃罐實際尺寸規則");
assert.match(byId["guilu-drink-180"].physicalScalePolicy, /0\.60.*0\.68|狹長.*鋁袋|鋁袋.*狹長/i, "180cc必須保留狹長鋁袋比例規則");
assert.ok(!/(300g|600g).*龜鹿湯塊|龜鹿湯塊.*(300g|600g)/.test(JSON.stringify(byId["guilu-tangkuai"])), "龜鹿湯塊不得回復300g／600g舊規格");
assert.equal(data.productPhotoAuthorityVersion, "2026-08-09-products-v3-user-approved-size-lock-v1");
assert.equal(data.runtime.serviceMode, "standalone-line-oa");
assert.equal(data.runtime.productMainImageSource, "products-v3-user-approved-originals");
assert.equal(data.runtime.productsV2Use, "legacy-reference-only");
assert.equal(data.runtime.productScalePolicy, "uniform-only-no-equal-height-equal-width");
assert.equal(data.runtime.schedulePolicyVersion, undefined, "LINE執行資料不得再掛社群排程版本");
assert.ok(String(data.runtime.richMenuSyncVersion || "").includes("rich-menu"));

const oldBubble = {type:"bubble",hero:{type:"image",url:"https://example.com/old.jpg"},body:{type:"box",layout:"vertical",contents:[{type:"text",text:"龜鹿飲30cc玻璃罐｜30cc／罐（小玻璃罐）"},{type:"text",text:"每組售價：$6,400"}]},footer:{type:"box",layout:"vertical",contents:[{type:"button",action:{type:"uri",label:"看產品DM",uri:"https://example.com/old-dm.jpg"}}]}};
safety.recordingUiFix.applyVisualFix(oldBubble);
assert.ok(oldBubble.hero.url.includes("/images/products-v3/guilu-drink-30.jpg"));
assert.equal(oldBubble.hero.aspectMode, "fit");
assert.equal(oldBubble.xjwProductScalePolicy, "uniform-only-no-crop-no-stretch");
assert.equal(oldBubble.footer.contents[0].action.label, "看實際產品照片");
assert.equal(oldBubble.body.contents[1].text, "商品合計：$6,400");

assert.equal(safety.CLEAN_MASCOT_PATH_PREFIX, "/assets/mascot-clean");
assert.equal(safety.CLEAN_DRINK_IMAGE_PATH, "/assets/guilu-drink-30-clean.jpg");
assert.equal(typeof safety.installImageRoutes, "function", "獨立server必須保留乾淨圖片route安裝器");

const menu = safety.richMenuSync.menuDefinition();
assert.equal(menu.areas.at(0).bounds.y, 176, "品牌Header不得成為熱區");
assert.equal(menu.areas.at(-1).bounds.y, 875);
assert.equal(menu.areas.at(-1).action.label, "直接下單");
assert.equal(menu.areas.at(-1).action.text, "直接下單");

console.log("PASS：LINE獨立直接啟動只保留products-v3、個別尺寸、乾淨角色圖route與繁中向量字原生Rich Menu；退役自動核准社群batch、社群排程與舊出貨補丁不得重新進入LINE安全層。");
