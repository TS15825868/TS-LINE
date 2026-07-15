"use strict";

const assert = require("assert");
const {
  POSTS,
  weeklySchedule,
  seedSocialDraftLibraryWeekly,
} = require("./social-draft-library-weekly");

assert.strictEqual(POSTS.length, 60, "should provide 60 long-term drafts");
assert.ok(POSTS.every((post) => /^https:\/\//.test(post.imageUrl)), "every draft needs a public image");
assert.ok(POSTS.every((post) => post.instagramCaption && post.facebookCaption), "every draft needs IG and FB copy");

const formatter = new Intl.DateTimeFormat("en-US", {
  timeZone: "Asia/Taipei",
  weekday: "short",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

for (let index = 0; index < POSTS.length; index += 1) {
  const post = POSTS[index];
  assert.strictEqual(post.scheduledAt, weeklySchedule(index));
  const parts = Object.fromEntries(formatter.formatToParts(new Date(post.scheduledAt)).map((part) => [part.type, part.value]));
  assert.ok(["Wed", "Fri"].includes(parts.weekday), `draft ${index + 1} is not Wednesday or Friday`);
  assert.strictEqual(parts.hour, "20", `draft ${index + 1} is not at 20:00`);
  assert.strictEqual(parts.minute, "00", `draft ${index + 1} is not at 20:00`);
}

for (let index = 1; index < POSTS.length; index += 1) {
  const gap = (new Date(POSTS[index].scheduledAt) - new Date(POSTS[index - 1].scheduledAt)) / 86400000;
  assert.ok([2, 5, 7].includes(gap), `unexpected cadence gap at ${index}: ${gap}`);
}

let store = { posts: [] };
const readStore = () => JSON.parse(JSON.stringify(store));
const writeStore = (next) => { store = JSON.parse(JSON.stringify(next)); };

const first = seedSocialDraftLibraryWeekly(readStore, writeStore);
assert.strictEqual(first.added, 60);
assert.strictEqual(first.updated, 0);
assert.strictEqual(first.preserved, 0);
assert.strictEqual(store.posts.length, 60);
assert.ok(store.posts.every((post) => post.status === "draft"));

store.posts[0].status = "published";
store.posts[0].scheduledAt = "2026-01-01T00:00:00.000Z";
store.posts[1].status = "cancelled";
store.posts[1].scheduledAt = "2026-01-02T00:00:00.000Z";
const second = seedSocialDraftLibraryWeekly(readStore, writeStore);
assert.strictEqual(second.added, 0);
assert.strictEqual(second.updated, 58);
assert.strictEqual(second.preserved, 2);
assert.strictEqual(store.posts[0].scheduledAt, "2026-01-01T00:00:00.000Z");
assert.strictEqual(store.posts[1].scheduledAt, "2026-01-02T00:00:00.000Z");
assert.strictEqual(store.posts[2].scheduledAt, POSTS[2].scheduledAt);

console.log("PASS 60 social drafts on Wednesday and Friday at 20:00 Asia/Taipei");
