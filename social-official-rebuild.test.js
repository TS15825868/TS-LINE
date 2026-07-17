"use strict";

const assert = require("assert");
const {
  CAMPAIGN_ID,
  IMAGE_VERSION,
  TOPICS,
  nextScheduleSlots,
  rebuildOfficialSocialSchedule,
} = require("./social-official-rebuild");
const { CARDS } = require("./knowledge-card-server");

assert.strictEqual(TOPICS.length, 30, "official social library must contain exactly 30 topics");
assert.strictEqual(Object.keys(CARDS).length, 30, "official image library must contain exactly 30 cards");
assert.strictEqual(new Set(TOPICS.map((topic) => topic.title)).size, 30, "titles must be unique");
assert.strictEqual(new Set(TOPICS.map((topic) => topic.slug)).size, 30, "image slugs must be unique");

const forbidden = ["療效", "治療", "改善疾病", "批號", "批次", "貶低", "別人不好", "保證有效"];
const libraryText = JSON.stringify(TOPICS);
for (const word of forbidden) assert.ok(!libraryText.includes(word), `forbidden wording: ${word}`);

const fixedNow = Date.parse("2026-07-17T04:00:00.000Z");
const slots = nextScheduleSlots(30, fixedNow);
assert.strictEqual(slots.length, 30);
for (const slot of slots) {
  const local = new Date(new Date(slot).getTime() + 8 * 60 * 60 * 1000);
  assert.ok([3, 5].includes(local.getUTCDay()), `slot is not Wednesday or Friday: ${slot}`);
  assert.strictEqual(local.getUTCHours(), 20, `slot is not 20:00 Taipei: ${slot}`);
  assert.strictEqual(local.getUTCMinutes(), 0);
}

let store = {
  posts: [
    { id: "history-1", status: "published", title: "已發布歷史", publishedAt: "2026-07-15T12:00:00.000Z" },
    { id: "old-draft", status: "draft", title: "舊草稿" },
    { id: "old-approved", status: "approved", title: "舊已審核" },
    { id: "old-failed", status: "failed", title: "舊失敗" },
    { id: "old-cancelled", status: "cancelled", title: "舊取消" },
  ],
};
const readStore = () => JSON.parse(JSON.stringify(store));
const writeStore = (next) => { store = JSON.parse(JSON.stringify(next)); };

const first = rebuildOfficialSocialSchedule(readStore, writeStore, { nowMs: fixedNow });
assert.strictEqual(first.preservedPublished, 1);
assert.strictEqual(first.removedUnpublished, 4);
assert.strictEqual(first.inserted, 30);
assert.strictEqual(first.pendingReview, 30);
assert.strictEqual(store.posts.length, 31);
assert.strictEqual(store.posts.filter((post) => post.status === "published").length, 1);

const drafts = store.posts.filter((post) => post.campaignId === CAMPAIGN_ID);
assert.strictEqual(drafts.length, 30);
assert.ok(drafts.every((post) => post.status === "draft"));
assert.ok(drafts.every((post) => post.imageUrl.includes(`/social-assets/knowledge/${IMAGE_VERSION}/`)));
assert.strictEqual(new Set(drafts.map((post) => post.title)).size, 30);
assert.strictEqual(new Set(drafts.map((post) => post.imageUrl)).size, 30);
assert.strictEqual(new Set(drafts.map((post) => post.instagramCaption)).size, 30);
assert.strictEqual(new Set(drafts.map((post) => post.facebookCaption)).size, 30);
assert.ok(drafts.every((post) => post.instagramCaption && post.facebookCaption));

store.posts.find((post) => post.id === "official-mascot-v10-01").status = "approved";
const approvedSchedule = store.posts.find((post) => post.id === "official-mascot-v10-01").scheduledAt;
const second = rebuildOfficialSocialSchedule(readStore, writeStore, { nowMs: fixedNow + 1000 });
assert.strictEqual(second.inserted, 0, "rerun must not duplicate current campaign");
assert.strictEqual(store.posts.filter((post) => post.campaignId === CAMPAIGN_ID).length, 30);
const approved = store.posts.find((post) => post.id === "official-mascot-v10-01");
assert.strictEqual(approved.status, "approved", "rerun must not reset reviewed post to draft");
assert.strictEqual(approved.scheduledAt, approvedSchedule, "rerun must preserve reviewed schedule");

console.log("PASS old unpublished social posts removed and 30 official mascot posts rebuilt as unique pending-review drafts");
