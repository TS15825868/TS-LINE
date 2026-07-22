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
assert.strictEqual(result.store.posts.length, 10);
assert.strictEqual(result.store.posts.some((post) => post.id === "old-extra"), false);

const repaired = result.store.posts.find((post) => post.id === batch.POSTS[0].id);
assert.strictEqual(repaired.scheduledAt, batch.POSTS[0].scheduledAt);
assert.strictEqual(repaired.status, "approved");
assert.strictEqual(repaired.manualScheduleOverride, undefined);
assert.strictEqual(repaired.manualReviewPending, undefined);

const status = repair.scheduleStatus(result.store);
assert.strictEqual(status.ok, true, status.issues.join("｜"));
assert.strictEqual(status.canonicalCount, 10);
assert.strictEqual(status.approvedCount, 7);
assert.strictEqual(status.standbyCount, 3);
assert.deepStrictEqual(status.issues, []);

const second = repair.repairStore(result.store, "2026-07-22T08:31:00.000Z");
assert.strictEqual(second.changed, false);
console.log("PASS one-time schedule repair restores canonical 10-post schedule and clears accidental overrides");
