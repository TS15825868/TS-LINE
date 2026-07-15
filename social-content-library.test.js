"use strict";

const assert = require("assert");
const { POSTS: BASE_POSTS } = require("./social-draft-library-weekly");
const { CARDS } = require("./knowledge-card-server");
const {
  KNOWLEDGE,
  POSTS,
  normalize,
  fingerprint,
  interleave,
  seedSocialContentLibrary,
} = require("./social-content-library");

assert.strictEqual(KNOWLEDGE.length, 12);
assert.strictEqual(Object.keys(CARDS).length, 12);
assert.strictEqual(POSTS.length, BASE_POSTS.length + KNOWLEDGE.length);
assert.ok(KNOWLEDGE.every((post) => /^https:\/\/ts-line\.onrender\.com\/social-assets\/knowledge\/.+\.png\?v=1$/.test(post.imageUrl)));
assert.strictEqual(new Set(KNOWLEDGE.map((post) => post.title)).size, KNOWLEDGE.length);
assert.strictEqual(new Set(KNOWLEDGE.map(fingerprint)).size, KNOWLEDGE.length);
assert.strictEqual(new Set(POSTS.map((post) => post.campaignKey)).size, POSTS.length);
assert.ok(POSTS.every((post) => {
  const date = new Date(post.scheduledAt);
  return [3, 5].includes(date.getUTCDay()) && date.getUTCHours() === 12;
}), "all posts must resolve to Wednesday or Friday 20:00 Asia/Taipei");

const merged = interleave(BASE_POSTS, KNOWLEDGE);
const positions = merged.map((post, index) => post.campaignId === "xjw-knowledge-202607-v1" ? index : -1).filter((index) => index >= 0);
assert.strictEqual(positions.length, 12);
assert.ok(positions[0] < BASE_POSTS.length, "knowledge posts must be interleaved, not only appended");

const existingText = new Set(BASE_POSTS.map((post) => normalize(`${post.title}\n${post.instagramCaption}\n${post.facebookCaption}`)));
KNOWLEDGE.forEach((post) => {
  assert.ok(!existingText.has(normalize(`${post.title}\n${post.instagramCaption}\n${post.facebookCaption}`)), `duplicate knowledge content: ${post.title}`);
});

let store = { posts: [] };
const readStore = () => JSON.parse(JSON.stringify(store));
const writeStore = (next) => { store = JSON.parse(JSON.stringify(next)); };
const first = seedSocialContentLibrary(readStore, writeStore);
assert.strictEqual(first.knowledgeTotal, 12);
assert.strictEqual(store.posts.length, POSTS.length);
const second = seedSocialContentLibrary(readStore, writeStore);
assert.strictEqual(second.added, 0);
assert.strictEqual(store.posts.length, POSTS.length);
console.log("PASS unique interleaved product and mascot knowledge social library");
