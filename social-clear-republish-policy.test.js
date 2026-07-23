"use strict";

const assert = require("assert");
const policy = require("./social-clear-republish-policy");
const assets = require("./social-original-asset-override");

(async () => {
  assert.strictEqual(policy.VERSION, "1.3.0");
  assert.strictEqual(policy.SCHEDULED_AT, "2026-07-24T11:30:00.000Z", "應於台灣時間2026/7/24 19:30發布");
  assert.strictEqual(policy.SOURCE_IMAGE_FILE, "634CBEF9-5A29-44EE-BFFC-AA5DDB8C049B.PNG");
  assert.strictEqual(policy.appliedPost.id, policy.REPUBLISH_POST_ID);
  assert.strictEqual(policy.appliedPost.title, "工作再忙，也別忘了休息一下");
  assert.strictEqual(policy.appliedPost.imageName, "care-work-rest-clear.jpg");
  assert.strictEqual(policy.appliedPost.manualScheduleOverride, true);
  assert.strictEqual(policy.appliedPost.oneTimeCorrectedRepublish, true);
  assert.strictEqual(policy.appliedPost.originalCompositionLocked, true);
  assert.strictEqual(policy.appliedPost.originalCharacterLayoutLocked, true);
  assert.strictEqual(policy.appliedPost.originalSourceDimensions, "1254x1254");

  const info = await assets.info(policy.appliedPost.imageName);
  assert.strictEqual(info.ok, true, info.error || "清晰原圖無法讀取");
  assert.strictEqual(info.width, 1254);
  assert.strictEqual(info.height, 1254);
  assert.strictEqual(info.exactOriginalSource, true);
  assert(info.bytes > 100000, "清晰原圖壓縮過度");
  console.log("PASS clear original repost scheduled for 2026/7/24 19:30");
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
