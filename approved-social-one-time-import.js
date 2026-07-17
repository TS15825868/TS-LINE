"use strict";

const crypto = require("crypto");
const express = require("express");
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

const VERSION = "1.2.0";
const SOURCE_NAME = "社群排程_正式20張_可直接匯入.zip";
const ZIP_SHA256 = "5d5826a47fee6c3d2af08d4d1926b2b9280b8e8d7a2d2be94c10d0984030b557";
const IMPORT_PATH = "/internal/api/v2/social/import-approved-once-5d5826a47fee6c3d";
const rawZip = express.raw({
  type: ["application/zip", "application/x-zip-compressed", "application/octet-stream"],
  limit: "100mb",
});

const status = {
  ok: false,
  state: "waiting-for-approved-zip",
  version: VERSION,
  downloaded: 0,
  uploaded: 0,
  pendingReview: 0,
  preservedPublished: 0,
  removedUnpublished: 0,
  error: "",
  updatedAt: new Date().toISOString(),
};

let runningPromise = null;

function setStatus(change) {
  Object.assign(status, change, { updatedAt: new Date().toISOString() });
}

function sha256(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

function finishFromExisting(readSocialStore, writeSocialStore) {
  const existing = readSocialStore();
  const current = existing?.[ASSET_STORE_KEY];
  if (current?.campaignId !== CAMPAIGN_ID || Number(current.originalCount) !== TOPICS.length) return null;
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
  return { ...status };
}

async function importBuffer(zipBuffer, readSocialStore, writeSocialStore) {
  const existingResult = finishFromExisting(readSocialStore, writeSocialStore);
  if (existingResult) return existingResult;

  if (!Buffer.isBuffer(zipBuffer) || !zipBuffer.length) throw new Error("沒有收到正式 ZIP");
  if (sha256(zipBuffer) !== ZIP_SHA256) throw new Error("ZIP 雜湊不符，已拒絕匯入");

  setStatus({ ok: false, state: "validating", downloaded: 0, uploaded: 0, error: "" });
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
  return { ...status };
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
        finishFromExisting(loaded.readStore, loaded.writeStore);
        res.status(status.state === "failed" ? 503 : 200).json(status);
      });

      loaded.app.post(IMPORT_PATH, rawZip, async (req, res) => {
        try {
          if (String(req.get("X-XJW-Approved-Zip-SHA256") || "") !== ZIP_SHA256) {
            return res.status(403).json({ ok: false, error: "正式 ZIP 驗證標頭不正確" });
          }
          if (!runningPromise) {
            runningPromise = importBuffer(req.body, loaded.readStore, loaded.writeStore)
              .finally(() => { runningPromise = null; });
          }
          const result = await runningPromise;
          return res.json(result);
        } catch (error) {
          setStatus({ ok: false, state: "failed", error: error.message || "正式 ZIP 匯入失敗" });
          console.error("Approved social one-time import failed", error);
          return res.status(400).json({ ok: false, ...status });
        }
      });

      setImmediate(() => finishFromExisting(loaded.readStore, loaded.writeStore));
    }
    return loaded;
  };
}

install();
module.exports = { VERSION, ZIP_SHA256, IMPORT_PATH, status, importBuffer, install };
