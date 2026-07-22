"use strict";

const assert = require("assert");
const batch = require("./social-final-approved-batch");

(async () => {
  assert.strictEqual(batch.POSTS.length, 11);
  assert.strictEqual(batch.POSTS.filter((post) => post.sequenceRole === "care").length, 5);
  assert.strictEqual(batch.POSTS.filter((post) => post.sequenceRole !== "care").length, 6);
  assert.strictEqual(new Set(batch.POSTS.map((post) => post.id)).size, 11);

  const care = batch.POSTS.filter((post) => post.imageName);
  const product = batch.POSTS.filter((post) => post.imageUrl);
  assert.strictEqual(care.length, 5);
  assert.strictEqual(product.length, 6);
  assert.strictEqual(new Set(care.map((post) => post.imageName)).size, 5);

  const drink30 = batch.POSTS.find((post) => post.id === "first-batch-v2-product-guilu-yin-30cc-20260731");
  const drink180 = batch.POSTS.find((post) => post.id === "first-batch-v2-product-guilu-yin-180cc-20260828");
  assert(drink30, "missing 30cc Guilu drink post");
  assert(drink180, "missing 180cc Guilu drink post");
  assert.strictEqual(drink30.sourceImageFile, "02_guilu-drink-30cc-dm.jpg");
  assert.strictEqual(drink180.sourceImageFile, "03_guilu-drink-180cc-dm.jpg");
  assert(!drink30.title.includes("180cc"), "30cc post must not combine 180cc");
  assert(!drink180.title.includes("30cc"), "180cc post must not combine 30cc");

  for (const post of care) {
    const image = await batch.assetBuffer(post.imageName);
    assert(image && image.length > 100000, `missing image ${post.imageName}`);
    assert.strictEqual(image[0], 0xff);
    assert.strictEqual(image[1], 0xd8);
    assert(!String(post.imageName).includes("mascot"));
  }
  for (const post of product) {
    assert(post.imageUrl.startsWith("https://ts15825868.github.io/xianjiawei/images/dm-final/"));
    assert(!post.imageUrl.includes("mascot"));
  }

  const legacy = {
    posts: [
      { id: "old-stitch-card", title: "舊拼湊圖", status: "approved", imageUrl: "https://example.com/mascot/faq.jpg" },
      { id: batch.POSTS[0].id, title: "舊標題", status: "paused", imageUrl: "https://example.com/old.jpg" },
    ],
  };
  const result = batch.reconcileStore(legacy, "2026-07-21T12:00:00.000Z");
  const active = result.store.posts.filter((post) => post.status !== "cancelled");
  assert.strictEqual(active.length, 11);
  assert.strictEqual(result.store.posts.find((post) => post.id === "old-stitch-card").status, "cancelled");
  assert(active.every((post) => !String(post.imageUrl).includes("/mascot/")));
  assert.strictEqual(active.filter((post) => post.automationStandby).length, 3);
  console.log("PASS final 11 approved social posts with separate 30cc and 180cc Guilu drink posts");
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
