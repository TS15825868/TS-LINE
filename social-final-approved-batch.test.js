"use strict";

const assert = require("assert");
require("./social-recommended-schedule");
require("./social-corrected-republish-schedule");
const clearPolicy = require("./social-clear-republish-policy");
const batch = require("./social-final-approved-batch");
const schedulePolicy = require("./social-schedule-policy");
require("./social-manual-schedule-override");
const assets = require("./social-original-asset-override");

(async () => {
  assert.strictEqual(batch.POSTS.length, 11);
  assert.strictEqual(batch.CANONICAL_IDS.size, 11);
  assert.strictEqual(batch.POSTS.filter((post) => !post.conditionalWeather).length, 8);
  assert.strictEqual(batch.POSTS.filter((post) => post.conditionalWeather).length, 3);

  const clearPost = batch.POSTS.find((post) => post.id === clearPolicy.REPUBLISH_POST_ID);
  assert(clearPost, "缺少明日清晰原圖重發貼文");
  assert.strictEqual(clearPost.scheduledAt, "2026-07-24T11:30:00.000Z");
  assert.strictEqual(clearPost.manualScheduleOverride, true);
  assert.strictEqual(clearPost.imageName, "care-work-rest-clear.jpg");

  const clearInfo = await assets.info(clearPost.imageName);
  assert.strictEqual(clearInfo.ok, true, clearInfo.error || "清晰圖檢查失敗");
  assert.strictEqual(clearInfo.width, 1254);
  assert.strictEqual(clearInfo.height, 1254);
  assert.strictEqual(clearInfo.exactOriginalSource, true);

  for (const post of batch.POSTS.filter((post) => !post.conditionalWeather)) {
    assert(schedulePolicy.validScheduledAt(post.scheduledAt, post), `${post.title} 排程不符合規則`);
  }

  const reconciled = batch.reconcileStore({ posts: [], publicationLedger: {} }, "2026-07-23T00:00:00.000Z").store;
  assert.strictEqual(reconciled.posts.length, 11);
  const desiredClear = reconciled.posts.find((post) => post.id === clearPolicy.REPUBLISH_POST_ID);
  assert.strictEqual(desiredClear.status, "approved");
  assert.strictEqual(desiredClear.assetLocked, true);
  assert.strictEqual(desiredClear.manualScheduleOverride, true);
  assert.strictEqual(desiredClear.publishInstagram, true);
  assert.strictEqual(desiredClear.publishFacebook, true);
  console.log("PASS final 11-post batch with clear original and manual one-time schedule");
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
