"use strict";

const assert = require("assert");
const policy = require("./social-clear-republish-policy");
const assets = require("./social-original-asset-override");

(async () => {
  assert.strictEqual(policy.VERSION, "3.0.0");
  assert.strictEqual(policy.SCHEDULED_AT, "2026-07-29T12:00:00.000Z", "建議排程應為台灣時間2026/7/29晚上8:00");
  assert.strictEqual(policy.SOURCE_IMAGE_FILE, "634CBEF9-5A29-44EE-BFFC-AA5DDB8C049B.PNG");
  assert.strictEqual(policy.appliedPost.id, policy.REPUBLISH_POST_ID);
  assert.strictEqual(policy.appliedPost.title, "工作再忙，也別忘了休息一下");
  assert.strictEqual(policy.appliedPost.imageName, "care-work-rest-clear.jpg");
  assert.strictEqual(policy.appliedPost.manualScheduleOverride, false);
  assert.strictEqual(policy.appliedPost.oneTimeCorrectedRepublish, true);
  assert.strictEqual(policy.appliedPost.originalCompositionLocked, true);
  assert.strictEqual(policy.appliedPost.originalCharacterLayoutLocked, true);
  assert.strictEqual(policy.appliedPost.originalSourceDimensions, "1254x1254");
  assert.strictEqual(policy.appliedPost.scheduleTimePolicy, "fixed-wed-20:00");
  assert(policy.appliedPost.republishReason.includes("人工核准後才啟用"));

  const info = await assets.info(policy.appliedPost.imageName);
  assert.strictEqual(info.ok, true, info.error || "清晰原圖無法讀取");
  assert.strictEqual(info.width, 1254);
  assert.strictEqual(info.height, 1254);
  assert(info.exactOriginalSource || info.crispVectorFallback, "必須有清晰原圖或清晰備援");
  console.log("PASS corrected post is pending review with a Wednesday 20:00 suggested slot");
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
