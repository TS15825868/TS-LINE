"use strict";

const crypto = require("crypto");
const Module = require("module");
const sharp = require("sharp");
const {
  CAMPAIGN_ID,
  ASSET_STORE_KEY,
  TOPICS,
  rebuildOfficialSocialSchedule,
} = require("./social-official-rebuild");
const { detectImage, uploadToSupabase } = require("./internal-social-upload");

const VERSION = "1.0.0";
const SOURCE_NAME = "社群排程_正式20張_可直接匯入.zip";
const SOURCES = {};

const status = {
  ok: false,
  state: "waiting",
  version: VERSION,
  downloaded: 0,
  uploaded: 0,
  pendingReview: 0,
  preservedPublished: 0,
  removedUnpublished: 0,
  error: "",
  updatedAt: new Date().toISOString(),
};

function setStatus(change) {
  Object.assign(status, change, { updatedAt: new Date().toISOString() });
}

function sha256(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

async function downloadAndValidate(topic) {
  const source = SOURCES[topic.file];
  if (!source?.url || !source?.sha256) throw new Error(`缺少正式圖片來源：${topic.file}`);
  const response = await fetch(source.url, { redirect: "follow" });
  if (!response.ok) throw new Error(`下載失敗 ${response.status}：${topic.file}`);
  const buffer = Buffer.from(await response.arrayBuffer());
  if (sha256(buffer) !== source.sha256) throw new Error(`原圖雜湊不符：${topic.file}`);
  const detected = detectImage(buffer);
  if (!detected || detected.mime !== "image/png") throw new Error(`不是原始 PNG：${topic.file}`);
  const metadata = await sharp(buffer, { limitInputPixels: 30 * 1024 * 1024 }).metadata();
  if (metadata.width !== 1254 || metadata.height !== 1254) {
    throw new Error(`尺寸不是 1254×1254：${topic.file}`);
  }
  return { topic, buffer, detected };
}

async function importOnce(readSocialStore, writeSocialStore) {
  const existing = readSocialStore();
  const current = existing?.[ASSET_STORE_KEY];
  if (current?.campaignId === CAMPAIGN_ID && Number(current.originalCount) === TOPICS.length) {
    const schedule = rebuildOfficialSocialSchedule(readSocialStore, writeSocialStore, { nowMs: Date.now() });
    setStatus({
      ok: true,
      state: "already-imported",
      downloaded: TOPICS.length,
      uploaded: TOPICS.length,
      pendingReview: schedule.pendingReview,
      preservedPublished: schedule.preservedPublished,
      removedUnpublished: schedule.removedUnpublished,
      error: "",
    });
    return;
  }

  if (Object.keys(SOURCES).length !== TOPICS.length) {
    setStatus({ state: "not-configured", error: "one-time sources are not installed" });
    return;
  }

  setStatus({ state: "downloading", error: "" });
  const downloaded = await Promise.all(TOPICS.map(downloadAndValidate));
  setStatus({ state: "uploading", downloaded: downloaded.length });

  const files = {};
  let uploadedCount = 0;
  for (const item of downloaded) {
    const uploaded = await uploadToSupabase(item.buffer, item.detected);
    files[item.topic.file] = uploaded.url;
    files[item.topic.slug] = uploaded.url;
    uploadedCount += 1;
    setStatus({ uploaded: uploadedCount });
  }

  const store = readSocialStore();
  store[ASSET_STORE_KEY] = {
    campaignId: CAMPAIGN_ID,
    version: VERSION,
    importedAt: new Date().toISOString(),
    sourceName: SOURCE_NAME,
    originalCount: TOPICS.length,
    files,
  };
  writeSocialStore(store);

  const schedule = rebuildOfficialSocialSchedule(readSocialStore, writeSocialStore, { nowMs: Date.now() });
  setStatus({
    ok: true,
    state: "complete",
    downloaded: downloaded.length,
    uploaded: uploadedCount,
    pendingReview: schedule.pendingReview,
    preservedPublished: schedule.preservedPublished,
    removedUnpublished: schedule.removedUnpublished,
    error: "",
  });
  console.log("Approved social one-time import complete", status);
}

let installed = false;
function install() {
  if (installed) return;
  installed = true;
  const originalLoad = Module._load;
  Module._load = function patchedLoad(request, parent, isMain) {
    const loaded = originalLoad.apply(this, arguments);
    if (request === "./social-server" && parent?.filename?.endsWith("internal-entry.js") && loaded?.app) {
      loaded.app.get("/internal/approved-social-one-time-healthz", (_req, res) => {
        res.status(status.state === "failed" ? 503 : 200).json(status);
      });
      setImmediate(() => {
        importOnce(loaded.readStore, loaded.writeStore).catch((error) => {
          setStatus({ ok: false, state: "failed", error: error.message || "one-time import failed" });
          console.error("Approved social one-time import failed", error);
        });
      });
    }
    return loaded;
  };
}

install();

module.exports = { VERSION, status, importOnce, install };
