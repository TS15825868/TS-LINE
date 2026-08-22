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
const aiAnswers = JSON.parse(read("config/ai-commerce-answers.json"));
const serverSource = read("server.js");
const syncSource = read("tools/sync_sales_master_current.js");
const safetySource = read("line-image-safety.js");
const richSource = read("line-rich-menu-sync.js");
const richArtwork = rich.readArtwork();
const packageJson = JSON.parse(read("package.json"));
const must = (ok, msg) => { if (!ok) throw new Error(msg); };

const visibleIds = ["guilu-gao","guilu-drink-30","guilu-drink-180","guilu-tangkuai","guilu-jiao","luerong-fen"];
const qixuanId = "qixuan-guilu-drink-powder";

assert.equal(authority.authority, "user-confirmed-current");
assert.deepEqual(authority.knowledgeProductIds, visibleIds, "LINE可見文字知識必須只有六項正式產品");
assert.deepEqual(authority.websitePublicProductIds, visibleIds, "官網公開產品必須維持六項");
assert.deepEqual(authority.approvedMediaProductIds, visibleIds, "核准媒體產品必須維持六項");
assert.deepEqual(authority.temporarilyHiddenProductIds, [qixuanId], "柒玄茶必須維持暫時隱藏");
assert.equal(data.products.length, 6, "LINE產品卡必須維持六項");
assert.equal(data.runtime?.knowledgeProductCount, 6, "LINE runtime 可見知識數量必須為6");
assert.equal(data.runtime?.approvedMediaProductCount, 6);

const official = Object.fromEntries((authority.products || []).map((p) => [p.id, p]));
const byId = Object.fromEntries((data.products || []).map((p) => [p.id, p]));
const qixuan = official[qixuanId];
assert.equal(qixuan?.name, "柒玄茶・龜鹿調飲粉");
assert.equal(qixuan?.websiteVisible, false);
assert.equal(qixuan?.lineKnowledgeVisible, false);
assert.equal(qixuan?.publicVisible, false);
assert.equal(qixuan?.temporarilyHidden, true);
assert.equal(qixuan?.displayMode, "hidden-until-user-reactivates");
assert.ok(!authority.knowledgeProductIds.includes(qixuanId));
assert.ok(!photoAuthority.products?.[qixuanId], "柒玄茶隱藏期間不得建立產品圖權威");
assert.ok(!String(qixuan?.approvedProductImage || "").trim());
assert.ok(!String(qixuan?.approvedDm || "").trim());
assert.ok(!Array.isArray(qixuan?.ingredients), "未確認公開成分前不得自行建立柒玄茶成分");

// LINE 自然語言公開回答不得繞過產品可見性規則重新曝光柒玄茶。
assert.ok(Array.isArray(aiAnswers.answers) && aiAnswers.answers.length >= 5, "LINE AI公開答案權威缺失");
const allProductsAnswer = aiAnswers.answers.find((item) => item.id === "all-products");
assert.ok(allProductsAnswer, "LINE AI缺少 all-products 回答");
assert.match(String(allProductsAnswer.answer || ""), /六項/, "LINE AI產品總覽必須說明目前六項對外產品");
assert.ok(!String(allProductsAnswer.answer || "").includes("柒玄茶"), "LINE AI產品總覽不得公開柒玄茶");
for (const answer of aiAnswers.answers) {
  assert.ok(!String(answer.answer || "").includes("柒玄茶"), `${answer.id} 公開回答不得曝光柒玄茶`);
}
assert.ok((aiAnswers.rules || []).some((rule) => String(rule).includes("柒玄茶") && String(rule).includes("暫時隱藏")), "LINE AI內部規則必須保留柒玄茶隱藏政策");

const specs = {
  "guilu-gao":"100g／罐",
  "guilu-drink-30":"30cc／罐（小玻璃罐）",
  "guilu-drink-180":"180cc／包（鋁袋）",
  "guilu-tangkuai":"75g （2兩）／盒｜8塊裝",
  "guilu-jiao":"600g （1斤）／盒｜32塊裝",
  "luerong-fen":"75g／罐"
};
const prices = {
  "guilu-gao":1800,
  "guilu-drink-30":60,
  "guilu-drink-180":200,
  "guilu-tangkuai":1600,
  "guilu-jiao":9600,
  "luerong-fen":2000
};
for (const id of visibleIds) {
  assert.equal(official[id]?.specification, specs[id], `${id} authority規格`);
  assert.equal(byId[id]?.specification, specs[id], `${id} runtime規格`);
  assert.equal(Number(byId[id]?.price), prices[id], `${id}售價`);
  assert.deepEqual(byId[id]?.ingredients, official[id]?.ingredients, `${id}成分順序`);
  assert.equal(byId[id]?.image, official[id]?.approvedProductImage, `${id}產品主圖`);
  assert.equal(byId[id]?.dmImage, official[id]?.approvedDm, `${id}詳細DM`);
  assert.equal(byId[id]?.officialOriginalImage, photoAuthority.products?.[id], `${id}products-v3身份原圖`);
  assert.notEqual(byId[id]?.image, byId[id]?.dmImage, `${id}產品圖與DM不得混用`);
  must(String(byId[id]?.physicalScalePolicy || "").trim(), `${id}缺少產品比例政策`);
}

assert.equal(byId["guilu-drink-30"].usage?.[0], "每日 1–2 罐");
must(!/玻璃瓶|30cc／瓶|瓶裝|開瓶/.test(JSON.stringify(byId["guilu-drink-30"])), "30cc不得回退瓶型舊稱");
assert.equal(byId["guilu-drink-180"].usage?.[0], "每日一包");
assert.equal(byId["guilu-drink-30"].productionLeadTime, "5～7個工作天");
assert.equal(byId["guilu-drink-180"].productionLeadTime, "5～7個工作天");
for (const id of ["guilu-gao","guilu-tangkuai","guilu-jiao","luerong-fen"]) {
  assert.equal(byId[id].productionLeadTime, null, `${id}不得套用龜鹿飲交期`);
  assert.equal(byId[id].readyStock, true, `${id}必須維持備貨商品`);
}
assert.equal((byId["guilu-drink-30"].offers || []).find((o)=>o.label==="買10送1")?.total, 600);
assert.equal((byId["guilu-drink-180"].offers || []).find((o)=>o.label==="買10送1")?.total, 2000);

const trial = data.trialCampaign || {};
assert.equal(trial.contents, "30cc小玻璃罐×3罐");
assert.equal(Number(trial.productFee), 0);
assert.deepEqual((trial.shippingOptions || []).map((o)=>[o.id,Number(o.fee)]), [["store",60],["home",100]]);
assert.match(String(trial.fulfillmentRule || trial.leadTime || ""), /5～7/);
assert.ok(String(authority.trialPosterAuthority?.currentDisplay || "").includes("trial-poster-small-boss-official-v20260814.jpg"));
assert.equal(authority.trialPosterAuthority?.doNotRegenerate, true);

assert.equal(Object.keys(photoAuthority.products || {}).length, 6);
for (const url of Object.values(photoAuthority.products || {})) must(String(url).includes("/images/products-v3/"), "products-v3身份原圖權威錯誤");
assert.equal(formal.approval_batch, "20260814-product-modal-media-v3");
for (const [name,url] of Object.entries(formal.source_product_dm || {})) assert.ok(String(url).includes("/images/dm-final/"), `${name}正式DM來源必須是dm-final`);
for (const route of ["formal-product/:id.jpg","formal-dm/:id.jpg","formal-trial/trial.jpg"]) must(safetySource.includes(route), `缺少LINE正式媒體route：${route}`);
assert.equal(safety.normalizeProductPhotos(JSON.parse(read("data.json"))).runtime.productMainImageSource, "current-approved-product-image-line-compatible-jpeg");

for (const [id,item] of Object.entries(visual.PRODUCTS || {})) {
  assert.match(String(item.image || ""), new RegExp(`/assets/formal-product/${id}\\.jpg\\?v=`));
  assert.ok(String(item.original || "").includes("/images/products-v3/"));
}
assert.match(visual.TRIAL_IMAGE, /\/assets\/formal-trial\/trial\.jpg\?v=/);

assert.equal(rich.SINGLE_IMAGE_ONLY, true);
assert.equal(rich.RUNTIME_COMPOSITE_FORBIDDEN, true);
assert.equal(rich.LEGACY_BASE_TEMPLATE_FORBIDDEN, true);
assert.ok(!richSource.includes(".composite("));
assert.ok(!/<image\b/i.test(richArtwork));
assert.ok(!/<text\b/i.test(richArtwork));
const menu = rich.menuDefinition();
assert.equal(menu.areas.length, 6);
assert.deepEqual(menu.areas.map((a)=>a.action.text), ["看產品","查看購買清單","幫我推薦","搭配組合","怎麼使用","直接下單"]);

for (const token of ["申請試喝","價格方案","搭配組合","怎麼使用","幫我推薦","查看購買清單","直接下單","我要人工客服"]) must(serverSource.includes(token), `LINE功能入口缺失：${token}`);
assert.ok(syncSource.includes("public-product-master.json"));
assert.ok(syncSource.includes("QIXUAN_HIDDEN"), "同步程式必須保留柒玄茶隱藏規則");
assert.ok(syncSource.includes("knowledgeProductCount:6"), "同步程式不得再回寫7項LINE可見知識");
assert.ok(!syncSource.includes("LINE 7 text knowledge products"), "同步程式不得保留舊7項成功訊息");
assert.equal(packageJson.main, "server.js");
assert.equal(packageJson.scripts.start, "node -r ./product-sales-master.js -r ./line-app-bootstrap.js -r ./brand-content-runtime.js server.js");
assert.ok(packageJson.scripts.prestart.includes("sync_sales_master_current.js --write"));

for (const retired of [".github/workflows/line-closeout-status-once.yml",".github/workflows/one-time-update-drink-pricing-20260806.yml",".github/workflows/sync-formal-line-media.yml",".github/workflows/sync-social-content-v20260817.yml","tools/sync-formal-line-media.py"]) {
  assert.equal(fs.existsSync(path.join(__dirname,retired)), false, `退役同步仍存在：${retired}`);
}

console.log(`PASS：LINE OA readiness依 ${authority.version} 驗收；六項正式產品可見，柒玄茶維持內部資料但暫時隱藏，公開AI回答不曝光柒玄茶。`);
