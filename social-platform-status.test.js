"use strict";

const assert = require("assert");
const {
  normalizePost,
  normalizeSocialPlatformStatus,
  wrapExecute,
} = require("./social-platform-status");

const stale = {
  id: "post-1",
  publishInstagram: true,
  publishFacebook: true,
  status: "published",
  result: {
    instagram: { id: "ig-1" },
    facebook: { id: "fb-1" },
  },
  platformStatus: {
    instagram: "成功",
    facebook: "失敗",
  },
  lastError: "Facebook：舊錯誤",
};

const normalized = normalizePost(stale);
assert.strictEqual(normalized.changed, true);
assert.strictEqual(normalized.post.status, "published");
assert.strictEqual(normalized.post.platformStatus.instagram, "成功");
assert.strictEqual(normalized.post.platformStatus.facebook, "成功");
assert.strictEqual(normalized.post.lastError, "");
assert.ok(normalized.post.publishedAt);

let store = { posts: [stale] };
const readStore = () => JSON.parse(JSON.stringify(store));
const writeStore = (next) => { store = JSON.parse(JSON.stringify(next)); };
const summary = normalizeSocialPlatformStatus(readStore, writeStore);
assert.strictEqual(summary.updated, 1);
assert.strictEqual(store.posts[0].platformStatus.facebook, "成功");

let called = 0;
const wrapped = wrapExecute(async () => {
  called += 1;
  store.posts[0].result.facebook = { id: "fb-2" };
  store.posts[0].status = "published";
}, readStore, writeStore);

wrapped("post-1").then((post) => {
  assert.strictEqual(called, 1);
  assert.strictEqual(post.platformStatus.facebook, "成功");
  console.log("PASS social platform status reconciliation after successful publish");
}).catch((error) => {
  console.error(error);
  process.exit(1);
});
