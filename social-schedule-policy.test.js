"use strict";

const assert = require("assert");
const policy = require("./social-schedule-policy");

const wed20 = "2026-07-29T12:00:00.000Z";
const fri20 = "2026-07-31T12:00:00.000Z";
const wed1930 = "2026-07-29T11:30:00.000Z";
const tue20 = "2026-07-28T12:00:00.000Z";
const sat20 = "2026-08-01T12:00:00.000Z";

const care = { title: "照顧自己，也別忘了關心家人", category: "日常關心", sequenceRole: "care", scheduledAt: wed20 };
const product = { title: "龜鹿膏100g", category: "產品介紹", sequenceRole: "product", scheduledAt: wed20 };
const weather = { title: "天氣炎熱，記得補水", conditionalWeather: true, oneTimeWeatherPost: true, weatherTrigger: "hot", scheduledAt: tue20 };

assert.strictEqual(policy.VERSION, "4.0.0");
assert.strictEqual(policy.validScheduledAt(wed20, care), true);
assert.strictEqual(policy.validScheduledAt(wed20, product), true);
assert.strictEqual(policy.validScheduledAt(wed1930, care), false);
assert.strictEqual(policy.validScheduledAt(fri20, product), false);
assert.strictEqual(policy.validScheduledAt(tue20, weather), true);
assert.strictEqual(policy.validScheduledAt(sat20, weather), false);
assert.strictEqual(policy.validScheduledAt(wed20, weather), false);
assert.strictEqual(policy.isWeatherPost(weather), true);
assert.strictEqual(policy.isFixedDay("Wed"), true);
assert.strictEqual(policy.isFixedDay("Fri"), false);
assert.strictEqual(policy.isWeekend("Sat"), true);
assert.strictEqual(policy.isWeekend("Sun"), true);
assert.strictEqual(policy.weekKey(wed20), "2026-07-27");

const normalized = policy.normalizeStore({ posts: [
  { ...care, id: "care", status: "draft", scheduledAt: "2026-07-29T10:00:00.000Z" },
  { ...product, id: "product", status: "draft", scheduledAt: "2026-07-29T02:00:00.000Z" },
] });
assert.strictEqual(normalized.posts[0].scheduledAt, wed20);
assert.strictEqual(normalized.posts[1].scheduledAt, wed20);
assert.strictEqual(normalized.socialScheduleRule.includes("每週1篇"), true);
assert.strictEqual(normalized.socialScheduleRule.includes("週六、週日不發布"), true);
console.log("PASS weekly Wednesday 20:00, conditional weather on other weekdays, and no weekend publishing");
