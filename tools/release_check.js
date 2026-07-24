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

// 總驗收只載入正式資料與純函式；舊遷移模組由各自獨立測試驗證，避免互相改寫 require loader。
const batch = require("../social-final-approved-batch");
const reviewGate = require("../social-review-only-mode");
const release = require("../social-final-release-20260724");
const remoteAssets = require("../social-final-release-remote-assets");
const schedulePolicy = require("../social-schedule-policy");
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
  assert(start.includes("node -r ./social-review-only-mode.js"), "審核閘門必須是正式啟動的第一個 preload");
  assert(!start.includes("-r ./social-incomplete-auto-retry.js"), "不可載入失敗平台自動補發模組");
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
  const filter = read("internal-app-social-filter.js");
  const facebookHealth = read("internal-app-facebook-health.js");
  const immediate = read("social-manual-immediate-publish.js");

  assert(clientFix.includes('RUNTIME_VERSION = "20260724-review-gate-2"'));
  assert(clientFix.indexOf("/internal/app-review-only.js") < clientFix.indexOf("/internal/app-social-retry.js"));
  assert(reviewUi.includes("人工審核閘門已開啟"));
  assert(reviewUi.includes("審核通過・啟用自動發布"));
  assert(reviewUi.includes("未審核內容不會發布"));
  assert(retry.includes("立即發布"));
  assert(retry.includes("已成功的平台不會重複發布"));
  assert(filter.includes("週三、週五上午 10:00"));
  assert(facebookHealth.includes("button.disabled = false"));
  assert(immediate.includes("post.manualImmediatePublish = true"));
}

function verifyReviewGate() {
  assert.strictEqual(reviewGate.VERSION, "2026-07-24-review-gate-v2");
  const template = batch.POSTS.find((post) => !post.conditionalWeather);
  assert(template && reviewGate.CANONICAL_IDS.has(template.id));
  const draft = reviewGate.clearPublishState({ ...template, status: "approved", assetLocked: true });
  assert.strictEqual(draft.status, "draft");
  assert.strictEqual(draft.assetLocked, false);
  assert.strictEqual(draft.reviewApprovedAt, "");

  const reset = { posts: [draft], publicationLedger: {}, socialReviewGateVersion: reviewGate.VERSION };
  const appApproved = reviewGate.protectStore({ ...reset, posts: [{ ...draft, status: "approved" }] }, reset, true);
  assert.strictEqual(appApproved.posts[0].status, "approved");
  assert(appApproved.posts[0].reviewApprovedAt);
  assert.strictEqual(appApproved.posts[0].autoPublishAfterReview, true);

  const backgroundApproved = reviewGate.protectStore({ ...reset, posts: [{ ...draft, status: "approved" }] }, reset, false);
  assert.strictEqual(backgroundApproved.posts[0].status, "draft");
  assert.strictEqual(backgroundApproved.posts[0].reviewApprovedAt, "");
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
  assert(read("social-clear-republish-policy.js").includes('SCHEDULED_AT = "2026-07-24T02:00:00.000Z"'));
  assert(read("social-original-asset-override.js").includes('VERSION = "2.0.0"'));
  assert.strictEqual(Object.keys(remoteAssets.ALIASES).length, 10);
  assert.strictEqual(release.validateDefinitions(), true);

  for (const post of release.POSTS.filter((post) => !post.conditionalWeather)) {
    assert(schedulePolicy.validScheduledAt(post.scheduledAt, post), `${post.title} 原建議排程不合規`);
  }
  for (const post of release.POSTS.filter((post) => post.conditionalWeather)) {
    assert.strictEqual(post.scheduledAt, "");
    assert.strictEqual(post.automationStandby, true);
  }
  assert(release.POSTS.every((post) => post.qBossMascotLocked && post.deerPartnerPresent && post.turtlePartnerPresent));
  assert(release.POSTS.filter((post) => post.sequenceRole === "product").every((post) => post.productPresentationLocked && post.productSpecLocked));
  assert.strictEqual(new Set(release.POSTS.map((post) => release.normalizeText(post.title))).size, 10);
  assert.strictEqual(new Set(release.POSTS.map((post) => post.imageName)).size, 10);
}

function verifyDuplicateProtection() {
  assert.strictEqual(guard.VERSION, "2.0.0");
  const original = { id: "old", title: "同一篇", sourceImageFile: "same.jpg", imageUrl: "https://example.com/same.jpg?v=old", instagramCaption: "相同文案", publishInstagram: true, result: { instagram: { id: "ig-1" } } };
  const duplicate = { ...original, id: "new", imageUrl: "https://example.com/same.jpg?v=new", result: {} };
  assert(guard.findPublishedMatch({ posts: [original], publicationLedger: {} }, duplicate, "instagram"));
}

verifyFilesAndCatalog();
verifyAppControls();
verifyReviewGate();
verifySocialContent();
verifyDuplicateProtection();
console.log("仙加味正式檢查通過：10篇圖文先進 App 草稿；人工審核後才啟用固定排程或氣候條件發布；未審核與失敗平台不自動補發；防止重複發布");