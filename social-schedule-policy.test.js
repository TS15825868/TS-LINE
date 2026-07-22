"use strict";

const assert = require("assert");
const policy = require("./social-schedule-policy");

const wed1930 = "2026-07-22T11:30:00.000Z";
const wed20 = "2026-07-22T12:00:00.000Z";
const fri10 = "2026-07-24T02:00:00.000Z";
const fri20 = "2026-07-24T12:00:00.000Z";
const tue10 = "2026-07-21T02:00:00.000Z";

const care = { title: "工作再忙，也別忘了休息", category: "日常關心", sequenceRole: "care", scheduledAt: wed1930 };
const product = { title: "龜鹿膏使用方式", category: "產品介紹", sequenceRole: "product", scheduledAt: fri20 };
const oneTime = { title: "豪雨提醒", oneTimeWeatherPost: true, conditionalWeather: true, scheduledAt: tue10 };

assert.strictEqual(policy.isCarePost(care), true);
assert.strictEqual(policy.isWeatherPost(care), false);
assert.strictEqual(policy.isCarePost(product), false);
assert.strictEqual(policy.isWeatherPost(oneTime), true);
assert.strictEqual(policy.validScheduledAt(wed1930, care), true);
assert.strictEqual(policy.validScheduledAt(wed20, care), false);
assert.strictEqual(policy.validScheduledAt(fri20, product), true);
assert.strictEqual(policy.validScheduledAt(fri10, product), false);
assert.strictEqual(policy.validScheduledAt(tue10, oneTime), true);

const normalized = policy.normalizeStore({ posts: [
  { ...care, id: "care", status: "draft", scheduledAt: wed20 },
  { ...product, id: "product", status: "draft", scheduledAt: fri10 },
] });
assert.strictEqual(normalized.posts[0].scheduledAt, wed1930);
assert.strictEqual(normalized.posts[1].scheduledAt, fri20);

const weatherException = policy.normalizeStore({ posts: [
  { ...oneTime, id: "weather", status: "approved" },
  { ...care, id: "weekly-care", status: "approved", scheduledAt: wed1930 },
  { ...product, id: "weekly-product", status: "approved", scheduledAt: fri20 },
] });
assert.strictEqual(weatherException.posts.find((post) => post.id === "weather").status, "approved");
assert.strictEqual(weatherException.posts.find((post) => post.id === "weekly-care").status, "approved");
assert.strictEqual(weatherException.posts.find((post) => post.id === "weekly-product").status, "approved");

console.log("PASS recommended schedule: care Wed 19:30, product Fri 20:00, weather exception 10:00");
