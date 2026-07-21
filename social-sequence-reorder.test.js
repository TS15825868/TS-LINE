"use strict";

const assert = require("assert");
const {
  CAMPAIGN_ID,
  SEQUENCE_VERSION,
  ORDER,
  reorderStore,
} = require("./social-sequence-reorder");

const nowMs = Date.UTC(2026, 6, 21, 2, 0, 0);
const published = {
  id: "published-keep",
  campaignId: CAMPAIGN_ID,
  status: "published",
  scheduledAt: "2026-07-18T12:00:00.000Z",
};
const posts = ORDER.map((id, index) => ({
  id,
  campaignId: CAMPAIGN_ID,
  status: index === 0 ? "approved" : "draft",
  scheduledAt: new Date(nowMs + index * 86400000).toISOString(),
  title: `貼文 ${index + 1}`,
}));
const unrelated = {
  id: "other-campaign",
  campaignId: "other",
  status: "approved",
  scheduledAt: "2026-07-22T12:00:00.000Z",
};

const result = reorderStore({ posts: [published, unrelated, ...posts] }, nowMs);
assert.strictEqual(result.store.officialSocialSequenceVersion, SEQUENCE_VERSION);
assert.strictEqual(result.store.posts.find((post) => post.id === published.id).scheduledAt, published.scheduledAt);
assert.strictEqual(result.store.posts.find((post) => post.id === unrelated.id).scheduledAt, unrelated.scheduledAt);

const ordered = ORDER.map((id) => result.store.posts.find((post) => post.id === id));
for (let index = 0; index < ordered.length; index += 1) {
  const post = ordered[index];
  assert.ok(post, `missing ${ORDER[index]}`);
  const local = new Date(Date.parse(post.scheduledAt) + 8 * 60 * 60 * 1000);
  assert.ok([3, 5].includes(local.getUTCDay()), "must be Wednesday or Friday");
  assert.strictEqual(local.getUTCHours(), 20, "must be 20:00 Taipei time");
  assert.strictEqual(local.getUTCMinutes(), 0);
  assert.strictEqual(post.sequenceRole, index % 2 === 0 ? "care" : "product");
  if (index > 0) assert.ok(Date.parse(post.scheduledAt) > Date.parse(ordered[index - 1].scheduledAt));
}

const second = reorderStore(result.store, nowMs + 86400000);
assert.strictEqual(second.skipped, true, "must not move the sequence again after migration");
assert.strictEqual(second.changed, 0);

console.log("PASS reorder all unpublished mascot posts into weekly care/product pairs; preserve published history and two posts per week");
