"use strict";

const assert = require("assert");
const {
  PATCHES,
  applyKnowledgeCardCopyFix,
  applySocialCopyFix,
} = require("./knowledge-card-copy-fix");
const { CARDS } = require("./knowledge-card-server");

const fixed = applyKnowledgeCardCopyFix();
assert.strictEqual(fixed.updatedCards, 5);

const cardText = JSON.stringify({
  sediment: CARDS.sediment,
  color: CARDS.color,
  batchInfo: CARDS["batch-info"],
  supportPhotos: CARDS["support-photos"],
  fairCompare: CARDS["fair-compare"],
});
["批號", "批次", "貶低", "別人不好", "仇人"].forEach((token) => {
  assert.ok(!cardText.includes(token), `knowledge card still contains ${token}`);
});
assert.ok(CARDS["fair-compare"].title.join("").includes("了解自己的需求"));
assert.ok(CARDS["batch-info"].title.join("").includes("收到商品"));

let store = {
  posts: Object.keys(PATCHES).map((slug, index) => ({
    id: `post-${index}`,
    campaignId: "xjw-knowledge-202607-v1",
    status: "draft",
    title: "舊文案",
    imageUrl: `https://ts-line.onrender.com/social-assets/knowledge/${slug}.png?v=2`,
    instagramCaption: "舊文案含批號與批次",
    facebookCaption: "比較產品不用先說別人不好，也不要貶低",
  })),
};
const readStore = () => JSON.parse(JSON.stringify(store));
const writeStore = (next) => { store = JSON.parse(JSON.stringify(next)); };
const result = applySocialCopyFix(readStore, writeStore);
assert.strictEqual(result.updated, 5);
assert.ok(store.posts.every((post) => post.imageUrl.endsWith("?v=3")));
const postText = JSON.stringify(store.posts);
["批號", "批次", "貶低", "別人不好", "仇人"].forEach((token) => {
  assert.ok(!postText.includes(token), `social copy still contains ${token}`);
});
console.log("PASS neutral knowledge cards and social copy without batch references");
