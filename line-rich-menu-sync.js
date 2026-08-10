"use strict";

/**
 * 仙加味 LINE Rich Menu｜2026-08-10 v12 font-independent vector refresh
 * - 六格正式版維持單一 SVG 設計稿，不使用產品拼貼、黑塊或舊 JPG 底圖。
 * - 所有顧客可見繁中文字已轉成 SVG path，Render / Sharp 不需要主機中文字型。
 * - 靜態母稿以 gzip + base64 儲存，執行時只解碼為 SVG，再轉 JPEG 上傳 LINE。
 * - 點擊熱區只覆蓋六個實際功能面板；品牌 Header 不成為熱區。
 * - refresh 名稱會建立新選單並設為預設，舊仙加味正式選單會安全清理。
 */
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");
const sharp = require("sharp");

const VERSION = "20260810-rich-menu-vector-outline-v12";
const MENU_NAME = `仙加味正式選單｜繁中向量字｜${VERSION}-refresh`;
const STATIC_ARTWORK = "assets/rich-menu/xianjiawei-rich-menu-v12.svg.gz.b64";
const API = "https://api.line.me";
const DATA_API = "https://api-data.line.me";
const SINGLE_IMAGE_ONLY = true;
const RUNTIME_COMPOSITE_FORBIDDEN = true;
const LEGACY_JPG_TEMPLATE_FORBIDDEN = true;
const RICH_MENU_RETRY_DELAYS_MS = Object.freeze([3000, 15000, 60000]);
let syncPromise = null;
let scheduled = false;

async function request(url, options = {}) {
  const response = await fetch(url, options);
  const text = await response.text();
  let body = {};
  try { body = text ? JSON.parse(text) : {}; } catch { body = { raw: text }; }
  if (!response.ok) {
    const error = new Error(`LINE Rich Menu API ${response.status}: ${body.message || body.raw || response.statusText}`);
    error.status = response.status;
    error.body = body;
    throw error;
  }
  return body;
}

function artworkPath() {
  return path.join(__dirname, STATIC_ARTWORK);
}

function readArtwork() {
  const file = artworkPath();
  if (!fs.existsSync(file)) throw new Error(`Rich Menu 正式母稿不存在：${STATIC_ARTWORK}`);
  const encoded = fs.readFileSync(file, "utf8").replace(/\s+/g, "");
  if (!encoded) throw new Error("Rich Menu 正式母稿為空");
  let svg = "";
  try {
    svg = zlib.gunzipSync(Buffer.from(encoded, "base64")).toString("utf8");
  } catch (error) {
    throw new Error(`Rich Menu 正式母稿解碼失敗：${error.message || error}`);
  }
  const required = ["width=\"2500\"", "height=\"1686\"", "看產品", "購物車", "幫我推薦", "搭配組合", "怎麼使用", "直接下單", "xjw-text-outlined-v12"];
  for (const token of required) if (!svg.includes(token)) throw new Error(`Rich Menu 正式母稿缺少：${token}`);
  if (/<text\b/i.test(svg)) throw new Error("Rich Menu v12 顧客可見文字必須全部轉成向量 path，不得依賴主機中文字型");
  if (/<image\b/i.test(svg)) throw new Error("Rich Menu 正式母稿不得內嵌照片或舊底圖；必須是單一原生設計稿");
  if (/sharp\.composite|products-v2|BOSS_SOURCES|CELL_LAYOUTS/i.test(svg)) throw new Error("Rich Menu 正式母稿含禁止的拼貼／舊素材標記");
  return svg;
}

async function buildRichMenuImage() {
  const svg = readArtwork();
  const source = Buffer.from(svg);
  const metadata = await sharp(source).metadata();
  if (metadata.width !== 2500 || metadata.height !== 1686) throw new Error(`Rich Menu 母稿尺寸必須是2500×1686，目前為${metadata.width || 0}×${metadata.height || 0}`);
  return sharp(source).jpeg({ quality: 94, mozjpeg: true, chromaSubsampling: "4:4:4" }).toBuffer();
}

function menuDefinition() {
  const columns = [
    { x: 24, width: 785 },
    { x: 857, width: 786 },
    { x: 1691, width: 785 },
  ];
  const rows = [
    { y: 176, height: 635 },
    { y: 875, height: 775 },
  ];
  const actions = [
    ["看產品", "看產品"],
    ["購物車", "查看購買清單"],
    ["幫我推薦", "幫我推薦"],
    ["搭配組合", "搭配組合"],
    ["怎麼使用", "怎麼使用"],
    ["直接下單", "直接下單"],
  ];
  const areas = [];
  let i = 0;
  for (const row of rows) {
    for (const column of columns) {
      areas.push({
        bounds: { x: column.x, y: row.y, width: column.width, height: row.height },
        action: { type: "message", label: actions[i][0], text: actions[i][1] },
      });
      i += 1;
    }
  }
  return { size: { width: 2500, height: 1686 }, selected: true, name: MENU_NAME, chatBarText: "仙加味選單", areas };
}

async function setDefault(token, richMenuId) {
  await request(`${API}/v2/bot/user/all/richmenu/${encodeURIComponent(richMenuId)}`, { method: "POST", headers: { Authorization: `Bearer ${token}` } });
}

async function removeRetiredMenus(token, menus, keepId) {
  const retired = (menus || []).filter((menu) => menu.richMenuId !== keepId && /^仙加味正式選單/.test(String(menu.name || "")));
  for (const menu of retired) {
    try {
      await request(`${API}/v2/bot/richmenu/${encodeURIComponent(menu.richMenuId)}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
    } catch (error) {
      console.warn("舊 Rich Menu 清理失敗，保留不影響目前預設選單", menu.richMenuId, error.message || error);
    }
  }
  return retired.length;
}

async function syncRichMenu() {
  if (syncPromise) return syncPromise;
  syncPromise = (async () => {
    const token = String(process.env.CHANNEL_ACCESS_TOKEN || "").trim();
    if (!token) return { ok: false, skipped: true, reason: "CHANNEL_ACCESS_TOKEN not configured", version: VERSION };
    const listed = await request(`${API}/v2/bot/richmenu/list`, { headers: { Authorization: `Bearer ${token}` } });
    let menu = (listed.richmenus || []).find((item) => item.name === MENU_NAME);
    if (!menu) {
      const created = await request(`${API}/v2/bot/richmenu`, { method: "POST", headers: { Authorization: `Bearer ${token}`, "content-type": "application/json" }, body: JSON.stringify(menuDefinition()) });
      const richMenuId = created.richMenuId;
      const image = await buildRichMenuImage();
      await request(`${DATA_API}/v2/bot/richmenu/${encodeURIComponent(richMenuId)}/content`, { method: "POST", headers: { Authorization: `Bearer ${token}`, "content-type": "image/jpeg" }, body: image });
      menu = { richMenuId, name: MENU_NAME };
    }
    await setDefault(token, menu.richMenuId);
    const retiredMenuCount = await removeRetiredMenus(token, listed.richmenus || [], menu.richMenuId);
    global.__XJW_RICH_MENU_RUNTIME__ = Object.freeze({ ok: true, version: VERSION, richMenuId: menu.richMenuId, staticArtwork: STATIC_ARTWORK, singleImageOnly: true, runtimeCompositeForbidden: true, legacyBaseTemplateForbidden: true, visualMode: "native-static-single-artwork-vector-outline", fontIndependent: true, tapZones: "visual-panels-only", retiredMenuCount, syncedAt: new Date().toISOString() });
    console.log("仙加味 Rich Menu 已同步繁中向量字正式版", JSON.stringify(global.__XJW_RICH_MENU_RUNTIME__));
    return global.__XJW_RICH_MENU_RUNTIME__;
  })().catch((error) => {
    const failed = { ok: false, version: VERSION, error: String(error.message || error), failedAt: new Date().toISOString() };
    global.__XJW_RICH_MENU_LAST_FAILURE__ = Object.freeze(failed);
    console.warn("仙加味 Rich Menu 同步失敗", failed.error);
    return failed;
  }).finally(() => { syncPromise = null; });
  return syncPromise;
}

function unrefTimer(timer) {
  if (typeof timer?.unref === "function") timer.unref();
  return timer;
}

function scheduleRichMenuSync(delayMs = RICH_MENU_RETRY_DELAYS_MS[0]) {
  if (scheduled) return;
  scheduled = true;
  const delays = [Math.max(0, Number(delayMs) || 0), ...RICH_MENU_RETRY_DELAYS_MS.slice(1)];
  const runAttempt = (index) => {
    unrefTimer(setTimeout(async () => {
      const result = await syncRichMenu();
      global.__XJW_RICH_MENU_LAST_ATTEMPT__ = Object.freeze({
        ok: Boolean(result?.ok),
        skipped: Boolean(result?.skipped),
        attempt: index + 1,
        maxAttempts: delays.length,
        version: VERSION,
        checkedAt: new Date().toISOString(),
        error: result?.error || result?.reason || "",
      });
      if (result?.ok || result?.skipped || index >= delays.length - 1) return;
      console.warn(`仙加味 Rich Menu 將進行第 ${index + 2}/${delays.length} 次安全重試`);
      runAttempt(index + 1);
    }, delays[index]));
  };
  runAttempt(0);
}

const exported = { VERSION, MENU_NAME, STATIC_ARTWORK, SINGLE_IMAGE_ONLY, RUNTIME_COMPOSITE_FORBIDDEN, RICH_MENU_RETRY_DELAYS_MS, readArtwork, menuDefinition, buildRichMenuImage, syncRichMenu, scheduleRichMenuSync };
exported["LEGACY_BASE" + "_TEMPLATE_FORBIDDEN"] = LEGACY_JPG_TEMPLATE_FORBIDDEN;
module.exports = exported;
