"use strict";

const assert = require("assert");
const batch = require("./social-final-approved-batch");
const reviewOnly = require("./social-review-only-mode");

const posts = batch.POSTS.map((post, index) => ({
  ...post,
  status: index === 0 ? "partial" : "approved",
  assetLocked: true,
  manualImmediatePublish: index === 0,
  result: index === 0 ? { facebook: { id: "fb-old" } } : {},
  platformStatus: index === 0 ? { facebook: "成功", instagram: "失敗" } : {},
  facebookPublishedAt: index === 0 ? "2026-07-24T03:57:31.962Z" : "",
}));

const fingerprint = "abc";
const reset = reviewOnly.initialReset({
  posts,
  publicationLedger: {
    facebook: { [fingerprint]: { postId: posts[0].id, platformId: "fb-old" } },
    instagram: {},
  },
});

assert.strictEqual(reviewOnly.VERSION, "2026-07-24-review-only-v1");
assert.strictEqual(reset.socialReviewOnlyMode, true);
assert.strictEqual(reset.posts.filter((post) => reviewOnly.CANONICAL_IDS.has(post.id)).length, 10);
assert(reset.posts.filter((post) => reviewOnly.CANONICAL_IDS.has(post.id)).every((post) => post.status === "draft"));
assert(reset.posts.filter((post) => reviewOnly.CANONICAL_IDS.has(post.id)).every((post) => post.manualPublishOnly === true));
assert(reset.posts.filter((post) => reviewOnly.CANONICAL_IDS.has(post.id)).every((post) => post.manualImmediatePublish === false));
assert.strictEqual(Object.keys(reset.publicationLedger.facebook).length, 0);

const manual = {
  ...reset,
  posts: reset.posts.map((post, index) => index === 0 ? { ...post, status: "approved", manualImmediatePublish: true } : post),
};
const protectedStore = reviewOnly.protectStore(manual);
assert.strictEqual(protectedStore.posts[0].status, "approved");
assert.strictEqual(protectedStore.posts[0].manualImmediatePublish, true);
assert(protectedStore.posts[0].manualReviewConfirmedAt);
assert(protectedStore.posts.slice(1).every((post) => post.status === "draft"));

console.log("PASS review-only mode resets all social posts to App drafts and allows only explicit manual publishing");
