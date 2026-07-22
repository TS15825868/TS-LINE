"use strict";

const assert = require("assert");
const batch = require("./social-final-approved-batch");

(async () => {
  assert.strictEqual(batch.VERSION, "5.1.0");
  assert.strictEqual(batch.CONTENT_VERSION, "approved-exact-original-1254-v6");
  assert.strictEqual(batch.POSTS.length, 11);
  assert.strictEqual(batch.POSTS.filter((post) => post.sequenceRole === "care").length, 5);
  assert.strictEqual(batch.POSTS.filter((post) => post.sequenceRole !== "care").length, 6);
  assert.strictEqual(new Set(batch.POSTS.map((post) => post.id)).size, 11);

  const care = batch.POSTS.filter((post) => post.imageName);
  const product = batch.POSTS.filter((post) => post.imageUrl);
  assert.strictEqual(care.length, 5);
  assert.strictEqual(product.length, 6);
  assert.strictEqual(new Set(care.map((post) => post.imageName)).size, 5);

  const clearPost = batch.POSTS.find((post) => post.id === "clear-republish-care-work-rest-20260723");
  assert(clearPost, "missing exact original clear work-rest repost");
  assert.strictEqual(clearPost.sourceImageFile, "634CBEF9-5A29-44EE-BFFC-AA5DDB8C049B.PNG");
  assert.strictEqual(clearPost.originalCompositionLocked, true);
  assert.strictEqual(clearPost.originalCharacterLayoutLocked, true);
  assert.strictEqual(clearPost.scheduledAt, "2026-07-23T11:30:00.000Z");

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
    const info = await batch.assetInfo(post.imageName);
    assert(image && image.length > 100000, `missing image ${post.imageName}`);
    assert.strictEqual(image[0], 0xff);
    assert.strictEqual(image[1], 0xd8);
    assert.strictEqual(info.ok, true, `${post.imageName} must pass quality check`);
    assert(info.width >= 1080 && info.height >= 1080, `${post.imageName} must be at least 1080x1080`);
    assert(!String(post.imageName).includes("mascot"));
  }

  const exactInfo = await batch.assetInfo(clearPost.imageName);
  assert.strictEqual(exactInfo.exactOriginalSource, true, "clear repost must use exact uploaded original");
  assert.strictEqual(exactInfo.originalSourceFile, clearPost.sourceImageFile);
  assert.strictEqual(exactInfo.originalSourceDimensions, "1254x1254");
  assert(exactInfo.width >= 1254 && exactInfo.height >= 1254, "exact original must remain 1254x1254 or larger");

  for (const post of product) {
    assert(post.imageUrl.startsWith("https://ts15825868.github.io/xianjiawei/images/dm-final/"));
    assert(!post.imageUrl.includes("mascot"));
  }

  const legacy = {
    posts: [
      { id: "old-stitch-card", title: "舊拼湊圖", status: "approved", imageUrl: "https://example.com/mascot/faq.jpg" },
      { id: batch.POSTS[0].id, title: "舊標題", status: "paused", imageUrl: "https://example.com/old.jpg" },
    ],
    publicationLedger: { instagram: { keep: { postId: "published-history" } } },
  };
  const result = batch.reconcileStore(legacy, "2026-07-21T12:00:00.000Z");
  const active = result.store.posts.filter((post) => post.status !== "cancelled");
  assert.strictEqual(active.length, 11);
  assert.strictEqual(result.store.posts.find((post) => post.id === "old-stitch-card").status, "cancelled");
  assert(active.every((post) => !String(post.imageUrl).includes("/mascot/")));
  assert.strictEqual(active.filter((post) => post.automationStandby).length, 3);
  assert.strictEqual(result.store.publicationLedger.instagram.keep.postId, "published-history");

  const weatherStore = batch.reconcileStore({ posts: [] }, "2026-07-21T12:00:00.000Z").store;
  const fixedBefore = weatherStore.posts.filter((post) => !post.conditionalWeather && post.status === "approved").map((post) => post.id);
  const activation = batch.activateWeatherPost(
    weatherStore,
    { trigger: "hot", summary: "最高33°C／體感最高36°C" },
    "2026-07-22",
    "2026-07-22T00:30:00.000Z"
  );
  assert.strictEqual(activation.activated, true);
  assert.strictEqual(activation.fixedPostsPreserved, true);
  assert.deepStrictEqual(
    weatherStore.posts.filter((post) => !post.conditionalWeather && post.status === "approved").map((post) => post.id),
    fixedBefore,
    "weather exception must not cancel fixed posts"
  );

  console.log("PASS final 11 social posts use exact original clear work-rest asset and preserve fixed posts");
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
