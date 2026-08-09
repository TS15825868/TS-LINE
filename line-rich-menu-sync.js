"use strict";

/**
 * 仙加味 LINE Rich Menu｜2026-08-09 原生完整單一設計稿 v11
 * - 正式視覺是一個完整 SVG 母稿，不再讀舊 JPG 底圖，也不在執行時補黑塊／貼照片／拼六格素材。
 * - 六個功能區、品牌標頭、文字、圖示、背景與分隔全部在同一份 SVG 中完成。
 * - 執行時只做一次 SVG → JPEG 格式轉換，再上傳 LINE；不使用 sharp.composite。
 */
const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const VERSION = "20260809-rich-menu-native-single-artwork-v11";
const MENU_NAME = `仙加味正式選單｜原生完整設計稿｜${VERSION}`;
const STATIC_ARTWORK = "assets/rich-menu/xianjiawei-rich-menu-v11.svg";
const API = "https://api.line.me";
const DATA_API = "https://api-data.line.me";
const SINGLE_IMAGE_ONLY = true;
const RUNTIME_COMPOSITE_FORBIDDEN = true;
const LEGACY_BASE_TEMPLATE_FORBIDDEN = true;
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
  const svg = fs.readFileSync(file, "utf8");
  const required = ["width=\"2500\"", "height=\"1686\"", "看產品", "購物車", "幫我推薦", "搭配組合", "怎麼使用", "直接下單"];
  for (const token of required) if (!svg.includes(token)) throw new Error(`Rich Menu 正式母稿缺少：${token}`);
  if (/<image\b/i.test(svg)) throw new Error("Rich Menu 正式母稿不得再內嵌照片或舊底圖；必須是單一原生設計稿");
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
  const col = [0, 833, 1667, 2500];
  const rows = [0, 843, 1686];
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
  for (let r = 0; r < 2; r += 1) {
    for (let c = 0; c < 3; c += 1) {
      areas.push({
        bounds: { x: col[c], y: rows[r], width: col[c + 1] - col[c], height: rows[r + 1] - rows[r] },
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
    global.__XJW_RICH_MENU_RUNTIME__ = Object.freeze({ ok: true, version: VERSION, richMenuId: menu.richMenuId, staticArtwork: STATIC_ARTWORK, singleImageOnly: true, runtimeCompositeForbidden: true, legacyBaseTemplateForbidden: true, visualMode: "native-static-single-artwork", retiredMenuCount, syncedAt: new Date().toISOString() });
    console.log("仙加味 Rich Menu 已同步原生完整單一設計稿", JSON.stringify(global.__XJW_RICH_MENU_RUNTIME__));
    return global.__XJW_RICH_MENU_RUNTIME__;
  })().catch((error) => {
    console.warn("仙加味 Rich Menu 同步失敗", error.message || error);
    return { ok: false, version: VERSION, error: String(error.message || error) };
  }).finally(() => { syncPromise = null; });
  return syncPromise;
}

function scheduleRichMenuSync(delayMs = 3000) {
  if (scheduled) return;
  scheduled = true;
  const timer = setTimeout(() => { syncRichMenu().catch(() => {}); }, delayMs);
  if (typeof timer.unref === "function") timer.unref();
}

module.exports = { VERSION, MENU_NAME, STATIC_ARTWORK, SINGLE_IMAGE_ONLY, RUNTIME_COMPOSITE_FORBIDDEN, LEGACY_BASE_TEMPLATE_FORBIDDEN, readArtwork, menuDefinition, buildRichMenuImage, syncRichMenu, scheduleRichMenuSync };
