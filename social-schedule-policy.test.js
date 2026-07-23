"use strict";

const assert = require("assert");
const policy = require("./social-schedule-policy");

const wed10 = "2026-07-29T02:00:00.000Z";
const fri10 = "2026-07-24T02:00:00.000Z";
const wed1930 = "2026-07-29T11:30:00.000Z";
const tue10 = "2026-07-28T02:00:00.000Z";
const sat10 = "2026-07-25T02:00:00.000Z";

const care = { title: "照顧自己，也別忘了關心家人", category: "日常關心", sequenceRole: "care", scheduledAt: fri10 };
const product = { title: "龜鹿膏100g", category: "產品介紹", sequenceRole: "product", scheduledAt: wed10 };
const weather = { title: "天氣炎熱，記得補水", conditionalWeather: true, oneTimeWeatherPost: true, weatherTrigger: "hot", scheduledAt: sat10 };

assert.strictEqual(policy.validScheduledAt(fri10, care), true);
assert.strictEqual(policy.validScheduledAt(wed10, product), true);
assert.strictEqual(policy.validScheduledAt(wed1930, care), false);
assert.strictEqual(policy.validScheduledAt(tue10, product), false);
assert.strictEqual(policy.validScheduledAt(sat10, weather), true);
assert.strictEqual(policy.validScheduledAt(fri10, weather), false);
assert.strictEqual(policy.isWeatherPost(weather), true);
assert.strictEqual(policy.isFixedDay("Wed"), true);
assert.strictEqual(policy.isFixedDay("Fri"), true);
assert.strictEqual(policy.isFixedDay("Sat"), false);
assert.strictEqual(policy.weekKey(fri10), "2026-07-20");

const normalized = policy.normalizeStore({ posts: [
  { ...care, id: "care", status: "draft", scheduledAt: "2026-07-24T12:00:00.000Z" },
  { ...product, id: "product", status: "draft", scheduledAt: "2026-07-29T12:00:00.000Z" },
] });
assert.strictEqual(normalized.posts[0].scheduledAt, fri10);
assert.strictEqual(normalized.posts[1].scheduledAt, wed10);
console.log("PASS fixed Wed/Fri 10:00 and conditional weather on non-fixed days");
