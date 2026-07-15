"use strict";

const assert = require("assert");
const { POSTS: BASE_POSTS } = require("./social-draft-library-weekly");
const { CARDS, renderCard } = require("./knowledge-card-server");
const {
  CAMPAIGN_ID,
  KNOWLEDGE,
  POSTS,
  normalize,
  fingerprint,
  interleave,
  seedSocialContentLibrary,
} = require("./social-content-library");

function headline(post) {
  return String(post.instagramCaption || "").split("\n")[0];
}

function bigrams(value) {
  const text = normalize(value);
  const set = new Set();
  for (let i = 0; i < text.length - 1; i += 1) set.add(text.slice(i, i + 2));
  return set;
}

function similarity(a, b) {
  const left = bigrams(a);
  const right = bigrams(b);
  if (!left.size || !right.size) return 0;
  let common = 0;
  left.forEach((item) => { if (right.has(item)) common += 1; });
  return common / (left.size + right.size - common);
}

assert.strictEqual(CAMPAIGN_ID, "xjw-knowledge-202607-v1");
assert.strictEqual(KNOWLEDGE.length, 20);
assert.strictEqual(Object.keys(CARDS).length, 20);
assert.strictEqual(POSTS.length, BASE_POSTS.length + KNOWLEDGE.length);
assert.ok(KNOWLEDGE.every((post) => /^https:\/\/ts-line\.onrender\.com\/social-assets\/knowledge\/.+\.png\?v=2$/.test(post.imageUrl)));
assert.strictEqual(new Set(KNOWLEDGE.map((post) => post.title)).size, KNOWLEDGE.length);
assert.strictEqual(new Set(KNOWLEDGE.map((post) => post.knowledgeTopic)).size, KNOWLEDGE.length);
assert.strictEqual(new Set(KNOWLEDGE.map(fingerprint)).size, KNOWLEDGE.length);
assert.strictEqual(new Set(POSTS.map((post) => post.campaignKey)).size, POSTS.length);
assert.ok(POSTS.every((post) => {
  const date = new Date(post.scheduledAt);
  return [3, 5].includes(date.getUTCDay()) && date.getUTCHours() === 12;
}), "all posts must resolve to Wednesday or Friday 20:00 Asia/Taipei");

const merged = interleave(BASE_POSTS, KNOWLEDGE);
const positions = merged.map((post, index) => post.campaignId === CAMPAIGN_ID ? index : -1).filter((index) => index >= 0);
assert.strictEqual(positions.length, 20);
assert.ok(positions[0] < BASE_POSTS.length, "knowledge posts must be interleaved, not only appended");
assert.ok(positions.every((position, index) => index === 0 || position > positions[index - 1]), "knowledge post order must remain stable");

const baseHeadlines = BASE_POSTS.map(headline);
KNOWLEDGE.forEach((post) => {
  const current = headline(post);
  assert.ok(!baseHeadlines.some((item) => normalize(item) === normalize(current)), `duplicate knowledge headline: ${post.title}`);
  const closest = Math.max(...baseHeadlines.map((item) => similarity(current, item)));
  assert.ok(closest < 0.82, `knowledge headline is too similar to existing content (${closest.toFixed(2)}): ${post.title}`);
  assert.ok(!/[�]/.test(`${post.title}${post.instagramCaption}${post.facebookCaption}`), `invalid character in ${post.title}`);
});

["治療", "治癒", "療效", "保證有效", "改善疾病"].forEach((term) => {
  assert.ok(!KNOWLEDGE.some((post) => `${post.instagramCaption}${post.facebookCaption}`.includes(term)), `medical claim found: ${term}`);
});

let store = { posts: [] };
const readStore = () => JSON.parse(JSON.stringify(store));
const writeStore = (next) => { store = JSON.parse(JSON.stringify(next)); };
const first = seedSocialContentLibrary(readStore, writeStore);
assert.strictEqual(first.knowledgeTotal, 20);
assert.strictEqual(store.posts.length, POSTS.length);
const second = seedSocialContentLibrary(readStore, writeStore);
assert.strictEqual(second.added, 0);
assert.strictEqual(store.posts.length, POSTS.length);

(async () => {
  const image = await renderCard("fair-compare");
  assert.ok(Buffer.isBuffer(image) && image.length > 10000, "knowledge image must render as a non-empty PNG");
  console.log("PASS 20 unique interleaved mascot knowledge posts and deterministic PNG cards");
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
