"use strict";

const assert = require("assert");
const {
  buildOfficialDrafts,
  resetOfficialSocialDrafts,
} = require("./social-official-draft-reset");

const fixedNow = new Date("2026-07-17T02:00:00.000Z");
const drafts = buildOfficialDrafts(fixedNow);
assert.strictEqual(drafts.length, 30);
assert.strictEqual(new Set(drafts.map((item) => item.title)).size, 30);
assert.strictEqual(new Set(drafts.map((item) => item.imageUrl)).size, 30);
assert.ok(drafts.every((item) => item.status === "draft"));
assert.ok(drafts.every((item) => item.platformStatus.instagram === "待審核"));
assert.ok(drafts.every((item) => /\/social-assets\/knowledge\/v9\//.test(item.imageUrl)));
for (const item of drafts) {
  const local = new Date(item.scheduledAt);
  assert.strictEqual(local.getUTCHours(), 12, "Taipei 20:00 must be UTC 12:00");
  assert.ok([3, 5].includes(local.getUTCDay()), "schedule must be Wednesday or Friday");
}

let store = {
  posts: [
    { id: "published", status: "published", title: "歷史已發布" },
    { id: "old-draft", status: "draft", title: "舊草稿" },
    { id: "old-approved", status: "approved", title: "舊已審核" },
    { id: "old-failed", status: "failed", title: "舊失敗" },
  ],
};
const readStore = () => JSON.parse(JSON.stringify(store));
const writeStore = (next) => { store = JSON.parse(JSON.stringify(next)); };
const result = resetOfficialSocialDrafts(readStore, writeStore, fixedNow);
assert.strictEqual(result.preservedPublishedHistory, 1);
assert.strictEqual(result.removedUnpublished, 3);
assert.strictEqual(result.draftsCreated, 30);
assert.strictEqual(store.posts.length, 31);
assert.ok(store.posts.some((item) => item.id === "published"));
assert.ok(!store.posts.some((item) => item.id === "old-draft"));
console.log("PASS replace all unpublished social posts with 30 official review drafts");
