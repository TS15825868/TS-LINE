"use strict";

const assert = require("assert");
const weekly = require("./social-weekly-schedule-override");
const reviewGate = require("./social-review-only-mode");
const batch = require("./social-final-approved-batch");
const sales = require("./line-sales-master.json");

assert.strictEqual(weekly.VERSION, "2026-07-25-weekly-once-v1");
assert.strictEqual(reviewGate.VERSION, "2026-07-25-review-gate-v4");
assert.strictEqual(weekly.FIXED_SCHEDULES.length, 7);
assert.strictEqual(new Set(weekly.FIXED_SCHEDULES).size, weekly.FIXED_SCHEDULES.length);

for (const scheduledAt of weekly.FIXED_SCHEDULES) {
  const parts = reviewGate.taipeiParts(scheduledAt);
  assert(parts, `無法解析排程：${scheduledAt}`);
  assert.strictEqual(parts.weekday, "Wed", `固定貼文不是週三：${scheduledAt}`);
  assert.strictEqual(parts.hour, "20", `固定貼文不是晚上8點：${scheduledAt}`);
  assert.strictEqual(parts.minute, "00", `固定貼文分鐘不正確：${scheduledAt}`);
}

assert.strictEqual(batch.POSTS.length, 10);
assert.strictEqual(batch.POSTS.filter((post) => post.conditionalWeather).length, 3);
assert.strictEqual(batch.POSTS.filter((post) => !post.conditionalWeather).length, 7);
assert.strictEqual(new Set(batch.POSTS.map((post) => post.id)).size, 10);
assert.strictEqual(new Set(batch.POSTS.map((post) => post.title)).size, 10);
assert(batch.POSTS.every((post) => post.qBossMascotLocked === true));
assert(batch.POSTS.every((post) => post.deerPartnerPresent === true));
assert(batch.POSTS.every((post) => post.turtlePartnerPresent === true));

const reset = reviewGate.initialReset({
  posts: batch.POSTS.map((post) => ({
    ...post,
    status: post.conditionalWeather ? "paused" : "approved",
    assetLocked: true,
  })),
  publicationLedger: { facebook: {}, instagram: {} },
});
const canonical = reset.posts.filter((post) => reviewGate.CANONICAL_IDS.has(post.id));
assert.strictEqual(canonical.length, 10);
assert(canonical.every((post) => post.status === "draft"));
assert(canonical.every((post) => post.assetLocked === false));
assert(canonical.every((post) => !post.reviewApprovedAt));
assert.strictEqual(reset.automaticSchedulingAfterReview, true);
assert.strictEqual(reset.automaticRetryEnabled, false);

assert.strictEqual(sales.products["guilu-gao"].price, 2000);
assert.strictEqual(sales.products["guilu-drink-30"].price, 100);
assert.strictEqual(sales.products["guilu-drink-180"].price, 200);
assert.strictEqual(sales.products["guilu-tangkuai"].price, 2000);
assert.strictEqual(sales.products["luerong-fen"].price, 2000);
assert.strictEqual(sales.imagePolicy.approvalRequiredBeforePublish, true);
assert.strictEqual(sales.imagePolicy.realProductImagesOnly, true);
assert(sales.imagePolicy.partners.includes("小鹿娃娃"));
assert(sales.imagePolicy.partners.includes("小烏龜娃娃"));

console.log("PASS current policy: weekly Wednesday 20:00, manual review, fixed mascot partners and official prices");
