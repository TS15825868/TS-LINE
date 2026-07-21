"use strict";

require("./social-schedule-policy");

const assert = require("assert");
const {
  validSchedule,
  weekKey,
  slotKey,
  scheduleErrors,
} = require("./internal-social-review-safety");

const careWed10 = "2026-07-22T02:00:00.000Z";
const otherFri20 = "2026-07-24T12:00:00.000Z";
const careWed20 = "2026-07-22T12:00:00.000Z";
const otherFri10 = "2026-07-24T02:00:00.000Z";
const tue10 = "2026-07-21T02:00:00.000Z";

const care = { sequenceRole: "care", category: "氣候關心", scheduledAt: careWed10 };
const other = { sequenceRole: "product", category: "產品知識", scheduledAt: otherFri20 };
const oneTime = { sequenceRole: "care", oneTimeWeatherPost: true, scheduledAt: tue10 };

assert.strictEqual(validSchedule(careWed10, care), true);
assert.strictEqual(validSchedule(otherFri20, other), true);
assert.strictEqual(validSchedule(careWed20, care), false);
assert.strictEqual(validSchedule(otherFri10, other), false);
assert.strictEqual(validSchedule(tue10, oneTime), true);
assert.strictEqual(weekKey(careWed10), weekKey(otherFri20));
assert.strictEqual(slotKey(careWed10), "2026-07-22T02:00");

const existing = [
  { id: "a", status: "draft", sequenceRole: "care", scheduledAt: careWed10 },
  { id: "b", status: "approved", sequenceRole: "product", scheduledAt: otherFri20 },
];
assert.deepStrictEqual(scheduleErrors([existing[0]], other), []);
assert(scheduleErrors(existing, { ...care, id: "new" }, "new").some((item) => item.includes("同一週最多")));
assert(scheduleErrors(existing, { ...care, id: "new" }, "new").some((item) => item.includes("已經有另一篇")));
assert(scheduleErrors([], { ...care, scheduledAt: careWed20 }).some((item) => item.includes("上午 10:00")));

console.log("internal social review safety tests passed");
