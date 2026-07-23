"use strict";

const assert = require("assert");
const policy = require("./social-clear-republish-policy");
const assets = require("./social-original-asset-override");

(async () => {
  assert.strictEqual(policy.VERSION, "2.0.0");
  assert.strictEqual(policy.SCHEDULED_AT, "2026-07-24T02:00:00.000Z", "應於台灣時間2026/7/24上午10:00發布");
  assert.strictEqual(policy.SOURCE_IMAGE_FILE, "634CBEF9-5A29-44EE-BFFC-AA5DDB8C049B.PNG");
  assert.strictEqual(policy.appliedPost.id, policy.REPUBLISH_POST_ID);
  assert.strictEqual(policy.appliedPost.title, "工作再忙，也別忘了休息一下");
  assert.strictEqual(policy.appliedPost.imageName, "care-work-rest-clear.jpg");
  assert.strictEqual(policy.appliedPost.manualScheduleOverride, false);
  assert.strictEqual(policy.appliedPost.oneTimeCorrectedRepublish, true);
  assert.strictEqual(policy.appliedPost.originalCompositionLocked, true);
  assert.strictEqual(policy.appliedPost.originalCharacterLayoutLocked, true);
  assert.strictEqual(policy.appliedPost.originalSourceDimensions, "1254x1254");

  const info = await assets.info(policy.appliedPost.imageName);
  assert.strictEqual(info.ok, true, info.error || "清晰原圖無法讀取");
  assert.strictEqual(info.width, 1254);
  assert.strictEqual(info.height, 1254);
  assert(info.exactOriginalSource || info.crispVectorFallback, "必須有清晰原圖或清晰備援");
  console.log("PASS first clear post scheduled for 2026/7/24 10:00");
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
