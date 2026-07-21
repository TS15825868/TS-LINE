"use strict";

const assert = require("assert");
const { cleanTitle, normalizeStore } = require("./social-title-normalizer");

assert.strictEqual(cleanTitle("小老闆知識 01｜先分型態，再看怎麼安排"), "小老闆知識｜先分型態，再看怎麼安排");
assert.strictEqual(cleanTitle("小老闆知識 21｜看懂產品型態，安排更順手"), "小老闆知識｜看懂產品型態，安排更順手");
assert.strictEqual(cleanTitle("產品與品牌 20｜補養，是一種節奏"), "產品與品牌｜補養，是一種節奏");
assert.strictEqual(cleanTitle("一般貼文標題"), "一般貼文標題");

const original = {
  posts: [
    {
      id: "approved-mascot-original-21",
      campaignId: "xjw-approved-zip-202607-v1",
      title: "小老闆知識 21｜看懂產品型態，安排更順手",
      imageUrl: "https://example.com/approved.png",
      status: "draft",
    },
    {
      id: "published-history",
      campaignId: "other-campaign",
      title: "保留 99｜其他活動",
      status: "published",
    },
  ],
};
const result = normalizeStore(original);
assert.strictEqual(result.changed, 1);
assert.strictEqual(result.store.posts[0].id, original.posts[0].id);
assert.strictEqual(result.store.posts[0].imageUrl, original.posts[0].imageUrl);
assert.strictEqual(result.store.posts[0].status, original.posts[0].status);
assert.strictEqual(result.store.posts[0].title, "小老闆知識｜看懂產品型態，安排更順手");
assert.strictEqual(result.store.posts[1], original.posts[1]);

console.log("PASS social post display titles omit internal sequence numbers while IDs and content remain unchanged");
