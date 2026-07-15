"use strict";

const assert = require("assert");
const { replaceText, patchKnowledgeCards, removeBatchNumberWording } = require("./social-no-batch-copy");

assert.ok(!replaceText("請拍下批號與有效日期").includes("批號"));
assert.ok(replaceText("請拍下批號與有效日期").includes("產品名稱、規格與有效日期"));

const cards = {
  color: { bullets: [] },
  "batch-info": { title: [], bullets: [] },
  "support-photos": { bullets: [] },
};
patchKnowledgeCards(cards);
assert.ok(cards["batch-info"].title.join("").includes("品名規格"));
assert.ok(!JSON.stringify(cards).includes("批號"));

let store = { posts: [{ title: "批號與保存資訊", instagramCaption: "保留包裝與批號並拍照詢問", facebookCaption: "批號期限" }] };
const readStore = () => JSON.parse(JSON.stringify(store));
const writeStore = (next) => { store = JSON.parse(JSON.stringify(next)); };
const result = removeBatchNumberWording(readStore, writeStore);
assert.strictEqual(result.updated, 1);
assert.ok(!JSON.stringify(store).includes("批號"));
console.log("PASS no batch-number wording in social drafts and knowledge cards");
