"use strict";

const assert = require("assert");
const policy = require("./social-clear-republish-policy");
const batch = require("./social-final-approved-batch");

(async () => {
  const post = batch.POSTS.find((item) => item.id === policy.REPUBLISH_POST_ID);
  assert(post, "清晰重發貼文未進入正式排程");
  assert.strictEqual(post.scheduledAt, "2026-07-23T11:30:00.000Z", "應於台灣時間7/23 19:30發布");
  assert.strictEqual(post.title, "工作再忙，也別忘了休息一下");
  assert.strictEqual(post.imageName, "care-work-rest-clear.jpg");
  assert.strictEqual(post.sourceImageFile, "634CBEF9-5A29-44EE-BFFC-AA5DDB8C049B.PNG");
  assert.strictEqual(post.referenceImageFile, post.sourceImageFile);
  assert.strictEqual(post.clearOriginalRequired, true);
  assert.strictEqual(post.approvedOriginalAsset, true);
  assert.strictEqual(post.originalCompositionLocked, true);
  assert.strictEqual(post.originalCharacterLayoutLocked, true);
  assert.strictEqual(post.originalSourceDimensions, "1254x1254");
  assert.strictEqual(post.correctedClearRepublish, true);
  assert.strictEqual(post.oneTimeCorrectedRepublish, true);
  assert(!/vector|向量|生成/i.test(post.sourceImageFile), "不可再使用生成或向量替代圖");

  const source = batch.exactOriginalAvifBuffer(post.imageName);
  assert(source && source.length > 40000, "正式清晰原圖來源遺失或不完整");

  const info = await batch.assetInfo(post.imageName);
  assert.strictEqual(info.ok, true, "正式清晰原圖無法正常輸出");
  assert(info.width >= 1254 && info.height >= 1254, `清晰圖尺寸不足：${info.width}×${info.height}`);
  assert(info.bytes >= 100000, `清晰圖壓縮過度：${info.bytes} bytes`);
  assert.strictEqual(info.highresSource, true, "仍在使用舊的放大模糊來源");
  assert.strictEqual(info.exactOriginalSource, true, "未使用使用者提供的正式清晰原圖");
  assert.strictEqual(info.originalSourceFile, post.sourceImageFile);
  assert.strictEqual(info.originalSourceDimensions, "1254x1254");

  const ids = batch.POSTS.map((item) => item.id);
  assert.strictEqual(new Set(ids).size, ids.length, "正式排程存在重複貼文ID");
  assert(!ids.includes(policy.ORIGINAL_POST_ID), "舊的模糊貼文ID仍留在正式排程");
  assert.strictEqual(ids.filter((id) => id === policy.REPUBLISH_POST_ID).length, 1, "清晰重發排程必須只有一篇");

  console.log(`PASS exact original clear republish ${post.id} ${info.width}x${info.height} ${info.bytes} bytes`);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
