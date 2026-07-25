"use strict";

const assert = require("assert");
require("./social-recommended-schedule");
require("./social-corrected-republish-schedule");
const clearPolicy = require("./social-clear-republish-policy");
const batch = require("./social-final-approved-batch");
const repair = require("./social-schedule-repair-20260722");

assert.strictEqual(repair.VERSION, "2026-07-25-v6");
const result = repair.repairStore({ posts: [{ id: "old-extra", title: "舊重複貼文", status: "approved", scheduledAt: "2026-07-24T02:00:00.000Z" }] }, "2026-07-25T00:30:00.000Z");
assert.strictEqual(result.changed, true);
assert.strictEqual(result.store.posts.length, 10);
assert.strictEqual(result.store.posts.some((post) => post.id === "old-extra"), false);

const first = result.store.posts.find((post) => post.id === clearPolicy.REPUBLISH_POST_ID);
assert(first, "修正版日常關心貼文必須存在");
assert.strictEqual(first.scheduledAt, "2026-07-29T12:00:00.000Z");
assert.strictEqual(first.status, "approved");

const fixed = result.store.posts.filter((post) => !post.conditionalWeather);
const weather = result.store.posts.filter((post) => post.conditionalWeather);
assert.strictEqual(fixed.length, 7);
assert.strictEqual(weather.length, 3);
assert(weather.every((post) => post.status === "paused" && !post.scheduledAt));
assert.strictEqual(batch.POSTS.filter((post) => post.topicKey === "product-guilu-drink-30-180").length, 1);

const status = repair.scheduleStatus(result.store);
assert.strictEqual(status.ok, true, status.issues.join("｜"));
assert.strictEqual(status.canonicalCount, 10);
assert.strictEqual(status.approvedCount, 7);
assert.strictEqual(status.standbyCount, 3);
assert.strictEqual(status.rule.fixed, "每週1篇，週三 20:00");
assert(status.rule.weatherException.includes("週末不發布"));
assert.deepStrictEqual(status.issues, []);
const second = repair.repairStore(result.store, "2026-07-25T00:31:00.000Z");
assert.strictEqual(second.changed, false);
console.log("PASS schedule repair installs 10 unique posts with one Wednesday 20:00 post per week");
