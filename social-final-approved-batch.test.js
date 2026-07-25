"use strict";

const assert = require("assert");
require("./social-recommended-schedule");
require("./social-corrected-republish-schedule");
const clearPolicy = require("./social-clear-republish-policy");
const batch = require("./social-final-approved-batch");
const schedulePolicy = require("./social-schedule-policy");

(async () => {
  assert.strictEqual(batch.VERSION, "6.1.0");
  assert.strictEqual(batch.POSTS.length, 10);
  assert.strictEqual(batch.CANONICAL_IDS.size, 10);
  assert.strictEqual(batch.POSTS.filter((post) => !post.conditionalWeather).length, 7);
  assert.strictEqual(batch.POSTS.filter((post) => post.conditionalWeather).length, 3);

  const first = batch.POSTS.find((post) => post.id === clearPolicy.REPUBLISH_POST_ID);
  assert(first, "缺少修正版日常關心貼文");
  assert.strictEqual(first.scheduledAt, "2026-07-29T12:00:00.000Z");
  assert.strictEqual(schedulePolicy.validScheduledAt(first.scheduledAt, first), true);

  const weekCounts = new Map();
  for (const post of batch.POSTS.filter((post) => !post.conditionalWeather)) {
    assert(schedulePolicy.validScheduledAt(post.scheduledAt, post), `${post.title} 排程不符合每週三晚上8:00規則`);
    const week = schedulePolicy.weekKey(post.scheduledAt);
    weekCounts.set(week, (weekCounts.get(week) || 0) + 1);
  }
  assert([...weekCounts.values()].every((count) => count === 1), "每週固定貼文只能有1篇");
  for (const post of batch.POSTS.filter((post) => post.conditionalWeather)) {
    assert.strictEqual(post.scheduledAt, "");
    assert.strictEqual(post.automationStandby, true);
  }

  const reconciled = batch.reconcileStore({ posts: [], publicationLedger: {} }, "2026-07-25T00:00:00.000Z").store;
  assert.strictEqual(reconciled.posts.length, 10);
  assert.strictEqual(reconciled.posts.filter((post) => post.status === "approved").length, 7);
  assert.strictEqual(reconciled.posts.filter((post) => post.status === "paused").length, 3);
  assert(batch.PRODUCT_SCENES["product-guilu-drink-combined.jpg"].length === 2);
  assert(batch.POSTS.every((post) => post.qBossMascotLocked && post.deerPartnerPresent && post.turtlePartnerPresent));

  const nextWeather = batch.nextWeatherDate(new Date("2026-07-25T00:00:00.000Z"));
  assert.strictEqual(nextWeather, "2026-07-27");
  assert(!["Wed", "Sat", "Sun"].includes(batch.weekdayForKey(nextWeather)), "氣候貼文不可安排週三或週末");
  const weatherSchedule = batch.weatherAt(nextWeather);
  const weatherParts = batch.taipeiParts(weatherSchedule);
  assert.strictEqual(weatherParts.hour, "20");
  assert.strictEqual(weatherParts.minute, "00");
  assert.strictEqual(schedulePolicy.validScheduledAt(weatherSchedule, { conditionalWeather: true }), true);

  const unreviewedStore = JSON.parse(JSON.stringify(reconciled));
  let fetchCalls = 0;
  const originalFetch = global.fetch;
  global.fetch = async () => {
    fetchCalls += 1;
    throw new Error("未審核時不應呼叫天氣服務");
  };
  try {
    const skipped = await batch.checkWeather(
      () => unreviewedStore,
      (next) => Object.assign(unreviewedStore, next)
    );
    assert.strictEqual(skipped.skipped, true);
    assert.strictEqual(fetchCalls, 0);
    assert(String(skipped.reason).includes("沒有已通過人工審核"));
  } finally {
    global.fetch = originalFetch;
  }

  const reviewedStore = JSON.parse(JSON.stringify(reconciled));
  const reviewedWeather = reviewedStore.posts.find((post) => post.conditionalWeather && post.weatherTrigger === "hot");
  reviewedWeather.reviewApprovedAt = "2026-07-25T01:00:00.000Z";
  reviewedWeather.manualReviewConfirmedAt = "2026-07-25T01:00:00.000Z";
  reviewedWeather.assetLocked = true;
  reviewedWeather.status = "paused";
  reviewedWeather.automationStandby = true;

  const originalFetch429 = global.fetch;
  global.fetch = async () => ({
    ok: false,
    status: 429,
    headers: { get: (name) => String(name).toLowerCase() === "retry-after" ? "120" : null },
  });
  try {
    const limited = await batch.checkWeather(
      () => reviewedStore,
      (next) => Object.assign(reviewedStore, next)
    );
    assert.strictEqual(limited.skipped, true);
    assert.strictEqual(limited.rateLimited, true);
    assert.strictEqual(reviewedStore.weatherAutomation.rateLimited, true);
    assert.strictEqual(reviewedStore.weatherAutomation.lastError, "weather HTTP 429");
    assert(Date.parse(reviewedStore.weatherAutomation.nextCheckAt) > Date.now());
    assert.strictEqual(reviewedWeather.status, "paused");
    assert.strictEqual(reviewedWeather.automationStandby, true);
  } finally {
    global.fetch = originalFetch429;
  }

  console.log("PASS first 10 posts keep weekly Wednesday 20:00, review-gated weather checks, weekday 20:00 activation and HTTP 429 backoff");
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
