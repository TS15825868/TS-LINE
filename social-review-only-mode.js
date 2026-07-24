"use strict";

const Module = require("module");
const batch = require("./social-final-approved-batch");

const VERSION = "2026-07-24-review-only-v1";
const REVIEW_NOTE = "已上傳至 App，等待人工確認；系統不會自動排程、發布或補發";
const CANONICAL_IDS = new Set(batch.CANONICAL_IDS || (batch.POSTS || []).map((post) => post.id));
let installed = false;
let socialApi = null;

function isCanonical(post = {}) {
  return CANONICAL_IDS.has(String(post.id || ""));
}

function clearPublishState(post = {}) {
  const next = {
    ...post,
    status: "draft",
    assetLocked: false,
    manualPublishOnly: true,
    manualReviewRequired: true,
    manualImmediatePublish: false,
    manualReviewConfirmedAt: "",
    result: {},
    platformStatus: { instagram: "待確認", facebook: "待確認" },
    lastError: REVIEW_NOTE,
    publishedAt: "",
    instagramPublishedAt: "",
    facebookPublishedAt: "",
    publishAttemptId: "",
    publishAttemptStartedAt: "",
    publishAttemptCompletedAt: "",
    lastAutoRetryAt: "",
    reviewModeVersion: VERSION,
    updatedAt: new Date().toISOString(),
  };
  return next;
}

function removeCanonicalLedgerEntries(store = {}) {
  const ledger = store.publicationLedger && typeof store.publicationLedger === "object"
    ? { ...store.publicationLedger }
    : {};
  for (const platform of ["instagram", "facebook"]) {
    const entries = ledger[platform] && typeof ledger[platform] === "object"
      ? { ...ledger[platform] }
      : {};
    for (const [fingerprint, entry] of Object.entries(entries)) {
      if (CANONICAL_IDS.has(String(entry?.postId || ""))) delete entries[fingerprint];
    }
    ledger[platform] = entries;
  }
  return ledger;
}

function initialReset(inputStore = {}) {
  const store = { ...inputStore };
  store.posts = (Array.isArray(store.posts) ? store.posts : []).map((post) => {
    if (!isCanonical(post)) return post;
    if (post.status === "published" && post.manualReviewConfirmedAt) return post;
    return clearPublishState(post);
  });
  store.publicationLedger = removeCanonicalLedgerEntries(store);
  store.socialReviewOnlyMode = true;
  store.socialReviewOnlyVersion = VERSION;
  store.socialReviewOnlyUpdatedAt = new Date().toISOString();
  return store;
}

function protectStore(inputStore = {}) {
  const store = { ...inputStore };
  store.posts = (Array.isArray(store.posts) ? store.posts : []).map((post) => {
    if (!isCanonical(post)) return post;
    const explicitManualPublish = post.manualImmediatePublish === true;
    const confirmedPublished = post.status === "published" && Boolean(post.manualReviewConfirmedAt || post.manualImmediatePublish);
    if (explicitManualPublish || confirmedPublished) {
      return {
        ...post,
        manualPublishOnly: true,
        manualReviewRequired: true,
        manualReviewConfirmedAt: post.manualReviewConfirmedAt || new Date().toISOString(),
        reviewModeVersion: VERSION,
      };
    }
    return clearPublishState(post);
  });
  store.socialReviewOnlyMode = true;
  store.socialReviewOnlyVersion = VERSION;
  store.socialReviewOnlyUpdatedAt = new Date().toISOString();
  return store;
}

function fakeTimer() {
  return {
    unref() { return this; },
    ref() { return this; },
    hasRef() { return false; },
    refresh() { return this; },
    close() {},
  };
}

function wrapSocialApi(api) {
  if (!api || api.__xjwReviewOnlyWrapped) return api;
  socialApi = api;
  const originalRead = api.readStore.bind(api);
  const originalWrite = api.writeStore.bind(api);
  const originalExecute = api.execute.bind(api);

  originalWrite(initialReset(originalRead()));

  api.writeStore = function reviewOnlyWrite(store) {
    return originalWrite(protectStore(store));
  };

  api.execute = async function reviewOnlyExecute(postId) {
    const store = originalRead();
    const post = (store.posts || []).find((item) => item.id === postId);
    if (isCanonical(post) && post.manualImmediatePublish !== true) {
      throw new Error("目前是人工審核模式：請先在 App 確認圖片與文案，再按『我已確認，手動發布』。");
    }
    if (isCanonical(post)) {
      const index = store.posts.findIndex((item) => item.id === postId);
      store.posts[index] = {
        ...post,
        manualReviewConfirmedAt: post.manualReviewConfirmedAt || new Date().toISOString(),
        reviewModeVersion: VERSION,
      };
      originalWrite(store);
    }
    return originalExecute(postId);
  };

  if (typeof api.healthPayload === "function") {
    const originalHealth = api.healthPayload.bind(api);
    api.healthPayload = function reviewOnlyHealth() {
      return {
        ...originalHealth(),
        reviewOnlyMode: true,
        automaticSchedulingEnabled: false,
        automaticRetryEnabled: false,
        reviewOnlyVersion: VERSION,
      };
    };
  }

  if (api.app && !api.app.__xjwReviewOnlyStatusMounted) {
    Object.defineProperty(api.app, "__xjwReviewOnlyStatusMounted", { value: true });
    api.app.get("/social/review-only-status", (_req, res) => {
      const store = originalRead();
      const posts = (store.posts || []).filter(isCanonical).map((post) => ({
        id: post.id,
        title: post.title,
        status: post.status,
        scheduledAt: post.scheduledAt || "",
        imageUrl: post.imageUrl || "",
        manualPublishOnly: post.manualPublishOnly === true,
        manualReviewRequired: post.manualReviewRequired === true,
        lastError: post.lastError || "",
      }));
      res.json({
        ok: true,
        version: VERSION,
        reviewOnlyMode: true,
        automaticSchedulingEnabled: false,
        automaticRetryEnabled: false,
        canonicalCount: posts.length,
        draftCount: posts.filter((post) => post.status === "draft").length,
        posts,
        checkedAt: new Date().toISOString(),
      });
    });
  }

  Object.defineProperty(api, "__xjwReviewOnlyWrapped", { value: true });
  return api;
}

function install() {
  if (installed) return;
  installed = true;
  const originalLoad = Module._load;
  Module._load = function reviewOnlyLoader(request, parent, isMain) {
    if (request === "./social-server") {
      const originalNow = Date.now;
      const originalSetInterval = global.setInterval;
      Date.now = () => 0;
      global.setInterval = function reviewOnlySetInterval(callback, delay, ...args) {
        if (Number(delay) === 30000) return fakeTimer();
        return originalSetInterval(callback, delay, ...args);
      };
      try {
        const loaded = originalLoad.apply(this, arguments);
        return wrapSocialApi(loaded);
      } finally {
        Date.now = originalNow;
        global.setInterval = originalSetInterval;
      }
    }
    return originalLoad.apply(this, arguments);
  };
}

install();

module.exports = {
  VERSION,
  REVIEW_NOTE,
  CANONICAL_IDS,
  isCanonical,
  clearPublishState,
  removeCanonicalLedgerEntries,
  initialReset,
  protectStore,
  wrapSocialApi,
  install,
};
