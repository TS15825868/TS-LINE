"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

// Read the repository master before line-image-safety installs its runtime fs guard.
const rawText = fs.readFileSync(path.join(__dirname, "data.json"), "utf8");
const rawData = JSON.parse(rawText);
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
assert.match(String(safety.FORMAL_MEDIA_VERSION || ""), /current|formal/i, "正式媒體快取識別必須代表目前authority，不應鎖歷史日期版本");

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
assert.ok(!/\b(?:const|let|var)\s+BASE_TEMPLATE\b/.test(richSource), "Rich Menu不得重新宣告舊底圖");
assert.ok(!/\b(?:const|let|var)\s+BOSS_SOURCES\b/.test(richSource), "Rich Menu不得重新維護六張後貼圖來源");
assert.ok(!/\b(?:const|let|var)\s+CELL_LAYOUTS\b/.test(richSource), "Rich Menu不得重新維護拼貼座標");
assert.ok(!/sharp\([^)]*\)\s*\.composite\s*\(/.test(richSource)&&!/\.composite\s*\(\s*\[/.test(richSource), "Rich Menu不得回退runtime拼貼");
assert.ok(!/<image\b/i.test(richArtwork), "Rich Menu不得內嵌舊底圖或照片拼貼");
assert.ok(!/<text\b/i.test(richArtwork), "Rich Menu顧客可見繁中不得依賴主機字型");
assert.ok(/xjw-text-outlined-/i.test(richArtwork), "Rich Menu正式母稿必須使用繁中向量字");
for (const label of ["看產品", "購物車", "幫我推薦", "搭配組合", "怎麼使用", "直接下單"]) assert.ok(richArtwork.includes(label), `Rich Menu正式母稿缺少${label}`);

assert.equal(rawData.products.length, 6, "LINE正式母資料產品必須維持六項");
const rawById = Object.fromEntries(rawData.products.map((product) => [product.id, product]));
for (const product of rawData.products) {
  for (const field of ["image", "imageUrl", "image_url", "dmImage", "officialOriginalImage"]) {
    const value=String(product[field] || "");
    assert.ok(value.includes("/images/products-v3/"), `${product.id}.${field} 母資料產品識別必須使用products-v3`);
    assert.ok(!value.includes("/images/products-v2/"), `${product.id}.${field}不得回退products-v2`);
  }
  assert.ok(String(product.physicalScalePolicy || "").trim(), `${product.id}缺少產品個別尺寸／比例規則`);
}
assert.match(String(rawById["guilu-drink-30"]?.physicalScalePolicy || ""), /Ø42.*H51|小玻璃/i, "30cc必須保留小玻璃罐尺寸規則");
assert.match(String(rawById["guilu-drink-180"]?.physicalScalePolicy || ""), /0\.60.*0\.68|狹長.*鋁袋/i, "180cc必須保留狹長鋁袋比例規則");
assert.deepEqual(rawById["guilu-drink-30"].quantityOptions.slice(0, 4), [1, 2, 5, 11], "30cc買10送1數量必須可直接選");
assert.deepEqual(rawById["guilu-drink-180"].quantityOptions.slice(0, 4), [1, 2, 5, 11], "180cc買10送1數量必須可直接選");
assert.equal(rawById["guilu-drink-30"].offers.find((offer) => offer.qty === 11)?.total, 600);
assert.equal(rawById["guilu-drink-180"].offers.find((offer) => offer.qty === 11)?.total, 2000);
assert.ok(!/(300g|600g).*龜鹿湯塊|龜鹿湯塊.*(300g|600g)/.test(JSON.stringify(rawById["guilu-tangkuai"])), "龜鹿湯塊不得回復退役規格");
assert.equal(rawData.runtime.serviceMode, "standalone-line-oa");
assert.equal(rawData.runtime.productMainImageSource, "products-v3-user-approved-originals");
assert.equal(rawData.runtime.productsV2Use, "legacy-reference-only");
assert.equal(rawData.runtime.productScalePolicy, "uniform-only-no-equal-height-equal-width");
assert.equal(rawData.runtime.promotionQuantityPolicy, "promotion-qty-must-appear-within-first-four-options");
assert.equal(rawData.runtime.schedulePolicyVersion, undefined, "LINE執行資料不得掛社群排程版本");

// Customer-facing runtime is intentionally different from product identity: current approved media is shown,
// while products-v3 is retained separately as the immutable identity/fallback authority.
const customerData = safety.normalizeProductPhotos(JSON.parse(rawText));
assert.equal(customerData.products.length,6);
for(const product of customerData.products){
  const display=String(product.image||'');
  assert.match(display,/^https:\/\/ts-line\.onrender\.com\/assets\/formal-dm\/[^?]+\.jpg\?v=/,`${product.id} 顧客展示應使用LINE目前正式媒體route`);
  for(const field of ['officialOriginalImage','productIdentityImage']){
    const value=String(product[field]||'');
    assert.ok(value.includes('/images/products-v3/'),`${product.id}.${field} 必須維持products-v3產品識別`);
    assert.ok(!value.includes('/images/products-v2/'),`${product.id}.${field} 不得回退products-v2`);
  }
  assert.ok(String(product.formalDmSource||'').startsWith('https://'),`${product.id} 顧客正式DM必須保留公開來源可追溯性`);
}

const formal=safety.formalMedia || {};
assert.match(String(formal.runtime || ""), /current/i, "LINE正式媒體authority必須是目前權威");
assert.ok(String(formal.approval_batch || "").trim(), "正式媒體authority必須有目前核准批次");
assert.ok(/^https:\/\//.test(String(formal.source_trial || "")), "LINE試喝圖必須有目前公開正式來源");
const sources=Object.entries(formal.source_product_dm || {});
assert.equal(sources.length,6,"LINE正式媒體authority必須維持六項顧客展示來源");
for(const [name,url] of sources){
  const value=String(url||"");
  assert.ok(/^https:\/\//.test(value),`${name}正式顯示來源必須是可公開取得網址`);
  assert.ok(/\/images\//.test(value),`${name}正式顯示來源必須來自目前網站圖片資產`);
  assert.ok(!/products-v2/.test(value),`${name}正式顯示來源不得使用products-v2`);
}
assert.ok(String(formal.source_product_dm?.["龜鹿飲30cc玻璃罐"] || "").includes("guilu-drink-30cc"), "30cc顧客DM來源必須維持目前核准30cc媒體");

assert.equal(safety.CLEAN_MASCOT_PATH_PREFIX, "/assets/mascot-clean");
assert.equal(safety.CLEAN_DRINK_IMAGE_PATH, "/assets/guilu-drink-30-clean.jpg");
assert.equal(typeof safety.installImageRoutes, "function", "獨立server必須保留圖片route安裝器");

const menu = safety.richMenuSync.menuDefinition();
assert.deepEqual(menu.size,{width:2500,height:1686});
assert.equal(menu.areas.length,6);
assert.equal(menu.areas.at(0).bounds.y, 176, "品牌Header不得成為熱區");
assert.equal(menu.areas.at(-1).action.text, "直接下單");

console.log("PASS：LINE直接啟動守門已分離『產品本體識別』與『顧客展示媒體』：母資料／fallback維持products-v3；顧客畫面使用目前核准正式媒體JPEG route；同時驗六格繁中向量Rich Menu、產品比例與促銷數量，不綁歷史路徑／版號。");
