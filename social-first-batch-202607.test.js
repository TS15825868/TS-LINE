"use strict";

const assert = require("assert");
const batch = require("./social-first-batch-202607");

let store = {
  posts: [
    { id: "approved-mascot-original-01", campaignId: "xjw-approved-zip-202607-v1", status: "draft" },
    { id: "published-keep", campaignId: "xjw-approved-zip-202607-v1", status: "published" },
  ],
};
const loaded = {
  readStore: () => JSON.parse(JSON.stringify(store)),
  writeStore: (next) => { store = JSON.parse(JSON.stringify(next)); },
};

const result = batch.upsertBatch(loaded);
assert.strictEqual(result.count, 9);
assert.strictEqual(store.posts.find((post) => post.id === "approved-mascot-original-01").status, "cancelled");
assert.strictEqual(store.posts.find((post) => post.id === "published-keep").status, "published");

const imported = store.posts.filter((post) => post.campaignId === batch.CAMPAIGN_ID);
assert.strictEqual(imported.length, 9);
assert(imported.every((post) => post.status === "draft"));
assert(imported.every((post) => post.assetLocked === false));
assert(imported.every((post) => post.publishInstagram && post.publishFacebook));
assert(imported.filter((post) => post.sequenceRole === "care").every((post) => new Date(post.scheduledAt).getUTCHours() === 2));
assert(imported.filter((post) => post.sequenceRole === "product").every((post) => new Date(post.scheduledAt).getUTCHours() === 12));

batch.upsertBatch(loaded);
assert.strictEqual(store.posts.filter((post) => post.campaignId === batch.CAMPAIGN_ID).length, 9, "must be idempotent");

console.log("PASS first batch creates 9 future drafts, preserves published history and cancels old numbered drafts");
