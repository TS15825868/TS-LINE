"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { applyMaster, getCurrentAuthority, getPhotoAuthority } = require("./product-sales-master");
const rich = require("./line-rich-menu-sync");
const visual = require("./line-recording-ui-fix");
const safety = require("./line-image-safety");
const formal = require("./formal-media-authority-v20260810.json");

const read = (file) => fs.readFileSync(path.join(__dirname, file), "utf8");
const data = applyMaster(JSON.parse(read("data.json")));
const authority = getCurrentAuthority();
const photoAuthority = getPhotoAuthority();
const serverSource = read("server.js");
const syncSource = read("tools/sync_sales_master_current.js");
const safetySource = read("line-image-safety.js");
const richSource = read("line-rich-menu-sync.js");
const richArtwork = rich.readArtwork();
const packageJson = JSON.parse(read("package.json"));
const guardMode = fs.existsSync(path.join(__dirname,"guard-mode.json")) ? JSON.parse(read("guard-mode.json")) : {};
const must = (ok,msg) => { if(!ok) throw new Error(msg); };

assert.equal(authority.authority, "user-confirmed-current");
assert.equal((authority.products || []).length, 6);
assert.equal(data.products.length, 6);
const byId = Object.fromEntries(data.products.map(p => [p.id,p]));
const official = Object.fromEntries(authority.products.map(p => [p.id,p]));
const specs = {
  "guilu-gao":"100g／罐",
  "guilu-drink-30":"30cc／罐（小玻璃罐）",
  "guilu-drink-180":"180cc／包（鋁袋）",
  "guilu-tangkuai":"75g （2兩）／盒｜8塊裝",
  "guilu-jiao":"600g （1斤）／盒｜32塊裝",
  "luerong-fen":"75g／罐",
};
const prices = {
  "guilu-gao":1800,
  "guilu-drink-30":60,
  "guilu-drink-180":200,
  "guilu-tangkuai":1600,
  "guilu-jiao":9600,
  "luerong-fen":2000,
};

for (const [id,spec] of Object.entries(specs)) {
  assert.equal(official[id]?.specification, spec, `${id} authority主規格`);
  assert.equal(byId[id]?.name, official[id]?.name, `${id}名稱`);
  assert.equal(byId[id]?.specification, spec, `${id} runtime主規格`);
  assert.deepEqual(byId[id]?.ingredients, official[id]?.ingredients, `${id}成分順序`);
  assert.equal(Number(byId[id]?.price), prices[id], `${id}售價`);
  assert.equal(byId[id]?.image, official[id]?.approvedProductImage, `${id}顧客產品主圖`);
  assert.equal(byId[id]?.dmImage, official[id]?.approvedDm, `${id}詳細DM`);
  assert.equal(byId[id]?.officialOriginalImage, photoAuthority.products?.[id], `${id}products-v3身份原圖`);
  assert.notEqual(byId[id]?.image, byId[id]?.dmImage, `${id}產品主圖不得等於DM`);
  must(String(byId[id]?.physicalScalePolicy || "").trim(), `${id}缺少尺寸比例政策`);
}

assert.equal(byId["guilu-gao"].usage?.[0], "食用時間可依個人使用習慣與作息時間安排");
must(!(byId["guilu-gao"].usage || []).some(line => /一天一次一小匙|早晚各一小匙|每日早上及下午各一小匙/.test(String(line))), "龜鹿膏不得回退舊固定時段用法");
assert.equal(byId["guilu-drink-30"].usage?.[0], "每日 1-2罐");
must((byId["guilu-drink-30"].usage || []).some(line => String(line).includes("飲用時間可依個人使用習慣與作息時間安排")), "30cc必須保留個人作息時間原則");
assert.equal(byId["guilu-drink-180"].usage?.[0], "每日一包");
must((byId["guilu-drink-180"].usage || []).some(line => String(line).includes("飲用時間可依個人使用習慣與作息時間安排")), "180cc必須保留每日一包並取消固定白天時段");
assert.equal(official["guilu-tangkuai"].detailUnitApprox, "每塊約9.375g");
must(String(official["guilu-tangkuai"].detailUnitRule || "").includes("可顯示完整規格"), "湯塊約重必須只在詳細資料");
assert.equal(official["guilu-jiao"].detailUnitApprox, "每塊約18.75 g");
must(String(official["guilu-jiao"].detailUnitRule || "").includes("可顯示完整規格"), "龜鹿膠約重必須只在詳細資料");
must(!/玻璃瓶|30cc／瓶|瓶裝/.test(JSON.stringify(byId["guilu-drink-30"])), "30cc不得稱瓶");
assert.match(String(byId["guilu-drink-30"].physicalScalePolicy || ""), /Ø42.*H51|小玻璃裸罐/i);
assert.match(String(byId["guilu-drink-180"].physicalScalePolicy || ""), /0\.60.*0\.68|狹長直立鋁袋/i);
assert.equal(byId["guilu-drink-30"].productionLeadTime, "5～7個工作天");
assert.equal(byId["guilu-drink-180"].productionLeadTime, "5～7個工作天");
for (const id of ["guilu-gao","guilu-tangkuai","guilu-jiao","luerong-fen"]) {
  assert.equal(byId[id].productionLeadTime, null, `${id}不得套用龜鹿飲交期`);
  assert.equal(byId[id].readyStock, true, `${id}必須維持備貨商品`);
}
assert.equal((byId["guilu-drink-30"].offers || []).find(o=>o.label==='買10送1')?.total,600);
assert.equal((byId["guilu-drink-180"].offers || []).find(o=>o.label==='買10送1')?.total,2000);

const trial = data.trialCampaign || {};
assert.equal(trial.contents,"30cc小玻璃罐×3罐");
assert.equal(Number(trial.productFee),0);
assert.deepEqual((trial.shippingOptions || []).map(o=>[o.id,Number(o.fee)]),[["store",60],["home",100]]);
assert.match(String(trial.fulfillmentRule || trial.leadTime || ""),/5～7/);
assert.ok(String(authority.trialPosterAuthority?.currentDisplay || "").includes("trial-poster-small-boss-official-v20260814.jpg"));
assert.equal(authority.trialPosterAuthority?.doNotRegenerate,true);

assert.match(String(photoAuthority.version || ""),/products-v3/i);
assert.equal(Object.keys(photoAuthority.products || {}).length,6);
for (const url of Object.values(photoAuthority.products || {})) must(String(url).includes('/images/products-v3/'), 'products-v3身份原圖權威錯誤');

assert.match(String(formal.runtime || ""),/current|20260814/i);
assert.equal(formal.approval_batch,"20260814-product-modal-media-v3");
assert.ok(String(formal.source_trial || "").includes("trial-poster-small-boss-official-v20260814.jpg"));
assert.ok(String(formal.source_product_dm?.["龜鹿飲30cc玻璃罐"] || "").includes("02_guilu-drink-30cc-dm-official-v20260814.jpg"));
for (const route of ['formal-product/:id.jpg','formal-dm/:id.jpg','formal-trial/trial.jpg']) must(safetySource.includes(route),`缺少LINE正式媒體route：${route}`);
assert.equal(safety.normalizeProductPhotos(JSON.parse(read("data.json"))).runtime.productMainImageSource,"current-approved-product-image-line-compatible-jpeg");

assert.match(String(visual.VERSION || ""),/recording-ui/i);
for (const [id,item] of Object.entries(visual.PRODUCTS || {})) {
  assert.match(String(item.image || ""),new RegExp(`/assets/formal-product/${id}\\.jpg\\?v=`));
  assert.ok(String(item.original || "").includes("/images/products-v3/"));
}
assert.match(visual.TRIAL_IMAGE,/\/assets\/formal-trial\/trial\.jpg\?v=/);
assert.equal(visual.productHero("guilu-drink-30").aspectMode,"fit");

assert.match(String(rich.VERSION || ""),/rich-menu/i);
assert.equal(rich.SINGLE_IMAGE_ONLY,true);
assert.equal(rich.RUNTIME_COMPOSITE_FORBIDDEN,true);
assert.equal(rich.LEGACY_BASE_TEMPLATE_FORBIDDEN,true);
assert.ok(!richSource.includes(".composite("));
assert.ok(!/<image\b/i.test(richArtwork));
assert.ok(!/<text\b/i.test(richArtwork));
const menu = rich.menuDefinition();
assert.equal(menu.areas.length,6);
assert.deepEqual(menu.areas.map(a=>a.action.text),["看產品","查看購買清單","幫我推薦","搭配組合","怎麼使用","直接下單"]);

for (const token of ["申請試喝","價格方案","搭配組合","怎麼使用","幫我推薦","查看購買清單","直接下單","我要人工客服"]) must(serverSource.includes(token),`LINE功能入口缺失：${token}`);
assert.ok(serverSource.includes('res.json({ ok: true });'));
assert.ok(serverSource.indexOf('res.json({ ok: true });') < serverSource.indexOf('Promise.allSettled((req.body.events || []).map(handleEvent))'));

assert.ok(syncSource.includes("official-products.json"));
assert.ok(syncSource.includes("assertCurrent"));
assert.equal(packageJson.main,"server.js");
assert.equal(packageJson.scripts.start,"node -r ./product-sales-master.js -r ./line-app-bootstrap.js -r ./brand-content-runtime.js server.js");
assert.ok(packageJson.scripts.prestart.includes("sync_sales_master_current.js --write"));
for(const test of ["line-health-authority.test.js","line-true-original-readiness.test.js","line-production-readiness.test.js","line-formal-media-route.test.js","line-products-v3-authority.test.js","line-rich-menu-sync.test.js","line-direct-start-safety.test.js","line-mascot-authority.test.js"]) assert.ok(String(packageJson.scripts["guard:full"] || "").includes(test),`guard:full缺少：${test}`);
if (guardMode.mode === "paused_for_full_system_update") assert.equal(guardMode.blocking_runtime_guards,false);

for (const retired of [".github/workflows/line-closeout-status-once.yml",".github/workflows/one-time-update-drink-pricing-20260806.yml",".github/workflows/sync-formal-line-media.yml","tools/sync-formal-line-media.py"]) assert.equal(fs.existsSync(path.join(__dirname,retired)),false,`退役同步仍存在：${retired}`);

console.log(`PASS：LINE OA readiness依 ${authority.version} 目前權威驗收：六項產品、使用時間個人化、30cc每日 1-2罐、180cc每日一包、媒體角色、8/14試喝、價格、交期、Webhook、Rich Menu與守門員均一致。`);
