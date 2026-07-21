"use strict";

const fs = require("fs");
const path = require("path");
const Module = require("module");
const policy = require("./social-schedule-policy");

const VERSION = "1.0.0";
const STORE_PATH = path.resolve(process.env.SOCIAL_DATA_PATH || "/tmp/xianjiawei-social-posts.json");
const originalValidScheduledAt = policy.validScheduledAt.bind(policy);
const originalScheduleError = policy.scheduleError.bind(policy);
const originalNormalizePostSchedule = policy.normalizePostSchedule.bind(policy);
let installed = false;

function manualOverride(value) {
  return value === true || value === "true" || value === "on" || value === 1 || value === "1";
}

function validManualTime(value) {
  const date = new Date(value);
  return Number.isFinite(date.getTime());
}

function validScheduledAt(value, post = {}) {
  if (manualOverride(post?.manualScheduleOverride)) return validManualTime(value);
  return originalValidScheduledAt(value, post);
}

function scheduleError(post = {}) {
  if (manualOverride(post?.manualScheduleOverride)) return "手動排程時間格式不正確";
  return originalScheduleError(post);
}

function normalizePostSchedule(post) {
  if (!post || !manualOverride(post.manualScheduleOverride)) return originalNormalizePostSchedule(post);
  if (["published", "cancelled"].includes(post.status) || !validManualTime(post.scheduledAt)) return post;
  if (post.scheduleTimePolicy === "manual-override") return post;
  return {
    ...post,
    scheduleTimePolicy: "manual-override",
    updatedAt: new Date().toISOString(),
  };
}

function installPolicyOverrides() {
  policy.validScheduledAt = validScheduledAt;
  policy.scheduleError = scheduleError;
  policy.normalizePostSchedule = normalizePostSchedule;
}

function restoreManualTimesAfterWrite() {
  if (fs.renameSync.__xjwManualScheduleOverride) return;
  const previousRename = fs.renameSync.bind(fs);
  const wrapped = function preserveManualSocialSchedule(source, destination) {
    let manualTimes = new Map();
    try {
      if (path.resolve(String(destination)) === STORE_PATH && fs.existsSync(source)) {
        const before = JSON.parse(fs.readFileSync(source, "utf8"));
        manualTimes = new Map(
          (before.posts || [])
            .filter((post) => manualOverride(post?.manualScheduleOverride) && validManualTime(post?.scheduledAt))
            .map((post) => [String(post.id || ""), post.scheduledAt])
            .filter(([id]) => id)
        );
      }
    } catch (error) {
      console.error("manual social schedule snapshot failed", error.message);
    }

    const result = previousRename(source, destination);

    if (manualTimes.size && path.resolve(String(destination)) === STORE_PATH) {
      try {
        const after = JSON.parse(fs.readFileSync(destination, "utf8"));
        let changed = false;
        after.posts = (after.posts || []).map((post) => {
          const scheduledAt = manualTimes.get(String(post.id || ""));
          if (!scheduledAt || post.scheduledAt === scheduledAt) return post;
          changed = true;
          return {
            ...post,
            scheduledAt,
            manualScheduleOverride: true,
            scheduleTimePolicy: "manual-override",
            updatedAt: new Date().toISOString(),
          };
        });
        if (changed) fs.writeFileSync(destination, JSON.stringify(after, null, 2), { mode: 0o600 });
      } catch (error) {
        console.error("manual social schedule restore failed", error.message);
      }
    }
    return result;
  };
  Object.defineProperty(wrapped, "__xjwManualScheduleOverride", { value: true });
  fs.renameSync = wrapped;
}

function transformInternalSafety(source) {
  source = policy.transformSource("internal-social-review-safety.js", source);
  source = source.replace(
    'scheduledAt: Number.isNaN(scheduledAt.getTime()) ? "" : scheduledAt.toISOString(),',
    'scheduledAt: Number.isNaN(scheduledAt.getTime()) ? "" : scheduledAt.toISOString(),\n    manualScheduleOverride:\n      body.manualScheduleOverride === undefined\n        ? Boolean(existing.manualScheduleOverride)\n        : [true, "true", "on", 1, "1"].includes(body.manualScheduleOverride),\n    automationManaged: Boolean(existing.automationManaged),'
  );
  return source;
}

function transformReviewCenter(source) {
  source = policy.transformSource("social-review-center.js", source);
  source = source.replace(
    'scheduledAt: Number.isNaN(scheduledAt.getTime()) ? "" : scheduledAt.toISOString(),',
    'scheduledAt: Number.isNaN(scheduledAt.getTime()) ? "" : scheduledAt.toISOString(),\n    manualScheduleOverride: ["true", "on", "1"].includes(String(body.manualScheduleOverride || "")) || Boolean(existing.manualScheduleOverride),\n    automationManaged: Boolean(existing.automationManaged),'
  );
  source = source.replace(
    '<form method="post" action="${action}">',
    '<form method="post" action="${action}"><input type="hidden" name="manualScheduleOverride" value="true">'
  );
  return source;
}

function installSourceTransforms() {
  if (Module._extensions[".js"].__xjwManualScheduleOverride) return;
  const previousLoader = Module._extensions[".js"];
  const wrapped = function loadWithManualScheduleOverride(module, filename) {
    const base = path.basename(filename);
    if (base === "internal-social-review-safety.js") {
      return module._compile(transformInternalSafety(fs.readFileSync(filename, "utf8")), filename);
    }
    if (base === "social-review-center.js") {
      return module._compile(transformReviewCenter(fs.readFileSync(filename, "utf8")), filename);
    }
    return previousLoader(module, filename);
  };
  Object.defineProperty(wrapped, "__xjwManualScheduleOverride", { value: true });
  Module._extensions[".js"] = wrapped;
}

function install() {
  if (installed) return;
  installed = true;
  installPolicyOverrides();
  restoreManualTimesAfterWrite();
  installSourceTransforms();
}

install();

module.exports = {
  VERSION,
  manualOverride,
  validManualTime,
  validScheduledAt,
  scheduleError,
  normalizePostSchedule,
  transformInternalSafety,
  transformReviewCenter,
  install,
};