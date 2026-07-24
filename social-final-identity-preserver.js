"use strict";

const release = require("./social-final-release-20260724");
const finalPosts = require("./social-final-posts");
const batch = require("./social-final-approved-batch");

const VERSION = "2026-07-24-identity-preserver-v1";
const ID_BY_TOPIC = Object.freeze({
  "care-work-rest": "first-batch-v2-care-work-rest-20260729",
  "product-guilu-gao-100g": "first-batch-v3-product-guilu-gao-20260729",
  "care-family": "first-batch-v3-care-family-20260731",
  "product-guilu-drink-30-180": "first-batch-v3-product-guilu-drink-combined-20260805",
  "product-lurongfen-75g": "first-batch-v3-product-lurongfen-20260807",
  "product-guilu-tangkuai-75g": "first-batch-v3-product-tangkuai-20260812",
  "product-guilu-jiao-600g": "first-batch-v3-product-guilu-jiao-20260814",
  "weather-temperature-gap": "first-batch-v3-care-temperature-gap",
  "weather-hot-hydration": "first-batch-v3-care-hot-hydration",
  "weather-rainy-day": "first-batch-v3-care-rainy-day",
});

const POSTS = Object.freeze(release.POSTS.map((post) => Object.freeze({
  ...post,
  id: ID_BY_TOPIC[post.topicKey] || post.id,
  identityPreserved: true,
})));

if (new Set(POSTS.map((post) => post.id)).size !== POSTS.length) {
  throw new Error("正式社群貼文 ID 重複");
}

release.POSTS = POSTS;
finalPosts.POSTS.splice(0, finalPosts.POSTS.length, ...POSTS);
if (batch.POSTS !== finalPosts.POSTS) batch.POSTS.splice(0, batch.POSTS.length, ...POSTS);
if (batch.CANONICAL_IDS?.clear) {
  batch.CANONICAL_IDS.clear();
  POSTS.forEach((post) => batch.CANONICAL_IDS.add(post.id));
}

module.exports = { VERSION, ID_BY_TOPIC, POSTS };
