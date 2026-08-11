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
const photoAuthorityVersion = String(photoAuthority?.version || "").trim();
const photoCacheVersions = new Set(Object.values(photoAuthority?.products || {}).map((url) => String(url || "").match(/[?&]v=([^&#]+)/)?.[1] || "").filter(Boolean));
const photoVersion = photoCacheVersions.size === 1 ? [...photoCacheVersions][0] : "";
const serverSource = read("server.js");
const syncSource = read("tools/sync_sales_master.js");
const richSource = read("line-rich-menu-sync.js");
const richArtwork = rich.readArtwork();
const packageJson = JSON.parse(read("package.json"));

assert.equal(authority.authority, "user-confirmed-current", "LINE目前產品權威必須是user-confirmed-current");
assert.equal((authority.products || []).length, 6, "LINE目前產品權威必須剛好六項");
assert.ok(photoAuthorityVersion, "LINE正式產品圖片權威必須提供版本識別");
assert.ok(photoVersion, "LINE六項正式產品照片必須使用一致的快取版本");
assert.ok(!rawDataText.includes("/images/products-v2/"), "LINE原始data.json不得再保存products-v2正式圖");
assert.equal(data.products.length, 6, "正式產品必須剛好六項");

const byId = Object.fromEntries(data.products.map((p) => [p.id, p]));
const authorityById = Object.fromEntries(authority.products.map((p) => [p.id, p]));
const prices = {
  "guilu-gao": { price: 1800, originalPrice: 2100 },
  "guilu-drink-30": { price: 60, offerQty: 11, offerTotal: 600 },
  "guilu-drink-180": { price: 200, offerQty: 11, offerTotal: 2000 },
  "guilu-tangkuai": { price: 1600 },
  "guilu-jiao": { price: 9600, originalPrice: 12000 },
  "luerong-fen": { price: 2000 },
};
for (const [id, rule] of Object.entries(prices)) {
  const p = byId[id];
  const official = authorityById[id];
  assert.ok(p && official, `${id} 不存在`);
  assert.equal(p.name, official.name, `${id} 正式名稱未跟目前權威同步`);
  assert.equal(p.specification || p.size || p.spec, official.specification, `${id} 正式規格未跟目前權威同步`);
  assert.equal(p.size, official.specification, `${id}.size 未跟目前權威同步`);
  assert.equal(p.spec, official.specification, `${id}.spec 未跟目前權威同步`);
  assert.deepEqual(p.ingredients, official.ingredients, `${id} 正式成分／順序未跟目前權威同步`);
  assert.equal(Number(p.price), rule.price, `${id} 正式售價不同步`);
  if (rule.originalPrice !== undefined) assert.equal(Number(p.originalPrice), rule.originalPrice, `${id} 正式原價不同步`);
  if (rule.offerQty) {
    const offer = (p.offers || []).find((o) => Number(o.qty) === rule.offerQty && o.label === "買10送1");
    assert.ok(offer, `${id} 缺少買10送1方案`);
    assert.equal(Number(offer.total), rule.offerTotal, `${id} 買10送1總額錯誤`);
  }
  for (const field of ["image", "imageUrl", "image_url", "dmImage", "officialOriginalImage"]) {
    const url = String(p[field] || "");
    assert.ok(url.includes("/images/products-v3/"), `${id}.${field} 仍非products-v3正式原圖`);
    assert.ok(url.includes(`v=${photoVersion}`), `${id}.${field} 未跟目前產品圖快取版本同步`);
    assert.ok(!url.includes("/images/products-v2/"), `${id}.${field} 不得回退products-v2`);
  }
  assert.equal(p.imagePolicy, "approved-original-product-photo-contain-no-crop", `${id} 圖片政策錯誤`);
}

assert.deepEqual(Object.fromEntries(Object.values(authorityById).map((p) => [p.id, p.specification])), {
  "guilu-gao": "100g／罐",
  "guilu-drink-30": "30cc／罐（小玻璃罐）",
  "guilu-drink-180": "180cc／包（鋁袋）",
  "guilu-tangkuai": "75g／盒｜8塊裝",
  "guilu-jiao": "600g／盒｜32塊裝",
  "luerong-fen": "75g／罐",
}, "LINE正式顧客規格未跟目前權威同步");
assert.equal(authorityById["guilu-gao"].usagePrimary, "一天一次一小匙");
assert.equal(byId["guilu-gao"].usage?.[0], authorityById["guilu-gao"].usagePrimary, "龜鹿膏主要使用句未跟目前權威同步");
assert.ok(!(byId["guilu-gao"].usage || []).some((line) => /每日早上及下午各一小匙|早晚各一小匙/.test(String(line))), "龜鹿膏不得回退早晚各一次舊用法");
assert.equal(byId["guilu-drink-30"].name, "龜鹿飲30cc玻璃罐");
assert.ok(!/玻璃瓶|30cc／瓶|瓶裝/.test(JSON.stringify(byId["guilu-drink-30"])), "30cc正式產品資料不得出現玻璃瓶／瓶裝");
assert.ok(!/每塊約\s*9\.375g/.test(JSON.stringify(byId["guilu-tangkuai"])), "龜鹿湯塊不得硬帶退役每塊重量延伸");
assert.ok(!/1斤|每塊約\s*18\.75g/.test(JSON.stringify(byId["guilu-jiao"])), "龜鹿膠不得硬帶退役1斤／每塊重量延伸");
assert.match(String(byId["guilu-drink-30"].physicalScalePolicy || ""), /Ø42.*H51|小玻璃裸罐/i, "30cc必須保留小玻璃裸罐尺寸規則");
assert.match(String(byId["guilu-drink-180"].physicalScalePolicy || ""), /0\.60.*0\.68|狹長直立鋁袋/i, "180cc必須保留狹長鋁袋比例規則");

assert.equal(byId["guilu-drink-30"].productionLeadTime, "5～7個工作天");
assert.equal(byId["guilu-drink-180"].productionLeadTime, "5～7個工作天");
for (const id of ["guilu-gao", "guilu-tangkuai", "guilu-jiao", "luerong-fen"]) assert.equal(byId[id].productionLeadTime, null, `${id} 不得套用龜鹿飲5～7工作天`);

const trial = data.trialCampaign || {};
assert.equal(trial.contents, "30cc小玻璃罐×3罐", "試喝份量必須鎖定3罐");
assert.equal(Number(trial.productFee), 0, "試喝品必須免費");
assert.deepEqual((trial.shippingOptions || []).map((o) => [o.id, Number(o.fee)]), [["store", 60], ["home", 100]], "試喝配送費用不同步");
assert.ok(!serverSource.includes("正式售價50元／罐"), "server.js不得保留舊30cc 50元備援價");
assert.ok(!serverSource.includes("11罐500元"), "server.js不得保留舊買10送1 500元備援價");
assert.ok(serverSource.includes("trialShippingOptions()"), "試喝配送費用必須從正式資料讀取");

assert.ok(String(rich.VERSION || "").includes("rich-menu"), "Rich Menu必須提供正式版本識別");
assert.equal(rich.SINGLE_IMAGE_ONLY, true);
assert.equal(rich.RUNTIME_COMPOSITE_FORBIDDEN, true);
assert.equal(rich.LEGACY_BASE_TEMPLATE_FORBIDDEN, true);
assert.match(String(rich.STATIC_ARTWORK || ""), /^assets\/rich-menu\/.*\.svg(?:\.gz\.b64)?$/, "Rich Menu正式母稿必須是assets/rich-menu下的單一SVG資產");
assert.ok(!richSource.includes("BASE_TEMPLATE"), "Rich Menu正式程式不得依賴舊JPG底圖");
assert.ok(!richSource.includes(".composite("), "Rich Menu不得使用sharp composite拼湊視覺");
assert.ok(!/<image\b/i.test(richArtwork), "Rich Menu不得內嵌照片或舊底圖");
assert.ok(!/<text\b/i.test(richArtwork), "Rich Menu顧客可見繁中不得依賴主機中文字型");
for (const label of ["仙加味", "看產品", "購物車", "幫我推薦", "搭配組合", "怎麼使用", "直接下單"]) assert.ok(richArtwork.includes(label), `Rich Menu完整母稿缺少：${label}`);
const menu = rich.menuDefinition();
assert.equal(menu.areas.length, 6, "Rich Menu必須剛好六個功能熱區");
assert.deepEqual(menu.areas.map((a) => a.action.label), ["看產品", "購物車", "幫我推薦", "搭配組合", "怎麼使用", "直接下單"]);
for (const area of menu.areas) {
  assert.ok(area.bounds.width > 0 && area.bounds.height > 0, "Rich Menu功能熱區尺寸必須有效");
  assert.ok(area.bounds.x >= 0 && area.bounds.y >= 0, "Rich Menu功能熱區不得超出畫布左上界");
  assert.ok(area.bounds.x + area.bounds.width <= menu.size.width, "Rich Menu功能熱區不得超出畫布寬度");
  assert.ok(area.bounds.y + area.bounds.height <= menu.size.height, "Rich Menu功能熱區不得超出畫布高度");
}

assert.ok(String(visual.VERSION || "").includes("recording-ui"), "LINE Flex視覺層必須提供正式版本識別");
assert.equal(visual.PRODUCT_IMAGE_VERSION, photoVersion, "LINE Flex必須直接跟目前產品圖片快取版本同步");
for (const p of Object.values(visual.PRODUCTS)) assert.ok(p.image.includes("/images/products-v3/"));
assert.equal(visual.productHero("guilu-drink-30").aspectMode, "fit");

for (const token of [
  '/^(看產品|查看產品|看商品|產品|直接下單|直接購買|我要下單|立即下單|開始下單|我要買)$/',
  '/購物車|購買清單|查看購買清單/',
  '/搭配組合|食補搭配|產品搭配|組合怎麼搭|搭配方式/',
  '/^(怎麼使用|使用方式|食用方式|產品怎麼用)$/',
  '/^(幫我推薦|怎麼選|不知道怎麼選)$/',
]) assert.ok(serverSource.includes(token), `LINE意圖路由缺失：${token}`);
assert.ok(serverSource.includes('/^(申請試喝|我要試喝|試喝|試喝組|龜鹿飲試喝)$/'), "LINE試喝意圖路由缺失");
assert.ok(serverSource.includes('/^(價格方案|價格|售價|價錢|多少錢|優惠)$/'), "LINE價格方案意圖路由缺失");
assert.ok(serverSource.includes('res.json({ ok: true });'), "LINE webhook必須先快速回200");
assert.ok(serverSource.indexOf('res.json({ ok: true });') < serverSource.indexOf('Promise.allSettled((req.body.events || []).map(handleEvent))'), "LINE webhook 200必須早於事件處理");
for (const field of ["lastWebhookAt", "lastReplySuccessAt", "lastReplyError"]) assert.ok(serverSource.includes(field), `LINE health缺少${field}`);
assert.ok(serverSource.includes("DRINK_ORDER_NOTICE") && serverSource.includes("READY_STOCK_ORDER_NOTICE") && serverSource.includes("MIXED_ORDER_NOTICE"), "主程式必須包含產品別出貨邏輯");
assert.ok(syncSource.includes("AUTHORITY_PATH") && syncSource.includes("official-products.json"), "prestart必須讀目前產品權威檔");
assert.ok(!syncSource.includes("每塊約9.375g") && !syncSource.includes("每塊約18.75g"), "prestart不得再硬鎖退役每塊重量規格");
assert.ok(!syncSource.includes("每日早上及下午各一小匙"), "prestart不得再硬鎖早晚各一次舊用法");

assert.equal(packageJson.main, "server.js", "正式服務入口必須是LINE OA server.js");
assert.ok(packageJson.scripts.prestart.includes("sync_sales_master.js --write"), "Render prestart必須同步正式母本");
assert.ok(packageJson.scripts.prestart.includes("line-production-readiness.test.js"), "Render prestart必須執行正式 readiness");

console.log(`PASS：LINE OA readiness 依目前 ${authority.version} 權威與能力驗收：六項現行規格、龜鹿膏一天一次、30cc小玻璃罐、180cc鋁袋、products-v3原圖、試喝、交期、Webhook與六格Rich Menu一致；不再以舊延伸規格、舊用法或歷史版號誤擋。`);
