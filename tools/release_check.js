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

require("../social-recommended-schedule");
require("../social-corrected-republish-schedule");
const clearPolicy = require("../social-clear-republish-policy");
const batch = require("../social-final-approved-batch");
const schedulePolicy = require("../social-schedule-policy");
require("../social-manual-schedule-override");
const repair = require("../social-schedule-repair-20260722");
const assets = require("../social-original-asset-override");
const guard = require("../social-publish-guard");

const required = [
  "internal-entry.js",
  "internal-app-client-fix.js",
  "internal-app-social-retry.js",
  "social-server.js",
  "social-publish-guard.js",
  "social-publication-ledger-backfill.js",
  "social-final-posts.js",
  "social-clear-republish-policy.js",
  "social-original-asset-override.js",
  "social-approved-clear-extension.js",
  "social-manual-immediate-publish.js",
  "social-schedule-repair-20260722.js",
  "social-schedule-policy.js",
  "social-manual-schedule-override.js",
  "assets/social-approved/v7-original/care-work-rest.avif.000.b64",
  "assets/social-approved/v7-original/care-work-rest.avif.001.b64",
  "assets/social-approved/v7-original/care-work-rest.avif.002.b64",
  "assets/social-approved/v7-original/care-work-rest.avif.003.b64",
  "assets/social-approved/v7-original/care-work-rest.avif.004.b64",
  "assets/social-approved/v7-original/care-work-rest.avif.005.b64",
  "assets/social-approved/clear-20260723/care-work-rest-fixed.avif.000.b64",
  "assets/social-approved/clear-20260723/care-work-rest-fixed.avif.001.b64",
  "supabase-state-bridge.js",
  "persistence-auto-save.js",
  ".github/workflows/production-health.yml",
  ".github/workflows/production-schedule-status.yml",
];

function verifyFilesAndCatalog() {
  for (const file of required) assert(exists(file), `缺少正式檔案：${file}`);
  assert.strictEqual(data.lineId, "@762jybnm");
  assert.strictEqual(data.catalogVersion, "408.7");
  assert.strictEqual(data.products.length, 6);
  assert.deepStrictEqual(data.products.map((item) => item.id), [
    "guilu-gao", "guilu-drink-30", "guilu-drink-180", "guilu-tangkuai", "guilu-jiao", "luerong-fen",
  ]);
  assert.strictEqual(pkg.version, "6.0.4");
  assert.strictEqual(lock.version, pkg.version);
  assert.strictEqual(lock.packages?.[""]?.version, pkg.version);
}

function verifyRuntimeContract() {
  const start = String(pkg.scripts?.start || "");
  for (const token of [
    "social-clear-republish-policy.js",
    "social-original-asset-override.js",
    "social-approved-clear-extension.js",
    "social-final-approved-batch.js",
    "social-schedule-repair-20260722.js",
    "social-schedule-policy.js",
    "social-manual-schedule-override.js",
    "social-manual-immediate-publish.js",
    "social-publication-ledger-backfill.js",
    "internal-entry.js",
  ]) assert(start.includes(token), `正式啟動程式缺少：${token}`);
  assert(start.indexOf("social-original-asset-override.js") < start.indexOf("social-final-approved-batch.js"));
  assert(start.indexOf("social-approved-clear-extension.js") < start.indexOf("social-final-approved-batch.js"));
  assert(start.indexOf("social-manual-immediate-publish.js") < start.indexOf("internal-entry.js"));

  const clientFix = read("internal-app-client-fix.js");
  const retry = read("internal-app-social-retry.js");
  const immediate = read("social-manual-immediate-publish.js");
  assert(clientFix.includes('RUNTIME_VERSION = "20260723-social-8"'));
  assert(retry.includes('VERSION = "20260723-social-ui-fix-2"'));
  assert(retry.includes('ASSET_VERSION = "approved-original-1254-v10"'));
  assert(retry.includes("立即發布"));
  assert(retry.includes("已成功的平台不會重複發布"));
  assert(immediate.includes('post.manualImmediatePublish = true'));
  assert(immediate.includes('post.manualScheduleOverride = true'));

  const server = read("server.js");
  assert(!/channelAccessToken\s*:\s*["'][^"']{20,}/.test(server));
  assert(!/channelSecret\s*:\s*["'][^"']{10,}/.test(server));
}

async function verifyAssetsAndSchedule() {
  assert.strictEqual(assets.VERSION, "1.3.0");
  assert.strictEqual(assets.CONTENT_VERSION, "approved-original-1254-v11-direct");
  assert.strictEqual(assets.TARGET_SIZE, 1254);
  const names = Object.keys(assets.THEMES);
  assert.strictEqual(names.length, 6);
  for (const name of names) {
    const info = await assets.info(name);
    assert.strictEqual(info.ok, true, `${name} 圖片品質檢查失敗：${info.error || ""}`);
    assert.strictEqual(info.width, 1254);
    assert.strictEqual(info.height, 1254);
    assert(info.bytes > 40000, `${name} 壓縮過度`);
  }
  const clear = await assets.info("care-work-rest-clear.jpg");
  assert.strictEqual(clear.exactOriginalSource, true, "明日重發必須使用1254×1254正式清晰原圖");

  assert.strictEqual(clearPolicy.VERSION, "1.3.0");
  assert.strictEqual(clearPolicy.SCHEDULED_AT, "2026-07-24T11:30:00.000Z");
  assert.strictEqual(clearPolicy.appliedPost.id, clearPolicy.REPUBLISH_POST_ID);
  assert.strictEqual(clearPolicy.appliedPost.manualScheduleOverride, true);
  assert.strictEqual(clearPolicy.appliedPost.originalCompositionLocked, true);
  assert.strictEqual(clearPolicy.appliedPost.originalCharacterLayoutLocked, true);

  assert.strictEqual(batch.POSTS.length, 11);
  assert.strictEqual(new Set(batch.POSTS.map((post) => post.id)).size, 11);
  const fixed = batch.POSTS.filter((post) => !post.conditionalWeather);
  const weather = batch.POSTS.filter((post) => post.conditionalWeather);
  assert.strictEqual(fixed.length, 8);
  assert.strictEqual(weather.length, 3);
  assert(weather.every((post) => !post.scheduledAt));
  for (const post of fixed) assert(schedulePolicy.validScheduledAt(post.scheduledAt, post), `${post.title} 排程不合規`);

  const store = { posts: batch.POSTS.map((post) => batch.desiredPost(post, {}, "2026-07-23T00:00:00.000Z")) };
  const status = repair.scheduleStatus(store);
  assert.strictEqual(status.ok, true, status.issues.join("；"));
  assert.strictEqual(status.repairVersion, "");
  assert.strictEqual(status.canonicalCount, 11);
}

function verifyDuplicateProtection() {
  assert.strictEqual(guard.VERSION, "2.0.0");
  const socialServer = read("social-server.js");
  assert(socialServer.includes('const SOCIAL_VERSION = "1.3.0"'));
  assert(socialServer.includes("persistentDuplicateProtection: true"));
  const original = {
    id: "old", title: "同一篇", sourceImageFile: "same.jpg",
    imageUrl: "https://example.com/same.jpg?v=old", instagramCaption: "相同文案",
    publishInstagram: true, result: { instagram: { id: "ig-1" } },
  };
  const duplicate = { ...original, id: "new", imageUrl: "https://example.com/same.jpg?v=new", result: {} };
  assert(guard.findPublishedMatch({ posts: [original], publicationLedger: {} }, duplicate, "instagram"));
}

(async () => {
  verifyFilesAndCatalog();
  verifyRuntimeContract();
  await verifyAssetsAndSchedule();
  verifyDuplicateProtection();
  console.log("仙加味正式上線檢查通過：清晰原圖、按鈕、立即發布、明日排程與防重複均正常");
})().catch((error) => {
  console.error(`仙加味正式上線檢查失敗：${error.message}`);
  process.exit(1);
});
