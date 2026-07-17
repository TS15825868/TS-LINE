"use strict";

const fs = require("fs");
const path = require("path");
const Module = require("module");
const {
  CAMPAIGN_ID,
  ASSET_STORE_KEY,
  TOPICS,
  rebuildOfficialSocialSchedule,
} = require("./social-official-rebuild");

const VERSION = "1.3.1";
const STORE_PATH = path.resolve(process.env.SOCIAL_DATA_PATH || "/tmp/xianjiawei-social-posts.json");
const nativeWriteFileSync = fs.writeFileSync.bind(fs);
const nativeRenameSync = fs.renameSync.bind(fs);
let persistencePatched = false;

const status = {
  ok: false,
  state: "checking",
  version: VERSION,
  received: 0,
  uploaded: 0,
  pendingReview: 0,
  preservedPublished: 0,
  removedUnpublished: 0,
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

function refreshStatus() {
  const store = readFullStore();
  const assets = store[ASSET_STORE_KEY];
  if (assets?.campaignId !== CAMPAIGN_ID || Number(assets.originalCount) !== TOPICS.length) {
    Object.assign(status, {
      ok: false,
      state: "assets-missing",
      received: 0,
      uploaded: 0,
      pendingReview: 0,
      preservedPublished: store.posts.filter((post) => post.status === "published").length,
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
    preservedPublished: schedule.preservedPublished,
    removedUnpublished: schedule.removedUnpublished,
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
module.exports = { VERSION, status, refreshStatus, install };
