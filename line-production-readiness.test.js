"use strict";
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const { applyMaster, getCurrentAuthority, getPhotoAuthority } = require("./product-sales-master");
const rich = require("./line-rich-menu-sync");
const visual = require("./line-recording-ui-fix");

const read = (file) => fs.readFileSync(path.join(__dirname, file), "utf8");
const rawDataText = read("data.json");
const data = applyMaster(JSON.parse(rawDataText));
const authority = getCurrentAuthority();
const photoAuthority = getPhotoAuthority();
const serverSource = read("server.js");
const syncSource = read("tools/sync_sales_master.js");
const richSource = read("line-rich-menu-sync.js");
const richArtwork = rich.readArtwork();
const packageJson = JSON.parse(read("package.json"));

assert.equal(authority.authority, "user-confirmed-current", "LINE目前產品權威必須是user-confirmed-current");
assert.equal((authority.products || []).length, 6, "LINE目前產品權威必須剛好六項");
assert.equal(data.products.length, 6, "LINE runtime正式產品必須剛好六項");
assert.ok(!rawDataText.includes("/images/products-v2/"), "LINE原始data.json不得再保存products-v2正式圖");

const byId = Object.fromEntries(data.products.map((p) => [p.id, p]));
const authorityById = Object.fromEntries(authority.products.map((p) => [p.id, p]));
const expectedSpecs = {
  "guilu-gao": "100g／罐",
  "guilu-drink-30": "30cc／罐（小玻璃罐）",
  "guilu-drink-180": "180cc／包（鋁袋）",
  "guilu-tangkuai": "75g／盒｜8塊裝",
  "guilu-jiao": "600g／盒｜32塊裝",
  "luerong-fen": "75g／罐",
};
const expectedPrices = {
  "guilu-gao": { price: 1800, originalPrice: 2100 },
  "guilu-drink-30": { price: 60, offerQty: 11, offerTotal: 600 },
  "guilu-drink-180": { price: 200, offerQty: 11, offerTotal: 2000 },
  "guilu-tangkuai": { price: 1600 },
  "guilu-jiao": { price: 9600, originalPrice: 12000 },
  "luerong-fen": { price: 2000 },
};

const photoUrls = Object.values(photoAuthority.products || {});
assert.equal(photoUrls.length, 6, "products-v3照片權威必須剛好六項");
const photoCacheVersions = new Set(photoUrls.map((url) => String(url || "").match(/[?&]v=([^&#]+)/)?.[1] || "").filter(Boolean));
assert.equal(photoCacheVersions.size, 1, "六項products-v3正式原圖快取版本必須一致");
const photoVersion = [...photoCacheVersions][0];
assert.ok(photoVersion, "products-v3正式原圖缺少快取版本");

for (const [id, spec] of Object.entries(expectedSpecs)) {
  const p = byId[id];
  const official = authorityById[id];
  const priceRule = expectedPrices[id];
  assert.ok(p && official, `${id} 不存在`);
  assert.equal(official.specification, spec, `${id} authority規格不同步`);
  assert.equal(p.name, official.name, `${id} runtime名稱不同步`);
  assert.equal(p.specification, spec, `${id}.specification不同步`);
  assert.equal(p.size, spec, `${id}.size不同步`);
  assert.equal(p.spec, spec, `${id}.spec不同步`);
  assert.deepEqual(p.ingredients, official.ingredients, `${id}正式成分／順序不同步`);
  assert.equal(Number(p.price), priceRule.price, `${id}正式售價不同步`);
  if (priceRule.originalPrice !== undefined) assert.equal(Number(p.originalPrice), priceRule.originalPrice, `${id}正式原價不同步`);
  if (priceRule.offerQty) {
    const offer = (p.offers || []).find((o) => Number(o.qty) === priceRule.offerQty && o.label === "買10送1");
    assert.ok(offer, `${id}缺少買10送1`);
    assert.equal(Number(offer.total), priceRule.offerTotal, `${id}買10送1總額不同步`);
  }
  for (const field of ["image", "imageUrl", "image_url", "dmImage", "officialOriginalImage"]) {
    const url = String(p[field] || "");
    assert.ok(url.includes("/images/products-v3/"), `${id}.${field}必須使用products-v3正式原圖`);
    assert.ok(url.includes(`v=${photoVersion}`), `${id}.${field}快取版本不同步`);
    assert.ok(!url.includes("/images/products-v2/"), `${id}.${field}不得回退products-v2`);
  }
  assert.equal(p.imagePolicy, "approved-original-product-photo-contain-no-crop", `${id}圖片政策不同步`);
  assert.ok(String(p.physicalScalePolicy || "").trim(), `${id}缺少個別產品尺寸／比例政策`);
}

assert.equal(authorityById["guilu-gao"].usagePrimary, "一天一次一小匙");
assert.equal(byId["guilu-gao"].usage?.[0], "一天一次一小匙", "龜鹿膏runtime主要使用方式不同步");
assert.ok(!(byId["guilu-gao"].usage || []).some((line) => /早上.*下午|早晚各/.test(String(line))), "龜鹿膏runtime不得回退舊的早晚各一次用法");
assert.ok(!/每塊約\s*9\.375g/.test(JSON.stringify(byId["guilu-tangkuai"])), "龜鹿湯塊runtime不得帶退役每塊重量");
assert.ok(!/1斤|每塊約\s*18\.75g/.test(JSON.stringify(byId["guilu-jiao"])), "龜鹿膠runtime不得帶退役1斤／每塊重量");
assert.ok(!/玻璃瓶|30cc／瓶|瓶裝/.test(JSON.stringify(byId["guilu-drink-30"])), "30cc runtime不得稱瓶");
assert.match(String(byId["guilu-drink-30"].physicalScalePolicy || ""), /Ø42.*H51|小玻璃裸罐/i, "30cc必須保留小玻璃裸罐尺寸規則");
assert.match(String(byId["guilu-drink-180"].physicalScalePolicy || ""), /0\.60.*0\.68|狹長直立鋁袋/i, "180cc必須保留狹長鋁袋比例規則");

assert.equal(byId["guilu-drink-30"].productionLeadTime, "5～7個工作天");
assert.equal(byId["guilu-drink-180"].productionLeadTime, "5～7個工作天");
for (const id of ["guilu-gao", "guilu-tangkuai", "guilu-jiao", "luerong-fen"]) {
  assert.equal(byId[id].productionLeadTime, null, `${id}不得套用龜鹿飲5～7工作天`);
  assert.equal(byId[id].readyStock, true, `${id}必須維持備貨商品狀態`);
}
assert.equal(byId["guilu-drink-30"].readyStock, false);
assert.equal(byId["guilu-drink-180"].readyStock, false);

const trial = data.trialCampaign || {};
assert.equal(trial.contents, "30cc小玻璃罐×3罐", "試喝內容必須是30cc小玻璃罐×3罐");
assert.equal(Number(trial.productFee), 0, "試喝品必須免費");
assert.deepEqual((trial.shippingOptions || []).map((o) => [o.id, Number(o.fee)]), [["store",60],["home",100]], "試喝運費必須是7-11 60元／郵局100元");
assert.ok(!serverSource.includes("正式售價50元／罐"), "server.js不得保留舊30cc 50元價");
assert.ok(!serverSource.includes("11罐500元"), "server.js不得保留舊11罐500元價");
assert.ok(serverSource.includes("trialShippingOptions()"), "試喝運費必須從正式資料讀取");

assert.ok(String(rich.VERSION || "").includes("rich-menu"), "Rich Menu缺少正式版本識別");
assert.equal(rich.SINGLE_IMAGE_ONLY, true);
assert.equal(rich.RUNTIME_COMPOSITE_FORBIDDEN, true);
assert.equal(rich.LEGACY_BASE_TEMPLATE_FORBIDDEN, true);
assert.match(String(rich.STATIC_ARTWORK || ""), /^assets\/rich-menu\/.*\.svg(?:\.gz\.b64)?$/, "Rich Menu必須使用單一SVG正式母稿");
assert.ok(!richSource.includes(".composite("), "Rich Menu不得用runtime composite拼湊");
assert.ok(!/<image\b/i.test(richArtwork), "Rich Menu不得內嵌舊照片底圖");
assert.ok(!/<text\b/i.test(richArtwork), "Rich Menu顧客繁中不得依賴主機中文字型");
for (const label of ["仙加味","看產品","購物車","幫我推薦","搭配組合","怎麼使用","直接下單"]) assert.ok(richArtwork.includes(label), `Rich Menu母稿缺少：${label}`);
const menu = rich.menuDefinition();
assert.equal(menu.areas.length, 6, "Rich Menu必須剛好六格");
assert.deepEqual(menu.areas.map((a) => a.action.label), ["看產品","購物車","幫我推薦","搭配組合","怎麼使用","直接下單"]);
for (const area of menu.areas) {
  assert.ok(area.bounds.width > 0 && area.bounds.height > 0, "Rich Menu熱區尺寸必須有效");
  assert.ok(area.bounds.x >= 0 && area.bounds.y >= 0, "Rich Menu熱區不得超出左上界");
  assert.ok(area.bounds.x + area.bounds.width <= menu.size.width, "Rich Menu熱區不得超出寬度");
  assert.ok(area.bounds.y + area.bounds.height <= menu.size.height, "Rich Menu熱區不得超出高度");
}

assert.ok(String(visual.VERSION || "").includes("recording-ui"), "LINE Flex視覺層缺少正式版本識別");
assert.equal(visual.PRODUCT_IMAGE_VERSION, photoVersion, "LINE Flex產品圖快取版本不同步");
for (const p of Object.values(visual.PRODUCTS)) assert.ok(p.image.includes("/images/products-v3/"), "LINE Flex產品圖必須使用products-v3");
assert.equal(visual.productHero("guilu-drink-30").aspectMode, "fit", "30cc Flex必須fit不可裁切");

for (const token of [
  '/^(看產品|查看產品|看商品|產品|直接下單|直接購買|我要下單|立即下單|開始下單|我要買)$/',
  '/購物車|購買清單|查看購買清單/',
  '/搭配組合|食補搭配|產品搭配|組合怎麼搭|搭配方式/',
  '/^(怎麼使用|使用方式|食用方式|產品怎麼用)$/',
  '/^(幫我推薦|怎麼選|不知道怎麼選)$/',
]) assert.ok(serverSource.includes(token), `LINE意圖路由缺失：${token}`);
assert.ok(serverSource.includes('/^(申請試喝|我要試喝|試喝|試喝組|龜鹿飲試喝)$/'), "LINE試喝意圖路由缺失");
assert.ok(serverSource.includes('/^(價格方案|價格|售價|價錢|多少錢|優惠)$/'), "LINE價格路由缺失");
assert.ok(serverSource.includes('res.json({ ok: true });'), "LINE webhook必須先快速回200");
assert.ok(serverSource.indexOf('res.json({ ok: true });') < serverSource.indexOf('Promise.allSettled((req.body.events || []).map(handleEvent))'), "LINE webhook 200必須早於事件處理");
for (const field of ["lastWebhookAt","lastReplySuccessAt","lastReplyError"]) assert.ok(serverSource.includes(field), `LINE health缺少${field}`);
assert.ok(serverSource.includes("DRINK_ORDER_NOTICE") && serverSource.includes("READY_STOCK_ORDER_NOTICE") && serverSource.includes("MIXED_ORDER_NOTICE"), "LINE主程式必須保留產品別出貨邏輯");

assert.ok(syncSource.includes("AUTHORITY_PATH") && syncSource.includes("official-products.json"), "prestart必須讀目前產品權威檔");
assert.ok(syncSource.includes("getCurrentAuthority") && syncSource.includes("authorityById"), "prestart必須以目前authority動態驗規格／用法");
assert.ok(syncSource.includes("龜鹿膏不得回退") && syncSource.includes("龜鹿湯塊不得硬帶退役") && syncSource.includes("龜鹿膠不得硬帶退役"), "prestart必須保留退役用法／延伸規格拒絕能力");

assert.equal(packageJson.main, "server.js", "正式服務入口必須是server.js");
assert.ok(packageJson.scripts.prestart.includes("sync_sales_master.js --write"), "Render prestart必須同步正式母本");
assert.ok(packageJson.scripts.prestart.includes("line-health-authority.test.js"), "Render prestart必須驗health authority");
assert.ok(packageJson.scripts.prestart.includes("line-production-readiness.test.js"), "Render prestart必須驗production readiness");
assert.ok(packageJson.scripts.prestart.includes("line-formal-media-route.test.js"), "Render prestart必須驗正式DM路由");

console.log(`PASS：LINE OA readiness 依目前 ${authority.version} 權威與實際能力驗收：六項現行規格／成分／價格、龜鹿膏一天一次、30cc小玻璃罐、180cc鋁袋、products-v3原圖、試喝、交期、Webhook、六格Rich Menu與正式媒體路由一致；退役用法／規格只作拒絕條件，不再因原始碼包含禁止字樣而誤擋新版。`);
