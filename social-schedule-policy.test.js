"use strict";

const assert = require("assert");
const policy = require("./social-schedule-policy");

const wed10 = "2026-07-22T02:00:00.000Z";
const wed20 = "2026-07-22T12:00:00.000Z";
const tue10 = "2026-07-21T02:00:00.000Z";

const care = { title: "天氣悶熱，記得補水", category: "氣候關心", scheduledAt: wed10 };
const product = { title: "龜鹿膏使用方式", category: "產品知識", scheduledAt: wed20 };
const oneTime = { title: "豪雨提醒", oneTimeWeatherPost: true, scheduledAt: tue10 };

assert.strictEqual(policy.isCarePost(care), true);
assert.strictEqual(policy.isCarePost(product), false);
assert.strictEqual(policy.validScheduledAt(wed10, care), true);
assert.strictEqual(policy.validScheduledAt(wed20, care), false);
assert.strictEqual(policy.validScheduledAt(wed20, product), true);
assert.strictEqual(policy.validScheduledAt(wed10, product), false);
assert.strictEqual(policy.validScheduledAt(tue10, oneTime), true);

const normalized = policy.normalizeStore({ posts: [
  { ...care, id: "care", status: "draft", scheduledAt: wed20 },
  { ...product, id: "product", status: "draft", scheduledAt: wed10 },
] });
assert.strictEqual(normalized.posts[0].scheduledAt, wed10);
assert.strictEqual(normalized.posts[1].scheduledAt, wed20);

console.log("social schedule time policy tests passed");
