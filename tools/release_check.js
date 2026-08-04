"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const exists = (file) => fs.existsSync(path.join(root, file));
const json = (file) => JSON.parse(read(file));
const decode = (file) => zlib.gunzipSync(Buffer.from(read(file).replace(/\s+/g, ""), "base64")).toString("utf8");

const required = [
  "server.js",
  "internal-entry.js",
  "internal-app-client-fix.js",
  "internal-social-site.js",
  "internal-social-site/index.html.gz.b64",
  "internal-social-site/site.css.gz.b64",
  "internal-social-site/site.js.gz.b64",
  "social-server.js",
  "social-final-posts.js",
  "social-final-approved-batch.js",
  "social-review-only-mode.js",
  "social-weekly-schedule-override.js",
  "social-schedule-policy.js",
  "social-schedule-repair-20260722.js",
  "social-static-asset-bridge.js",
  "social-publish-guard.js",
  "product-sales-master.js",
  "product-quote-only-guard.js",
  "brand-content.json",
  "brand-content-runtime.js",
  "line-sales-master.json",
  "MASCOT_CHARACTER_SPEC.md",
  "supabase-state-bridge.js",
  "persistence-auto-save.js",
];
for (const file of required) assert(exists(file), `缺少正式檔案：${file}`);

const data = json("data.json");
const pkg = json("package.json");
const lock = json("package-lock.json");
const sales = json("line-sales-master.json");
const brand = json("brand-content.json");
const weekly = require("../social-weekly-schedule-override");
const reviewGate = require("../social-review-only-mode");
const schedulePolicy = require("../social-schedule-policy");
const finalPosts = require("../social-final-posts");
const quoteGuard = require("../product-quote-only-guard");

assert.equal(data.lineId, "@762jybnm");
assert.match(String(data.catalogVersion || ""), /^\d+(?:\.\d+)+$/, "網站目錄版本格式錯誤");
assert.equal(data.products.length, 6, "公開產品應為六項正式產品");
assert.equal(lock.version, pkg.version, "package-lock 版本未同步");
assert.equal(lock.packages?.[""]?.version, pkg.version, "package-lock 根套件版本未同步");
assert.match(String(sales.version || ""), /^2026-08-04-v14-buy10get1$/, "LINE 正式售價母本版本錯誤");

const expected = {
  "guilu-gao": { price: 1800, originalPrice: 2100, promotionalPrice: 1800 },
  "guilu-drink-30": {
    price: 50,
    offer: "買10送1",
    qty: 11,
    total: 500,
    name: "龜鹿飲30cc玻璃罐",
    specification: "30cc／罐（小玻璃罐）",
    unit: "罐",
  },
  "guilu-drink-180": {
    price: 200,
    offer: "買10送1",
    qty: 11,
    total: 2000,
    name: "龜鹿飲180cc鋁袋",
    specification: "180cc／包（鋁袋）",
    unit: "包",
  },
  "guilu-tangkuai": {
    price: 1600,
    name: "龜鹿湯塊75g",
    specification: "75g／盒｜8塊裝｜每塊約9.375g",
    unit: "盒",
  },
  "luerong-fen": { price: 2000 },
  "guilu-jiao": {
    price: 9600,
    originalPrice: 12000,
    quoteOnly: false,
    name: "龜鹿膠",
    specification: "600g／盒（1斤）｜32塊裝｜每塊約18.75g",
    unit: "盒",
  },
};

for (const [id, rule] of Object.entries(expected)) {
  const product = sales.products?.[id];
  assert(product, `缺少正式產品：${id}`);
  assert.equal(Number(product.price), rule.price, `${id} 售價錯誤`);
  if (rule.originalPrice !== undefined) assert.equal(Number(product.originalPrice), rule.originalPrice, `${id} 原價錯誤`);
  if (rule.promotionalPrice !== undefined) assert.equal(Number(product.promotionalPrice), rule.promotionalPrice, `${id} 優惠價錯誤`);
  if (rule.offer) {
    assert(product.offers?.includes(rule.offer), `${id} 優惠文字錯誤`);
    assert.equal(Number(product.offer?.qty), rule.qty, `${id} 優惠數量錯誤`);
    assert.equal(Number(product.offer?.total), rule.total, `${id} 優惠總價錯誤`);
  }
  if (rule.quoteOnly !== undefined) assert.equal(product.quoteOnly, rule.quoteOnly, `${id} 下單模式錯誤`);
  if (rule.name !== undefined) assert.equal(product.name, rule.name, `${id} 名稱錯誤`);
  if (rule.specification !== undefined) assert.equal(product.specification, rule.specification, `${id} 規格錯誤`);
  if (rule.unit !== undefined) assert.equal(product.unit, rule.unit, `${id} 單位錯誤`);
}

const jiao = sales.products["guilu-jiao"];
assert.equal(jiao.size, jiao.specification, "龜鹿膠 size 必須同步完整正式規格");
assert.equal(jiao.spec, jiao.specification, "龜鹿膠 spec 必須同步完整正式規格");
assert.equal(jiao.priceText, "$9,600 / 盒", "龜鹿膠價格單位必須使用盒");

const trial = sales.trialCampaign;
assert(trial, "缺少長期試喝活動");
assert.equal(trial.contents, "30cc小玻璃罐×3罐");
assert.equal(Number(trial.productFee), 0);
assert.equal(trial.active, true);
assert.equal(trial.evergreen, true);
assert.match(String(trial.fulfillmentRule || ""), /製作加工約需5～7個工作天/);
assert.match(String(trial.fulfillmentRule || ""), /完成後才安排出貨/);
assert.match(String(trial.leadTimeDefinition || ""), /不包含完成後的物流配送時間/);

assert.equal(sales.comboOffers?.length, 3);
assert.equal(sales.combos?.length, 3);
assert.deepEqual(sales.imagePolicy?.partners, ["小鹿娃娃", "小烏龜娃娃"]);
assert.equal(sales.imagePolicy?.realProductImagesOnly, true);
assert.equal(sales.imagePolicy?.noProductRedraw, true);
assert.equal(sales.imagePolicy?.approvalRequiredBeforePublish, true);

for (const label of ["品牌故事", "品牌由來", "選料理念", "品質把關", "傳統工法", "品牌承諾"]) {
  assert.equal(typeof brand.quickReplies?.[label], "string", `品牌內容缺少：${label}`);
  assert(brand.quickReplies[label].trim().length >= 20, `品牌內容過短：${label}`);
}
assert.equal(brand.brand, "仙加味");
assert.equal(brand.tagline, "補養，是一種節奏。");
assert(Array.isArray(brand.menu) && brand.menu.length >= 5, "品牌導覽不足");
assert(read("brand-content-runtime.js").includes("content.quickReplies"), "LINE 尚未載入目前品牌內容格式");

const start = String(pkg.scripts?.start || "");
for (const file of [
  "product-sales-master.js",
  "brand-content-runtime.js",
  "product-quote-only-guard.js",
  "social-weekly-schedule-override.js",
  "social-review-only-mode.js",
  "social-static-asset-bridge.js",
]) assert(start.includes(file), `正式啟動缺少：${file}`);
assert(start.indexOf("product-sales-master.js") < start.indexOf("product-quote-only-guard.js"), "售價主檔載入順序錯誤");
assert(!start.includes("social-incomplete-auto-retry.js"), "不可載入失敗平台自動補發模組");

assert.equal(typeof weekly.VERSION, "string");
assert.equal(typeof reviewGate.VERSION, "string");
assert.equal(typeof schedulePolicy.validScheduledAt, "function");
const posts = finalPosts.POSTS;
assert.equal(posts.length, 10);
for (const field of ["id", "title", "instagramCaption", "facebookCaption", "imageName"]) {
  assert.equal(new Set(posts.map((post) => post[field])).size, 10, `貼文 ${field} 不可重複`);
}
assert(posts.every((post) => post.qBossMascotLocked && post.deerPartnerPresent && post.turtlePartnerPresent), "小老闆固定夥伴規格不完整");
const fixed = posts.filter((post) => !post.conditionalWeather);
const weather = posts.filter((post) => post.conditionalWeather);
assert.equal(fixed.length, 7);
assert.equal(weather.length, 3);
assert(weather.every((post) => !post.scheduledAt && post.automationStandby === true), "天氣貼文不可預排");
for (const post of fixed) assert(schedulePolicy.validScheduledAt(post.scheduledAt, post), `${post.title} 固定建議時段錯誤`);

assert.equal(typeof quoteGuard.VERSION, "string");
assert(quoteGuard.transformServer(read("server.js")).includes("if (product.quoteOnly) return false"));
const html = decode("internal-social-site/index.html.gz.b64");
const css = decode("internal-social-site/site.css.gz.b64");
const js = decode("internal-social-site/site.js.gz.b64");
assert(html.includes("社群管理中心") && html.includes('id="imageFile"'));
assert(css.includes(".post-card"));
assert(js.includes("/internal/api/v2/social/upload"));
assert(!js.includes("MutationObserver"));
assert(read("social-static-asset-bridge.js").includes("NotoSansTC-VF.ttf"));
assert(read("social-static-asset-bridge.js").includes("preventsGibberish: true"));
assert(read("social-publish-guard.js").includes("withPostLock"));
assert(read("social-publish-guard.js").includes("recordPublication"));

const serialized = JSON.stringify({ data, sales });
for (const legacy of ["買10送2", "共12罐500元", "共12包2,000元", "30cc／瓶（小玻璃瓶）", "約5～7個工作天出貨"]) {
  assert(!serialized.includes(legacy), `正式資料仍含舊內容：${legacy}`);
}

console.log(`PASS 仙加味正式檢查：LINE OA ${pkg.version}、網站目錄 ${data.catalogVersion}、六項售價、買10送1、30cc玻璃罐、試喝、人工審核、防重複與社群排程安全均通過。`);
