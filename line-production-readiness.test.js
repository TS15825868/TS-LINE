"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { applyMaster, getCurrentAuthority, getPhotoAuthority } = require("./product-sales-master");
const rich = require("./line-rich-menu-sync");
const visual = require("./line-recording-ui-fix");
const formal = require("./formal-media-authority-v20260810.json");

const read = (file) => fs.readFileSync(path.join(__dirname, file), "utf8");
const rawDataText = read("data.json");
const data = applyMaster(JSON.parse(rawDataText));
const authority = getCurrentAuthority();
const photoAuthority = getPhotoAuthority();
const serverSource = read("server.js");
const syncSource = read("tools/sync_sales_master.js");
const safetySource = read("line-image-safety.js");
const richSource = read("line-rich-menu-sync.js");
const richArtwork = rich.readArtwork();
const packageJson = JSON.parse(read("package.json"));
const guardMode = fs.existsSync(path.join(__dirname,"guard-mode.json")) ? JSON.parse(read("guard-mode.json")) : {};

assert.equal(authority.authority, "user-confirmed-current", "LINE產品權威必須明確是目前使用者確認資料");
assert.equal((authority.products || []).length, 6, "LINE目前產品權威必須維持六項");
assert.equal(data.products.length, 6, "LINE runtime正式產品必須維持六項");
assert.ok(!rawDataText.includes("/images/products-v2/"), "LINE原始data.json不得保存products-v2正式圖");

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

const photoEntries = Object.entries(photoAuthority.products || {});
assert.equal(photoEntries.length, 6, "products-v3產品識別權威必須維持六項");
assert.match(String(photoAuthority.version || ""), /products-v3/i, "產品圖片權威必須維持products-v3系列");
assert.ok(!/products-v2/i.test(String(photoAuthority.version || "")), "產品圖片權威不得回退products-v2");
for (const [id,url] of photoEntries) {
  const value=String(url||"");
  assert.ok(value.includes("/images/products-v3/"), `${id}產品識別圖不得離開products-v3`);
  assert.ok(!value.includes("/images/products-v2/"), `${id}產品識別圖不得回退products-v2`);
}

for (const [id, spec] of Object.entries(expectedSpecs)) {
  const p = byId[id];
  const official = authorityById[id];
  const priceRule = expectedPrices[id];
  assert.ok(p && official, `${id}不存在`);
  assert.equal(official.specification, spec, `${id} authority規格不同步`);
  assert.equal(p.name, official.name, `${id} runtime名稱不同步`);
  assert.equal(p.specification, spec, `${id}.specification不同步`);
  assert.equal(p.size, spec, `${id}.size不同步`);
  assert.equal(p.spec, spec, `${id}.spec不同步`);
  assert.deepEqual(p.ingredients, official.ingredients, `${id}正式成分／順序不同步`);
  assert.equal(Number(p.price), priceRule.price, `${id}正式售價不同步`);
  if (priceRule.originalPrice !== undefined) assert.equal(Number(p.originalPrice), priceRule.originalPrice, `${id}正式原價不同步`);
  if (priceRule.offerQty) {
    const offer=(p.offers||[]).find(o=>Number(o.qty)===priceRule.offerQty&&o.label==="買10送1");
    assert.ok(offer, `${id}缺少買10送1`);
    assert.equal(Number(offer.total), priceRule.offerTotal, `${id}買10送1總額不同步`);
  }
  for (const field of ["image","imageUrl","image_url","dmImage","officialOriginalImage"]) {
    const url=String(p[field]||"");
    assert.ok(url.includes("/images/products-v3/"), `${id}.${field}母資料產品識別必須維持products-v3`);
    assert.ok(!url.includes("/images/products-v2/"), `${id}.${field}不得回退products-v2`);
  }
  assert.ok(String(p.physicalScalePolicy || "").trim(), `${id}缺少個別產品尺寸／比例政策`);
}

assert.equal(authorityById["guilu-gao"].usagePrimary, "一天一次一小匙");
assert.equal(byId["guilu-gao"].usage?.[0], "一天一次一小匙", "龜鹿膏目前主要使用方式不同步");
assert.ok(!(byId["guilu-gao"].usage || []).some(line=>/早上.*下午|早晚各/.test(String(line))), "龜鹿膏runtime不得回退退役用法");
assert.ok(!/每塊約\s*9\.375g/.test(JSON.stringify(byId["guilu-tangkuai"])), "龜鹿湯塊不得硬帶退役每塊重量");
assert.ok(!/1斤|每塊約\s*18\.75g/.test(JSON.stringify(byId["guilu-jiao"])), "龜鹿膠不得硬帶退役延伸規格");
assert.ok(!/玻璃瓶|30cc／瓶|瓶裝/.test(JSON.stringify(byId["guilu-drink-30"])), "30cc不得稱瓶");
assert.match(String(byId["guilu-drink-30"].physicalScalePolicy||""), /Ø42.*H51|小玻璃裸罐/i);
assert.match(String(byId["guilu-drink-180"].physicalScalePolicy||""), /0\.60.*0\.68|狹長直立鋁袋/i);

assert.equal(byId["guilu-drink-30"].productionLeadTime, "5～7個工作天");
assert.equal(byId["guilu-drink-180"].productionLeadTime, "5～7個工作天");
for (const id of ["guilu-gao","guilu-tangkuai","guilu-jiao","luerong-fen"]) {
  assert.equal(byId[id].productionLeadTime, null, `${id}不得套用龜鹿飲交期`);
  assert.equal(byId[id].readyStock, true, `${id}必須維持備貨商品狀態`);
}

const trial=data.trialCampaign||{};
assert.equal(trial.contents, "30cc小玻璃罐×3罐", "試喝內容必須是30cc小玻璃罐×3罐");
assert.equal(Number(trial.productFee), 0, "試喝品必須免費");
assert.deepEqual((trial.shippingOptions||[]).map(o=>[o.id,Number(o.fee)]), [["store",60],["home",100]], "試喝運費必須是7-11 60元／郵局100元");
assert.match(String(trial.fulfillmentRule||trial.leadTime||""), /5～7/, "試喝交期必須維持5～7工作天");
assert.ok(serverSource.includes("trialShippingOptions()"), "試喝運費必須從正式資料讀取");

assert.match(String(formal.runtime||""), /current/i, "正式媒體runtime必須跟目前authority");
assert.equal(formal.approval_batch, "current-user-approved-media");
assert.ok(String(formal.source_trial||"").includes("guilu-drink-trial.webp"), "試喝正式海報來源不同步");
assert.ok(String(formal.source_product_dm?.["龜鹿飲30cc玻璃罐"]||"").includes("guilu-drink-30cc.webp"), "30cc正式DM來源不同步");
for(const key of ["龜鹿膏","龜鹿飲180cc鋁袋","龜鹿湯塊","龜鹿膠","鹿茸粉"]) assert.match(String(formal.source_product_dm?.[key]||""), /\/images\/dm-final\/.*\.jpg\?v=current$/, `${key}正式媒體來源未跟目前網站有效二進位同步`);
assert.ok(safetySource.includes('app.get("/assets/formal-dm/:id.jpg"'), "LINE runtime缺少正式DM route");
assert.ok(safetySource.includes('fit: "inside"')&&safetySource.includes('withoutEnlargement: true'), "LINE正式媒體轉換必須等比例、不裁切、不不必要放大");
assert.ok(safetySource.includes('FORMAL_MEDIA_VERSION = "current-formal-media"'), "LINE媒體runtime不得再鎖歷史批次版號");

assert.match(String(rich.VERSION||""), /rich-menu/i, "Rich Menu缺少能力版本識別");
assert.equal(rich.SINGLE_IMAGE_ONLY,true);
assert.equal(rich.RUNTIME_COMPOSITE_FORBIDDEN,true);
assert.equal(rich.LEGACY_BASE_TEMPLATE_FORBIDDEN,true);
assert.match(String(rich.STATIC_ARTWORK||""), /^assets\/rich-menu\/.*\.svg(?:\.gz\.b64)?$/);
assert.ok(!richSource.includes(".composite("), "Rich Menu不得runtime拼貼");
assert.ok(!/<image\b/i.test(richArtwork), "Rich Menu不得內嵌舊照片底圖");
assert.ok(!/<text\b/i.test(richArtwork), "Rich Menu繁中不得依賴主機字型");
for (const label of ["仙加味","看產品","購物車","幫我推薦","搭配組合","怎麼使用","直接下單"]) assert.ok(richArtwork.includes(label), `Rich Menu母稿缺少：${label}`);
const menu=rich.menuDefinition();
assert.equal(menu.areas.length,6,"Rich Menu必須維持六格");
for(const area of menu.areas){
  assert.ok(area.bounds.width>0&&area.bounds.height>0);
  assert.ok(area.bounds.x>=0&&area.bounds.y>=0);
  assert.ok(area.bounds.x+area.bounds.width<=menu.size.width);
  assert.ok(area.bounds.y+area.bounds.height<=menu.size.height);
}

assert.match(String(visual.VERSION||""), /recording-ui/i, "LINE Flex視覺層缺少能力識別");
for (const p of Object.values(visual.PRODUCTS||{})) assert.ok(String(p.image||"").includes("/images/products-v3/"), "LINE Flex產品圖必須維持products-v3識別");
assert.equal(visual.productHero("guilu-drink-30").aspectMode,"fit","30cc Flex必須fit不可裁切");

for (const token of [
  '/^(看產品|查看產品|看商品|產品|直接下單|直接購買|我要下單|立即下單|開始下單|我要買)$/',
  '/購物車|購買清單|查看購買清單/',
  '/搭配組合|食補搭配|產品搭配|組合怎麼搭|搭配方式/',
  '/^(怎麼使用|使用方式|食用方式|產品怎麼用)$/',
  '/^(幫我推薦|怎麼選|不知道怎麼選)$/',
  '/^(申請試喝|我要試喝|試喝|試喝組|龜鹿飲試喝)$/',
  '/^(價格方案|價格|售價|價錢|多少錢|優惠)$/'
]) assert.ok(serverSource.includes(token), `LINE意圖路由缺失：${token}`);
assert.ok(serverSource.includes('res.json({ ok: true });'), "LINE webhook必須先快速回200");
assert.ok(serverSource.indexOf('res.json({ ok: true });') < serverSource.indexOf('Promise.allSettled((req.body.events || []).map(handleEvent))'), "LINE webhook 200必須早於事件處理");
for (const field of ["lastWebhookAt","lastReplySuccessAt","lastReplyError"]) assert.ok(serverSource.includes(field), `LINE health缺少${field}`);

assert.ok(syncSource.includes("AUTHORITY_PATH")&&syncSource.includes("official-products.json"), "catalog同步必須讀目前產品authority");
assert.ok(syncSource.includes("getCurrentAuthority")&&syncSource.includes("authorityById"), "catalog同步必須動態驗目前規格／用法");
assert.equal(packageJson.main,"server.js","正式服務入口必須是server.js");
assert.ok(packageJson.scripts.prestart.includes("sync_sales_master.js --write"), "Render prestart至少必須同步目前母本");
assert.ok(packageJson.scripts.prestart.includes("node --check")&&!packageJson.scripts.prestart.includes("line-production-readiness.test.js"), "更新維護模式的prestart只保留同步與語法安全，不應重新啟用阻擋式完整守門");
for(const test of ["line-health-authority.test.js","line-true-original-readiness.test.js","line-production-readiness.test.js","line-formal-media-route.test.js","line-products-v3-authority.test.js","line-rich-menu-sync.test.js","line-direct-start-safety.test.js","line-mascot-authority.test.js"]) assert.ok(String(packageJson.scripts["guard:full"]||"").includes(test), `guard:full缺少目前能力守門：${test}`);
if(guardMode.mode==='paused_for_full_system_update') assert.equal(guardMode.blocking_runtime_guards,false,"維護模式必須保持阻擋守門關閉直到使用者確認");

console.log(`PASS：LINE OA readiness依目前 ${authority.version} authority與實際能力驗收：六項規格／成分／價格、產品比例、products-v3識別、目前核准正式媒體、試喝、交期、Webhook、六格Rich Menu與完整guard:full均一致；維護期間prestart只保留最低安全，不綁舊版號。`);
