"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const exists = (file) => fs.existsSync(path.join(root, file));
const decodeBundle = (file) => zlib.gunzipSync(Buffer.from(read(file).replace(/\s+/g, ""), "base64")).toString("utf8");

const weeklyOverride = require("../social-weekly-schedule-override");
const quoteOnlyGuard = require("../product-quote-only-guard");
const data = JSON.parse(read("data.json"));
const pkg = JSON.parse(read("package.json"));
const lock = JSON.parse(read("package-lock.json"));
const salesMaster = JSON.parse(read("line-sales-master.json"));
const schedulePolicy = require("../social-schedule-policy");
const finalPosts = require("../social-final-posts");
const approvedBatch = require("../social-final-approved-batch");
const reviewGate = require("../social-review-only-mode");

const required = [
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
  "social-review-only-mode.test.js",
  "social-current-policy.test.js",
  "social-publish-guard.js",
  "social-publication-ledger-backfill.js",
  "social-final-posts.js",
  "social-clear-republish-policy.js",
  "social-original-asset-override.js",
  "social-final-approved-batch.js",
  "social-final-approved-batch.test.js",
  "social-final-release-20260724.js",
  "social-final-release-remote-assets.js",
  "social-schedule-repair-20260722.js",
  "social-schedule-policy.js",
  "social-manual-schedule-override.js",
  "social-manual-immediate-publish.js",
  "product-sales-master.js",
  "product-quote-only-guard.js",
  "product-quote-only-guard.test.js",
  "line-sales-master.json",
  "MASCOT_CHARACTER_SPEC.md",
  "supabase-state-bridge.js",
  "persistence-auto-save.js",
];
for (const file of required) assert(exists(file), `缺少正式檔案：${file}`);

assert.strictEqual(data.lineId, "@762jybnm");
assert.strictEqual(data.catalogVersion, "408.9");
assert.strictEqual(data.products.length, 6);
assert.strictEqual(pkg.version, "6.0.6");
assert.strictEqual(lock.version, pkg.version);
assert.strictEqual(lock.packages?.[" "]?.version, undefined);
assert.strictEqual(lock.packages?.[""]?.version, pkg.version);
assert.strictEqual(salesMaster.version, "2026-07-26-v4");
assert.strictEqual(salesMaster.products?.["guilu-gao"]?.price, 2000);
assert.strictEqual(salesMaster.products?.["guilu-drink-30"]?.price, 100);
assert.strictEqual(salesMaster.products?.["guilu-drink-180"]?.price, 200);
assert.strictEqual(salesMaster.products?.["guilu-tangkuai"]?.price, 2000);
assert.strictEqual(salesMaster.products?.["luerong-fen"]?.price, 2000);
assert.strictEqual(salesMaster.products?.["guilu-jiao"]?.price, 0);
assert.strictEqual(salesMaster.products?.["guilu-jiao"]?.quoteOnly, true);
assert.strictEqual(salesMaster.products?.["guilu-jiao"]?.priceText, "價格請洽詢");
assert.strictEqual(salesMaster.comboOffers?.length, 3);
assert.strictEqual(salesMaster.combos?.length, 3);
assert.deepStrictEqual(salesMaster.imagePolicy?.partners, ["小鹿娃娃", "小烏龜娃娃"]);
assert.strictEqual(salesMaster.imagePolicy?.realProductImagesOnly, true);
assert.strictEqual(salesMaster.imagePolicy?.noProductRedraw, true);
assert.strictEqual(salesMaster.imagePolicy?.approvalRequiredBeforePublish, true);

const start = String(pkg.scripts?.start || "");
assert(start.includes("node -r ./product-sales-master.js"), "正式售價與角色主檔必須在啟動時載入");
assert(start.includes("-r ./product-quote-only-guard.js"), "龜鹿膠洽詢價防護必須在正式啟動時載入");
assert(start.includes("-r ./social-weekly-schedule-override.js"), "每週一篇相容層必須在啟動時載入");
assert(start.includes("-r ./social-review-only-mode.js"), "審核閘門必須在正式啟動時載入");
assert(start.indexOf("product-sales-master.js") < start.indexOf("product-quote-only-guard.js"), "售價主檔必須先於洽詢價防護載入");
assert(start.indexOf("product-quote-only-guard.js") < start.indexOf("social-weekly-schedule-override.js"), "洽詢價防護必須先於排程相容層載入");
assert(start.indexOf("social-weekly-schedule-override.js") < start.indexOf("social-review-only-mode.js"), "每週一篇相容層必須先於審核閘門載入");
assert(start.includes("-r ./social-static-asset-bridge.js"), "缺少繁體中文光柵圖片橋接器");
assert(start.indexOf("social-static-asset-bridge.js") < start.indexOf("social-final-approved-batch.js"), "圖片橋接器必須先於舊圖片產生器載入");
assert(!start.includes("-r ./social-incomplete-auto-retry.js"), "不可載入失敗平台自動補發模組");
assert(!start.includes("line-approved-mascot-runtime.js"), "損壞的 LINE 小老闆圖片流程不可載入");

assert.strictEqual(quoteOnlyGuard.VERSION, "2026-07-25-quote-only-v2");
const transformedServer = quoteOnlyGuard.transformServer(read("server.js"));
assert(transformedServer.includes('product.quoteOnly ? (product.priceLabel || "價格請洽詢客服")'));
assert(transformedServer.includes('if (product.quoteOnly) return false'));
assert(transformedServer.includes('label: "LINE洽詢"'));

assert.strictEqual(weeklyOverride.VERSION, "2026-07-25-weekly-once-v1");
assert.strictEqual(reviewGate.VERSION, "2026-07-26-review-gate-v5");
assert.strictEqual(approvedBatch.VERSION, "6.1.0");
assert.strictEqual(approvedBatch.WEATHER_START_DELAY_MS, 60 * 1000);
assert.strictEqual(approvedBatch.WEATHER_RATE_LIMIT_BACKOFF_MS, 2 * 60 * 60 * 1000);
const gate = read("social-review-only-mode.js");
assert(gate.includes('VERSION = "2026-07-26-review-gate-v5"'));
assert(gate.includes("automaticSchedulingRequiresReview: true"));
assert(gate.includes("automaticRetryEnabled: false"));
assert(gate.includes("這篇尚未通過人工審核，不能發布"));
assert(gate.includes("nextAvailableFixedSlot"));
assert(gate.includes('parts.weekday === "Wed"'));
assert(gate.includes('parts.hour === "20"'));
assert(gate.includes('status = "pending_review"'));
assert(gate.includes('scheduledAt: ""'));

const clientFix = read("internal-app-client-fix.js");
assert(clientFix.includes('RUNTIME_VERSION = "20260724-inventory-split-1"'));
assert(clientFix.includes("mountInternalSocialSite(app)"));
assert(clientFix.includes("/internal/social-center"));
assert(clientFix.includes("社群網站"));
assert(clientFix.includes("socialSection.remove"));
assert(clientFix.includes("no-store, no-cache, must-revalidate"));
const appScripts = (clientFix.match(/const scripts = \[([\s\S]*?)\]\.map/) || [])[1] || "";
for (const legacySocialUi of ["app-review-only.js", "app-social-retry.js", "app-social-filter.js", "app-facebook-health.js"]) {
  assert(!appScripts.includes(legacySocialUi), `進銷存 App 不可再載入社群前端：${legacySocialUi}`);
}

const socialSiteServer = read("internal-social-site.js");
assert(socialSiteServer.includes('VERSION = "2026-07-24-social-site-v3"'));
assert(socialSiteServer.includes('require("./internal-app-security-patch")'));
assert(socialSiteServer.includes("requirePage"));
assert(socialSiteServer.includes("/internal/social-center"));
assert(socialSiteServer.includes("/internal/social-center-healthz"));
assert(socialSiteServer.includes('mode: "independent-website"'));
assert(socialSiteServer.includes("reviewRequiredBeforePublish: true"));
assert(socialSiteServer.includes("automaticRetryEnabled: false"));

const socialHtml = decodeBundle("internal-social-site/index.html.gz.b64");
const socialCss = decodeBundle("internal-social-site/site.css.gz.b64");
const socialJs = decodeBundle("internal-social-site/site.js.gz.b64");
assert(socialHtml.includes("社群管理中心"));
assert(socialHtml.includes("貼文先審核，通過後才進入自動排程"));
assert(socialHtml.includes('id="imageFile"'));
assert(socialHtml.includes('href="/internal/app"'));
assert(socialCss.includes(".post-card"));
assert(socialCss.includes(".upload-row"));
assert(socialJs.includes('RASTER_VERSION = "social-raster-tc-v1"'));
assert(socialJs.includes("/internal/api/v2/social/upload"));
assert(socialJs.includes("ensureRasterPost"));
assert(socialJs.includes("通過後才會進入自動排程"));
assert(!socialJs.includes("MutationObserver"), "獨立社群網站不可使用全頁 MutationObserver");

const raster = read("social-static-asset-bridge.js");
assert(raster.includes('VERSION = "2026-07-24-raster-tc-v1"'));
assert(raster.includes('CONTENT_VERSION = "social-raster-tc-v1"'));
assert(raster.includes("NotoSansTC-VF.ttf"));
assert(raster.includes("fontfile: font.path"));
assert(raster.includes("sharp({"));
assert(raster.includes("無法載入繁體中文字型，已停止產生貼文圖片以避免亂碼"));
assert(raster.includes("patchBatch"));
assert(raster.includes("patchSocialServer"));
assert(raster.includes("mountHealth"));
assert(raster.includes("/social/raster-healthz"));
assert(raster.includes("繁體中文測試｜龜鹿膏100g｜30cc／180cc"));
assert(raster.includes("preventsGibberish: true"));

const immediate = read("social-manual-immediate-publish.js");
assert(immediate.includes("post.manualImmediatePublish = true"));
const posts = finalPosts.POSTS;
assert.strictEqual(posts.length, 10, `正式貼文應為10篇，目前找到${posts.length}篇`);
assert.strictEqual(new Set(posts.map((post) => post.id)).size, 10, "正式貼文 ID 不可重複");
assert(posts.every((post) => post.qBossMascotLocked && post.deerPartnerPresent && post.turtlePartnerPresent), "小老闆與夥伴規格不完整");
const fixed = posts.filter((post) => !post.conditionalWeather);
const weather = posts.filter((post) => post.conditionalWeather);
assert.strictEqual(fixed.length, 7);
assert.strictEqual(weather.length, 3);
assert(weather.every((post) => !post.scheduledAt && post.automationStandby === true), "天氣貼文不可預排固定日期");
const weekCounts = new Map();
for (const post of fixed) {
  assert(schedulePolicy.validScheduledAt(post.scheduledAt, post), `${post.title} 不是週三晚上8:00`);
  const week = schedulePolicy.weekKey(post.scheduledAt);
  weekCounts.set(week, (weekCounts.get(week) || 0) + 1);
}
assert([...weekCounts.values()].every((count) => count === 1), "固定貼文每週只能有1篇");
assert.strictEqual(fixed[0].scheduledAt, "2026-07-29T12:00:00.000Z");

const postSource = read("social-final-posts.js");
assert(postSource.includes("validatePosts();"));
assert(postSource.includes('assertUnique(posts, "instagramCaption", "Instagram文案"'));
assert(postSource.includes('assertUnique(posts, "facebookCaption", "Facebook文案"'));
assert(postSource.includes('assertUnique(posts, "imageName", "圖片"'));

const schedule = read("social-schedule-policy.js");
assert(schedule.includes('FIXED_DAYS = Object.freeze(["Wed"])'));
assert(schedule.includes('FIXED_HOUR = "20"'));
assert(schedule.includes("週六、週日不發布"));
assert.strictEqual(schedulePolicy.validScheduledAt("2026-07-29T12:00:00.000Z", { category: "產品介紹" }), true);
assert.strictEqual(schedulePolicy.validScheduledAt("2026-07-31T12:00:00.000Z", { category: "產品介紹" }), false);
assert.strictEqual(schedulePolicy.validScheduledAt("2026-08-01T12:00:00.000Z", { conditionalWeather: true, weatherTrigger: "hot" }), false);

const guard = read("social-publish-guard.js");
assert(guard.includes('VERSION = "2.0.0"'));
assert(guard.includes("withPostLock"));
assert(guard.includes("findPublishedMatch"));
assert(guard.includes("recordPublication"));

console.log("仙加味正式檢查通過：官網目錄v408.9、LINE OA v6.0.6售價與龜鹿膠洽詢價防護、三組搭配相容欄位、官網小老闆與小鹿小烏龜娃娃、真實產品原圖、全部未發布內容先待審、審核後每週1篇週三20:00、天氣內容人工審核後只在其他平日20:00條件加發、HTTP 429自動退避、週末不發布");
