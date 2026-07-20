"use strict";

const assert = require("assert");
const {
  validSchedule,
  weekKey,
  slotKey,
  scheduleErrors,
} = require("./internal-social-review-safety");

const wed = "2026-07-22T12:00:00.000Z";
const fri = "2026-07-24T12:00:00.000Z";
const tue = "2026-07-21T12:00:00.000Z";
const wrongTime = "2026-07-22T11:30:00.000Z";

assert.strictEqual(validSchedule(wed), true);
assert.strictEqual(validSchedule(fri), true);
assert.strictEqual(validSchedule(tue), false);
assert.strictEqual(validSchedule(wrongTime), false);
assert.strictEqual(weekKey(wed), weekKey(fri));
assert.strictEqual(slotKey(wed), "2026-07-22T12:00");

const existing = [
  { id: "a", status: "draft", scheduledAt: wed },
  { id: "b", status: "approved", scheduledAt: fri },
];
assert.deepStrictEqual(scheduleErrors([existing[0]], { scheduledAt: fri }), []);
assert(scheduleErrors(existing, { scheduledAt: wed }, "new").some((item) => item.includes("同一週最多")));
assert(scheduleErrors(existing, { scheduledAt: wed }, "new").some((item) => item.includes("已經有另一篇")));
assert(scheduleErrors([], { scheduledAt: tue }).some((item) => item.includes("週三、週五")));

console.log("internal social review safety tests passed");
