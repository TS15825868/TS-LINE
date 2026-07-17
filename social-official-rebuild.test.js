"use strict";

const assert = require("assert");
const {
  CAMPAIGN_ID,
  ASSET_STORE_KEY,
  TOPICS,
  nextScheduleSlots,
  rebuildOfficialSocialSchedule,
} = require("./social-official-rebuild");

assert.strictEqual(TOPICS.length, 20, "approved ZIP library must contain exactly 20 topics");
assert.strictEqual(new Set(TOPICS.map((topic) => topic.title)).size, 20, "titles must be unique");
assert.strictEqual(new Set(TOPICS.map((topic) => topic.slug)).size, 20, "slugs must be unique");
assert.strictEqual(new Set(TOPICS.map((topic) => topic.file)).size, 20, "original image filenames must be unique");
assert.ok(TOPICS.every((topic) => /^[0-9A-F-]+\.PNG$/.test(topic.file)), "all images must use approved ZIP filenames");

const forbiddenClaims = ["療效", "治療", "改善疾病", "保證有效"];
const libraryText = JSON.stringify(TOPICS);
for (const word of forbiddenClaims) assert.ok(!libraryText.includes(word), `forbidden claim: ${word}`);
assert.ok(
  TOPICS.some((topic) => topic.lead.includes("不必靠比較或貶低別人")),
  "守規文案應明確提醒不比較、不貶低同業"
);

const fixedNow = Date.parse("2026-07-17T04:00:00.000Z");
const slots = nextScheduleSlots(20, fixedNow);
assert.strictEqual(slots.length, 20);
for (const slot of slots) {
  const local = new Date(new Date(slot).getTime() + 8 * 60 * 60 * 1000);
  assert.ok([3, 5].includes(local.getUTCDay()), `slot is not Wednesday or Friday: ${slot}`);
  assert.strictEqual(local.getUTCHours(), 20, `slot is not 20:00 Taipei: ${slot}`);
  assert.strictEqual(local.getUTCMinutes(), 0);
}

let store = {
  posts: [
    { id: "history-1", status: "published", title: "已發布歷史", publishedAt: "2026-07-15T12:00:00.000Z" },
    { id: "wrong-draft-1", status: "draft", title: "錯誤自動生成草稿" },
    { id: "wrong-approved-1", status: "approved", title: "錯誤已審核草稿" },
  ],
};
const readStore = () => JSON.parse(JSON.stringify(store));
const writeStore = (next) => { store = JSON.parse(JSON.stringify(next)); };

const waiting = rebuildOfficialSocialSchedule(readStore, writeStore, { nowMs: fixedNow });
assert.strictEqual(waiting.awaitingApprovedZip, true);
assert.strictEqual(waiting.preservedPublished, 1);
assert.strictEqual(waiting.removedUnpublished, 2);
assert.strictEqual(waiting.pendingReview, 0);
assert.strictEqual(store.posts.length, 1, "wrong unpublished posts must be removed before ZIP import");

store[ASSET_STORE_KEY] = {
  campaignId: CAMPAIGN_ID,
  importedAt: new Date(fixedNow).toISOString(),
  sourceName: "社群排程.zip",
  files: Object.fromEntries(
    TOPICS.flatMap((topic) => [
      [topic.file, `https://storage.example/approved/${encodeURIComponent(topic.file)}`],
      [topic.slug, `https://storage.example/approved/${encodeURIComponent(topic.file)}`],
    ])
  ),
};

const first = rebuildOfficialSocialSchedule(readStore, writeStore, { nowMs: fixedNow });
assert.strictEqual(first.awaitingApprovedZip, false);
assert.strictEqual(first.inserted, 20);
assert.strictEqual(first.pendingReview, 20);
assert.strictEqual(store.posts.length, 21);
assert.strictEqual(store.posts.filter((post) => post.status === "published").length, 1);

const drafts = store.posts.filter((post) => post.campaignId === CAMPAIGN_ID);
assert.strictEqual(drafts.length, 20);
assert.ok(drafts.every((post) => post.status === "draft"));
assert.ok(drafts.every((post) => /^https:\/\/storage\.example\/approved\//.test(post.imageUrl)));
assert.ok(drafts.every((post) => post.sourceImageFile && post.imageUrl.includes(encodeURIComponent(post.sourceImageFile))));
assert.strictEqual(new Set(drafts.map((post) => post.title)).size, 20);
assert.strictEqual(new Set(drafts.map((post) => post.imageUrl)).size, 20);
assert.strictEqual(new Set(drafts.map((post) => post.instagramCaption)).size, 20);
assert.strictEqual(new Set(drafts.map((post) => post.facebookCaption)).size, 20);
assert.ok(drafts.every((post) => post.instagramCaption && post.facebookCaption));

const firstDraft = drafts[0];
firstDraft.status = "approved";
const approvedSchedule = firstDraft.scheduledAt;
const second = rebuildOfficialSocialSchedule(readStore, writeStore, { nowMs: fixedNow + 1000 });
assert.strictEqual(second.inserted, 0, "rerun must not duplicate approved original campaign");
assert.strictEqual(store.posts.filter((post) => post.campaignId === CAMPAIGN_ID).length, 20);
const approved = store.posts.find((post) => post.id === firstDraft.id);
assert.strictEqual(approved.status, "approved", "rerun must preserve reviewed post status");
assert.strictEqual(approved.scheduledAt, approvedSchedule, "rerun must preserve reviewed schedule");

console.log("PASS preserve published history, clear wrong unpublished posts, and rebuild 20 approved ZIP originals as pending review");
