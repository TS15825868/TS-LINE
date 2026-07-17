"use strict";

const crypto = require("crypto");
const express = require("express");
const fs = require("fs");
const path = require("path");
const Module = require("module");
const {
  CAMPAIGN_ID,
  ASSET_STORE_KEY,
  TOPICS,
  rebuildOfficialSocialSchedule,
} = require("./social-official-rebuild");
const { detectImage, uploadToSupabase } = require("./internal-social-upload");
const { validateOriginalImage } = require("./social-approved-zip-import");

const VERSION = "1.3.0";
const SOURCE_NAME = "社群排程_正式20張_可直接匯入.zip";
const IMAGE_PATH = "/internal/api/v2/social/import-approved-image-5d5826a47fee6c3d";
const PROGRESS_KEY = "approvedMascotImportProgress202607";
const STORE_PATH = path.resolve(process.env.SOCIAL_DATA_PATH || "/tmp/xianjiawei-social-posts.json");
const rawImage = express.raw({
  type: ["image/png", "application/octet-stream"],
  limit: "12mb",
});

const IMAGE_HASHES = {
  "14A289E2-99BA-457F-9A21-464C3A2C83AD.PNG": "bef36c8c97d644cbf5a63644e51bff70201a137d46c234b674cfb74e09823171",
  "1653AFD1-28A0-43A6-9CD2-E37E196977A7.PNG": "aa19249c39417f57395f9542918279bdb713a37e1e490430d80be6106385d8cd",
  "3F187045-74E9-45AC-B3DD-1F42FA35438D.PNG": "4ec6586e45147bdd15d76d19c82f347113f027ba86b60cbe37294df6452ecd79",
  "52C83E67-1BAD-4A85-94B5-E016887607F6.PNG": "438da7aba90ae5953f8991c85d3b700b808daa5da5169d0214c2332fb68aadda",
  "581D7AAC-AB40-4BA4-81EF-07DA66AC3BC7.PNG": "527834a84c87e5f257e7491aea8830c348fc475d24f011cee54bddf0aaa08e75",
  "586D7D03-5224-48B1-B6C2-2F74B6D5EB53.PNG": "77dab2a63cfacdb729d01eed242890fab6e52201d3df41e37942dc3add7534fc",
  "6A5717B1-D9BC-40A6-858C-5FDD8464AF53.PNG": "26009d959bcfe10694f686557dbd6e5a87349f2dcb4fc199095e87d0e5b237b8",
  "790D6C1D-B3A2-4D65-8C3A-F60494D63437.PNG": "37fc6257e0c95cce7539adfc4b4dba6ff7aaadb373b5201048e12b85046b278c",
  "84E5C7EC-593B-4086-B1F6-1B4EE09A01AB.PNG": "d3d1f9be87218b8b5c11c625e3b10e497a8e735e1e1d6baa379432f0047b0658",
  "89C17637-77B2-4F14-8629-2136A9A0BA2E.PNG": "1941841e8a8e408d8a70c69b2ce849764629ed6a562a1bfd685b66bb24b9c252",
  "8C1EAF67-9007-41A0-8729-D0B4631416BE.PNG": "e97c8d0f34621ce29338d7582cf54d9dec6d6f25cad4bbcc9fe571f6c59c1b17",
  "9679EC48-F3A3-43E5-8261-08CFEA97F9A1.PNG": "17e6e77424a44614e8040e50a36ef6e3d32cd3de2901d5ef708d710fd32e43e5",
  "9DF04070-FD41-4B4E-81EE-1D277DFD202F.PNG": "a977fae0a9be2032d54dafd167ba8e482eae96db9b9e40b40d75cb3e5f12fcff",
  "A307B1B9-2414-45B1-B839-4A1FC90B9B74.PNG": "43a2b0c22820942c276045226d6a8bf9d893bb16a6a661a577ed5c599a8d211d",
  "A92B951E-78B9-4153-882E-185EA91FE7ED.PNG": "cd274b43bb9e905a8dbfde1e9afa05a18bae4acbaaba1f754cf3b4f1117bbcff",
  "CA5CF41E-414B-4840-A259-7A3C06C082A1.PNG": "25c7302685f603c3f8cfcc71e1253ad10d682f664a2d9088df053241ab0e6c71",
  "CBDD60D2-C5BE-449B-95DF-469122F3DB08.PNG": "7646af58125a6296faef8034d68434364e6251a6993e7372492078bf3d676f44",
  "E3DF57ED-1A6E-4A93-A187-BFCACFCE0B74.PNG": "0814287650fe49ea7cdb7b30115cc964870b231637f9febcc3ba921efe30fd6a",
  "F6985971-E131-42EF-BCA8-4E434F8CC345.PNG": "666fb95142b871d7cb370297f0e54d69bf720ad9b5cfb5fe2b1bf954a93b2d3d",
  "FAB540D0-8BB7-4272-97A7-2BB7C82C964D.PNG": "d229e94361603dc8c43dab6a9ea56e4565c8dfee5d89a47ecac90dedd4de3ebd",
};

const status = {
  ok: false,
  state: "waiting-for-approved-images",
  version: VERSION,
  received: 0,
  uploaded: 0,
  pendingReview: 0,
  preservedPublished: 0,
  removedUnpublished: 0,
  error: "",
  updatedAt: new Date().toISOString(),
};

const nativeWriteFileSync = fs.writeFileSync.bind(fs);
const nativeRenameSync = fs.renameSync.bind(fs);
let persistencePatched = false;

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
  nativeWriteFileSync(temp, JSON.stringify({ ...store, posts: (store.posts || []).slice(-500), updatedAt: new Date().toISOString() }, null, 2), { mode: 0o600 });
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

function setStatus(change) {
  Object.assign(status, change, { updatedAt: new Date().toISOString() });
}

function sha256(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

function countProgressFiles(files = {}) {
  return TOPICS.filter((topic) => Boolean(files[topic.file])).length;
}

function finishFromExisting() {
  const store = readFullStore();
  const current = store?.[ASSET_STORE_KEY];
  if (current?.campaignId !== CAMPAIGN_ID || Number(current.originalCount) !== TOPICS.length) return null;
  const schedule = rebuildOfficialSocialSchedule(readFullStore, writeFullStore, { nowMs: Date.now() });
  setStatus({
    ok: true,
    state: "already-imported",
    received: TOPICS.length,
    uploaded: TOPICS.length,
    pendingReview: schedule.pendingReview,
    preservedPublished: schedule.preservedPublished,
    removedUnpublished: schedule.removedUnpublished,
    error: "",
  });
  return { ...status };
}

async function importImage(fileName, buffer) {
  const existing = finishFromExisting();
  if (existing) return existing;

  const topic = TOPICS.find((item) => item.file === fileName);
  const expectedHash = IMAGE_HASHES[fileName];
  if (!topic || !expectedHash) throw new Error("圖片檔名不在正式 20 張清單中");
  if (!Buffer.isBuffer(buffer) || !buffer.length) throw new Error("沒有收到圖片資料");
  if (sha256(buffer) !== expectedHash) throw new Error(`原圖雜湊不符：${fileName}`);
  const detected = await validateOriginalImage(buffer, fileName);
  if (!detectImage(buffer) || detected.mime !== "image/png") throw new Error(`不是原始 PNG：${fileName}`);

  const store = readFullStore();
  const progress = store[PROGRESS_KEY]?.campaignId === CAMPAIGN_ID
    ? store[PROGRESS_KEY]
    : { campaignId: CAMPAIGN_ID, sourceName: SOURCE_NAME, files: {}, startedAt: new Date().toISOString() };

  if (!progress.files[fileName]) {
    const uploaded = await uploadToSupabase(buffer, detected);
    progress.files[fileName] = uploaded.url;
    progress.files[topic.slug] = uploaded.url;
  }

  const count = countProgressFiles(progress.files);
  setStatus({ ok: false, state: "receiving", received: count, uploaded: count, error: "" });

  if (count < TOPICS.length) {
    store[PROGRESS_KEY] = progress;
    writeFullStore(store);
    return { ...status, file: fileName };
  }

  store[ASSET_STORE_KEY] = {
    campaignId: CAMPAIGN_ID,
    version: VERSION,
    importedAt: new Date().toISOString(),
    sourceName: SOURCE_NAME,
    originalCount: TOPICS.length,
    files: progress.files,
  };
  delete store[PROGRESS_KEY];
  writeFullStore(store);

  const schedule = rebuildOfficialSocialSchedule(readFullStore, writeFullStore, { nowMs: Date.now() });
  setStatus({
    ok: true,
    state: "complete",
    received: count,
    uploaded: count,
    pendingReview: schedule.pendingReview,
    preservedPublished: schedule.preservedPublished,
    removedUnpublished: schedule.removedUnpublished,
    error: "",
  });
  console.log("Approved social image-chunk import complete", status);
  return { ...status, file: fileName };
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
        finishFromExisting();
        if (!status.ok) {
          const progress = readFullStore()[PROGRESS_KEY];
          const count = countProgressFiles(progress?.files || {});
          if (count) setStatus({ state: "receiving", received: count, uploaded: count });
        }
        res.status(status.state === "failed" ? 503 : 200).json(status);
      });

      loaded.app.post(IMAGE_PATH, rawImage, async (req, res) => {
        const fileName = String(req.get("X-XJW-Image-Name") || "").trim();
        try {
          const expectedHash = IMAGE_HASHES[fileName];
          if (!expectedHash || String(req.get("X-XJW-Image-SHA256") || "") !== expectedHash) {
            return res.status(403).json({ ok: false, error: "正式圖片驗證標頭不正確" });
          }
          const result = await importImage(fileName, req.body);
          return res.json(result);
        } catch (error) {
          setStatus({ ok: false, state: "failed", error: error.message || "正式圖片匯入失敗" });
          console.error("Approved social image import failed", error);
          return res.status(400).json({ ok: false, ...status });
        }
      });

      setImmediate(finishFromExisting);
    }
    return loaded;
  };
}

install();
module.exports = { VERSION, IMAGE_HASHES, IMAGE_PATH, status, importImage, install };
