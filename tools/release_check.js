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
const release = require("../social-final-release-20260724");
const remoteAssets = require("../social-final-release-remote-assets");
const reviewOnly = require("../social-review-only-mode");
const schedulePolicy = require("../social-schedule-policy");
const repair = require("../social-schedule-repair-20260722");
const legacyAssets = require("../social-original-asset-override");
const guard = require("../social-publish-guard");

const required = [
  "internal-entry.js",
  "internal-app-client-fix.js",
  "internal-app-review-only.js",
  "internal-app-social-retry.js",
  "internal-app-social-filter.js",
  "internal-app-facebook-health.js",
  "social-server.js",
  "social-review-only-mode.js",
  "social-review-only-mode.test.js",
  "social-publish-guard.js",
  "social-publication-ledger-backfill.js",
  "social-final-posts.js",
  "social-clear-republish-policy.js",
  "social-original-asset-override.js",
  "social-final-approved-batch.js",
  "social-final-release-20260724.js",
  "social-final-release-remote-assets.js",
  "social-schedule-repair-20260722.js",
  "social-schedule-policy.js",
  "social-manual-schedule-override.js",
  "social-manual-immediate-publish.js",
  "supabase-state-bridge.js",
  "persistence-auto-save.js",
];

function verifyFilesAndCatalog() {
  for (const file of required) assert(exists(file), `缺少正式檔案：${file}`);
  assert.strictEqual(data.lineId, "@762jybnm");
  assert.strictEqual(data.catalogVersion, "408.7");
  assert.strictEqual(data.products.length, 6);
  assert.strictEqual(pkg.version, "6.0.4");
  assert.strictEqual(lock.version, pkg.version);
  assert.strictEqual(lock.packages?.[""]?.version, pkg.version);
}

function verifyAppControls() {
  const start = String(pkg.scripts?.start || "");
  assert(start.includes("node -r ./social-review-only-mode.js"), "人工審核模式必須是正式啟動的第一個 preload");
  assert(!start.includes("-r ./social-incomplete-auto-retry.js"), "不可再載入自動補發模組");
  for (const token of [
    "social-review-only-mode.js",
    "social-clear-republish-policy.js",
    "social-original-asset-override.js",
    "social-final-approved-batch.js",
    "social-final-release-20260724.js",
    "social-final-release-remote-assets.js",
    "social-schedule-repair-20260722.js",
    "social-schedule-policy.js",
    "social-manual-schedule-override.js",
    "social-manual-immediate-publish.js",
    "internal-entry.js",
  ]) assert(start.includes(token), `正式啟動程式缺少：${token}`);

  const clientFix = read("internal-app-client-fix.js");
  const reviewUi = read("internal-app-review-only.js");
  const retry = read("internal-app-social-retry.js");
  const immediate = read("social-manual-immediate-publish.js");
  assert(clientFix.includes('RUNTIME_VERSION = "20260724-review-only-1"'));
  assert(clientFix.includes("/internal/app-review-only.js"));
  assert(reviewUi.includes("人工審核模式已開啟"));
  assert(reviewUi.includes("我已確認，手動發布"));
  assert(reviewUi.includes("不會自動排程、不會自動發布，也不會自動補發"));
  assert(retry.includes("已成功的平台不會重複發布"));
  assert(immediate.includes('post.manualImmediatePublish = true'));
  assert(immediate.includes('post.assetLocked = true'));
}

function verifyReviewOnlyMode() {
  assert.strictEqual(reviewOnly.VERSION, "2026-07-24-review-only-v1");
  const prepared = batch.reconcileStore({ posts: [], publicationLedger: {} }, "2026-07-24T00:00:00.000Z").store;
  const reset = reviewOnly.initialReset(prepared);
  const canonical = reset.posts.filter((post) => reviewOnly.CANONICAL_IDS.has(post.id));
  assert.strictEqual(canonical.length, 10);
  assert(canonical.every((post) => post.status === "draft"));
  assert(canonical.every((post) => post.manualPublishOnly === true));
  assert(canonical.every((post) => post.manualReviewRequired === true));
  assert(canonical.every((post) => post.manualImmediatePublish === false));
  assert.strictEqual(reset.socialReviewOnlyMode, true);
}

function verifySocialContent() {
  assert.strictEqual(batch.VERSION, "6.0.0");
  assert.strictEqual(release.VERSION, "2026-07-24-final-v1");
  assert.strictEqual(remoteAssets.VERSION, "2026-07-24-remote-assets-v1");
  assert.strictEqual(release.POSTS.length, 10);
  assert.strictEqual(new Set(release.POSTS.map((post) => post.id)).size, 10);
  assert.strictEqual(release.POSTS.filter((post) => !post.conditionalWeather).length, 7);
  assert.strictEqual(release.POSTS.filter((post) => post.conditionalWeather).length, 3);
  assert.strictEqual(release.POSTS[0].scheduledAt, "2026-07-24T02:00:00.000Z");
  assert.strictEqual(clearPolicy.SCHEDULED_AT, "2026-07-24T02:00:00.000Z");
  assert.strictEqual(legacyAssets.VERSION, "2.0.0");
  assert.strictEqual(Object.keys(remoteAssets.ALIASES).length, 10);
  assert.strictEqual(release.validateDefinitions(), true);

  for (const post of release.POSTS.filter((post) => !post.conditionalWeather)) {
    assert(schedulePolicy.validScheduledAt(post.scheduledAt, post), `${post.title} 原建議排程不合規`);
  }
  assert(release.POSTS.every((post) => post.qBossMascotLocked && post.deerPartnerPresent && post.turtlePartnerPresent));
  assert(release.POSTS.filter((post) => post.sequenceRole === "product").every((post) => post.productPresentationLocked && post.productSpecLocked));
  assert.strictEqual(new Set(release.POSTS.map((post) => release.normalizeText(post.title))).size, 10);
  assert.strictEqual(new Set(release.POSTS.map((post) => post.imageName)).size, 10);

  const store = batch.reconcileStore({ posts: [], publicationLedger: {} }, "2026-07-24T00:00:00.000Z").store;
  const status = repair.scheduleStatus(store);
  assert.strictEqual(status.ok, true, status.issues.join("；"));
  assert.strictEqual(status.canonicalCount, 10);
}

function verifyDuplicateProtection() {
  assert.strictEqual(guard.VERSION, "2.0.0");
  const original = { id: "old", title: "同一篇", sourceImageFile: "same.jpg", imageUrl: "https://example.com/same.jpg?v=old", instagramCaption: "相同文案", publishInstagram: true, result: { instagram: { id: "ig-1" } } };
  const duplicate = { ...original, id: "new", imageUrl: "https://example.com/same.jpg?v=new", result: {} };
  assert(guard.findPublishedMatch({ posts: [original], publicationLedger: {} }, duplicate, "instagram"));
}

verifyFilesAndCatalog();
verifyAppControls();
verifyReviewOnlyMode();
verifySocialContent();
verifyDuplicateProtection();
console.log("仙加味正式檢查通過：10篇只進 App 草稿、禁止自動排程與補發、人工確認後才可手動發布、圖文不重複");
