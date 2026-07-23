"use strict";

const fs = require("fs");
const path = require("path");
const Module = require("module");
const officialSocial = require("./social-official-rebuild");

const {
  CAMPAIGN_ID,
  ASSET_STORE_KEY,
  TOPICS,
} = officialSocial;

const VERSION = "1.5.0";
const STORE_PATH = path.resolve(process.env.SOCIAL_DATA_PATH || "/tmp/xianjiawei-social-posts.json");
const DEFAULT_SUPABASE_URL = "https://iphexhvjhsmelbgwzhhr.supabase.co";
const nativeWriteFileSync = fs.writeFileSync.bind(fs);
const nativeRenameSync = fs.renameSync.bind(fs);
const baseRebuildOfficialSocialSchedule = officialSocial.rebuildOfficialSocialSchedule;
let persistencePatched = false;

function configureOfficialImageHosts() {
  const hosts = new Set(
    String(
      process.env.SOCIAL_APPROVED_IMAGE_HOSTS ||
        "raw.githubusercontent.com,ts15825868.github.io"
    )
      .split(",")
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean)
  );

  try {
    const supabaseHost = new URL(
      String(process.env.SUPABASE_URL || DEFAULT_SUPABASE_URL)
    ).hostname.toLowerCase();
    if (supabaseHost) hosts.add(supabaseHost);
  } catch (error) {
    console.error("approved social image host setup failed", error.message);
  }

  process.env.SOCIAL_APPROVED_IMAGE_HOSTS = [...hosts].join(",");
}

configureOfficialImageHosts();

const status = {
  ok: false,
  state: "checking",
  version: VERSION,
  received: 0,
  uploaded: 0,
  pendingReview: 0,
  allPendingReview: 0,
  activeTotal: 0,
  allActiveTotal: 0,
  preservedPublished: 0,
  preservedExistingUnpublished: 0,
  removedUnpublished: 0,
  firstAt: "",
  lastAt: "",
  weeklyPosts: 2,
  scheduleDays: "週三、週五",
  scheduleTime: "20:00",
  uploadReceiverClosed: true,
  error: "",
  updatedAt: new Date().toISOString(),
};

function readFullStore() {
  try {
    if (!fs.existsSync(STORE_PATH)) return { posts: [] };
    const data = JSON.parse(fs.readFileSync(STORE_PATH, "utf8"));
    return { ...data, posts: Array.isArray(data.posts) ? data.posts : [] };
  } catch (error) {
    console.error("approved social full store read failed", error.message);
    return { posts: [] };
  }
}

function writeFullStore(store) {
  fs.mkdirSync(path.dirname(STORE_PATH), { recursive: true });
  const temp = `${STORE_PATH}.${process.pid}.approved.tmp`;
  nativeWriteFileSync(
    temp,
    JSON.stringify({ ...store, posts: (store.posts || []).slice(-500), updatedAt: new Date().toISOString() }, null, 2),
    { mode: 0o600 }
  );
  nativeRenameSync(temp, STORE_PATH);
}

function preserveExtendedStoreKeys() {
  if (persistencePatched) return;
  persistencePatched = true;
  fs.renameSync = function preserveSocialExtras(source, destination) {
    try {
      if (path.resolve(String(destination)) === STORE_PATH && fs.existsSync(source)) {
        const current = readFullStore();
        const next = JSON.parse(fs.readFileSync(source, "utf8"));
        for (const [key, value] of Object.entries(current)) {
          if (!["posts", "updatedAt"].includes(key) && next[key] === undefined) next[key] = value;
        }
        nativeWriteFileSync(source, JSON.stringify(next, null, 2), { mode: 0o600 });
      }
    } catch (error) {
      console.error("approved social store preservation failed", error.message);
    }
    return nativeRenameSync(source, destination);
  };
}

function replaceLineId(text) {
  return String(text || "")
    .replace(
      /有產品、保存或使用方式的問題，可私訊或加入官方 LINE：@762jybnm。/g,
      "有產品、保存或使用方式的問題，歡迎私訊，或從個人檔案連結加入官方 LINE。"
    )
    .replace(/@762jybnm/g, "官方 LINE");
}

function clearObsoleteImageError(value) {
  const text = String(value || "");
  if (
    text.includes("圖片不是仙加味 TS-LINE／xianjiawei 正式素材") ||
    text === "素材尚未鎖定"
  ) {
    return "";
  }
  return text;
}

function normalizeOfficialPost(post) {
  if (!post || post.campaignId !== CAMPAIGN_ID) return post;
  return {
    ...post,
    instagramCaption: replaceLineId(post.instagramCaption),
    facebookCaption: replaceLineId(post.facebookCaption),
    lastError: clearObsoleteImageError(post.lastError),
  };
}

function uniquePosts(posts) {
  const seen = new Set();
  const result = [];
  for (const post of posts) {
    const key = String(post?.id || "");
    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push(post);
  }
  return result;
}

function scheduleSummary(posts) {
  const active = posts
    .filter((post) => !["published", "cancelled"].includes(post.status))
    .filter((post) => !Number.isNaN(new Date(post.scheduledAt).getTime()))
    .sort((a, b) => new Date(a.scheduledAt) - new Date(b.scheduledAt));
  const campaignActive = active.filter((post) => post.campaignId === CAMPAIGN_ID);
  return {
    pendingReview: campaignActive.filter((post) => ["draft", "rejected"].includes(post.status)).length,
    allPendingReview: active.filter((post) => ["draft", "rejected"].includes(post.status)).length,
    activeTotal: campaignActive.length,
    allActiveTotal: active.length,
    firstAt: campaignActive[0]?.scheduledAt || "",
    lastAt: campaignActive.at(-1)?.scheduledAt || "",
    allFirstAt: active[0]?.scheduledAt || "",
    allLastAt: active.at(-1)?.scheduledAt || "",
  };
}

function rebuildOfficialSocialSchedule(readStore, writeStore, options = {}) {
  const before = readStore();
  const beforePosts = Array.isArray(before.posts) ? before.posts : [];
  const removedUnpublished = beforePosts.filter(
    (post) => !["published", "cancelled"].includes(post.status)
  ).length;
  let finalStore = null;

  const safeWrite = (nextStore) => {
    const generated = Array.isArray(nextStore.posts) ? nextStore.posts : [];
    const merged = uniquePosts(generated.map(normalizeOfficialPost)).slice(-500);
    finalStore = { ...nextStore, posts: merged };
    writeStore(finalStore);
  };

  const result = baseRebuildOfficialSocialSchedule(readStore, safeWrite, options);
  const after = finalStore || readStore();
  const posts = Array.isArray(after.posts) ? after.posts : [];
  const summary = scheduleSummary(posts);

  return {
    ...result,
    ...summary,
    preservedExistingUnpublished: 0,
    removedUnpublished,
  };
}

officialSocial.rebuildOfficialSocialSchedule = rebuildOfficialSocialSchedule;

function refreshStatus() {
  const store = readFullStore();
  const assets = store[ASSET_STORE_KEY];
  if (assets?.campaignId !== CAMPAIGN_ID || Number(assets.originalCount) !== TOPICS.length) {
    const summary = scheduleSummary(store.posts);
    Object.assign(status, {
      ok: false,
      state: "assets-missing",
      received: 0,
      uploaded: 0,
      ...summary,
      preservedPublished: store.posts.filter((post) => post.status === "published").length,
      preservedExistingUnpublished: store.posts.filter(
        (post) => post.campaignId !== CAMPAIGN_ID && !["published", "cancelled"].includes(post.status)
      ).length,
      removedUnpublished: 0,
      error: "正式 20 張資產尚未恢復",
      updatedAt: new Date().toISOString(),
    });
    return { ...status };
  }

  const schedule = rebuildOfficialSocialSchedule(readFullStore, writeFullStore, { nowMs: Date.now() });
  Object.assign(status, {
    ok: true,
    state: "already-imported",
    received: TOPICS.length,
    uploaded: TOPICS.length,
    pendingReview: schedule.pendingReview,
    allPendingReview: schedule.allPendingReview,
    activeTotal: schedule.activeTotal,
    allActiveTotal: schedule.allActiveTotal,
    preservedPublished: schedule.preservedPublished,
    preservedExistingUnpublished: schedule.preservedExistingUnpublished,
    removedUnpublished: schedule.removedUnpublished,
    firstAt: schedule.firstAt,
    lastAt: schedule.lastAt,
    allFirstAt: schedule.allFirstAt,
    allLastAt: schedule.allLastAt,
    uploadReceiverClosed: true,
    error: "",
    updatedAt: new Date().toISOString(),
  });
  return { ...status };
}

let installed = false;
function install() {
  if (installed) return;
  installed = true;
  preserveExtendedStoreKeys();
  const originalLoad = Module._load;

  Module._load = function patchedLoad(request, parent, isMain) {
    const loaded = originalLoad.apply(this, arguments);
    if (request === "./social-server" && parent?.filename?.endsWith("internal-entry.js") && loaded?.app) {
      loaded.readStore = readFullStore;
      loaded.writeStore = writeFullStore;
      loaded.app.get("/internal/approved-social-one-time-healthz", (_req, res) => {
        const result = refreshStatus();
        res.status(result.ok ? 200 : 503).json(result);
      });
      setImmediate(refreshStatus);
    }
    return loaded;
  };
}

install();
module.exports = {
  VERSION,
  status,
  configureOfficialImageHosts,
  replaceLineId,
  normalizeOfficialPost,
  scheduleSummary,
  rebuildOfficialSocialSchedule,
  refreshStatus,
  install,
};
