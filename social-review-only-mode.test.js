"use strict";

const assert = require("assert");
const batch = require("./social-final-approved-batch");
const reviewGate = require("./social-review-only-mode");

const sourcePosts = batch.POSTS.map((post) => ({
  ...post,
  status: post.conditionalWeather ? "paused" : "approved",
  assetLocked: true,
  result: {},
  platformStatus: {},
}));

const reset = reviewGate.initialReset({
  posts: sourcePosts,
  publicationLedger: {
    facebook: { old: { postId: sourcePosts[0].id, platformId: "fb-old" } },
    instagram: {},
  },
});

assert.strictEqual(reviewGate.VERSION, "2026-07-24-review-gate-v2");
assert.strictEqual(reset.socialReviewGateMode, true);
assert.strictEqual(reset.automaticSchedulingAfterReview, true);
assert.strictEqual(reset.posts.filter((post) => reviewGate.CANONICAL_IDS.has(post.id)).length, 10);
assert(reset.posts.filter((post) => reviewGate.CANONICAL_IDS.has(post.id)).every((post) => post.status === "draft"));
assert(reset.posts.filter((post) => reviewGate.CANONICAL_IDS.has(post.id)).every((post) => !post.reviewApprovedAt));
assert.strictEqual(Object.keys(reset.publicationLedger.facebook).length, 0);

// 背景重建無權把草稿改成 approved。
const automaticAttempt = {
  ...reset,
  posts: reset.posts.map((post, index) => index === 0 ? { ...post, status: "approved", assetLocked: true } : post),
};
const blockedAutomatic = reviewGate.protectStore(automaticAttempt, reset, false);
assert.strictEqual(blockedAutomatic.posts[0].status, "draft");
assert.strictEqual(blockedAutomatic.posts[0].assetLocked, false);
assert.strictEqual(blockedAutomatic.posts[0].reviewApprovedAt, "");

// 未審核直接按立即發布，也不能繞過審核。
const immediateAttempt = {
  ...reset,
  posts: reset.posts.map((post, index) => index === 0 ? { ...post, status: "approved", manualImmediatePublish: true } : post),
};
const blockedImmediate = reviewGate.protectStore(immediateAttempt, reset, true);
assert.strictEqual(blockedImmediate.posts[0].status, "draft");
assert.strictEqual(blockedImmediate.posts[0].manualImmediatePublish, false);

// App 明確按下 approve 後，固定貼文才進入自動排程。
const fixedIndex = reset.posts.findIndex((post) => !post.conditionalWeather);
const approveFixedInput = {
  ...reset,
  posts: reset.posts.map((post, index) => index === fixedIndex ? { ...post, status: "approved" } : post),
};
const approvedFixed = reviewGate.protectStore(approveFixedInput, reset, true);
const fixed = approvedFixed.posts[fixedIndex];
assert.strictEqual(fixed.status, "approved");
assert.strictEqual(fixed.assetLocked, true);
assert.strictEqual(fixed.autoPublishAfterReview, true);
assert(fixed.reviewApprovedAt);

// 審核後，排程器的 publishing / published 狀態可正常寫入。
const publishingInput = {
  ...approvedFixed,
  posts: approvedFixed.posts.map((post, index) => index === fixedIndex ? { ...post, status: "publishing" } : post),
};
const publishing = reviewGate.protectStore(publishingInput, approvedFixed, false);
assert.strictEqual(publishing.posts[fixedIndex].status, "publishing");
assert.strictEqual(publishing.posts[fixedIndex].reviewApprovedAt, fixed.reviewApprovedAt);

// 氣候貼文審核後維持待命，符合實際氣候時才可被自動啟用。
const weatherIndex = reset.posts.findIndex((post) => post.conditionalWeather);
const approveWeatherInput = {
  ...reset,
  posts: reset.posts.map((post, index) => index === weatherIndex ? { ...post, status: "approved" } : post),
};
const approvedWeather = reviewGate.protectStore(approveWeatherInput, reset, true);
const weather = approvedWeather.posts[weatherIndex];
assert.strictEqual(weather.status, "paused");
assert.strictEqual(weather.automationStandby, true);
assert.strictEqual(weather.autoPublishAfterReview, true);
assert(weather.reviewApprovedAt);

// 已審核內容若從 App 修改，必須回到草稿重新審核。
const editedInput = {
  ...approvedFixed,
  posts: approvedFixed.posts.map((post, index) => index === fixedIndex ? { ...post, title: `${post.title}（修改）` } : post),
};
const edited = reviewGate.protectStore(editedInput, approvedFixed, true);
assert.strictEqual(edited.posts[fixedIndex].status, "draft");
assert.strictEqual(edited.posts[fixedIndex].reviewApprovedAt, "");

console.log("PASS App review gate blocks unreviewed publishing and enables automatic scheduling only after approval");