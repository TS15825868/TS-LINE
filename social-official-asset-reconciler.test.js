"use strict";

const assert = require("assert");
require("./social-first-batch-assets");
require("./social-approved-mascot-assets");
const batch = require("./social-first-batch-202607");
const reconciler = require("./social-official-asset-reconciler");

const careTemplate = batch.POSTS.find((post) => post.sequenceRole === "care");
const productTemplate = batch.POSTS.find((post) => post.sequenceRole !== "care");
const store = {
  posts: [
    {
      id: careTemplate.id,
      status: "approved",
      imageUrl: "https://ts-line.onrender.com/social-assets/first-batch/old.jpg",
      sourceImageFile: "old.jpg",
    },
    {
      id: "auto-product-copy",
      autoTemplateId: productTemplate.id,
      status: "approved",
      imageUrl: "https://example.com/redrawn-product.jpg",
      sourceImageFile: "redrawn-product.jpg",
    },
    {
      id: "published-keep",
      autoTemplateId: careTemplate.id,
      status: "published",
      imageUrl: "https://example.com/published.jpg",
    },
  ],
};

const result = reconciler.reconcileStore(store);
assert.strictEqual(result.changed, 2);
const care = result.store.posts.find((post) => post.id === careTemplate.id);
const product = result.store.posts.find((post) => post.id === "auto-product-copy");
const published = result.store.posts.find((post) => post.id === "published-keep");
assert.strictEqual(care.imageUrl, careTemplate.imageUrl);
assert.match(care.imageUrl, /public\/mascot\//);
assert.strictEqual(product.imageUrl, productTemplate.imageUrl);
assert.match(product.imageUrl, /images\/dm-final\//);
assert.strictEqual(published.imageUrl, "https://example.com/published.jpg");
assert.strictEqual(result.store.socialOfficialAssetVersion, reconciler.VERSION);

console.log("official social asset reconciler tests passed");