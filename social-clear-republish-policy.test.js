"use strict";

const assert = require("assert");
const policy = require("./social-clear-republish-policy");
const batch = require("./social-final-approved-batch");

(async () => {
  const post = batch.POSTS.find((item) => item.id === policy.REPUBLISH_POST_ID);
  assert(post, "清晰重發貼文未進入正式排程");
  assert.strictEqual(post.scheduledAt, "2026-07-23T11:30:00.000Z", "應於台灣時間7/23 19:30發布");
  assert.strictEqual(post.title, "工作再忙，也別忘了休息一下");
  assert.strictEqual(post.sourceImageFile, "D558F584-DEE1-45BB-B243-6166E118617C.PNG");
  assert.strictEqual(post.clearOriginalRequired, true);
  assert.strictEqual(post.correctedClearRepublish, true);

  const info = await batch.assetInfo(post.imageName);
  assert.strictEqual(info.ok, true, "清晰原圖無法正常輸出");
  assert(info.width >= 1200 && info.height >= 1200, `清晰原圖尺寸不足：${info.width}×${info.height}`);
  assert(info.bytes >= 500000, `清晰原圖壓縮過度：${info.bytes} bytes`);
  assert.strictEqual(info.highresSource, true, "仍在使用舊的放大模糊來源");

  const ids = batch.POSTS.map((item) => item.id);
  assert.strictEqual(new Set(ids).size, ids.length, "正式排程存在重複貼文ID");
  assert(!ids.includes(policy.ORIGINAL_POST_ID), "舊的模糊貼文ID仍留在正式排程");

  console.log(`PASS clear republish ${post.id} ${info.width}x${info.height} ${info.bytes} bytes`);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
