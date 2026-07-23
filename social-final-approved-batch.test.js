"use strict";

const assert = require("assert");
require("./social-recommended-schedule");
require("./social-corrected-republish-schedule");
const clearPolicy = require("./social-clear-republish-policy");
const batch = require("./social-final-approved-batch");
const schedulePolicy = require("./social-schedule-policy");

assert.strictEqual(batch.VERSION, "6.0.0");
assert.strictEqual(batch.POSTS.length, 10);
assert.strictEqual(batch.CANONICAL_IDS.size, 10);
assert.strictEqual(batch.POSTS.filter((post) => !post.conditionalWeather).length, 7);
assert.strictEqual(batch.POSTS.filter((post) => post.conditionalWeather).length, 3);

const first = batch.POSTS.find((post) => post.id === clearPolicy.REPUBLISH_POST_ID);
assert(first, "缺少7/24上午首發貼文");
assert.strictEqual(first.scheduledAt, "2026-07-24T02:00:00.000Z");
assert.strictEqual(schedulePolicy.validScheduledAt(first.scheduledAt, first), true);

for (const post of batch.POSTS.filter((post) => !post.conditionalWeather)) {
  assert(schedulePolicy.validScheduledAt(post.scheduledAt, post), `${post.title} 排程不符合週三／週五上午10:00規則`);
}
for (const post of batch.POSTS.filter((post) => post.conditionalWeather)) {
  assert.strictEqual(post.scheduledAt, "");
  assert.strictEqual(post.automationStandby, true);
}

const reconciled = batch.reconcileStore({ posts: [], publicationLedger: {} }, "2026-07-24T00:00:00.000Z").store;
assert.strictEqual(reconciled.posts.length, 10);
assert.strictEqual(reconciled.posts.filter((post) => post.status === "approved").length, 7);
assert.strictEqual(reconciled.posts.filter((post) => post.status === "paused").length, 3);
assert(batch.PRODUCT_SCENES["product-guilu-drink-combined.jpg"].length === 2);
assert(batch.POSTS.every((post) => post.qBossMascotLocked && post.deerPartnerPresent && post.turtlePartnerPresent));
console.log("PASS first 10 unique posts, 7/24 morning start, Wed/Fri 10:00 and weather standby");
