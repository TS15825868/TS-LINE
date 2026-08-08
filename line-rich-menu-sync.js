"use strict";

/**
 * 仙加味 LINE Rich Menu 自動同步｜2026-08-08
 * 保留既有 3×2 六格選單的文字、圖示與操作邏輯，僅把舊小老闆視覺覆蓋為官網 approved-v405 衍生Q版。
 * 六格角色情境依功能對應：產品／購物車／推薦／搭配／使用／下單客服。
 * 不使用產品圖，因此不會把舊包裝或宣傳版面混進 Rich Menu。
 * 成功後透過 LINE Messaging API 設為預設 Rich Menu；失敗只記錄，不影響 webhook 回覆。
 */
const sharp = require("sharp");

const VERSION = "20260808-rich-menu-website-chibi-v2-semantic-scenes";
const MENU_NAME = `仙加味正式選單｜網站Q版｜${VERSION}`;
const BASE_MENU = "https://ts15825868.github.io/xianjiawei/images/line/xianjiawei-rich-menu-2500x1686-v309.jpg";
const BOSS_SOURCES = [
  "https://ts15825868.github.io/xianjiawei/images/brand/line-oa/products.jpg?v=20260808-24",
  "https://ts15825868.github.io/xianjiawei/images/brand/line-oa/products.jpg?v=20260808-24",
  "https://ts15825868.github.io/xianjiawei/images/brand/line-oa/recommend.jpg?v=20260808-24",
  "https://ts15825868.github.io/xianjiawei/images/brand/line-oa/combo.jpg?v=20260808-24",
  "https://ts15825868.github.io/xianjiawei/images/brand/line-oa/usage.jpg?v=20260808-24",
  "https://ts15825868.github.io/xianjiawei/images/brand/line-oa/service.jpg?v=20260808-24"
];
const API = "https://api.line.me";
const DATA_API = "https://api-data.line.me";
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
  if (!response.ok) throw new Error(`Rich Menu 素材讀取失敗 HTTP ${response.status}: ${url}`);
  return Buffer.from(await response.arrayBuffer());
}

async function bossOverlay(buffer, width = 350, height = 525) {
  return sharp(buffer)
    .resize(width, height, { fit: "cover", position: "right" })
    .jpeg({ quality: 88, mozjpeg: true })
    .toBuffer();
}

async function buildRichMenuImage() {
  const [base, ...bosses] = await Promise.all([fetchBuffer(BASE_MENU), ...BOSS_SOURCES.map(fetchBuffer)]);
  const overlays = await Promise.all(bosses.map((buffer) => bossOverlay(buffer)));
  const cells = [
    { x: 18, y: 220 }, { x: 851, y: 220 }, { x: 1685, y: 220 },
    { x: 18, y: 1063 }, { x: 851, y: 1063 }, { x: 1685, y: 1063 },
  ];
  const backgroundBlocks = cells.map((cell) => ({
    input: { create: { width: 370, height: 545, channels: 4, background: { r: 239, g: 228, b: 210, alpha: 1 } } },
    left: cell.x - 8,
    top: cell.y - 10,
  }));
  const bossLayers = overlays.map((input, index) => ({ input, left: cells[index].x, top: cells[index].y }));
  return sharp(base)
    .resize(2500, 1686, { fit: "fill" })
    .composite([...backgroundBlocks, ...bossLayers])
    .jpeg({ quality: 84, mozjpeg: true })
    .toBuffer();
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
    ["直接下單", "開始結帳"],
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
  return {
    size: { width: 2500, height: 1686 },
    selected: true,
    name: MENU_NAME,
    chatBarText: "仙加味選單",
    areas,
  };
}

async function setDefault(token, richMenuId) {
  await request(`${API}/v2/bot/user/all/richmenu/${encodeURIComponent(richMenuId)}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
}

async function syncRichMenu() {
  if (syncPromise) return syncPromise;
  syncPromise = (async () => {
    const token = String(process.env.CHANNEL_ACCESS_TOKEN || "").trim();
    if (!token) return { ok: false, skipped: true, reason: "CHANNEL_ACCESS_TOKEN not configured", version: VERSION };

    const listed = await request(`${API}/v2/bot/richmenu/list`, { headers: { Authorization: `Bearer ${token}` } });
    let menu = (listed.richmenus || []).find((item) => item.name === MENU_NAME);
    if (!menu) {
      menu = await request(`${API}/v2/bot/richmenu`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "content-type": "application/json" },
        body: JSON.stringify(menuDefinition()),
      });
      const richMenuId = menu.richMenuId;
      const image = await buildRichMenuImage();
      await request(`${DATA_API}/v2/bot/richmenu/${encodeURIComponent(richMenuId)}/content`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "content-type": "image/jpeg" },
        body: image,
      });
      menu = { richMenuId, name: MENU_NAME };
    }
    await setDefault(token, menu.richMenuId);
    global.__XJW_RICH_MENU_RUNTIME__ = Object.freeze({ ok: true, version: VERSION, richMenuId: menu.richMenuId, syncedAt: new Date().toISOString() });
    console.log("仙加味 Rich Menu 已同步", JSON.stringify(global.__XJW_RICH_MENU_RUNTIME__));
    return global.__XJW_RICH_MENU_RUNTIME__;
  })().catch((error) => {
    console.warn("仙加味 Rich Menu 同步失敗", error.message || error);
    return { ok: false, version: VERSION, error: String(error.message || error) };
  }).finally(() => { syncPromise = null; });
  return syncPromise;
}

function scheduleRichMenuSync(delayMs = 7000) {
  if (scheduled) return;
  scheduled = true;
  const timer = setTimeout(() => { syncRichMenu().catch(() => {}); }, delayMs);
  if (typeof timer.unref === "function") timer.unref();
}

module.exports = { VERSION, MENU_NAME, BASE_MENU, BOSS_SOURCES, menuDefinition, buildRichMenuImage, syncRichMenu, scheduleRichMenuSync };