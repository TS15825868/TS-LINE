"use strict";

const Module = require("module");
const weekly = require("./social-weekly-schedule-override");
const batch = require("./social-final-approved-batch");
const reviewGate = require("./social-review-only-mode");

const VERSION = "2026-07-26-runtime-stabilizer-v2";
const REVIEW_NOTE = "已上傳至 App，等待人工審核；未審核不會排程、發布或補發";
const FORCE_REVIEW_TOPICS = new Set(["care-work-rest"]);
const CANONICAL_IDS = new Set((batch.POSTS || []).map((post) => String(post.id || "")));
const FIXED_PROPOSALS = Array.isArray(weekly.FIXED_SCHEDULES) ? weekly.FIXED_SCHEDULES : [];
const LEGACY_ASSET_ALIASES = Object.freeze({
  "care-work-rest-v7.jpg": "care-work-rest.jpg",
  "product-guilu-gao-100g-v7.jpg": "product-guilu-gao-100g.jpg",
  "care-family-v7.jpg": "care-family.jpg",
  "product-guilu-drink-v7.jpg": "product-guilu-drink-combined.jpg",
  "product-lurongfen-75g-v7.jpg": "product-lurongfen-75g.jpg",
  "product-guilu-tangkuai-75g-v7.jpg": "product-guilu-tangkuai-75g.jpg",
  "product-guilu-jiao-600g-v7.jpg": "product-guilu-jiao-600g.jpg",
  "care-temperature-gap-v7.jpg": "care-temperature-gap.jpg",
  "care-hot-hydration-v7.jpg": "care-hot-hydration.jpg",
  "care-rainy-day-v7.jpg": "care-rainy-day.jpg",
});
const timers = new Set();
let installed = false;
let socialApi = null;

const nowIso = () => new Date().toISOString();

function isForceReview(post = {}) {
  return FORCE_REVIEW_TOPICS.has(String(post.topicKey || ""));
}

function isConfirmedPublished(post = {}) {
  return !isForceReview(post)
    && post.status === "published"
    && Boolean(post.publishedAt || post.instagramPublishedAt || post.facebookPublishedAt);
}

function reviewed(post = {}) {
  return Boolean(post.reviewApprovedAt || post.manualReviewConfirmedAt);
}

function proposedAt(template = {}, fixedIndex = 0) {
  if (template.conditionalWeather === true) return "";
  return FIXED_PROPOSALS[fixedIndex] || template.proposedScheduledAt || template.scheduledAt || "";
}

function pendingPost(template = {}, existing = {}, fixedIndex = 0) {
  const base = { ...template, ...existing, id: template.id };
  const proposal = existing.proposedScheduledAt || proposedAt(template, fixedIndex);
  const imageName = template.imageName || existing.imageName || "";
  const imageUrl = existing.imageUrl || (imageName
    ? `https://ts-line.onrender.com/social-approved-assets/${encodeURIComponent(imageName)}?v=social-raster-tc-v1`
    : "");
  return {
    ...base,
    campaignId: "xjw-social-first-batch-10-v1",
    campaignVersion: batch.VERSION,
    proposedScheduledAt: proposal,
    scheduledAt: "",
    imageUrl,
    status: existing.status === "rejected" ? "rejected" : "pending_review",
    approved: false,
    published: false,
    assetLocked: false,
    scheduleEnabled: false,
    schedule_enabled: false,
    manualReviewRequired: true,
    autoPublishAfterReview: false,
    automaticRetryEnabled: false,
    manualImmediatePublish: false,
    automationStandby: template.conditionalWeather === true,
    oneTimeWeatherPost: false,
    reviewApprovedAt: "",
    reviewApprovedBy: "",
    manualReviewConfirmedAt: "",
    approvedAt: "",
    publishedAt: "",
    instagramPublishedAt: "",
    facebookPublishedAt: "",
    publishAttemptId: "",
    publishAttemptStartedAt: "",
    publishAttemptCompletedAt: "",
    result: {},
    platformStatus: { instagram: "待確認", facebook: "待確認" },
    lastError: REVIEW_NOTE,
    reviewModeVersion: reviewGate.VERSION,
    runtimeStabilizerVersion: VERSION,
    updatedAt: existing.updatedAt || nowIso(),
  };
}

function reviewedPost(template = {}, existing = {}, fixedIndex = 0, store = {}) {
  const base = { ...template, ...existing, id: template.id };
  if (template.conditionalWeather === true) {
    return {
      ...base,
      proposedScheduledAt: "",
      scheduledAt: base.oneTimeWeatherPost === true ? base.scheduledAt || "" : "",
      status: base.oneTimeWeatherPost === true ? base.status : "paused",
      automationStandby: base.oneTimeWeatherPost !== true,
      manualReviewRequired: false,
      autoPublishAfterReview: true,
      assetLocked: true,
      runtimeStabilizerVersion: VERSION,
    };
  }
  let scheduledAt = base.scheduledAt || base.proposedScheduledAt || proposedAt(template, fixedIndex);
  if (!reviewGate.validFixedSlot(scheduledAt) || new Date(scheduledAt).getTime() <= Date.now() + 60000) {
    scheduledAt = reviewGate.nextAvailableFixedSlot(store, base.id, Date.now());
  }
  return {
    ...base,
    proposedScheduledAt: base.proposedScheduledAt || proposedAt(template, fixedIndex),
    scheduledAt,
    status: ["publishing", "published", "partial", "failed"].includes(base.status) ? base.status : "approved",
    automationStandby: false,
    manualReviewRequired: false,
    autoPublishAfterReview: base.status !== "published",
    assetLocked: true,
    scheduleEnabled: true,
    schedule_enabled: true,
    runtimeStabilizerVersion: VERSION,
  };
}

function cleanForceReviewLedger(ledger = {}) {
  const result = ledger && typeof ledger === "object" ? { ...ledger } : {};
  const forceIds = new Set((batch.POSTS || []).filter(isForceReview).map((post) => String(post.id || "")));
  for (const platform of ["instagram", "facebook"]) {
    const entries = result[platform] && typeof result[platform] === "object" ? { ...result[platform] } : {};
    for (const [fingerprint, entry] of Object.entries(entries)) {
      if (forceIds.has(String(entry?.postId || ""))) delete entries[fingerprint];
    }
    result[platform] = entries;
  }
  return result;
}

function normalizeStore(inputStore = {}, previousStore = {}) {
  const input = { ...inputStore };
  const incomingPosts = Array.isArray(input.posts) ? input.posts : [];
  const previousPosts = Array.isArray(previousStore.posts) ? previousStore.posts : [];
  const byId = new Map([...previousPosts, ...incomingPosts].map((post) => [String(post.id || ""), post]));
  const nonCanonical = incomingPosts.filter((post) => !CANONICAL_IDS.has(String(post.id || "")));
  let fixedIndex = 0;
  const canonical = (batch.POSTS || []).map((template) => {
    const existing = byId.get(String(template.id || "")) || {};
    const index = template.conditionalWeather === true ? fixedIndex : fixedIndex++;
    if (isConfirmedPublished(existing)) return { ...template, ...existing, runtimeStabilizerVersion: VERSION };
    if (reviewed(existing) && !isForceReview(template)) return reviewedPost(template, existing, index, { ...input, posts: incomingPosts });
    return pendingPost(template, existing, index);
  });
  return {
    ...input,
    posts: [...nonCanonical, ...canonical].slice(-500),
    publicationLedger: cleanForceReviewLedger(input.publicationLedger || previousStore.publicationLedger || {}),
    socialReviewGateMode: true,
    socialReviewRequired: true,
    automaticSchedulingAfterReview: true,
    automaticRetryEnabled: false,
    socialReviewGateVersion: reviewGate.VERSION,
    runtimeSocialStabilizerVersion: VERSION,
  };
}

function comparable(store = {}) {
  const clone = JSON.parse(JSON.stringify(store));
  delete clone.updatedAt;
  delete clone.runtimeSocialStabilizedAt;
  return JSON.stringify(clone);
}

function removeRoute(app, routePath) {
  if (!app?._router?.stack) return;
  app._router.stack = app._router.stack.filter((layer) => layer?.route?.path !== routePath);
}

async function currentAssetInfo(post = {}) {
  const name = String(post.imageName || "");
  const canonicalName = LEGACY_ASSET_ALIASES[name] || name;
  return batch.assetInfo(canonicalName);
}

function mountCurrentHealth(app) {
  if (!app || app.__xjwCurrentAutomationHealthMounted) return;
  Object.defineProperty(app, "__xjwCurrentAutomationHealthMounted", { value: true });
  removeRoute(app, "/social/automation-healthz");
  removeRoute(app, "/social/final-release-healthz");
  const handler = async (_req, res) => {
    const posts = batch.POSTS || [];
    const assets = await Promise.all(posts.map(currentAssetInfo));
    const body = {
      ok: posts.length === 10 && assets.every((item) => item.ok === true),
      version: batch.VERSION,
      contentVersion: batch.CONTENT_VERSION,
      runtimeStabilizerVersion: VERSION,
      totalPosts: posts.length,
      fixedPosts: posts.filter((post) => post.conditionalWeather !== true).length,
      weatherStandbyPosts: posts.filter((post) => post.conditionalWeather === true).length,
      fixedRule: "每週1篇，週三20:00",
      weatherRule: "人工審核通過後，依實際氣候於其他平日20:00加發；每週最多1篇；週末不發布",
      rateLimitBackoffMs: batch.WEATHER_RATE_LIMIT_BACKOFF_MS,
      assets,
      checkedAt: nowIso(),
    };
    res.status(body.ok ? 200 : 503).json(body);
  };
  app.get("/social/automation-healthz", handler);
  app.get("/social/final-release-healthz", handler);
}

function wrapSocialApi(api) {
  if (!api || api.__xjwRuntimeStabilized) return api;
  socialApi = api;
  const originalWrite = api.writeStore.bind(api);
  api.writeStore = function stabilizedWrite(store) {
    const previous = api.readStore();
    const normalized = normalizeStore(store, previous);
    if (comparable(normalized) === comparable(previous)) return previous;
    normalized.runtimeSocialStabilizedAt = nowIso();
    return originalWrite(normalized);
  };
  Object.defineProperty(api, "__xjwRuntimeStabilized", { value: true });
  setImmediate(() => {
    try {
      const current = api.readStore();
      api.writeStore(normalizeStore(current, current));
    } catch (error) {
      console.error("Runtime social stabilization failed", error.message);
    }
  });
  const timer = setInterval(() => {
    try {
      const current = api.readStore();
      api.writeStore(normalizeStore(current, current));
    } catch (error) {
      console.error("Runtime social periodic stabilization failed", error.message);
    }
  }, 5 * 60 * 1000);
  timer.unref?.();
  timers.add(timer);
  return api;
}

function install() {
  if (installed) return;
  installed = true;
  const originalLoad = Module._load;
  Module._load = function runtimeStabilizerLoader(request, parent, isMain) {
    const loaded = originalLoad.apply(this, arguments);
    if (request === "./server" && loaded?.app) mountCurrentHealth(loaded.app);
    if (request === "./social-server" && loaded?.readStore && loaded?.writeStore) wrapSocialApi(loaded);
    return loaded;
  };
}

install();

module.exports = {
  VERSION,
  FORCE_REVIEW_TOPICS,
  CANONICAL_IDS,
  FIXED_PROPOSALS,
  LEGACY_ASSET_ALIASES,
  isForceReview,
  isConfirmedPublished,
  reviewed,
  proposedAt,
  pendingPost,
  reviewedPost,
  cleanForceReviewLedger,
  normalizeStore,
  comparable,
  currentAssetInfo,
  mountCurrentHealth,
  wrapSocialApi,
  install,
};
