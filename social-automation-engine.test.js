"use strict";

const assert = require("assert");
const firstBatch = require("./social-first-batch-202607");
const automation = require("./social-automation-engine");

const hot = automation.classifyForecast({
  daily: {
    time: ["2026-07-22"],
    temperature_2m_max: [34],
    temperature_2m_min: [27],
    apparent_temperature_max: [38],
    precipitation_sum: [0],
    precipitation_probability_max: [10],
    weather_code: [1],
  },
});
assert.strictEqual(hot.type, "hot");

const rain = automation.classifyForecast({
  daily: {
    time: ["2026-07-22"],
    temperature_2m_max: [30],
    temperature_2m_min: [26],
    apparent_temperature_max: [33],
    precipitation_sum: [12],
    precipitation_probability_max: [80],
    weather_code: [63],
  },
});
assert.strictEqual(rain.type, "rain");

const gap = automation.classifyForecast({
  daily: {
    time: ["2026-07-22"],
    temperature_2m_max: [29],
    temperature_2m_min: [19],
    apparent_temperature_max: [30],
    precipitation_sum: [0],
    precipitation_probability_max: [5],
    weather_code: [0],
  },
});
assert.strictEqual(gap.type, "gap");

assert.strictEqual(automation.scheduledIso("2026-07-22", 10), "2026-07-22T02:00:00.000Z");
assert.strictEqual(automation.scheduledIso("2026-07-24", 20), "2026-07-24T12:00:00.000Z");
assert.strictEqual(automation.nextDateForWeekday("2026-07-21", 3, true), "2026-07-22");
assert.strictEqual(automation.nextDateForWeekday("2026-07-24", 5, false), "2026-07-31");

const nowMs = new Date("2026-07-21T00:00:00.000Z").getTime();
let store = {
  posts: [
    ...firstBatch.POSTS.map((post) => firstBatch.desiredPost(post, "2026-07-21T00:00:00.000Z")),
    {
      id: "weather-hot-care-20260721",
      status: "approved",
      assetLocked: true,
      scheduledAt: "2026-07-21T12:00:00.000Z",
      sequenceRole: "care",
    },
  ],
};
const loaded = {
  readStore: () => store,
  writeStore: (next) => { store = next; },
};

const reconciled = automation.reconcileStore(loaded, nowMs);
assert.ok(reconciled.changed > 0);
assert.strictEqual(store.posts.find((post) => post.id === "weather-hot-care-20260721").status, "cancelled");
assert.strictEqual(store.posts.filter((post) => post.automationStandby && post.status === "paused").length, 3);

const summary = automation.automationSummary(store, nowMs);
assert.strictEqual(summary.mode, "full-auto");
assert.strictEqual(summary.careReady, 5);
assert.strictEqual(summary.productReady, 5);
assert.strictEqual(summary.weatherStandby, 3);

const weatherResult = automation.installWeatherPost(
  loaded,
  { ...rain, date: "2026-07-23" },
  { dateKey: "2026-07-23", scheduledAt: "2026-07-23T02:00:00.000Z" }
);
assert.ok(weatherResult.changed >= 1);
const weatherPost = store.posts.find((post) => post.id === "auto-weather-rain-2026-07-23");
assert.ok(weatherPost);
assert.strictEqual(weatherPost.status, "approved");
assert.strictEqual(weatherPost.assetLocked, true);
assert.strictEqual(weatherPost.oneTimeWeatherPost, true);
assert.strictEqual(weatherPost.scheduledAt, "2026-07-23T02:00:00.000Z");

console.log("social automation engine tests passed");