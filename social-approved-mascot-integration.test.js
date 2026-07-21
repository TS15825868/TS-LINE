"use strict";

const assert = require("assert");
require("./social-first-batch-assets");
require("./social-approved-mascot-assets");
const batch = require("./social-first-batch-202607");

const carePosts = batch.POSTS.filter((post) => post.sequenceRole === "care");
const productPosts = batch.POSTS.filter((post) => post.sequenceRole !== "care");

assert.strictEqual(carePosts.length, 5);
assert.strictEqual(productPosts.length, 5);
for (const post of carePosts) {
  assert.match(post.imageUrl, /^https:\/\/raw\.githubusercontent\.com\/TS15825868\/TS-LINE\/main\/public\/mascot\/(faq|brand|service|usage|welcome)\.jpg\?/);
  assert.ok(!post.imageUrl.includes("social-assets/first-batch"));
  assert.ok(!post.imageUrl.includes("public/social/first-batch"));
}
for (const post of productPosts) {
  assert.match(post.imageUrl, /^https:\/\/ts15825868\.github\.io\/xianjiawei\/images\/dm-final\//);
}

console.log("approved mascot runtime integration tests passed");