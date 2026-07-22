"use strict";

const assert = require("assert");
const batch = require("./social-final-approved-batch");
const repair = require("./social-schedule-repair-20260722");

const store = {
  posts: [
    {
      ...batch.POSTS[0],
      status: "draft",
      scheduledAt: "2026-07-22T12:00:00.000Z",
      manualScheduleOverride: true,
      manualReviewPending: true,
    },
    { id: "old-extra", title: "誤按新增貼文", status: "approved", scheduledAt: "2026-07-22T12:00:00.000Z" },
  ],
};

const result = repair.repairStore(store, "2026-07-22T08:30:00.000Z");
assert.strictEqual(result.changed, true);
assert.strictEqual(result.store.socialScheduleRepairVersion, repair.VERSION);
assert.strictEqual(result.store.posts.length, 11);
assert.strictEqual(result.store.posts.some((post) => post.id === "old-extra"), false);

const repaired = result.store.posts.find((post) => post.id === batch.POSTS[0].id);
assert.strictEqual(repaired.scheduledAt, batch.POSTS[0].scheduledAt);
assert.strictEqual(repaired.status, "approved");
assert.strictEqual(repaired.manualScheduleOverride, undefined);
assert.strictEqual(repaired.manualReviewPending, undefined);

const drink30 = result.store.posts.find((post) => post.id === "first-batch-v2-product-guilu-yin-30cc-20260731");
const drink180 = result.store.posts.find((post) => post.id === "first-batch-v2-product-guilu-yin-180cc-20260828");
assert(drink30 && drink180, "30cc and 180cc posts must both exist");
assert.notStrictEqual(drink30.scheduledAt, drink180.scheduledAt);

const status = repair.scheduleStatus(result.store);
assert.strictEqual(status.ok, true, status.issues.join("｜"));
assert.strictEqual(status.canonicalCount, 11);
assert.strictEqual(status.approvedCount, 8);
assert.strictEqual(status.standbyCount, 3);
assert.deepStrictEqual(status.issues, []);

const second = repair.repairStore(result.store, "2026-07-22T08:31:00.000Z");
assert.strictEqual(second.changed, false);
console.log("PASS schedule repair restores 11 posts and keeps 30cc and 180cc separate");
