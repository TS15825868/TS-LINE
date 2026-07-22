"use strict";

const assert = require("assert");
const finalSocial = require("./social-final-reconcile");

const initial = {
  posts: [
    { id: "keep-published", status: "published", title: "保留" },
    { id: "duplicate-a", campaignId: "xjw-approved-zip-202607-v1", status: "paused" },
    { id: "duplicate-b", campaignId: "xjw-social-first-batch-202607-v2", status: "draft" },
  ],
};

const reconciled = finalSocial.reconcileStore(initial, "2026-07-21T00:00:00.000Z");
const active = reconciled.store.posts.filter((post) => post.status !== "published");
assert.strictEqual(active.length, 10);
assert.strictEqual(active.filter((post) => post.sequenceRole === "care").length, 5);
assert.strictEqual(active.filter((post) => post.sequenceRole === "product").length, 5);
assert.strictEqual(new Set(active.map((post) => post.scheduledAt)).size, 10);
assert(active.every((post) => post.status === "approved"));
assert(active.every((post) => post.assetLocked === true));
assert(active.every((post) => /^https:\/\//.test(post.imageUrl)));
assert.strictEqual(active.filter((post) => post.imageUrl.includes("public/mascot/")).length, 5);
assert.strictEqual(active.filter((post) => post.imageUrl.includes("images/dm-final/")).length, 5);
assert.strictEqual(reconciled.removedUnpublished, 2);

const target = active.find((post) => post.sequenceRole === "care");
const count = reconciled.store.posts.length;
assert.strictEqual(
  finalSocial.updateWeatherReplacement(
    reconciled.store,
    target.id,
    { trigger: "hot", summary: "最高33°C" },
    "2026-07-21T01:00:00.000Z"
  ),
  true
);
const weather = reconciled.store.posts.find((post) => post.id === target.id);
assert.strictEqual(reconciled.store.posts.length, count);
assert.strictEqual(weather.scheduledAt, target.scheduledAt);
assert.strictEqual(weather.weatherTrigger, "hot");
assert(weather.imageUrl.includes("public/mascot/usage.jpg"));

assert.strictEqual(finalSocial.selectWeather({
  time: ["2026-07-22"],
  weather_code: [0],
  temperature_2m_max: [33],
  temperature_2m_min: [27],
  apparent_temperature_max: [36],
  precipitation_sum: [0],
  precipitation_probability_max: [10],
}, "2026-07-22").trigger, "hot");

assert.strictEqual(finalSocial.selectWeather({
  time: ["2026-07-22"],
  weather_code: [61],
  temperature_2m_max: [29],
  temperature_2m_min: [25],
  apparent_temperature_max: [31],
  precipitation_sum: [12],
  precipitation_probability_max: [80],
}, "2026-07-22").trigger, "rain");

console.log("PASS final social reconciliation: exactly 10 active posts and weather replaces the same care slot");
