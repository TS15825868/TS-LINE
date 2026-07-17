"use strict";

const crypto = require("crypto");
const Module = require("module");
const {
  CAMPAIGN_ID,
  ASSET_STORE_KEY,
  TOPICS,
  rebuildOfficialSocialSchedule,
} = require("./social-official-rebuild");
const { detectImage, uploadToSupabase } = require("./internal-social-upload");
const {
  readZipDirectory,
  extractZipEntry,
  selectApprovedEntries,
  validateOriginalImage,
} = require("./social-approved-zip-import");

const VERSION = "1.1.2";
const SOURCE_NAME = "社群排程_正式20張_可直接匯入.zip";
const ZIP_SHA256 = "5d5826a47fee6c3d2af08d4d1926b2b9280b8e8d7a2d2be94c10d0984030b557";
const ZIP_SOURCE = "https://oaisdmntprseasia.blob.core.windows.net/files/00000000-ceb0-7207-9ce9-0571d4276b8b/raw?se=2026-07-17T12%3A27%3A05Z&sp=r&sv=2026-02-06&sr=b&scid=019f6ff1-c7d3-74d3-b90d-99a4504b8d6e&skoid=6980ab1e-b994-4668-84de-ad0444c9d08b&sktid=a48cca56-e6da-484e-a814-9c849652bcb3&skt=2026-07-17T00%3A30%3A02Z&ske=2026-07-19T00%3A30%3A02Z&sks=b&skv=2026-02-06&sig=QoyMxGQfCbPnVVIoKaMKAH1zB5PJ/Vlv7abqxNSIyzk%3D";

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

async function downloadApprovedZip() {
  const response = await fetch(ZIP_SOURCE, { redirect: "follow" });
  if (!response.ok) throw new Error(`正式 ZIP 下載失敗（${response.status}）`);
  const buffer = Buffer.from(await response.arrayBuffer());
  if (sha256(buffer) !== ZIP_SHA256) throw new Error("正式 ZIP 雜湊驗證失敗");
  return buffer;
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

  setStatus({ state: "downloading", error: "" });
  const zipBuffer = await downloadApprovedZip();
  const entries = readZipDirectory(zipBuffer);
  const selected = selectApprovedEntries(entries);
  const extracted = [];

  for (const topic of TOPICS) {
    const entry = selected.get(topic.file.toUpperCase());
    const image = extractZipEntry(zipBuffer, entry);
    const detected = await validateOriginalImage(image, topic.file);
    if (!detectImage(image) || detected.mime !== "image/png") {
      throw new Error(`圖片格式驗證失敗：${topic.file}`);
    }
    extracted.push({ topic, image, detected });
  }

  setStatus({ state: "uploading", downloaded: extracted.length });
  const files = {};
  let uploadedCount = 0;

  for (const item of extracted) {
    const uploaded = await uploadToSupabase(item.image, item.detected);
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
    downloaded: extracted.length,
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
