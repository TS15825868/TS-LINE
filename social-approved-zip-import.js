"use strict";

const crypto = require("crypto");
const express = require("express");
const path = require("path");
const zlib = require("zlib");
const sharp = require("sharp");
const { detectImage, uploadToSupabase } = require("./internal-social-upload");
const {
  CAMPAIGN_ID,
  ASSET_STORE_KEY,
  TOPICS,
  rebuildOfficialSocialSchedule,
} = require("./social-official-rebuild");

const VERSION = "1.0.1";
const COOKIE = "xjw_internal";
const MAX_ZIP_BYTES = 100 * 1024 * 1024;
const MAX_ENTRY_BYTES = 15 * 1024 * 1024;
const MAX_TOTAL_BYTES = 100 * 1024 * 1024;
const rawZip = express.raw({
  type: ["application/zip", "application/x-zip-compressed", "application/octet-stream"],
  limit: MAX_ZIP_BYTES,
});
const mountedApps = new WeakSet();

const clean = (value, max = 500) => String(value ?? "")
  .replace(/[\u0000-\u001f\u007f]/g, "")
  .trim()
  .slice(0, max);

function secret() {
  return clean(process.env.INTERNAL_APP_SECRET || process.env.INTERNAL_APP_PASSWORD || process.env.SOCIAL_ADMIN_PIN, 500);
}

function readCookies(req) {
  return Object.fromEntries(
    String(req.headers.cookie || "")
      .split(";")
      .map((part) => part.trim().split("="))
      .filter((item) => item.length === 2)
  );
}

function currentSession(req) {
  try {
    const value = readCookies(req)[COOKIE] || "";
    const [payload, signature] = value.split(".");
    if (!payload || !signature || !secret()) return null;
    const expected = crypto.createHmac("sha256", secret()).update(payload).digest("base64url");
    if (signature.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (!parsed.user || parsed.exp < Date.now()) return null;
    return parsed;
  } catch {
    return null;
  }
}

function requireApi(req, res, next) {
  const user = currentSession(req);
  if (!user) return res.status(401).json({ ok: false, error: "請重新登入" });
  req.internalUser = user;
  return next();
}

function requestGuard(req, res, next) {
  if (req.get("X-XJW-Requested-With") !== "internal-app-v2") {
    return res.status(403).json({ ok: false, error: "請從管理 App 操作" });
  }
  const origin = clean(req.get("Origin"), 500);
  if (origin) {
    try {
      if (new URL(origin).host !== req.get("host")) {
        return res.status(403).json({ ok: false, error: "來源驗證失敗" });
      }
    } catch {
      return res.status(403).json({ ok: false, error: "來源驗證失敗" });
    }
  }
  return next();
}

function findEndOfCentralDirectory(buffer) {
  const signature = 0x06054b50;
  const minimum = Math.max(0, buffer.length - 0xffff - 22);
  for (let offset = buffer.length - 22; offset >= minimum; offset -= 1) {
    if (buffer.readUInt32LE(offset) === signature) return offset;
  }
  throw new Error("ZIP 格式不完整，找不到中央目錄");
}

function readZipDirectory(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 22 || buffer.readUInt32LE(0) !== 0x04034b50) {
    throw new Error("請選擇原本的社群排程 ZIP 檔");
  }
  const eocd = findEndOfCentralDirectory(buffer);
  const entryCount = buffer.readUInt16LE(eocd + 10);
  const centralSize = buffer.readUInt32LE(eocd + 12);
  const centralOffset = buffer.readUInt32LE(eocd + 16);
  if (!entryCount || entryCount > 200) throw new Error("ZIP 內檔案數量不正確");
  if (centralOffset + centralSize > buffer.length) throw new Error("ZIP 中央目錄超出檔案範圍");

  const entries = [];
  let cursor = centralOffset;
  let totalUncompressed = 0;
  for (let index = 0; index < entryCount; index += 1) {
    if (buffer.readUInt32LE(cursor) !== 0x02014b50) throw new Error("ZIP 中央目錄損壞");
    const flags = buffer.readUInt16LE(cursor + 8);
    const method = buffer.readUInt16LE(cursor + 10);
    const compressedSize = buffer.readUInt32LE(cursor + 20);
    const uncompressedSize = buffer.readUInt32LE(cursor + 24);
    const nameLength = buffer.readUInt16LE(cursor + 28);
    const extraLength = buffer.readUInt16LE(cursor + 30);
    const commentLength = buffer.readUInt16LE(cursor + 32);
    const localOffset = buffer.readUInt32LE(cursor + 42);
    const nameStart = cursor + 46;
    const nameEnd = nameStart + nameLength;
    if (nameEnd > buffer.length) throw new Error("ZIP 檔名資料損壞");
    const name = buffer.toString("utf8", nameStart, nameEnd);
    cursor = nameEnd + extraLength + commentLength;

    if (flags & 0x1) throw new Error("ZIP 不能設定密碼");
    if (![0, 8].includes(method)) throw new Error(`ZIP 使用不支援的壓縮方式：${method}`);
    if (uncompressedSize > MAX_ENTRY_BYTES) throw new Error(`圖片過大：${path.basename(name)}`);
    totalUncompressed += uncompressedSize;
    if (totalUncompressed > MAX_TOTAL_BYTES) throw new Error("ZIP 解壓後總容量超過 100 MB");

    entries.push({ name, method, compressedSize, uncompressedSize, localOffset });
  }
  return entries;
}

function extractZipEntry(buffer, entry) {
  const offset = entry.localOffset;
  if (offset + 30 > buffer.length || buffer.readUInt32LE(offset) !== 0x04034b50) {
    throw new Error(`ZIP 圖片資料損壞：${path.basename(entry.name)}`);
  }
  const nameLength = buffer.readUInt16LE(offset + 26);
  const extraLength = buffer.readUInt16LE(offset + 28);
  const start = offset + 30 + nameLength + extraLength;
  const end = start + entry.compressedSize;
  if (end > buffer.length) throw new Error(`ZIP 圖片內容不完整：${path.basename(entry.name)}`);
  const compressed = buffer.subarray(start, end);
  const data = entry.method === 0 ? Buffer.from(compressed) : zlib.inflateRawSync(compressed);
  if (data.length !== entry.uncompressedSize) throw new Error(`ZIP 圖片大小驗證失敗：${path.basename(entry.name)}`);
  return data;
}

function selectApprovedEntries(entries) {
  const expected = new Map(TOPICS.map((topic) => [topic.file.toUpperCase(), topic]));
  const selected = new Map();
  const unexpectedImages = [];

  for (const entry of entries) {
    const normalized = String(entry.name || "").replace(/\\/g, "/");
    const base = path.posix.basename(normalized);
    if (!base || normalized.endsWith("/") || normalized.includes("/__MACOSX/") || base.startsWith("._")) continue;
    const upper = base.toUpperCase();
    if (expected.has(upper)) {
      if (selected.has(upper)) throw new Error(`ZIP 內圖片重複：${base}`);
      selected.set(upper, entry);
    } else if (/\.(png|jpe?g|webp)$/i.test(base)) {
      unexpectedImages.push(base);
    }
  }

  const missing = [...expected.keys()].filter((name) => !selected.has(name));
  if (missing.length) throw new Error(`ZIP 缺少 ${missing.length} 張正式圖片：${missing.slice(0, 3).join("、")}`);
  if (unexpectedImages.length) throw new Error(`ZIP 含有非正式圖片：${unexpectedImages.slice(0, 3).join("、")}`);
  return selected;
}

async function validateOriginalImage(buffer, fileName) {
  const detected = detectImage(buffer);
  if (!detected || detected.mime !== "image/png") throw new Error(`${fileName} 必須是原始 PNG 圖片`);
  const metadata = await sharp(buffer, { limitInputPixels: 30 * 1024 * 1024 }).metadata();
  if (metadata.width !== 1254 || metadata.height !== 1254) {
    throw new Error(`${fileName} 尺寸不是正式版 1254×1254`);
  }
  return detected;
}

function browserScript() {
  return `(()=>{"use strict";const ID="approvedSocialZipImportCard";function mount(){if(document.getElementById(ID))return;const form=document.getElementById("socialForm");if(!form)return;const card=document.createElement("section");card.id=ID;card.style.cssText="border:2px solid #314d22;border-radius:18px;padding:16px;margin:0 0 18px;background:#fffaf0";card.innerHTML='<h3 style="margin:0 0 8px;color:#0b1f3b">匯入正式社群圖文</h3><p style="margin:0 0 12px;line-height:1.6">使用你已核准的「社群排程.zip」原圖。系統不重畫、不裁切、不重新排版；保留已發布紀錄，並取代所有未發布貼文。</p><input id="approvedSocialZipFile" type="file" accept=".zip,application/zip" style="display:block;width:100%;margin-bottom:12px"><button id="approvedSocialZipButton" type="button" class="btn gold">匯入 ZIP 並建立 20 篇待審貼文</button><div id="approvedSocialZipStatus" class="muted" style="margin-top:10px">請選擇原本的社群排程 ZIP 檔</div>';form.parentNode.insertBefore(card,form);const input=card.querySelector("#approvedSocialZipFile"),button=card.querySelector("#approvedSocialZipButton"),status=card.querySelector("#approvedSocialZipStatus");button.addEventListener("click",async()=>{const file=input.files&&input.files[0];if(!file)return alert("請先選擇社群排程.zip");if(file.size>100*1024*1024)return alert("ZIP 超過 100 MB");button.disabled=true;button.textContent="正在驗證並上傳 20 張原圖…";status.textContent="上傳期間請不要關閉頁面；系統不會改動圖片內容。";try{const response=await fetch("/internal/api/v2/social/import-approved-zip",{method:"POST",headers:{"Content-Type":"application/zip","X-XJW-Requested-With":"internal-app-v2","X-XJW-Zip-Name":encodeURIComponent(file.name)},body:file});const data=await response.json().catch(()=>({ok:false,error:"系統回覆格式錯誤"}));if(response.status===401){location.href="/internal/login";return}if(!response.ok||!data.ok)throw new Error(data.error||"匯入失敗");status.style.color="#245f3c";status.textContent="✓ 已原檔匯入 "+data.uploaded+" 張圖片，建立 "+data.pendingReview+" 篇待審貼文";alert("正式原圖與文案已匯入，舊的未發布貼文已移除。");location.reload()}catch(error){status.style.color="#9b2727";status.textContent=error.message||"匯入失敗";alert(error.message||"匯入失敗")}finally{button.disabled=false;button.textContent="重新匯入正式 ZIP"}})}mount();new MutationObserver(mount).observe(document.documentElement,{childList:true,subtree:true})})();`;
}

function injectImporter(html) {
  if (typeof html !== "string" || html.includes("/internal/approved-social-import.js")) return html;
  return html.replace("</body>", `<script src="/internal/approved-social-import.js?v=${VERSION}"></script></body>`);
}

function mountApprovedSocialZipImport(app, { readSocialStore, writeSocialStore }) {
  if (!app || mountedApps.has(app)) return;
  mountedApps.add(app);

  app.get("/internal/approved-social-import.js", (_req, res) => {
    res.set({
      "Cache-Control": "no-store, max-age=0",
      "Content-Type": "application/javascript; charset=utf-8",
    }).send(browserScript());
  });

  app.use("/internal/app", (_req, res, next) => {
    const originalSend = res.send.bind(res);
    res.send = (body) => originalSend(injectImporter(body));
    next();
  });

  app.post("/internal/api/v2/social/import-approved-zip", requireApi, requestGuard, rawZip, async (req, res) => {
    try {
      const zipBuffer = req.body;
      if (!Buffer.isBuffer(zipBuffer) || !zipBuffer.length) {
        return res.status(400).json({ ok: false, error: "沒有收到 ZIP 檔案" });
      }
      const entries = readZipDirectory(zipBuffer);
      const selected = selectApprovedEntries(entries);
      const files = {};
      const imported = [];

      for (const topic of TOPICS) {
        const entry = selected.get(topic.file.toUpperCase());
        const image = extractZipEntry(zipBuffer, entry);
        const detected = await validateOriginalImage(image, topic.file);
        const uploaded = await uploadToSupabase(image, detected);
        files[topic.file] = uploaded.url;
        files[topic.slug] = uploaded.url;
        imported.push({ number: topic.number, title: topic.title, file: topic.file, url: uploaded.url, size: image.length });
      }

      const store = readSocialStore();
      store[ASSET_STORE_KEY] = {
        campaignId: CAMPAIGN_ID,
        version: VERSION,
        importedAt: new Date().toISOString(),
        sourceName: decodeURIComponent(clean(req.get("X-XJW-Zip-Name") || "社群排程.zip", 200)),
        originalCount: imported.length,
        files,
      };
      writeSocialStore(store);
      const schedule = rebuildOfficialSocialSchedule(readSocialStore, writeSocialStore, { nowMs: Date.now() });
      return res.json({
        ok: true,
        version: VERSION,
        uploaded: imported.length,
        pendingReview: schedule.pendingReview,
        preservedPublished: schedule.preservedPublished,
        removedUnpublished: schedule.removedUnpublished,
        firstAt: schedule.firstAt,
        lastAt: schedule.lastAt,
        imported,
      });
    } catch (error) {
      console.error("approved social ZIP import failed", error.message);
      return res.status(400).json({ ok: false, error: error.message || "正式社群 ZIP 匯入失敗" });
    }
  });
}

module.exports = {
  VERSION,
  MAX_ZIP_BYTES,
  readZipDirectory,
  extractZipEntry,
  selectApprovedEntries,
  validateOriginalImage,
  injectImporter,
  mountApprovedSocialZipImport,
};