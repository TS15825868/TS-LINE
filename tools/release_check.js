"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const exists = (file) => fs.existsSync(path.join(root, file));
const data = JSON.parse(read("data.json"));
const pkg = JSON.parse(read("package.json"));
const lock = JSON.parse(read("package-lock.json"));
const server = read("server.js");
const socialServer = read("social-server.js");
const clientFix = read("internal-app-client-fix.js");
const formController = read("internal-app-form-controller.js");
const socialFilter = read("internal-app-social-filter.js");
const facebookHealthUi = read("internal-app-facebook-health.js");
const facebookBridge = read("facebook-page-token-bridge.js");
const facebookHealthRoute = read("facebook-token-health-route.js");
require("../social-recommended-schedule");
require("../social-corrected-republish-schedule");
const clearPolicy = require("../social-clear-republish-policy");
const schedulePolicy = require("../social-schedule-policy");
const batch = require("../social-final-approved-batch");
const guard = require("../social-publish-guard");

function requiredFiles() {
  return [
    "internal-entry.js",
    "internal-app.js",
    "internal-app-client-fix.js",
    "internal-app-form-controller.js",
    "internal-app-social-filter.js",
    "internal-app-social-retry.js",
    "internal-app-facebook-health.js",
    "social-server.js",
    "social-publish-guard.js",
    "social-publish-guard.test.js",
    "social-publication-ledger-backfill.js",
    "social-recommended-schedule.js",
    "social-final-posts.js",
    "social-clear-republish-policy.js",
    "social-clear-republish-policy.test.js",
    "social-corrected-republish-schedule.js",
    "social-final-approved-batch.js",
    "social-final-approved-batch.test.js",
    "social-schedule-repair-20260722.js",
    "social-schedule-repair-20260722.test.js",
    "social-schedule-policy.js",
    "social-schedule-policy.test.js",
    "social-manual-schedule-override.js",
    "social-review-center.js",
    "facebook-page-token-bridge.js",
    "facebook-token-health-route.js",
    "assets/social-approved/original-clear/care-work-rest-original.avif.000.b64",
    "assets/social-approved/original-clear/care-work-rest-original.avif.001.b64",
    "assets/social-approved/original-clear/care-work-rest-original.avif.002.b64",
    "assets/social-approved/original-clear/care-work-rest-original.avif.003.b64",
    "assets/social-approved/original-clear/care-work-rest-original.avif.004.b64",
    "supabase-state-bridge.js",
    "persistence-auto-save.js",
    "supabase/schema.sql",
    ".github/workflows/ci.yml",
    ".github/workflows/production-health.yml",
  ];
}

function verifyRequiredFiles() {
  for (const file of requiredFiles()) assert(exists(file), `缺少正式檔案：${file}`);
}

function verifyCatalogAndRuntime() {
  assert.strictEqual(data.lineId, "@762jybnm");
  assert.strictEqual(data.catalogVersion, "408.7");
  assert.strictEqual(data.products.length, 6);
  assert.deepStrictEqual(
    data.products.map((item) => item.id),
    ["guilu-gao", "guilu-drink-30", "guilu-drink-180", "guilu-tangkuai", "guilu-jiao", "luerong-fen"]
  );
  assert.strictEqual(pkg.version, "6.0.2");
  assert.strictEqual(lock.version, pkg.version);
  assert.strictEqual(lock.packages?.[""]?.version, pkg.version);
  const start = String(pkg.scripts?.start || "");
  for (const token of [
    "social-recommended-schedule.js",
    "social-clear-republish-policy.js",
    "social-corrected-republish-schedule.js",
    "social-final-approved-batch.js",
    "social-schedule-policy.js",
    "social-publication-ledger-backfill.js",
    "facebook-page-token-bridge.js",
    "facebook-token-health-route.js",
    "internal-entry.js",
  ]) assert(start.includes(token), `正式啟動程式缺少：${token}`);
  assert(start.indexOf("social-recommended-schedule.js") < start.indexOf("social-final-approved-batch.js"));
  assert(start.indexOf("social-corrected-republish-schedule.js") < start.indexOf("social-schedule-policy.js"));
  assert(start.indexOf("facebook-page-token-bridge.js") < start.indexOf("facebook-token-health-route.js"));
  assert(String(pkg.scripts?.test || "").includes("social-clear-republish-policy.test.js"));
  assert(String(pkg.scripts?.test || "").includes("social-publish-guard.test.js"));
  assert(String(pkg.scripts?.test || "").includes("tools/release_check.js"));
  assert(!/channelAccessToken\s*:\s*["'][^"']{20,}/.test(server));
  assert(!/channelSecret\s*:\s*["'][^"']{10,}/.test(server));
}

function verifyInternalApp() {
  assert(clientFix.includes('RUNTIME_VERSION = "20260722-social-6"'));
  assert(clientFix.includes("/internal/app-facebook-health.js"));
  assert(formController.includes('VERSION = "20260722-form-stable-3"'));
  assert(formController.includes("day === 3 ? 19 : 20"));
  assert(formController.includes("day === 3 ? 30 : 0"));
  assert(socialFilter.includes('VERSION = "20260722-social-review-3"'));
  for (const text of ["週三 19:30 關心文", "週五 20:00 產品文", "氣候待命", "排程檢查正常"]) {
    assert(socialFilter.includes(text), `內部 App 排程介面缺少：${text}`);
  }
  assert(!socialFilter.includes("週三、週五 20:00"));
  assert(facebookHealthUi.includes('VERSION = "20260722-facebook-health-2"'));
  assert(facebookHealthUi.includes("Instagram 已成功的貼文不會重複發布"));
  assert(facebookBridge.includes("META_PAGE_ACCESS_TOKEN_NEXT"));
  assert(facebookBridge.includes("facebookAuthHealth"));
  assert(facebookHealthRoute.includes("/social/facebook-healthz"));
  assert(!/EA[A-Za-z0-9]{40,}/.test(facebookBridge));
}

async function verifyExactOriginalImage() {
  assert.strictEqual(batch.VERSION, "5.1.0");
  assert.strictEqual(batch.CONTENT_VERSION, "approved-exact-original-1254-v6");
  assert.strictEqual(batch.CAMPAIGN_ID, "xjw-social-final-11-v6");
  assert.strictEqual(batch.TARGET_IMAGE_SIZE, 1080);

  const care = batch.POSTS.filter((post) => post.imageName);
  assert.strictEqual(care.length, 5);
  for (const post of care) {
    const info = await batch.assetInfo(post.imageName);
    assert.strictEqual(info.ok, true, `${post.imageName} 圖片品質檢查失敗`);
    assert(info.width >= 1080 && info.height >= 1080, `${post.imageName} 未達1080×1080`);
    assert(info.bytes > 100000, `${post.imageName} 壓縮過度`);
  }

  assert.strictEqual(clearPolicy.VERSION, "1.2.0");
  assert.strictEqual(clearPolicy.SOURCE_IMAGE_FILE, "634CBEF9-5A29-44EE-BFFC-AA5DDB8C049B.PNG");
  assert.strictEqual(clearPolicy.SCHEDULED_AT, "2026-07-23T11:30:00.000Z");
  const post = batch.POSTS.find((item) => item.id === clearPolicy.REPUBLISH_POST_ID);
  assert(post, "正式排程缺少清晰原圖重發貼文");
  assert.strictEqual(post.sourceImageFile, clearPolicy.SOURCE_IMAGE_FILE);
  assert.strictEqual(post.originalCompositionLocked, true);
  assert.strictEqual(post.originalCharacterLayoutLocked, true);
  assert.strictEqual(post.oneTimeCorrectedRepublish, true);
  assert(!/vector|向量|生成/i.test(post.sourceImageFile));

  const source = batch.exactOriginalAvifBuffer(post.imageName);
  assert(source && source.length > 40000, "原始清晰圖分段內容不完整");
  const info = await batch.assetInfo(post.imageName);
  assert.strictEqual(info.exactOriginalSource, true);
  assert.strictEqual(info.originalSourceFile, clearPolicy.SOURCE_IMAGE_FILE);
  assert.strictEqual(info.originalSourceDimensions, "1254x1254");
  assert(info.width >= 1254 && info.height >= 1254, `原圖尺寸不足：${info.width}×${info.height}`);
  assert(info.bytes > 100000, "原圖輸出壓縮過度");
}

function verifyPersistentDuplicateProtection() {
  assert.strictEqual(guard.VERSION, "2.0.0");
  assert(socialServer.includes('const SOCIAL_VERSION = "1.3.0"'));
  assert(socialServer.includes("publicationLedger"));
  assert(socialServer.includes("persistentDuplicateProtection: true"));
  assert(socialServer.includes("findPublishedMatch"));
  assert(socialServer.includes("recordPublication"));
  assert(socialServer.includes("已略過重複"));
  const original = {
    id: "old",
    title: "同一篇",
    sourceImageFile: "same.jpg",
    imageUrl: "https://example.com/same.jpg?v=old",
    instagramCaption: "相同文案",
    publishInstagram: true,
    result: { instagram: { id: "ig-1" } },
  };
  const duplicate = { ...original, id: "new", imageUrl: "https://example.com/same.jpg?v=new", result: {} };
  const store = { posts: [original], publicationLedger: {} };
  assert(guard.findPublishedMatch(store, duplicate, "instagram"), "跨貼文ID重複內容未被攔截");
  guard.recordPublication(store, original, "instagram", original.result.instagram, "2026-07-22T00:00:00.000Z");
  assert(guard.findPublishedMatch({ posts: [], publicationLedger: store.publicationLedger }, duplicate, "instagram"), "持久化發佈紀錄未生效");
}

function verifyScheduleAndWeather() {
  const posts = batch.POSTS;
  assert.strictEqual(posts.length, 11);
  assert.strictEqual(new Set(posts.map((post) => post.id)).size, 11);
  const fixed = posts.filter((post) => !post.conditionalWeather);
  const weather = posts.filter((post) => post.conditionalWeather);
  assert.strictEqual(fixed.length, 8);
  assert.strictEqual(weather.length, 3);
  assert(weather.every((post) => !post.scheduledAt));
  for (const post of fixed) assert(schedulePolicy.validScheduledAt(post.scheduledAt, post), `${post.id} 排程不合規`);
  const corrected = posts.find((post) => post.id === clearPolicy.REPUBLISH_POST_ID);
  assert(corrected);
  assert.strictEqual(schedulePolicy.expectedTime(corrected).policy, "corrected-clear-republish-thu-19:30");
  const drink30 = posts.find((post) => post.id.includes("guilu-yin-30cc"));
  const drink180 = posts.find((post) => post.id.includes("guilu-yin-180cc"));
  assert(drink30 && drink180);
  assert(!drink30.title.includes("180cc"));
  assert(!drink180.title.includes("30cc"));

  const store = { posts: posts.map((post) => batch.desiredPost(post, {}, "2026-07-22T00:00:00.000Z")) };
  const fixedBefore = store.posts.filter((post) => !post.conditionalWeather && post.status === "approved").map((post) => post.id);
  const activation = batch.activateWeatherPost(store, { trigger: "hot", summary: "最高33°C" }, "2026-07-22", "2026-07-22T00:30:00.000Z");
  assert.strictEqual(activation.activated, true);
  assert.strictEqual(activation.fixedPostsPreserved, true);
  assert.deepStrictEqual(store.posts.filter((post) => !post.conditionalWeather && post.status === "approved").map((post) => post.id), fixedBefore);
}

function verifyCopySafety() {
  const blocked = /改善|治療|關節|卡卡|疲勞|精神不濟|補氣|生津|膠原蛋白|鈣質/;
  for (const post of batch.POSTS) {
    assert(String(post.title || "").trim());
    assert(String(post.instagramCaption || "").trim());
    assert(String(post.facebookCaption || "").trim());
    assert(!blocked.test(`${post.title}\n${post.instagramCaption}\n${post.facebookCaption}`), `${post.id} 含禁用字詞`);
  }
}

(async () => {
  try {
    verifyRequiredFiles();
    verifyCatalogAndRuntime();
    verifyInternalApp();
    await verifyExactOriginalImage();
    verifyPersistentDuplicateProtection();
    verifyScheduleAndWeather();
    verifyCopySafety();
    console.log("PASS 仙加味正式版：1254×1254正式清晰原圖、原配置與角色鎖定、單次重發、防重複與排程全部通過");
  } catch (error) {
    console.error(`仙加味正式上線檢查失敗：${error.message}`);
    process.exit(1);
  }
})();
