"use strict";

/**
 * 仙加味 LINE Rich Menu｜2026-08-09 正式單一成品圖版
 * - Rich Menu 視覺只允許一張完整 2500×1686 成品圖，不再做任何六格圖片後貼／拼湊／composite。
 * - 功能熱區與視覺圖分離：圖只負責品牌視覺；LINE areas 只負責六個正確意圖。
 * - 保留使用者偏好的經典深藍＋金線六格母版，先停止所有會造成黑底＋白框拼貼感的動態疊圖。
 * - 未來更換正式視覺時，只需換 FINAL_MENU_IMAGE 整張成品，不得再新增 BOSS_SOURCES 或 cell overlay。
 */
const sharp = require("sharp");

const VERSION = "20260809-rich-menu-single-final-v9-no-composite";
const MENU_NAME = `仙加味正式選單｜完整成品圖｜${VERSION}`;
const FINAL_MENU_IMAGE = "https://ts15825868.github.io/xianjiawei/images/line/xianjiawei-rich-menu-2500x1686-v309.jpg";
const API = "https://api.line.me";
const DATA_API = "https://api-data.line.me";
const SINGLE_IMAGE_ONLY = true;
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

async function fetchBuffer(url) {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) throw new Error(`Rich Menu 完整成品圖讀取失敗 HTTP ${response.status}: ${url}`);
  return Buffer.from(await response.arrayBuffer());
}

async function buildRichMenuImage() {
  const source = await fetchBuffer(FINAL_MENU_IMAGE);
  const image = sharp(source);
  const metadata = await image.metadata();
  if (!metadata.width || !metadata.height) throw new Error("Rich Menu 完整成品圖無法讀取尺寸");
  if (metadata.width !== 2500 || metadata.height !== 1686) {
    throw new Error(`Rich Menu 完整成品圖尺寸必須是2500×1686，目前為${metadata.width}×${metadata.height}`);
  }
  return image.jpeg({ quality: 92, mozjpeg: true }).toBuffer();
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

async function syncRichMenu() {
  if (syncPromise) return syncPromise;
  syncPromise = (async () => {
    const token = String(process.env.CHANNEL_ACCESS_TOKEN || "").trim();
    if (!token) return { ok: false, skipped: true, reason: "CHANNEL_ACCESS_TOKEN not configured", version: VERSION };
    const listed = await request(`${API}/v2/bot/richmenu/list`, { headers: { Authorization: `Bearer ${token}` } });
    let menu = (listed.richmenus || []).find((item) => item.name === MENU_NAME);
    if (!menu) {
      menu = await request(`${API}/v2/bot/richmenu`, { method: "POST", headers: { Authorization: `Bearer ${token}`, "content-type": "application/json" }, body: JSON.stringify(menuDefinition()) });
      const richMenuId = menu.richMenuId;
      const image = await buildRichMenuImage();
      await request(`${DATA_API}/v2/bot/richmenu/${encodeURIComponent(richMenuId)}/content`, { method: "POST", headers: { Authorization: `Bearer ${token}`, "content-type": "image/jpeg" }, body: image });
      menu = { richMenuId, name: MENU_NAME };
    }
    await setDefault(token, menu.richMenuId);
    global.__XJW_RICH_MENU_RUNTIME__ = Object.freeze({ ok: true, version: VERSION, richMenuId: menu.richMenuId, image: FINAL_MENU_IMAGE, singleImageOnly: true, syncedAt: new Date().toISOString() });
    console.log("仙加味 Rich Menu 已同步完整成品圖", JSON.stringify(global.__XJW_RICH_MENU_RUNTIME__));
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

module.exports = { VERSION, MENU_NAME, FINAL_MENU_IMAGE, SINGLE_IMAGE_ONLY, menuDefinition, buildRichMenuImage, syncRichMenu, scheduleRichMenuSync };
