"use strict";

const assert = require("assert");
const {
  POSTS,
  weeklySchedule,
  seedSocialDraftLibraryExtended,
} = require("./social-draft-library-extended");

assert.strictEqual(POSTS.length, 42, "should provide 42 long-term drafts");
assert.ok(POSTS.every((post) => post.imageUrl.startsWith("https://")), "every draft needs a public image");
assert.ok(POSTS.every((post) => post.instagramCaption && post.facebookCaption), "every draft needs IG and FB copy");

for (let index = 0; index < POSTS.length; index += 1) {
  assert.strictEqual(POSTS[index].scheduledAt, weeklySchedule(index));
}

for (let index = 1; index < POSTS.length; index += 1) {
  const days = (new Date(POSTS[index].scheduledAt) - new Date(POSTS[index - 1].scheduledAt)) / 86400000;
  assert.ok([3, 6, 5].includes(days), `unexpected cadence gap at ${index}: ${days}`);
}

let store = { posts: [] };
const readStore = () => JSON.parse(JSON.stringify(store));
const writeStore = (next) => { store = JSON.parse(JSON.stringify(next)); };

const first = seedSocialDraftLibraryExtended(readStore, writeStore);
assert.strictEqual(first.added, 42);
assert.strictEqual(first.updated, 0);
assert.strictEqual(store.posts.length, 42);
assert.ok(store.posts.every((post) => post.status === "draft"));

store.posts[0].status = "published";
store.posts[0].scheduledAt = "2026-01-01T00:00:00.000Z";
const second = seedSocialDraftLibraryExtended(readStore, writeStore);
assert.strictEqual(second.added, 0);
assert.strictEqual(second.updated, 41);
assert.strictEqual(store.posts.length, 42);
assert.strictEqual(store.posts[0].scheduledAt, "2026-01-01T00:00:00.000Z", "published post must not be rescheduled");
assert.strictEqual(store.posts[1].scheduledAt, POSTS[1].scheduledAt, "unpublished drafts should follow weekly cadence");

console.log("PASS 42 social drafts at weekly 1-2 post cadence");
