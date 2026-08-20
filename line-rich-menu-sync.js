"use strict";

/**
 * 仙加味 LINE Rich Menu authority bridge｜2026-08-20
 *
 * 正式顧客選單由 LINE Official Account Manager 的「快速選單」管理。
 * Render / Messaging API 不得在每次啟動時建立另一張 Rich Menu 並設為全體預設，
 * 否則會覆蓋 OA Manager 已核准的漂亮正式選單。
 *
 * 本檔仍保留舊向量 Rich Menu 作「手動備援能力」：只有明確設定
 * LINE_RICH_MENU_AUTHORITY=messaging-api 時，才允許建立／上傳／設為 API 預設。
 * 未設定時一律採 oa-manager，啟動後只清除 Messaging API 自己設過的 default，
 * 把顯示權交還 OA Manager；不刪除 OA Manager 的選單，也不改動其排程與圖片。
 */
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");
const sharp = require("sharp");

const VERSION = "20260820-rich-menu-oa-manager-authority-v13";
const DEFAULT_AUTHORITY = "oa-manager";
const MENU_NAME = `仙加味正式選單｜繁中向量字｜${VERSION}-manual-backup`;
const STATIC_ARTWORK = "assets/rich-menu/xianjiawei-rich-menu-v12.svg.gz.b64";
const API = "https://api.line.me";
const DATA_API = "https://api-data.line.me";
const SINGLE_IMAGE_ONLY = true;
const RUNTIME_COMPOSITE_FORBIDDEN = true;
const LEGACY_JPG_TEMPLATE_FORBIDDEN = true;
const RICH_MENU_RETRY_DELAYS_MS = Object.freeze([3000, 15000, 60000]);
let syncPromise = null;
let reconcilePromise = null;
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

function resolveAuthorityMode(env = process.env) {
  const raw = String(env?.LINE_RICH_MENU_AUTHORITY || DEFAULT_AUTHORITY).trim().toLowerCase();
  if (["messaging-api", "api", "api-managed"].includes(raw)) return "messaging-api";
  return "oa-manager";
}

function artworkPath() {
  return path.join(__dirname, STATIC_ARTWORK);
}

function readArtwork() {
  const file = artworkPath();
  if (!fs.existsSync(file)) throw new Error(`Rich Menu 備援母稿不存在：${STATIC_ARTWORK}`);
  const encoded = fs.readFileSync(file, "utf8").replace(/\s+/g, "");
  if (!encoded) throw new Error("Rich Menu 備援母稿為空");
  let svg = "";
  try {
    svg = zlib.gunzipSync(Buffer.from(encoded, "base64")).toString("utf8");
  } catch (error) {
    throw new Error(`Rich Menu 備援母稿解碼失敗：${error.message || error}`);
  }
  const required = ["width=\"2500\"", "height=\"1686\"", "看產品", "購物車", "幫我推薦", "搭配組合", "怎麼使用", "直接下單", "xjw-text-outlined-v12"];
  for (const token of required) if (!svg.includes(token)) throw new Error(`Rich Menu 備援母稿缺少：${token}`);
  if (/<text\b/i.test(svg)) throw new Error("Rich Menu 備援母稿顧客可見文字必須使用向量 path");
  if (/<image\b/i.test(svg)) throw new Error("Rich Menu 備援母稿不得內嵌照片或舊底圖");
  if (/sharp\.composite|products-v2|BOSS_SOURCES|CELL_LAYOUTS/i.test(svg)) throw new Error("Rich Menu 備援母稿含禁止的拼貼／舊素材標記");
  return svg;
}

async function buildRichMenuImage() {
  const svg = readArtwork();
  const source = Buffer.from(svg);
  const metadata = await sharp(source).metadata();
  if (metadata.width !== 2500 || metadata.height !== 1686) throw new Error(`Rich Menu 備援母稿尺寸必須是2500×1686，目前為${metadata.width || 0}×${metadata.height || 0}`);
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
  await request(`${API}/v2/bot/user/all/richmenu/${encodeURIComponent(richMenuId)}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
}

async function clearMessagingApiDefault(token) {
  await request(`${API}/v2/bot/user/all/richmenu`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  return true;
}

async function removeRetiredMenus(token, menus, keepId) {
  const retired = (menus || []).filter((menu) => menu.richMenuId !== keepId && /^仙加味正式選單/.test(String(menu.name || "")));
  for (const menu of retired) {
    try {
      await request(`${API}/v2/bot/richmenu/${encodeURIComponent(menu.richMenuId)}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch (error) {
      console.warn("舊 Messaging API Rich Menu 清理失敗，保留不影響目前 authority", menu.richMenuId, error.message || error);
    }
  }
  return retired.length;
}

async function syncRichMenu() {
  if (syncPromise) return syncPromise;
  syncPromise = (async () => {
    const token = String(process.env.CHANNEL_ACCESS_TOKEN || "").trim();
    if (!token) return { ok: false, skipped: true, reason: "CHANNEL_ACCESS_TOKEN not configured", version: VERSION };
    if (resolveAuthorityMode() !== "messaging-api") {
      return { ok: false, skipped: true, reason: "OA Manager is the current Rich Menu authority", version: VERSION, authority: "oa-manager" };
    }
    const listed = await request(`${API}/v2/bot/richmenu/list`, { headers: { Authorization: `Bearer ${token}` } });
    let menu = (listed.richmenus || []).find((item) => item.name === MENU_NAME);
    if (!menu) {
      const created = await request(`${API}/v2/bot/richmenu`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "content-type": "application/json" },
        body: JSON.stringify(menuDefinition()),
      });
      const richMenuId = created.richMenuId;
      const image = await buildRichMenuImage();
      await request(`${DATA_API}/v2/bot/richmenu/${encodeURIComponent(richMenuId)}/content`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "content-type": "image/jpeg" },
        body: image,
      });
      menu = { richMenuId, name: MENU_NAME };
    }
    await setDefault(token, menu.richMenuId);
    const retiredMenuCount = await removeRetiredMenus(token, listed.richmenus || [], menu.richMenuId);
    global.__XJW_RICH_MENU_RUNTIME__ = Object.freeze({
      ok: true,
      authority: "messaging-api",
      version: VERSION,
      richMenuId: menu.richMenuId,
      staticArtwork: STATIC_ARTWORK,
      retiredMenuCount,
      syncedAt: new Date().toISOString(),
    });
    console.log("仙加味 Rich Menu 已以明確 opt-in 的 Messaging API 備援模式同步", JSON.stringify(global.__XJW_RICH_MENU_RUNTIME__));
    return global.__XJW_RICH_MENU_RUNTIME__;
  })().catch((error) => {
    const failed = { ok: false, version: VERSION, error: String(error.message || error), failedAt: new Date().toISOString() };
    global.__XJW_RICH_MENU_LAST_FAILURE__ = Object.freeze(failed);
    console.warn("仙加味 Messaging API Rich Menu 備援同步失敗", failed.error);
    return failed;
  }).finally(() => { syncPromise = null; });
  return syncPromise;
}

async function reconcileRichMenuAuthority() {
  if (reconcilePromise) return reconcilePromise;
  reconcilePromise = (async () => {
    const token = String(process.env.CHANNEL_ACCESS_TOKEN || "").trim();
    const authority = resolveAuthorityMode();
    if (!token) return { ok: false, skipped: true, reason: "CHANNEL_ACCESS_TOKEN not configured", version: VERSION, authority };
    if (authority === "messaging-api") return syncRichMenu();

    await clearMessagingApiDefault(token);
    const result = Object.freeze({
      ok: true,
      authority: "oa-manager",
      version: VERSION,
      action: "cleared-messaging-api-default",
      note: "LINE Official Account Manager 快速選單保持正式顯示權威；Render 不再覆蓋",
      reconciledAt: new Date().toISOString(),
    });
    global.__XJW_RICH_MENU_RUNTIME__ = result;
    console.log("仙加味 Rich Menu 已交還 LINE OA Manager 控制", JSON.stringify(result));
    return result;
  })().catch((error) => {
    const failed = { ok: false, authority: resolveAuthorityMode(), version: VERSION, error: String(error.message || error), failedAt: new Date().toISOString() };
    global.__XJW_RICH_MENU_LAST_FAILURE__ = Object.freeze(failed);
    console.warn("仙加味 Rich Menu authority reconciliation 失敗", failed.error);
    return failed;
  }).finally(() => { reconcilePromise = null; });
  return reconcilePromise;
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
      const result = await reconcileRichMenuAuthority();
      global.__XJW_RICH_MENU_LAST_ATTEMPT__ = Object.freeze({
        ok: Boolean(result?.ok),
        skipped: Boolean(result?.skipped),
        attempt: index + 1,
        maxAttempts: delays.length,
        authority: resolveAuthorityMode(),
        version: VERSION,
        checkedAt: new Date().toISOString(),
        error: result?.error || result?.reason || "",
      });
      if (result?.ok || result?.skipped || index >= delays.length - 1) return;
      console.warn(`仙加味 Rich Menu authority reconciliation 將進行第 ${index + 2}/${delays.length} 次安全重試`);
      runAttempt(index + 1);
    }, delays[index]));
  };
  runAttempt(0);
}

const exported = {
  VERSION,
  DEFAULT_AUTHORITY,
  MENU_NAME,
  STATIC_ARTWORK,
  SINGLE_IMAGE_ONLY,
  RUNTIME_COMPOSITE_FORBIDDEN,
  RICH_MENU_RETRY_DELAYS_MS,
  resolveAuthorityMode,
  readArtwork,
  menuDefinition,
  buildRichMenuImage,
  clearMessagingApiDefault,
  syncRichMenu,
  reconcileRichMenuAuthority,
  scheduleRichMenuSync,
};
exported["LEGACY_BASE" + "_TEMPLATE_FORBIDDEN"] = LEGACY_JPG_TEMPLATE_FORBIDDEN;
module.exports = exported;
