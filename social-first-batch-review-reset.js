"use strict";

const Module = require("module");
const batch = require("./social-final-approved-batch");

const VERSION = "2026-07-26-first-batch-review-reset-v1";
const REVIEW_NOTE = "已上傳至 App，等待人工審核；未審核不會排程、發布或補發";
const IDS = new Set((batch.POSTS || []).map((post) => String(post.id || "")));
let installed = false;

function wasActuallyReviewed(post = {}) {
  return Boolean(post.reviewApprovedAt || post.manualReviewConfirmedAt || post.approvedAt);
}

function normalize(store = {}) {
  if (!Array.isArray(store.posts)) return store;
  let changed = false;
  const posts = store.posts.map((post) => {
    if (!IDS.has(String(post?.id || "")) || wasActuallyReviewed(post)) return post;
    const needsReset = post.status !== "pending_review" || post.scheduledAt || post.publishedAt || post.instagramPublishedAt || post.facebookPublishedAt;
    if (!needsReset) return post;
    changed = true;
    return {
      ...post,
      status: "pending_review",
      scheduledAt: "",
      approved: false,
      published: false,
      scheduleEnabled: false,
      schedule_enabled: false,
      manualReviewRequired: true,
      autoPublishAfterReview: false,
      automaticRetryEnabled: false,
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
      firstBatchReviewResetVersion: VERSION,
      updatedAt: new Date().toISOString(),
    };
  });
  return changed ? { ...store, posts, firstBatchReviewResetVersion: VERSION } : store;
}

function wrap(api) {
  if (!api?.readStore || !api?.writeStore || api.__xjwFirstBatchReviewReset) return api;
  const originalWrite = api.writeStore.bind(api);
  api.writeStore = function writeWithFirstBatchReviewReset(store) {
    return originalWrite(normalize(store));
  };
  Object.defineProperty(api, "__xjwFirstBatchReviewReset", { value: true });
  setImmediate(() => {
    try {
      const current = api.readStore();
      api.writeStore(normalize(current));
    } catch (error) {
      console.error("First-batch review reset failed", error.message);
    }
  });
  return api;
}

function install() {
  if (installed) return;
  installed = true;
  const originalLoad = Module._load;
  Module._load = function firstBatchReviewResetLoader(request, parent, isMain) {
    const loaded = originalLoad.apply(this, arguments);
    if (request === "./social-server") wrap(loaded);
    return loaded;
  };
}

install();
module.exports = { VERSION, IDS, wasActuallyReviewed, normalize, wrap, install };
