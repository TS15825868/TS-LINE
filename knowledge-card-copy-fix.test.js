"use strict";

const assert = require("assert");
const {
  IMAGE_VERSION,
  PATCHES,
  applyKnowledgeCardCopyFix,
  applySocialCopyFix,
} = require("./knowledge-card-copy-fix");
const { CARDS } = require("./knowledge-card-server");

const fixed = applyKnowledgeCardCopyFix();
assert.strictEqual(fixed.updatedCards, 5);
assert.strictEqual(IMAGE_VERSION, "7");

const cardText = JSON.stringify({
  sediment: CARDS.sediment,
  color: CARDS.color,
  batchInfo: CARDS["batch-info"],
  supportPhotos: CARDS["support-photos"],
  fairCompare: CARDS["fair-compare"],
});
["批號", "批次", "貶低", "別人不好", "仇人", "孕婦", "小朋友", "素食者"].forEach((token) => {
  assert.ok(!cardText.includes(token), `knowledge card still contains ${token}`);
});
assert.ok(CARDS["fair-compare"].title.join("").includes("了解自己的需求"));
assert.ok(CARDS["batch-info"].title.join("").includes("收到商品"));

const slugs = [...Object.keys(PATCHES), "units"];
let store = {
  posts: slugs.map((slug, index) => ({
    id: `post-${index}`,
    campaignId: "xjw-knowledge-202607-v1",
    status: "draft",
    title: slug === "units" ? "小老闆知識 13｜g與cc不能只看數字比較" : "舊文案",
    imageUrl: `https://ts-line.onrender.com/social-assets/knowledge/${slug}.png?v=6`,
    instagramCaption: slug === "units" ? "g 與 cc 單位說明" : "舊文案含批號與批次",
    facebookCaption: slug === "units" ? "先確認單位" : "比較產品不用先說別人不好，也不要貶低",
  })),
};
const readStore = () => JSON.parse(JSON.stringify(store));
const writeStore = (next) => { store = JSON.parse(JSON.stringify(next)); };
const result = applySocialCopyFix(readStore, writeStore);
assert.strictEqual(result.updated, slugs.length);
assert.strictEqual(result.imagesUpdated, slugs.length);
assert.ok(store.posts.every((post) => post.imageUrl.endsWith("?v=7")));
const unitPost = store.posts.find((post) => post.imageUrl.includes("/units.png"));
assert.strictEqual(unitPost.title, "小老闆知識 13｜g與cc不能只看數字比較");
const postText = JSON.stringify(store.posts);
["批號", "批次", "貶低", "別人不好", "仇人", "孕婦", "小朋友", "素食者"].forEach((token) => {
  assert.ok(!postText.includes(token), `social copy still contains ${token}`);
});
console.log("PASS all knowledge drafts refreshed to glyph-safe image v7 with neutral copy");
