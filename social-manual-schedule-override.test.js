"use strict";

const assert = require("assert");
const manual = require("./social-manual-schedule-override");
const policy = require("./social-schedule-policy");

const thursday1530 = "2026-07-23T07:30:00.000Z";
const product = {
  title: "龜鹿膏使用提醒",
  category: "產品介紹",
  scheduledAt: thursday1530,
  manualScheduleOverride: true,
  status: "draft",
};

assert.strictEqual(manual.manualOverride(true), true);
assert.strictEqual(manual.manualOverride("true"), true);
assert.strictEqual(manual.manualOverride("false"), false);
assert.strictEqual(manual.validManualTime(thursday1530), true);
assert.strictEqual(policy.validScheduledAt(thursday1530, product), true);
assert.strictEqual(policy.scheduleError(product), "手動排程時間格式不正確");

const normalized = policy.normalizePostSchedule(product);
assert.strictEqual(normalized.scheduledAt, thursday1530);
assert.strictEqual(normalized.scheduleTimePolicy, "manual-override");

const safetySource = `function normalizePost(body = {}, existing = {}) {\n  const scheduledAt = new Date(body.scheduledAt ?? existing.scheduledAt);\n  return {\n    ...existing,\n    scheduledAt: Number.isNaN(scheduledAt.getTime()) ? "" : scheduledAt.toISOString(),\n  };\n}`;
const transformedSafety = manual.transformInternalSafety(safetySource);
assert.ok(transformedSafety.includes("manualScheduleOverride"));
assert.ok(transformedSafety.includes("automationManaged"));

const reviewSource = 'const action = isNew ? "/social-post" : `/social-post/${encodeURIComponent(value.id)}/edit`;\nreturn `<form method="post" action="${action}">`;\nconst value = { scheduledAt: Number.isNaN(scheduledAt.getTime()) ? "" : scheduledAt.toISOString(), };';
const transformedReview = manual.transformReviewCenter(reviewSource);
assert.ok(transformedReview.includes('name="manualScheduleOverride"'));
assert.ok(transformedReview.includes("manualScheduleOverride"));

console.log("manual social schedule override tests passed");