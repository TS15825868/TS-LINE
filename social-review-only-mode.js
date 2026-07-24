"use strict";

const Module = require("module");
const batch = require("./social-final-approved-batch");

const VERSION = "2026-07-24-review-gate-v2";
const REVIEW_NOTE = "已上傳至 App，等待人工審核；未審核不會排程、發布或補發";
const APPROVED_NOTE = "已通過人工審核，等待排程自動發布";
const WEATHER_NOTE = "已通過人工審核，等待符合萬華實際氣候後安排發布";
const CANONICAL_IDS = new Set(batch.CANONICAL_IDS || (batch.POSTS || []).map((post) => post.id));
const CONTENT_FIELDS = ["title", "imageUrl", "instagramCaption", "facebookCaption", "scheduledAt", "publishInstagram", "publishFacebook"];
let installed = false;
let socialApi = null;

const nowIso = () => new Date().toISOString();

function isCanonical(post = {}) {
  return CANONICAL_IDS.has(String(post.id || ""));
}

function callFromApp() {
  return new Error().stack?.includes("internal-app-pro.js") === true;
}

function contentSignature(post = {}) {
  return JSON.stringify(CONTENT_FIELDS.map((key) => post[key] ?? ""));
}

function clearPublishState(post = {}, status = "draft", note = REVIEW_NOTE) {
  return {
    ...post,
    status,
    assetLocked: false,
    manualPublishOnly: false,
    manualReviewRequired: true,
    autoPublishAfterReview: false,
    manualImmediatePublish: false,
    reviewApprovedAt: "",
    reviewApprovedBy: "",
    manualReviewConfirmedAt: "",
    result: {},
    platformStatus: { instagram: "待確認", facebook: "待確認" },
    lastError: note,
    publishedAt: "",
    instagramPublishedAt: "",
    facebookPublishedAt: "",
    publishAttemptId: "",
    publishAttemptStartedAt: "",
    publishAttemptCompletedAt: "",
    lastAutoRetryAt: "",
    reviewModeVersion: VERSION,
    updatedAt: nowIso(),
  };
}

function approvePost(post = {}) {
  const approvedAt = nowIso();
  const weatherStandby = post.conditionalWeather === true && !post.scheduledAt;
  return {
    ...post,
    status: weatherStandby ? "paused" : "approved",
    assetLocked: true,
    manualPublishOnly: false,
    manualReviewRequired: false,
    autoPublishAfterReview: true,
    manualImmediatePublish: false,
    reviewApprovedAt: approvedAt,
    reviewApprovedBy: "內部管理 App",
    manualReviewConfirmedAt: approvedAt,
    approvedAt: post.approvedAt || approvedAt,
    automationStandby: weatherStandby ? true : Boolean(post.automationStandby),
    platformStatus: { instagram: "待發布", facebook: "待發布" },
    lastError: weatherStandby ? WEATHER_NOTE : "",
    reviewModeVersion: VERSION,
    updatedAt: approvedAt,
  };
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
  if (store.socialReviewGateVersion === VERSION) {
    store.socialReviewGateMode = true;
    store.socialReviewRequired = true;
    store.automaticSchedulingAfterReview = true;
    store.automaticRetryEnabled = false;
    return store;
  }
  store.posts = (Array.isArray(store.posts) ? store.posts : []).map((post) => {
    if (!isCanonical(post)) return post;
    return clearPublishState(post);
  });
  // 使用者已刪除先前錯誤發布，這次初始化清除該批舊發布指紋；之後重新建立防重複紀錄。
  store.publicationLedger = removeCanonicalLedgerEntries(store);
  store.socialReviewGateMode = true;
  store.socialReviewRequired = true;
  store.automaticSchedulingAfterReview = true;
  store.automaticRetryEnabled = false;
  store.socialReviewGateVersion = VERSION;
  store.socialReviewGateInitializedAt = nowIso();
  return store;
}

function preserveReviewedPost(incoming = {}, previous = {}, fromApp = false) {
  const approvedAt = previous.reviewApprovedAt || previous.manualReviewConfirmedAt;
  const contentChanged = fromApp && contentSignature(incoming) !== contentSignature(previous);
  if (contentChanged && incoming.manualImmediatePublish !== true) {
    return clearPublishState(incoming, "draft", "內容或排程已修改，請重新審核後再啟用自動發布");
  }

  if (fromApp && incoming.status === "rejected") {
    return clearPublishState(incoming, "rejected", "已退回修改；修改完成後請重新審核");
  }
  if (fromApp && incoming.status === "cancelled") {
    return {
      ...clearPublishState(incoming, "cancelled", "已取消"),
      manualReviewRequired: false,
    };
  }

  const allowedStatuses = new Set(["approved", "paused", "publishing", "published", "partial", "failed"]);
  const status = allowedStatuses.has(String(incoming.status || ""))
    ? incoming.status
    : (allowedStatuses.has(String(previous.status || "")) ? previous.status : "approved");

  return {
    ...incoming,
    status,
    assetLocked: true,
    manualPublishOnly: false,
    manualReviewRequired: false,
    autoPublishAfterReview: true,
    reviewApprovedAt: approvedAt,
    reviewApprovedBy: previous.reviewApprovedBy || "內部管理 App",
    manualReviewConfirmedAt: approvedAt,
    approvedAt: incoming.approvedAt || previous.approvedAt || approvedAt,
    reviewModeVersion: VERSION,
  };
}

function protectStore(inputStore = {}, previousStore = {}, fromApp = false) {
  const store = { ...inputStore };
  const previousById = new Map((previousStore.posts || []).map((post) => [String(post.id || ""), post]));
  store.posts = (Array.isArray(store.posts) ? store.posts : []).map((incoming) => {
    if (!isCanonical(incoming)) return incoming;
    const previous = previousById.get(String(incoming.id || "")) || {};
    const previouslyReviewed = Boolean(previous.reviewApprovedAt || previous.manualReviewConfirmedAt);

    // 「立即發布」不能取代審核；未審核直接按發布仍維持草稿。
    if (!previouslyReviewed && incoming.manualImmediatePublish === true) {
      return clearPublishState(incoming, "draft", "請先按『審核通過・啟用自動發布』，確認後才可立即發布");
    }

    // 只有從內部 App 明確按下 approve，才建立人工審核憑證。
    if (!previouslyReviewed && fromApp && incoming.status === "approved") {
      return approvePost(incoming);
    }

    if (previouslyReviewed) return preserveReviewedPost(incoming, previous, fromApp);

    if (fromApp && incoming.status === "rejected") {
      return clearPublishState(incoming, "rejected", "已退回修改；修改完成後請重新審核");
    }
    if (fromApp && incoming.status === "cancelled") {
      return { ...clearPublishState(incoming, "cancelled", "已取消"), manualReviewRequired: false };
    }

    // 任何背景排程、重建或遷移都無權把未審核內容改成 approved。
    return clearPublishState(incoming);
  });
  store.socialReviewGateMode = true;
  store.socialReviewRequired = true;
  store.automaticSchedulingAfterReview = true;
  store.automaticRetryEnabled = false;
  store.socialReviewGateVersion = VERSION;
  store.socialReviewGateUpdatedAt = nowIso();
  return store;
}

function wrapSocialApi(api) {
  if (!api || api.__xjwReviewGateWrapped) return api;
  socialApi = api;
  const originalRead = api.readStore.bind(api);
  const originalWrite = api.writeStore.bind(api);
  const originalExecute = api.execute.bind(api);

  originalWrite(initialReset(originalRead()));

  api.writeStore = function reviewGateWrite(store) {
    const previous = originalRead();
    return originalWrite(protectStore(store, previous, callFromApp()));
  };

  api.execute = async function reviewGateExecute(postId) {
    const store = originalRead();
    const post = (store.posts || []).find((item) => item.id === postId);
    if (isCanonical(post) && !post.reviewApprovedAt && !post.manualReviewConfirmedAt) {
      throw new Error("這篇尚未通過人工審核，不能發布。請先在 App 確認圖片、文案、平台與時間。");
    }
    if (isCanonical(post) && post.assetLocked !== true) {
      throw new Error("審核憑證不完整，請退回後重新審核。");
    }
    return originalExecute(postId);
  };

  if (typeof api.healthPayload === "function") {
    const originalHealth = api.healthPayload.bind(api);
    api.healthPayload = function reviewGateHealth() {
      return {
        ...originalHealth(),
        reviewGateMode: true,
        reviewRequiredBeforePublish: true,
        automaticSchedulingEnabled: true,
        automaticSchedulingRequiresReview: true,
        automaticRetryEnabled: false,
        reviewGateVersion: VERSION,
      };
    };
  }

  if (api.app && !api.app.__xjwReviewGateStatusMounted) {
    Object.defineProperty(api.app, "__xjwReviewGateStatusMounted", { value: true });
    const handler = (_req, res) => {
      const store = originalRead();
      const posts = (store.posts || []).filter(isCanonical).map((post) => ({
        id: post.id,
        title: post.title,
        status: post.status,
        scheduledAt: post.scheduledAt || "",
        imageUrl: post.imageUrl || "",
        conditionalWeather: post.conditionalWeather === true,
        automationStandby: post.automationStandby === true,
        reviewApprovedAt: post.reviewApprovedAt || "",
        reviewApprovedBy: post.reviewApprovedBy || "",
        autoPublishAfterReview: post.autoPublishAfterReview === true,
        manualReviewRequired: post.manualReviewRequired !== false,
        lastError: post.lastError || "",
      }));
      const reviewed = posts.filter((post) => Boolean(post.reviewApprovedAt));
      res.json({
        ok: true,
        version: VERSION,
        reviewGateMode: true,
        reviewRequiredBeforePublish: true,
        automaticSchedulingEnabled: true,
        automaticSchedulingRequiresReview: true,
        automaticRetryEnabled: false,
        canonicalCount: posts.length,
        draftCount: posts.filter((post) => ["draft", "rejected"].includes(post.status)).length,
        reviewedCount: reviewed.length,
        automaticQueueCount: reviewed.filter((post) => ["approved", "paused"].includes(post.status)).length,
        unreviewedActiveCount: posts.filter((post) => !post.reviewApprovedAt && ["approved", "paused", "publishing", "published", "partial", "failed"].includes(post.status)).length,
        posts,
        checkedAt: nowIso(),
      });
    };
    api.app.get("/social/review-gate-status", handler);
    api.app.get("/social/review-only-status", handler);
  }

  Object.defineProperty(api, "__xjwReviewGateWrapped", { value: true });
  return api;
}

function install() {
  if (installed) return;
  installed = true;
  const originalLoad = Module._load;
  Module._load = function reviewGateLoader(request, parent, isMain) {
    const loaded = originalLoad.apply(this, arguments);
    if (request === "./social-server") return wrapSocialApi(loaded);
    return loaded;
  };
}

install();

module.exports = {
  VERSION,
  REVIEW_NOTE,
  APPROVED_NOTE,
  WEATHER_NOTE,
  CANONICAL_IDS,
  isCanonical,
  callFromApp,
  contentSignature,
  clearPublishState,
  approvePost,
  removeCanonicalLedgerEntries,
  initialReset,
  preserveReviewedPost,
  protectStore,
  wrapSocialApi,
  install,
};