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
const care = imported.filter((post) => post.sequenceRole === "care");
const product = imported.filter((post) => post.sequenceRole === "product");
assert.strictEqual(imported.length, 10);
assert.strictEqual(care.length, 5);
assert.strictEqual(product.length, 5);
assert(imported.every((post) => post.status === "draft"));
assert(imported.every((post) => post.assetLocked === false));
assert(imported.every((post) => post.publishInstagram && post.publishFacebook));
assert(imported.every((post) => !/小老闆知識\s*\d+|Day\s*\d+/i.test(post.title)));
assert(care.every((post) => new Date(post.scheduledAt).getUTCHours() === 2));
assert(product.every((post) => new Date(post.scheduledAt).getUTCHours() === 12));
assert(care.every((post) => /raw\.githubusercontent\.com\/TS15825868\/TS-LINE\/main\/public\/social\/first-batch\//.test(post.imageUrl)));
assert(product.every((post) => /ts15825868\.github\.io\/xianjiawei\/images\/dm-final\//.test(post.imageUrl)));
[
  "01_guilu-gao-100g-dm.jpg",
  "02_guilu-drink-30cc-dm.jpg",
  "04_luerong-fen-75g-dm.jpg",
  "05_guilu-tangkuai-75g-dm.jpg",
  "06_guilu-jiao-600g-dm.jpg",
].forEach((file) => assert(product.some((post) => post.imageUrl.includes(file)), file));

const blocked = /改善|治療|關節|卡卡|疲勞|精神不濟|補氣|生津|膠原蛋白|鈣質/;
assert(imported.every((post) => !blocked.test(`${post.title}\n${post.instagramCaption}\n${post.facebookCaption}`)));

batch.upsertBatch(loaded);
assert.strictEqual(store.posts.filter((post) => post.campaignId === batch.CAMPAIGN_ID).length, 10, "must be idempotent");
console.log("PASS first batch v2 creates 10 drafts: 5 themed care posts at 10:00 and 5 official-product-DM posts at 20:00");
