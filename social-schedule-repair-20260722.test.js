"use strict";

const assert = require("assert");
require("./social-recommended-schedule");
require("./social-corrected-republish-schedule");
const clearPolicy = require("./social-clear-republish-policy");
const batch = require("./social-final-approved-batch");
require("./social-manual-schedule-override");
const repair = require("./social-schedule-repair-20260722");

assert.strictEqual(repair.VERSION, "2026-07-23-v4");

const store = {
  posts: [
    {
      ...batch.POSTS[0],
      status: "draft",
      scheduledAt: "2026-07-22T12:00:00.000Z",
      manualScheduleOverride: false,
      manualReviewPending: true,
    },
    { id: "old-extra", title: "誤按新增貼文", status: "approved", scheduledAt: "2026-07-22T12:00:00.000Z" },
  ],
};

const result = repair.repairStore(store, "2026-07-23T08:30:00.000Z");
assert.strictEqual(result.changed, true);
assert.strictEqual(result.store.socialScheduleRepairVersion, repair.VERSION);
assert.strictEqual(result.store.posts.length, 11);
assert.strictEqual(result.store.posts.some((post) => post.id === "old-extra"), false);

const clear = result.store.posts.find((post) => post.id === clearPolicy.REPUBLISH_POST_ID);
assert(clear, "清晰原圖單次重發貼文必須存在");
assert.strictEqual(clear.scheduledAt, "2026-07-24T11:30:00.000Z");
assert.strictEqual(clear.status, "approved");
assert.strictEqual(clear.manualScheduleOverride, true);
assert.strictEqual(clear.scheduleTimePolicy, "manual-override");
assert.strictEqual(clear.manualReviewPending, undefined);

const drink30 = result.store.posts.find((post) => post.id === "first-batch-v2-product-guilu-yin-30cc-20260731");
const drink180 = result.store.posts.find((post) => post.id === "first-batch-v2-product-guilu-yin-180cc-20260828");
assert(drink30 && drink180, "30cc and 180cc posts must both exist");
assert.notStrictEqual(drink30.scheduledAt, drink180.scheduledAt);

const weather = result.store.posts.filter((post) => post.automationStandby === true);
assert.strictEqual(weather.length, 3);
assert(weather.every((post) => post.status === "paused" && !post.scheduledAt));

const status = repair.scheduleStatus(result.store);
assert.strictEqual(status.ok, true, status.issues.join("｜"));
assert.strictEqual(status.canonicalCount, 11);
assert.strictEqual(status.approvedCount, 8);
assert.strictEqual(status.standbyCount, 3);
assert.deepStrictEqual(status.issues, []);

const second = repair.repairStore(result.store, "2026-07-23T08:31:00.000Z");
assert.strictEqual(second.changed, false);
console.log("PASS schedule repair keeps the one-time 7/24 clear repost and all 11 canonical posts");
