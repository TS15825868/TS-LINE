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
const repair = require("../social-schedule-repair-20260722");
const legacyAssets = require("../social-original-asset-override");
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
  "social-final-approved-batch.js",
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
  assert.strictEqual(pkg.version, "6.0.3");
  assert.strictEqual(lock.version, pkg.version);
  assert.strictEqual(lock.packages?.[""]?.version, pkg.version);
}

function verifyAppControlsUntouched() {
  const start = String(pkg.scripts?.start || "");
  for (const token of [
    "social-clear-republish-policy.js",
    "social-original-asset-override.js",
    "social-final-approved-batch.js",
    "social-schedule-repair-20260722.js",
    "social-schedule-policy.js",
    "social-manual-schedule-override.js",
    "social-manual-immediate-publish.js",
    "internal-entry.js",
  ]) assert(start.includes(token), `正式啟動程式缺少：${token}`);

  const clientFix = read("internal-app-client-fix.js");
  const retry = read("internal-app-social-retry.js");
  const immediate = read("social-manual-immediate-publish.js");
  assert(clientFix.includes('RUNTIME_VERSION = "20260723-social-8"'));
  assert(retry.includes('VERSION = "20260723-social-ui-fix-2"'));
  assert(retry.includes("立即發布"));
  assert(retry.includes("已成功的平台不會重複發布"));
  assert(immediate.includes('post.manualImmediatePublish = true'));
  assert(immediate.includes('post.assetLocked = true'));
}

function verifySocialAutomation() {
  assert.strictEqual(batch.VERSION, "6.0.0");
  assert.strictEqual(batch.POSTS.length, 10);
  assert.strictEqual(new Set(batch.POSTS.map((post) => post.id)).size, 10);
  assert.strictEqual(batch.POSTS.filter((post) => !post.conditionalWeather).length, 7);
  assert.strictEqual(batch.POSTS.filter((post) => post.conditionalWeather).length, 3);
  assert.strictEqual(clearPolicy.SCHEDULED_AT, "2026-07-24T02:00:00.000Z");
  assert.strictEqual(legacyAssets.VERSION, "2.0.0");

  for (const post of batch.POSTS.filter((post) => !post.conditionalWeather)) {
    assert(schedulePolicy.validScheduledAt(post.scheduledAt, post), `${post.title} 排程不合規`);
  }
  for (const post of batch.POSTS.filter((post) => post.conditionalWeather)) {
    assert.strictEqual(post.scheduledAt, "");
    assert.strictEqual(post.automationStandby, true);
  }
  assert(batch.POSTS.every((post) => post.qBossMascotLocked && post.deerPartnerPresent && post.turtlePartnerPresent));
  assert(batch.POSTS.filter((post) => post.sequenceRole === "product").every((post) => post.productPresentationLocked && post.productSpecLocked));
  assert.strictEqual(batch.PRODUCT_SCENES["product-guilu-drink-combined.jpg"].length, 2);

  const store = batch.reconcileStore({ posts: [], publicationLedger: {} }, "2026-07-24T00:00:00.000Z").store;
  const status = repair.scheduleStatus(store);
  assert.strictEqual(status.ok, true, status.issues.join("；"));
  assert.strictEqual(status.canonicalCount, 10);
  assert.strictEqual(status.approvedCount, 7);
  assert.strictEqual(status.standbyCount, 3);
}

function verifyDuplicateProtection() {
  assert.strictEqual(guard.VERSION, "2.0.0");
  const original = { id: "old", title: "同一篇", sourceImageFile: "same.jpg", imageUrl: "https://example.com/same.jpg?v=old", instagramCaption: "相同文案", publishInstagram: true, result: { instagram: { id: "ig-1" } } };
  const duplicate = { ...original, id: "new", imageUrl: "https://example.com/same.jpg?v=new", result: {} };
  assert(guard.findPublishedMatch({ posts: [original], publicationLedger: {} }, duplicate, "instagram"));
}

verifyFilesAndCatalog();
verifyAppControlsUntouched();
verifySocialAutomation();
verifyDuplicateProtection();
console.log("仙加味正式檢查通過：App按鈕保留、7/24上午首發、週三週五10:00、氣候條件加發、圖文不重複");
