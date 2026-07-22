"use strict";

const Module = require("module");
const batch = require("./social-final-approved-batch");
const schedulePolicy = require("./social-schedule-policy");

const VERSION = "2026-07-22-v3";
const ACTIVE_STATUSES = new Set(["approved", "publishing", "published", "failed", "partial"]);
let installed = false;
let socialApi = null;

const nowIso = () => new Date().toISOString();

function canonicalPrevious(previous = {}) {
  const next = { ...previous };
  delete next.manualScheduleOverride;
  delete next.manualContentOverride;
  delete next.manualReviewPending;
  delete next.manualScheduleUpdatedAt;
  delete next.manualContentUpdatedAt;
  if (["draft", "rejected", "paused", "cancelled"].includes(String(next.status || ""))) delete next.status;
  return next;
}

function repairStore(inputStore, updatedAt = nowIso()) {
  const store = { ...(inputStore || {}) };
  if (store.socialScheduleRepairVersion === VERSION) {
    return { store, changed: false, repaired: 0, removed: 0 };
  }

  const original = Array.isArray(store.posts) ? store.posts : [];
  const byId = new Map(original.map((post) => [String(post.id || ""), post]));
  const published = original.filter((post) => post.status === "published");
  const publishedIds = new Set(published.map((post) => String(post.id || "")));
  const canonical = [];
  let repaired = 0;

  for (const template of batch.POSTS) {
    if (publishedIds.has(template.id)) continue;
    const previous = canonicalPrevious(byId.get(template.id) || {});
    const desired = batch.desiredPost(template, previous, updatedAt);
    delete desired.manualScheduleOverride;
    delete desired.manualContentOverride;
    delete desired.manualReviewPending;
    canonical.push(desired);
    repaired += 1;
  }

  const removed = original.filter(
    (post) => post.status !== "published" && !batch.CANONICAL_IDS.has(String(post.id || ""))
  ).length;

  store.posts = [...published, ...canonical].slice(-500);
  store.socialScheduleRepairVersion = VERSION;
  store.socialScheduleRepairAt = updatedAt;
  store.socialScheduleRepairReason = "龜鹿飲30cc與180cc分開發文；固定關心週三19:30、產品週五20:00；氣候符合時10:00例外加發";
  return { store, changed: true, repaired, removed };
}

function repair(readStore, writeStore) {
  const result = repairStore(readStore());
  if (result.changed) writeStore(result.store);
  return {
    version: VERSION,
    changed: result.changed,
    repaired: result.repaired,
    removed: result.removed,
  };
}

function weekKey(value) {
  const parts = schedulePolicy.taipeiParts(value);
  if (!parts) return "";
  const date = new Date(Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day)));
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() - day + 1);
  return date.toISOString().slice(0, 10);
}

function scheduleStatus(store = {}) {
  const canonical = (store.posts || [])
    .filter((post) => batch.CANONICAL_IDS.has(String(post.id || "")))
    .map((post) => ({
      id: post.id,
      title: post.title,
      sequenceRole: post.sequenceRole,
      status: post.status,
      scheduledAt: post.scheduledAt || "",
      conditionalWeather: post.conditionalWeather === true,
      automationStandby: post.automationStandby === true,
      oneTimeWeatherPost: post.oneTimeWeatherPost === true,
      manualScheduleOverride: post.manualScheduleOverride === true,
      manualContentOverride: post.manualContentOverride === true,
      scheduleTimePolicy: post.scheduleTimePolicy || "",
      publishedAt: post.publishedAt || "",
    }));

  const issues = [];
  const expectedCount = batch.POSTS.length;
  if (canonical.length !== expectedCount) issues.push(`正式貼文數量應為${expectedCount}，目前為${canonical.length}`);

  const active = canonical.filter((post) => ACTIVE_STATUSES.has(post.status));
  const timeMap = new Map();
  for (const post of active) {
    if (!post.scheduledAt) {
      issues.push(`${post.title} 缺少排程時間`);
      continue;
    }
    if (!schedulePolicy.validScheduledAt(post.scheduledAt, post)) {
      issues.push(`${post.title} 排程時間不符合規則`);
    }
    const list = timeMap.get(post.scheduledAt) || [];
    list.push(post.title);
    timeMap.set(post.scheduledAt, list);
    if (post.manualScheduleOverride) issues.push(`${post.title} 仍有手動時間覆寫`);
  }
  for (const [time, titles] of timeMap) {
    if (titles.length > 1) issues.push(`${time} 有${titles.length}篇重複排程：${titles.join("、")}`);
  }

  const regularWeekCounts = new Map();
  const weatherWeekCounts = new Map();
  for (const post of active) {
    const week = weekKey(post.scheduledAt);
    if (!week) continue;
    if (post.oneTimeWeatherPost || post.conditionalWeather) {
      weatherWeekCounts.set(week, (weatherWeekCounts.get(week) || 0) + 1);
    } else {
      regularWeekCounts.set(week, (regularWeekCounts.get(week) || 0) + 1);
    }
  }
  for (const [week, count] of regularWeekCounts) {
    if (count > 2) issues.push(`${week} 這週固定貼文共有${count}篇，超過每週2篇`);
  }
  for (const [week, count] of weatherWeekCounts) {
    if (count > 1) issues.push(`${week} 這週氣候例外貼文共有${count}篇，應最多1篇`);
  }

  return {
    ok: issues.length === 0,
    version: VERSION,
    checkedAt: nowIso(),
    repairVersion: store.socialScheduleRepairVersion || "",
    rule: {
      regularCare: "每週三 19:30",
      product: "每週五 20:00",
      weatherException: "符合萬華實際氣候時，當日上午 10:00 額外發布，不占固定篇數",
      guiluDrink: "30cc與180cc分開發文",
    },
    canonicalCount: canonical.length,
    activeCount: active.length,
    publishedCount: canonical.filter((post) => post.status === "published").length,
    approvedCount: canonical.filter((post) => post.status === "approved").length,
    standbyCount: canonical.filter((post) => post.automationStandby === true).length,
    issues,
    posts: canonical.sort((a, b) => {
      if (!a.scheduledAt && !b.scheduledAt) return a.title.localeCompare(b.title, "zh-Hant");
      if (!a.scheduledAt) return 1;
      if (!b.scheduledAt) return -1;
      return new Date(a.scheduledAt) - new Date(b.scheduledAt);
    }),
  };
}

function mountStatus(app) {
  if (!app || app.__xjwScheduleRepairStatusMounted) return;
  Object.defineProperty(app, "__xjwScheduleRepairStatusMounted", { value: true });
  app.get("/social/schedule-status", (_req, res) => {
    if (!socialApi?.readStore) {
      return res.status(503).json({ ok: false, version: VERSION, error: "社群資料尚未載入" });
    }
    const status = scheduleStatus(socialApi.readStore());
    return res.status(status.ok ? 200 : 409).json(status);
  });
}

function install() {
  if (installed) return;
  installed = true;
  const originalLoad = Module._load;
  Module._load = function scheduleRepairLoader(request, parent, isMain) {
    const loaded = originalLoad.apply(this, arguments);
    if (request === "./server" && loaded?.app) mountStatus(loaded.app);
    if (request === "./social-server" && loaded?.readStore && loaded?.writeStore) {
      socialApi = loaded;
      setImmediate(() => {
        try {
          console.log("Social schedule drink-split repair", repair(loaded.readStore, loaded.writeStore));
        } catch (error) {
          console.error("Social schedule drink-split repair failed", error.message);
        }
      });
    }
    return loaded;
  };
}

install();

module.exports = {
  VERSION,
  canonicalPrevious,
  repairStore,
  repair,
  weekKey,
  scheduleStatus,
  mountStatus,
  install,
};
