"use strict";

/**
 * 仙加味 LINE Rich Menu｜2026-08-09 正式單一畫布版
 * - 不再把六張照片／小老闆圖／產品卡貼進六格。
 * - 只使用一張既有品牌母版作為完整畫布，六個視覺區一次以同一套米白、深紅、金色線性圖示重繪。
 * - 整個 Rich Menu 只 render 一次 SVG → JPEG；沒有 BOSS_SOURCES、CELL_LAYOUTS、sharp.composite 或圖片拼貼。
 * - 原本六個中文功能標題留在同一張品牌母版，功能熱區另由 LINE areas 負責。
 */
const sharp = require("sharp");

const VERSION = "20260809-rich-menu-single-canvas-v10-cohesive";
const MENU_NAME = `仙加味正式選單｜單一完整畫布｜${VERSION}`;
const BASE_TEMPLATE = "https://ts15825868.github.io/xianjiawei/images/line/xianjiawei-rich-menu-2500x1686-v309.jpg";
const API = "https://api.line.me";
const DATA_API = "https://api-data.line.me";
const SINGLE_IMAGE_ONLY = true;
const RUNTIME_COMPOSITE_FORBIDDEN = true;
let syncPromise = null;
let scheduled = false;

const COLORS = Object.freeze({
  navy: "#08223e",
  cream: "#f4efe5",
  cream2: "#f1eadc",
  burgundy: "#8d2024",
  gold: "#bd8b32",
  light: "#d8cab1",
});

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
  if (!response.ok) throw new Error(`Rich Menu 品牌母版讀取失敗 HTTP ${response.status}: ${url}`);
  return Buffer.from(await response.arrayBuffer());
}

function panel(x, y, width, height, icon) {
  const cx = x + width / 2;
  const lineY = y + height - 58;
  return `
    <rect x="${x + 5}" y="${y + 5}" width="${width - 10}" height="${height - 10}" fill="${COLORS.cream}"/>
    <rect x="${x + 26}" y="${y + 26}" width="${width - 52}" height="${height - 52}" rx="30" fill="${COLORS.cream2}" stroke="${COLORS.light}" stroke-width="2"/>
    ${icon(cx, y + 270)}
    <line x1="${cx - 52}" y1="${lineY}" x2="${cx + 52}" y2="${lineY}" stroke="${COLORS.gold}" stroke-width="5" stroke-linecap="round"/>
  `;
}

function productIcon(cx, cy) {
  return `<g fill="none" stroke="${COLORS.burgundy}" stroke-width="11" stroke-linecap="round" stroke-linejoin="round">
    <rect x="${cx - 128}" y="${cy - 102}" width="100" height="166" rx="18"/>
    <rect x="${cx - 137}" y="${cy - 126}" width="118" height="31" rx="8" fill="${COLORS.gold}" stroke-width="6"/>
    <path d="M ${cx + 31} ${cy - 112} L ${cx + 118} ${cy - 93} L ${cx + 107} ${cy + 61} L ${cx + 20} ${cy + 50} Z"/>
    <line x1="${cx - 105}" y1="${cy - 35}" x2="${cx - 51}" y2="${cy - 35}" stroke="${COLORS.gold}" stroke-width="6"/>
    <line x1="${cx - 105}" y1="${cy - 2}" x2="${cx - 51}" y2="${cy - 2}" stroke="${COLORS.gold}" stroke-width="6"/>
    <line x1="${cx + 48}" y1="${cy - 75}" x2="${cx + 104}" y2="${cy - 63}" stroke="${COLORS.gold}" stroke-width="6"/>
  </g>`;
}
function cartIcon(cx, cy) {
  return `<g fill="none" stroke="${COLORS.burgundy}" stroke-width="12" stroke-linecap="round" stroke-linejoin="round">
    <path d="M ${cx - 105} ${cy - 104} L ${cx - 69} ${cy - 104} L ${cx - 27} ${cy + 17} L ${cx + 120} ${cy + 17} L ${cx + 149} ${cy - 61} L ${cx - 82} ${cy - 61}"/>
    <circle cx="${cx + 2}" cy="${cy + 65}" r="17" fill="${COLORS.burgundy}"/>
    <circle cx="${cx + 110}" cy="${cy + 65}" r="17" fill="${COLORS.burgundy}"/>
    <line x1="${cx - 14}" y1="${cy - 18}" x2="${cx + 110}" y2="${cy - 18}" stroke="${COLORS.gold}" stroke-width="7"/>
  </g>`;
}
function recommendIcon(cx, cy) {
  return `<g fill="none" stroke="${COLORS.burgundy}" stroke-width="11" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="${cx}" cy="${cy - 13}" r="98"/>
    <path d="M ${cx + 47} ${cy - 70} L ${cx + 7} ${cy - 4} L ${cx - 52} ${cy + 46} L ${cx - 6} ${cy - 24} Z" fill="${COLORS.burgundy}"/>
    <circle cx="${cx}" cy="${cy - 13}" r="10" fill="${COLORS.gold}" stroke="none"/>
    <line x1="${cx}" y1="${cy - 151}" x2="${cx}" y2="${cy - 129}" stroke="${COLORS.gold}" stroke-width="6"/>
    <line x1="${cx}" y1="${cy + 103}" x2="${cx}" y2="${cy + 125}" stroke="${COLORS.gold}" stroke-width="6"/>
  </g>`;
}
function comboIcon(cx, cy) {
  return `<g fill="none" stroke-linecap="round" stroke-linejoin="round">
    <path d="M ${cx - 70} ${cy - 94} C ${cx - 70} ${cy - 140},${cx - 36} ${cy - 140},${cx - 36} ${cy - 94}" stroke="${COLORS.gold}" stroke-width="8"/>
    <path d="M ${cx + 5} ${cy - 108} C ${cx + 5} ${cy - 154},${cx + 47} ${cy - 154},${cx + 47} ${cy - 108}" stroke="${COLORS.gold}" stroke-width="8"/>
    <line x1="${cx - 128}" y1="${cy + 12}" x2="${cx + 120}" y2="${cy + 12}" stroke="${COLORS.burgundy}" stroke-width="12"/>
    <path d="M ${cx - 126} ${cy + 51} C ${cx - 108} ${cy + 129},${cx - 56} ${cy + 151},${cx - 3} ${cy + 151} C ${cx + 53} ${cy + 151},${cx + 106} ${cy + 126},${cx + 121} ${cy + 51}" stroke="${COLORS.burgundy}" stroke-width="11"/>
    <line x1="${cx - 47}" y1="${cy + 121}" x2="${cx + 48}" y2="${cy + 121}" stroke="${COLORS.gold}" stroke-width="6"/>
    <line x1="${cx + 121}" y1="${cy - 85}" x2="${cx + 121}" y2="${cy - 34}" stroke="${COLORS.burgundy}" stroke-width="10"/>
    <line x1="${cx + 95}" y1="${cy - 60}" x2="${cx + 147}" y2="${cy - 60}" stroke="${COLORS.burgundy}" stroke-width="10"/>
  </g>`;
}
function usageIcon(cx, cy) {
  return `<g fill="none" stroke-linecap="round" stroke-linejoin="round">
    <rect x="${cx - 91}" y="${cy - 26}" width="151" height="105" rx="15" stroke="${COLORS.burgundy}" stroke-width="11"/>
    <path d="M ${cx + 66} ${cy - 3} C ${cx + 116} ${cy},${cx + 119} ${cy + 58},${cx + 72} ${cy + 64}" stroke="${COLORS.burgundy}" stroke-width="10"/>
    <path d="M ${cx - 50} ${cy - 86} C ${cx - 50} ${cy - 120},${cx - 22} ${cy - 120},${cx - 22} ${cy - 86}" stroke="${COLORS.gold}" stroke-width="7"/>
    <path d="M ${cx + 13} ${cy - 96} C ${cx + 13} ${cy - 130},${cx + 44} ${cy - 130},${cx + 44} ${cy - 96}" stroke="${COLORS.gold}" stroke-width="7"/>
    <circle cx="${cx + 132}" cy="${cy - 97}" r="34" stroke="${COLORS.gold}" stroke-width="7"/>
    <line x1="${cx + 132}" y1="${cy - 97}" x2="${cx + 132}" y2="${cy - 119}" stroke="${COLORS.gold}" stroke-width="6"/>
    <line x1="${cx + 132}" y1="${cy - 97}" x2="${cx + 151}" y2="${cy - 84}" stroke="${COLORS.gold}" stroke-width="6"/>
  </g>`;
}
function checkoutIcon(cx, cy) {
  return `<g fill="none" stroke="${COLORS.burgundy}" stroke-width="11" stroke-linecap="round" stroke-linejoin="round">
    <rect x="${cx - 116}" y="${cy - 88}" width="232" height="145" rx="20"/>
    <path d="M ${cx - 62} ${cy - 8} L ${cx - 19} ${cy + 32} L ${cx + 72} ${cy - 51}"/>
    <path d="M ${cx - 71} ${cy + 59} L ${cx - 96} ${cy + 108} L ${cx - 37} ${cy + 72} Z" fill="${COLORS.burgundy}" stroke="none"/>
  </g>`;
}

function fullCanvasSvg(baseBuffer) {
  const base64 = baseBuffer.toString("base64");
  const topY = 165, topHeight = 553, bottomY = 925, bottomHeight = 548;
  const columns = [
    { x: 0, width: 833, icon: productIcon },
    { x: 833, width: 834, icon: cartIcon },
    { x: 1667, width: 833, icon: recommendIcon },
  ];
  const bottom = [comboIcon, usageIcon, checkoutIcon];
  return `<svg xmlns="http://www.w3.org/2000/svg" width="2500" height="1686" viewBox="0 0 2500 1686">
    <image href="data:image/jpeg;base64,${base64}" x="0" y="0" width="2500" height="1686" preserveAspectRatio="none"/>
    ${columns.map((cell) => panel(cell.x, topY, cell.width, topHeight, cell.icon)).join("")}
    ${columns.map((cell, index) => panel(cell.x, bottomY, cell.width, bottomHeight, bottom[index])).join("")}
  </svg>`;
}

async function buildRichMenuImage() {
  const source = await fetchBuffer(BASE_TEMPLATE);
  const metadata = await sharp(source).metadata();
  if (metadata.width !== 2500 || metadata.height !== 1686) {
    throw new Error(`Rich Menu 品牌母版尺寸必須是2500×1686，目前為${metadata.width || 0}×${metadata.height || 0}`);
  }
  const svg = Buffer.from(fullCanvasSvg(source));
  return sharp(svg).jpeg({ quality: 92, mozjpeg: true }).toBuffer();
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
    global.__XJW_RICH_MENU_RUNTIME__ = Object.freeze({ ok: true, version: VERSION, richMenuId: menu.richMenuId, baseTemplate: BASE_TEMPLATE, singleImageOnly: true, runtimeCompositeForbidden: true, visualMode: "single-canvas-vector-redraw", syncedAt: new Date().toISOString() });
    console.log("仙加味 Rich Menu 已同步單一完整畫布", JSON.stringify(global.__XJW_RICH_MENU_RUNTIME__));
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

module.exports = { VERSION, MENU_NAME, BASE_TEMPLATE, SINGLE_IMAGE_ONLY, RUNTIME_COMPOSITE_FORBIDDEN, COLORS, fullCanvasSvg, menuDefinition, buildRichMenuImage, syncRichMenu, scheduleRichMenuSync };
