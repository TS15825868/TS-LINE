"use strict";

const assert = require("assert");
const batch = require("./social-first-batch-202607");

let store = {
  posts: [
    { id: "approved-mascot-original-01", campaignId: "xjw-approved-zip-202607-v1", status: "draft" },
    { id: "old-first-batch", campaignId: "xjw-social-first-batch-202607-v1", status: "approved" },
    { id: "published-keep", campaignId: "xjw-approved-zip-202607-v1", status: "published" },
  ],
};
const loaded = {
  readStore: () => JSON.parse(JSON.stringify(store)),
  writeStore: (next) => { store = JSON.parse(JSON.stringify(next)); },
};

const result = batch.upsertBatch(loaded);
assert.strictEqual(result.count, 10);
assert.strictEqual(store.posts.find((post) => post.id === "approved-mascot-original-01").status, "cancelled");
assert.strictEqual(store.posts.find((post) => post.id === "old-first-batch").status, "cancelled");
assert.strictEqual(store.posts.find((post) => post.id === "published-keep").status, "published");

const imported = store.posts.filter((post) => post.campaignId === batch.CAMPAIGN_ID);
assert.strictEqual(imported.length, 10);
assert.strictEqual(imported.filter((post) => post.sequenceRole === "care").length, 5);
assert.strictEqual(imported.filter((post) => post.sequenceRole === "product").length, 5);
assert(imported.every((post) => post.status === "draft"));
assert(imported.every((post) => post.assetLocked === false));
assert(imported.every((post) => post.publishInstagram && post.publishFacebook));
assert(imported.every((post) => !/小老闆知識\s*\d+|Day\s*\d+/i.test(post.title)));
assert(imported.filter((post) => post.sequenceRole === "care").every((post) => new Date(post.scheduledAt).getUTCHours() === 2));
assert(imported.filter((post) => post.sequenceRole === "product").every((post) => new Date(post.scheduledAt).getUTCHours() === 12));
assert(imported.filter((post) => post.sequenceRole === "care").every((post) => /raw\.githubusercontent\.com\/TS15825868\/TS-LINE\/main\/public\/mascot\//.test(post.imageUrl)));
assert(imported.filter((post) => post.sequenceRole === "product").every((post) => /raw\.githubusercontent\.com\/TS15825868\/xianjiawei\/main\/images\/dm-final\//.test(post.imageUrl)));
assert(imported.some((post) => post.imageUrl.includes("01_guilu-gao-100g-dm.jpg")));
assert(imported.some((post) => post.imageUrl.includes("02_guilu-drink-30cc-dm.jpg")));
assert(imported.some((post) => post.imageUrl.includes("04_luerong-fen-75g-dm.jpg")));
assert(imported.some((post) => post.imageUrl.includes("05_guilu-tangkuai-75g-dm.jpg")));
assert(imported.some((post) => post.imageUrl.includes("06_guilu-jiao-600g-dm.jpg")));

batch.upsertBatch(loaded);
assert.strictEqual(store.posts.filter((post) => post.campaignId === batch.CAMPAIGN_ID).length, 10, "must be idempotent");

console.log("PASS first batch creates 10 drafts: 5 care at 10:00 and 5 official-product-DM posts at 20:00");
