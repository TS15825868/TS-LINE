"use strict";

const assert = require("assert");
const {
  VERSION,
  ACTIVE_STATUSES,
  canonicalPosts,
  clean,
  duplicateReason,
  validImage,
  validCopy,
  auditSocialSchedule,
} = require("./social-schedule-audit");

const canonical = canonicalPosts();
assert.strictEqual(VERSION, "1.0.0");
assert.strictEqual(canonical.length, 90, "canonical social library must contain 90 source posts before dedupe");

const createdAt = "2026-07-16T00:00:00.000Z";
let store = {
  posts: canonical.map((item, index) => ({
    id: `canonical-${index}`,
    ...item,
    status: "draft",
    result: {},
    platformStatus: { instagram: "待處理", facebook: "待處理" },
    createdAt,
    updatedAt: createdAt,
  })),
};

store.posts.push({
  id: "manual-exact-duplicate",
  title: canonical[0].title,
  imageUrl: canonical[0].imageUrl,
  instagramCaption: canonical[0].instagramCaption,
  facebookCaption: canonical[0].facebookCaption,
  publishInstagram: true,
  publishFacebook: true,
  scheduledAt: canonical[0].scheduledAt,
  status: "draft",
  createdAt,
  updatedAt: createdAt,
});

store.posts.push({
  id: "manual-missing-image",
  title: "人工草稿｜缺圖測試",
  imageUrl: "",
  instagramCaption: "這是一篇完整但沒有圖片的 Instagram 文案。",
  facebookCaption: "這是一篇完整但沒有圖片的 Facebook 文案。",
  publishInstagram: true,
  publishFacebook: true,
  scheduledAt: canonical[0].scheduledAt,
  status: "draft",
  createdAt,
  updatedAt: createdAt,
});

const published = {
  id: "published-history",
  title: canonical[0].title,
  imageUrl: canonical[0].imageUrl,
  instagramCaption: canonical[0].instagramCaption,
  facebookCaption: canonical[0].facebookCaption,
  publishInstagram: true,
  publishFacebook: true,
  scheduledAt: "2026-07-15T12:00:00.000Z",
  status: "published",
  publishedAt: "2026-07-15T12:01:00.000Z",
  createdAt,
  updatedAt: createdAt,
};
store.posts.push(published);

const readStore = () => JSON.parse(JSON.stringify(store));
const writeStore = (next) => { store = JSON.parse(JSON.stringify(next)); };

const first = auditSocialSchedule(readStore, writeStore, { now: "2026-07-16T00:00:00.000Z" });
assert.strictEqual(first.canonicalTotal, 90);
assert.ok(first.activeTotal >= 70 && first.activeTotal <= 90, `unexpected active total after dedupe: ${first.activeTotal}`);
assert.ok(first.duplicatesCancelled >= 1, "duplicate draft must be cancelled");
assert.strictEqual(first.needsFix, 1, "missing-image draft must be marked for correction");

const verified = store.posts.filter((post) => post.auditStatus === "verified" && ACTIVE_STATUSES.has(post.status));
assert.strictEqual(verified.length, first.activeTotal);
assert.ok(verified.every(validImage), "all scheduled posts must have a valid HTTPS image");
assert.ok(verified.every(validCopy), "all scheduled posts must have title, IG copy and FB copy");
assert.ok(verified.every((post) => post.publishInstagram && post.publishFacebook), "all canonical scheduled posts must target IG and FB");
assert.ok(verified.every((post) => [3, 5].includes(new Date(post.scheduledAt).getUTCDay()) && new Date(post.scheduledAt).getUTCHours() === 12), "all schedules must be Wednesday or Friday at 20:00 Asia/Taipei");

for (let index = 1; index < verified.length; index += 1) {
  assert.ok(new Date(verified[index].scheduledAt) > new Date(verified[index - 1].scheduledAt), "schedule must be strictly increasing");
}

for (let left = 0; left < verified.length; left += 1) {
  for (let right = left + 1; right < verified.length; right += 1) {
    assert.strictEqual(duplicateReason(verified[left], verified[right]), "", `duplicate survived audit: ${verified[left].title} / ${verified[right].title}`);
  }
}

assert.strictEqual(new Set(verified.map((post) => clean(post.title))).size, verified.length, "scheduled titles must be unique");
assert.ok(store.posts.some((post) => post.id === "manual-exact-duplicate" && post.status === "cancelled"));
assert.ok(store.posts.some((post) => post.id === "manual-missing-image" && post.status === "rejected" && post.auditStatus === "needs-fix"));
assert.ok(store.posts.some((post) => post.id === "published-history" && post.status === "published" && post.publishedAt === published.publishedAt), "published history must remain untouched");

const schedules = verified.map((post) => post.scheduledAt);
const second = auditSocialSchedule(readStore, writeStore, { now: "2026-07-16T03:00:00.000Z" });
const verifiedAgain = store.posts.filter((post) => post.auditStatus === "verified" && ACTIVE_STATUSES.has(post.status));
assert.deepStrictEqual(verifiedAgain.map((post) => post.scheduledAt), schedules, "restarts must not shift the audited schedule");
assert.strictEqual(second.scheduleOffset, first.scheduleOffset);

console.log("PASS full social schedule dedupe, balanced order, verified images and matched platform copy", {
  canonical: first.canonicalTotal,
  scheduled: first.activeTotal,
  duplicatesCancelled: first.duplicatesCancelled,
  needsFix: first.needsFix,
  categories: first.categoryCounts,
  firstAt: first.firstAt,
  lastAt: first.lastAt,
});
