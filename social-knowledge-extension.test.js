"use strict";

const assert = require("assert");
const { CARDS } = require("./knowledge-card-server");
const { KNOWLEDGE, normalize } = require("./social-content-library");
const {
  CAMPAIGN_ID,
  IMAGE_PATH_VERSION,
  EXTRA_KNOWLEDGE,
  seedExtraSocialKnowledge,
} = require("./social-knowledge-extension");

function headline(post) {
  return String(post.instagramCaption || "").split("\n")[0];
}

function bigrams(value) {
  const text = normalize(value);
  const set = new Set();
  for (let index = 0; index < text.length - 1; index += 1) set.add(text.slice(index, index + 2));
  return set;
}

function similarity(leftValue, rightValue) {
  const left = bigrams(leftValue);
  const right = bigrams(rightValue);
  if (!left.size || !right.size) return 0;
  let common = 0;
  left.forEach((item) => { if (right.has(item)) common += 1; });
  return common / (left.size + right.size - common);
}

assert.strictEqual(CAMPAIGN_ID, "xjw-knowledge-202607-v2");
assert.strictEqual(IMAGE_PATH_VERSION, "v9");
assert.strictEqual(EXTRA_KNOWLEDGE.length, 10);
assert.strictEqual(Object.keys(CARDS).length, 30);
assert.strictEqual(new Set(EXTRA_KNOWLEDGE.map((post) => post.title)).size, 10);
assert.strictEqual(new Set(EXTRA_KNOWLEDGE.map((post) => post.knowledgeTopic)).size, 10);
assert.strictEqual(new Set(EXTRA_KNOWLEDGE.map((post) => post.imageUrl)).size, 10);
assert.ok(EXTRA_KNOWLEDGE.every((post) => /^https:\/\/ts-line\.onrender\.com\/social-assets\/knowledge\/v9\/[a-z0-9-]+\.png$/.test(post.imageUrl)));
assert.ok(EXTRA_KNOWLEDGE.every((post) => {
  const date = new Date(post.scheduledAt);
  return [3, 5].includes(date.getUTCDay()) && date.getUTCHours() === 12;
}), "all extra posts must resolve to Wednesday or Friday 20:00 Asia/Taipei");

const existingHeadlines = KNOWLEDGE.map(headline);
const extraHeadlines = EXTRA_KNOWLEDGE.map(headline);
for (const post of EXTRA_KNOWLEDGE) {
  const current = headline(post);
  const closestExisting = Math.max(...existingHeadlines.map((item) => similarity(current, item)));
  assert.ok(closestExisting < 0.35, `extra headline is too similar to existing knowledge content (${closestExisting.toFixed(2)}): ${post.title}`);
  const otherExtra = extraHeadlines.filter((item) => item !== current);
  const closestExtra = Math.max(...otherExtra.map((item) => similarity(current, item)));
  assert.ok(closestExtra < 0.55, `extra headline is too similar to another extra post (${closestExtra.toFixed(2)}): ${post.title}`);
}

["治療", "治癒", "療效", "保證有效", "改善疾病", "批號", "批次", "貶低", "別人不好", "仇人"].forEach((term) => {
  assert.ok(!EXTRA_KNOWLEDGE.some((post) => `${post.title}${post.instagramCaption}${post.facebookCaption}`.includes(term)), `unsafe or duplicated wording found: ${term}`);
});

let store = { posts: [] };
const readStore = () => JSON.parse(JSON.stringify(store));
const writeStore = (next) => { store = JSON.parse(JSON.stringify(next)); };
const first = seedExtraSocialKnowledge(readStore, writeStore);
assert.strictEqual(first.added, 10);
assert.strictEqual(store.posts.length, 10);
const second = seedExtraSocialKnowledge(readStore, writeStore);
assert.strictEqual(second.added, 0);
assert.strictEqual(second.updated, 10);
assert.strictEqual(store.posts.length, 10);

console.log("PASS 10 new non-duplicated mascot knowledge drafts with unique v9 images and Wednesday/Friday schedules");
