"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const exists = (file) => fs.existsSync(path.join(root, file));
const decodeBundle = (file) => zlib.gunzipSync(Buffer.from(read(file).replace(/\s+/g, ""), "base64")).toString("utf8");

const data = JSON.parse(read("data.json"));
const pkg = JSON.parse(read("package.json"));
const lock = JSON.parse(read("package-lock.json"));
const sales = JSON.parse(read("line-sales-master.json"));
const brand = JSON.parse(read("brand-content.json"));
const weekly = require("../social-weekly-schedule-override");
const reviewGate = require("../social-review-only-mode");
const scheduleRepair = require("../social-schedule-repair-20260722");
const schedulePolicy = require("../social-schedule-policy");
const finalPosts = require("../social-final-posts");
const approvedBatch = require("../social-final-approved-batch");
const quoteOnlyGuard = require("../product-quote-only-guard");

const required = [
  "server.js",
  "internal-entry.js",
  "internal-app-client-fix.js",
  "internal-social-site.js",
  "internal-social-site/index.html.gz.b64",
  "internal-social-site/site.css.gz.b64",
  "internal-social-site/site.js.gz.b64",
  "social-static-asset-bridge.js",
  "social-server.js",
  "social-weekly-schedule-override.js",
  "social-review-only-mode.js",
  "social-current-policy.test.js",
  "social-publish-guard.js",
  "social-final-posts.js",
  "social-final-approved-batch.js",
  "social-schedule-policy.js",
  "social-schedule-repair-20260722.js",
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

assert.strictEqual(data.lineId, "@762jybnm");
assert.strictEqual(data.catalogVersion, "408.9");
assert.strictEqual(data.products.length, 6);
assert.strictEqual(pkg.version, "6.1.1");
assert.strictEqual(lock.version, pkg.version);
assert.strictEqual(lock.packages?.[""]?.version, pkg.version);

assert.strictEqual(sales.version, "2026-07-27-v5");
const expectedProducts = {
  "guilu-gao": { price: 1500, originalPrice: 1800 },
  "guilu-drink-30": { price: 50, offer: "買10送2" },
  "guilu-drink-180": { price: 200, offer: "買10送2" },
  "guilu-tangkuai": { price: 1600 },
  "luerong-fen": { price: 2000 },
  "guilu-jiao": { price: 9600, originalPrice: 12000, quoteOnly: false },
};
for (const [id, expected] of Object.entries(expectedProducts)) {
  const product = sales.products?.[id];
  assert(product, `正式售價主檔缺少產品：${id}`);
  assert.strictEqual(Number(product.price), expected.price, `${id} 正式售價錯誤`);
  if (expected.originalPrice !== undefined) assert.strictEqual(Number(product.originalPrice), expected.originalPrice, `${id} 原價錯誤`);
  if (expected.offer) assert(product.offers?.includes(expected.offer), `${id} 優惠活動錯誤`);
  if (expected.quoteOnly !== undefined) assert.strictEqual(product.quoteOnly, expected.quoteOnly, `${id} 洽詢模式錯誤`);
}
assert.strictEqual(sales.comboOffers?.length, 3);
assert.strictEqual(sales.combos?.length, 3);
assert.deepStrictEqual(sales.imagePolicy?.partners, ["小鹿娃娃", "小烏龜娃娃"]);
assert.strictEqual(sales.imagePolicy?.realProductImagesOnly, true);
assert.strictEqual(sales.imagePolicy?.noProductRedraw, true);
assert.strictEqual(sales.imagePolicy?.approvalRequiredBeforePublish, true);

const quickReplies = brand.quickReplies || {};
for (const label of ["品牌故事", "品牌由來", "選料理念", "品質把關", "傳統工法", "品牌承諾"]) {
  assert.strictEqual(typeof quickReplies[label], "string", `品牌內容缺少：${label}`);
  assert(quickReplies[label].trim().length >= 20, `品牌內容過短：${label}`);
}
assert.strictEqual(brand.brand, "仙加味");
assert.strictEqual(brand.tagline, "補養，是一種節奏。");
assert(Array.isArray(brand.menu) && brand.menu.length >= 5, "品牌導覽不足");
assert(Array.isArray(brand.compliance?.blockedClaims) && brand.compliance.blockedClaims.includes("療效"), "品牌合規禁詞未設定");
const brandRuntime = read("brand-content-runtime.js");
assert(brandRuntime.includes("content.quickReplies"), "LINE 品牌回覆尚未載入目前共用格式");

const start = String(pkg.scripts?.start || "");
for (const preload of [
  "product-sales-master.js",
  "brand-content-runtime.js",
  "product-quote-only-guard.js",
  "social-weekly-schedule-override.js",
  "social-review-only-mode.js",
  "social-static-asset-bridge.js",
]) assert(start.includes(preload), `正式啟動缺少：${preload}`);
assert(start.indexOf("product-sales-master.js") < start.indexOf("product-quote-only-guard.js"), "售價主檔載入順序錯誤");
assert(!start.includes("social-incomplete-auto-retry.js"), "不可載入失敗平台自動補發模組");

assert.strictEqual(quoteOnlyGuard.VERSION, "2026-07-25-quote-only-v2");
const transformedServer = quoteOnlyGuard.transformServer(read("server.js"));
assert(transformedServer.includes("if (product.quoteOnly) return false"));
assert(transformedServer.includes('label: "LINE洽詢"'));

assert.strictEqual(weekly.VERSION, "2026-07-25-weekly-once-v1");
assert.strictEqual(reviewGate.VERSION, "2026-07-26-review-gate-v5");
assert.strictEqual(scheduleRepair.VERSION, "2026-07-24-v5");
assert.strictEqual(approvedBatch.VERSION, "6.1.0");
assert.strictEqual(approvedBatch.WEATHER_RATE_LIMIT_BACKOFF_MS, 2 * 60 * 60 * 1000);

const posts = finalPosts.POSTS;
assert.strictEqual(posts.length, 10, `正式貼文應為10篇，目前${posts.length}篇`);
for (const field of ["id", "title", "instagramCaption", "facebookCaption", "imageName"]) {
  assert.strictEqual(new Set(posts.map((post) => post[field])).size, 10, `正式貼文 ${field} 不可重複`);
}
assert(posts.every((post) => post.qBossMascotLocked && post.deerPartnerPresent && post.turtlePartnerPresent), "小老闆與固定夥伴規格不完整");
const fixed = posts.filter((post) => !post.conditionalWeather);
const weather = posts.filter((post) => post.conditionalWeather);
assert.strictEqual(fixed.length, 7);
assert.strictEqual(weather.length, 3);
assert(weather.every((post) => !post.scheduledAt && post.automationStandby === true), "天氣貼文不可預先排固定日期");
const weekCounts = new Map();
for (const post of fixed) {
  assert(schedulePolicy.validScheduledAt(post.scheduledAt, post), `${post.title} 不是週三20:00`);
  const week = schedulePolicy.weekKey(post.scheduledAt);
  weekCounts.set(week, (weekCounts.get(week) || 0) + 1);
}
assert([...weekCounts.values()].every((count) => count === 1), "同一週不可排超過一篇固定貼文");

const socialHtml = decodeBundle("internal-social-site/index.html.gz.b64");
const socialCss = decodeBundle("internal-social-site/site.css.gz.b64");
const socialJs = decodeBundle("internal-social-site/site.js.gz.b64");
assert(socialHtml.includes("社群管理中心"));
assert(socialHtml.includes('id="imageFile"'));
assert(socialCss.includes(".post-card"));
assert(socialJs.includes("/internal/api/v2/social/upload"));
assert(!socialJs.includes("MutationObserver"), "獨立社群網站不可使用全頁 MutationObserver");

const raster = read("social-static-asset-bridge.js");
assert(raster.includes("NotoSansTC-VF.ttf"));
assert(raster.includes("preventsGibberish: true"));
assert(raster.includes("/social/raster-healthz"));
const publishGuard = read("social-publish-guard.js");
assert(publishGuard.includes('VERSION = "2.0.0"'));
assert(publishGuard.includes("withPostLock"));
assert(publishGuard.includes("recordPublication"));

console.log("仙加味正式檢查通過：官網目錄v408.9、LINE OA v6.1.1、六項正式售價與優惠、共用品牌內容、三組搭配、真實產品原圖、小老闆固定夥伴、人工待審、每週三20:00排程、天氣條件加發與週末停發。");
