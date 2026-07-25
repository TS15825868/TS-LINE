"use strict";

const Module = require("module");
const batch = require("./social-final-approved-batch");

const VERSION = "2026-07-26-review-gate-v5";
const REVIEW_NOTE = "已上傳至 App，等待人工審核；未審核不會排程、發布或補發";
const WEATHER_NOTE = "已通過人工審核，等待符合萬華實際氣候後安排平日晚間發布";
const CANONICAL_IDS = new Set(batch.CANONICAL_IDS || (batch.POSTS || []).map((post) => post.id));
const CONTENT_FIELDS = ["title", "imageUrl", "instagramCaption", "facebookCaption", "proposedScheduledAt", "scheduledAt", "publishInstagram", "publishFacebook"];
let installed = false;

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

function taipeiParts(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return Object.fromEntries(new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date).filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
}

function validFixedSlot(value) {
  const parts = taipeiParts(value);
  return Boolean(parts && parts.weekday === "Wed" && parts.hour === "20" && parts.minute === "00");
}

function nextAvailableFixedSlot(store = {}, postId = "", afterMs = Date.now()) {
  const occupied = new Set((store.posts || [])
    .filter((post) => String(post.id || "") !== String(postId || "") && post.scheduledAt && ["approved", "publishing", "published", "partial", "failed"].includes(String(post.status || "")))
    .map((post) => new Date(post.scheduledAt).toISOString()));
  const local = taipeiParts(new Date(afterMs));
  if (!local) return "";
  for (let offset = 0; offset < 740; offset += 1) {
    const localDate = new Date(Date.UTC(Number(local.year), Number(local.month) - 1, Number(local.day) + offset));
    if (localDate.getUTCDay() !== 3) continue;
    const candidate = new Date(Date.UTC(
      localDate.getUTCFullYear(),
      localDate.getUTCMonth(),
      localDate.getUTCDate(),
      12, 0, 0, 0
    ));
    if (candidate.getTime() <= afterMs + 60 * 1000) continue;
    if (occupied.has(candidate.toISOString())) continue;
    return candidate.toISOString();
  }
  return "";
}

function clearPublishState(post = {}, status = "pending_review", note = REVIEW_NOTE) {
  const proposedScheduledAt = post.proposedScheduledAt || post.scheduledAt || "";
  return {
    ...post,
    proposedScheduledAt,
    scheduledAt: "",
    status,
    approved: false,
    scheduleEnabled: false,
    schedule_enabled: false,
    published: false,
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

function approvePost(post = {}, store = {}) {
  const approvedAt = nowIso();
  const weatherStandby = post.conditionalWeather === true;
  let scheduledAt = weatherStandby ? "" : (post.proposedScheduledAt || post.scheduledAt || "");
  let reviewScheduleNote = "";
  if (!weatherStandby) {
    const originalTime = new Date(scheduledAt).getTime();
    if (!validFixedSlot(scheduledAt) || !Number.isFinite(originalTime) || originalTime <= Date.now() + 60 * 1000) {
      scheduledAt = nextAvailableFixedSlot(store, post.id, Date.now());
      if (!scheduledAt) throw new Error("找不到可用的週三晚上8:00排程，請先調整其他貼文時間");
      reviewScheduleNote = `原建議排程已過或不合規，審核後改排至${new Date(scheduledAt).toLocaleString("zh-TW", { timeZone: "Asia/Taipei", hour12: false })}`;
    }
  }
  return {
    ...post,
    proposedScheduledAt: post.proposedScheduledAt || post.scheduledAt || scheduledAt,
    scheduledAt,
    status: weatherStandby ? "paused" : "approved",
    approved: true,
    scheduleEnabled: !weatherStandby,
    schedule_enabled: !weatherStandby,
    published: false,
    assetLocked: true,
    manualPublishOnly: false,
    manualReviewRequired: false,
    autoPublishAfterReview: true,
    manualImmediatePublish: false,
    reviewApprovedAt: approvedAt,
    reviewApprovedBy: "內部管理 App",
    manualReviewConfirmedAt: approvedAt,
    approvedAt: approvedAt,
    automationStandby: weatherStandby,
    platformStatus: { instagram: "待發布", facebook: "待發布" },
    reviewScheduleNote,
    lastError: weatherStandby ? WEATHER_NOTE : "",
    reviewModeVersion: VERSION,
    updatedAt: approvedAt,
  };
}

function removeUnpublishedCanonicalLedgerEntries(store = {}, publishedIds = new Set()) {
  const ledger = store.publicationLedger && typeof store.publicationLedger === "object" ? { ...store.publicationLedger } : {};
  for (const platform of ["instagram", "facebook"]) {
    const entries = ledger[platform] && typeof ledger[platform] === "object" ? { ...ledger[platform] } : {};
    for (const [fingerprint, entry] of Object.entries(entries)) {
      const postId = String(entry?.postId || "");
      if (CANONICAL_IDS.has(postId) && !publishedIds.has(postId)) delete entries[fingerprint];
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

  const originalPosts = Array.isArray(store.posts) ? store.posts : [];
  const publishedIds = new Set(originalPosts
    .filter((post) => isCanonical(post) && post.status === "published" && Boolean(post.publishedAt || post.instagramPublishedAt || post.facebookPublishedAt))
    .map((post) => String(post.id || "")));

  store.posts = originalPosts.map((post) => {
    if (!isCanonical(post)) return post;
    if (publishedIds.has(String(post.id || ""))) {
      return {
        ...post,
        approved: true,
        published: true,
        assetLocked: true,
        manualReviewRequired: false,
        autoPublishAfterReview: false,
        scheduleEnabled: false,
        schedule_enabled: false,
        reviewModeVersion: VERSION,
      };
    }
    return clearPublishState(post);
  });
  store.publicationLedger = removeUnpublishedCanonicalLedgerEntries(store, publishedIds);
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
    return clearPublishState(incoming, "pending_review", "內容或建議排程已修改，請重新審核後再啟用自動發布");
  }
  if (fromApp && incoming.status === "rejected") return clearPublishState(incoming, "rejected", "已退回修改；修改完成後請重新審核");
  if (fromApp && incoming.status === "cancelled") return { ...clearPublishState(incoming, "cancelled", "已取消"), manualReviewRequired: false };

  const allowedStatuses = new Set(["approved", "paused", "publishing", "published", "partial", "failed"]);
  const status = allowedStatuses.has(String(incoming.status || ""))
    ? incoming.status
    : (allowedStatuses.has(String(previous.status || "")) ? previous.status : "approved");
  return {
    ...incoming,
    status,
    approved: true,
    published: status === "published",
    assetLocked: true,
    manualPublishOnly: false,
    manualReviewRequired: false,
    autoPublishAfterReview: status !== "published",
    scheduleEnabled: status === "approved",
    schedule_enabled: status === "approved",
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

    if (previous.status === "published" && Boolean(previous.publishedAt || previous.instagramPublishedAt || previous.facebookPublishedAt)) {
      return preserveReviewedPost({ ...incoming, status: "published" }, previous, false);
    }
    if (!previouslyReviewed && incoming.manualImmediatePublish === true) {
      return clearPublishState(incoming, "pending_review", "請先按『審核通過・啟用自動發布』，確認後才可立即發布");
    }
    if (!previouslyReviewed && fromApp && incoming.status === "approved") {
      return approvePost(incoming, store);
    }
    if (previouslyReviewed) return preserveReviewedPost(incoming, previous, fromApp);
    if (fromApp && incoming.status === "rejected") return clearPublishState(incoming, "rejected", "已退回修改；修改完成後請重新審核");
    if (fromApp && incoming.status === "cancelled") return { ...clearPublishState(incoming, "cancelled", "已取消"), manualReviewRequired: false };
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
    if (isCanonical(post) && post.assetLocked !== true) throw new Error("審核憑證不完整，請退回後重新審核。");
    return originalExecute(postId);
  };

  if (typeof api.healthPayload === "function") {
    const originalHealth = api.healthPayload.bind(api);
    api.healthPayload = function reviewGateHealth() {
      return { ...originalHealth(), reviewGateMode: true, reviewRequiredBeforePublish: true, automaticSchedulingEnabled: true, automaticSchedulingRequiresReview: true, automaticRetryEnabled: false, reviewGateVersion: VERSION };
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
        proposedScheduledAt: post.proposedScheduledAt || "",
        scheduledAt: post.scheduledAt || "",
        imageUrl: post.imageUrl || "",
        conditionalWeather: post.conditionalWeather === true,
        automationStandby: post.automationStandby === true,
        reviewApprovedAt: post.reviewApprovedAt || "",
        reviewApprovedBy: post.reviewApprovedBy || "",
        reviewScheduleNote: post.reviewScheduleNote || "",
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
        overdueApprovalPolicy: "move-to-next-free-wed-20:00",
        canonicalCount: posts.length,
        pendingReviewCount: posts.filter((post) => post.status === "pending_review").length,
        draftCount: posts.filter((post) => ["draft", "pending_review", "rejected"].includes(post.status)).length,
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
  WEATHER_NOTE,
  CANONICAL_IDS,
  isCanonical,
  callFromApp,
  contentSignature,
  taipeiParts,
  validFixedSlot,
  nextAvailableFixedSlot,
  clearPublishState,
  approvePost,
  removeUnpublishedCanonicalLedgerEntries,
  initialReset,
  preserveReviewedPost,
  protectStore,
  wrapSocialApi,
  install,
};
