"use strict";

/**
 * 仙加味・龜鹿 LINE Bot（整包替換版｜全數字選單｜保護條款強化版）
 *
 * ✅ 功能摘要
 * - 全選單數字化：主選單/產品/價格/購買方式/湯塊（介紹/價格/規格）/湯塊規格
 * - 價格單品回覆：建議售價 + 目前活動價（建議售價9折）
 * - 所有價格回覆統一附：通路差異/到店活動/報價有效期限/運費&組合另計
 * - 龜鹿膏 建議售價 2000；目前活動價 1800（9折）
 * - 湯塊新增 2兩(75g) 1000（暫不做活動價）
 * - 湯塊 4兩不做活動價
 * - 「龜鹿仙膠/龜鹿二仙膠/龜鹿膠」→ 統一「龜鹿湯塊(膠)」
 * - 真人回覆管理（ADMIN_USER_IDS 推播 + 指令 handoff）
 * - 不制式購買草稿（吸收訊息、不鎖流程），草稿 30 分鐘過期
 * - 地址/門市判斷：只有選了購買方式才吸收，避免誤判地名
 * - 0 隨時回主選單
 */

const express = require("express");
const line = require("@line/bot-sdk");
const fs = require("fs");
const path = require("path");
const cron = require("node-cron");

const {
  CHANNEL_ACCESS_TOKEN,
  CHANNEL_SECRET,
  PORT = 3000,
  ADMIN_USER_IDS = "", // 多位管理員用逗號分隔：Uxxx,Uyyy
} = process.env;

if (!CHANNEL_ACCESS_TOKEN || !CHANNEL_SECRET) {
  console.error("缺少環境變數：CHANNEL_ACCESS_TOKEN 或 CHANNEL_SECRET");
  process.exit(1);
}

const config = { channelAccessToken: CHANNEL_ACCESS_TOKEN, channelSecret: CHANNEL_SECRET };
const app = express();
const client = new line.Client(config);
const ADMIN_IDS = ADMIN_USER_IDS.split(",").map((s) => s.trim()).filter(Boolean);

/** =========================
 * A) 店家/產品資料
 * ========================= */
const STORE = {
  brandName: "仙加味・龜鹿",
  address: "台北市萬華區西昌街 52 號",
  phoneDisplay: "(02) 2381-2990",
  phoneTel: "0223812990",
  website: "https://ts15825868.github.io/TaiShing/index.html",
  mapUrl:
    "https://www.google.com/maps/search/?api=1&query=%E5%8F%B0%E5%8C%97%E5%B8%82%E8%90%AC%E8%8F%AF%E5%8D%80%E8%A5%BF%E6%98%8C%E8%A1%97+52+%E8%99%9F",

  // 營業/回覆時間（你提供）
  hours: {
    weekdays: "週一～週五 9:30–18:30",
    pickupLate: "自取可到約 21:30–22:00（請先訊息確認）",
    weekendPickup: "週六日若剛好在店/可外出，也可協助取貨（建議先訊息確認）",
    replyTime: "回覆時間大多落在 9:30–22:00 左右（依現場忙碌略有延遲）",
  },

  doctorLineId: "@changwuchi",
  doctorLink: "https://lin.ee/1MK4NR9",

  products: {
    gel: {
      key: "gel",
      name: "龜鹿膏",
      spec: "100g/罐",
      msrp: 2000, // ✅ 建議售價
      discount: 0.9, // ✅ 9折
      noteDays: "依每個人食用習慣不同，一罐大約可吃10天～半個月左右。",
      usage: [
        "一般建議：先從小量、飯後開始（例如小湯匙量），連續觀察幾天；",
        "若本身容易上火、睡不好或口乾，建議減量或隔天吃。",
      ],
    },

    drink: {
      key: "drink",
      name: "龜鹿飲",
      spec: "180cc/包",
      msrp: 200,
      discount: 0.9,
      usage: ["每日一包，可隔水加熱或溫熱飲用。", "建議白天飲用，飲用期間避免冰飲。"],
    },

    antler: {
      key: "antler",
      name: "鹿茸粉",
      spec: "75g/罐",
      msrp: 2000,
      discount: 0.9,
      usage: ["一般建議：先從小量開始，搭配溫水或飲品。", "若容易上火、睡不好或口乾，建議減量或間隔食用。"],
    },

    soup: {
      key: "soup",
      name: "龜鹿湯塊(膠)",
      packagingNote: "目前為傳統盒裝（新包裝仍在規劃中）。",
      variants: [
        { key: "soup75", label: "2兩", spec: "75g", msrp: 1000, discount: null },    // ✅ 暫不做活動價
        { key: "soup150", label: "4兩", spec: "150g", msrp: 2000, discount: null },  // ✅ 不做活動價
        { key: "soup300", label: "半斤", spec: "300g", msrp: 4000, discount: 0.9 },
        { key: "soup600", label: "一斤", spec: "600g", msrp: 8000, discount: 0.9 },
      ],
      usage: ["依個人口味加水煮滾，可搭配肉類/食材燉煮。", "建議熱飲熱食，避免冰冷搭配。"],
    },
  },

  shippingNote:
    "可安排：宅配／超商店到店／雙北親送（台北/新北）／到店購買。運費與到貨時間會依地區與方式確認後回覆您。",
  paymentNote: "付款方式會依訂單確認後提供（例如轉帳等）。我整理好後會一次回覆給您🙂",
  testingNote: "可提供基本資訊（依批次/包裝標示為準）。如需更完整資料，歡迎留言，我整理後回覆您。",
};

const SETTINGS = {
  draftTtlMs: 30 * 60 * 1000, // 30分鐘
  detailsStyle: "hybrid", // "hybrid"：短介紹＋官網；"linkOnly"：只給官網
};

/** =========================
 * B) 保護條款（統一模板）
 * ========================= */
const PRICE_FOOTER = [
  "※ 不同通路因服務內容／搭配方案不同，價格可能略有差異🙂",
  "※ 到店另有不定期活動或搭配方案，依現場為準。",
  "※ 報價以本次對話回覆為準，活動可能調整，恕不另行通知。",
  "※ 以上為單品價格；運費、贈品與組合方案依訂單內容另計。",
].join("\n");

const USAGE_FOOTER = "※ 本品為一般食品/滋補品，非藥品；如有特殊體質/用藥/孕哺，建議先諮詢專業人員。";
const PRIVACY_LINE = "※ 您提供的聯絡與地址僅用於本次出貨聯繫，不會另作他用。";
const ETA_LINE = "※ 到貨/配送時間為預估，仍以物流/路況為準。";

const D2D_NOTE = [
  "※ 雙北親送僅限台北/新北，是否可送需以地址與當日路線確認。",
  "※ 親送需視訂單金額與時段安排；若不便親送會改以宅配/店到店協助🙂",
  ETA_LINE,
].join("\n");

const ORDER_TERMS = [
  "※ 訂單以「款項確認」或「到店完成結帳」為準成立。",
  "※ 若遇缺貨/包材調整/物流因素，會先與您確認改期或替代方案。",
  "※ 如需取消/改單，請在出貨前告知；出貨後將依物流規則協助處理。",
].join("\n");

const REPLY_TIME_LINE = `※ ${STORE.hours.replyTime}`;

/** =========================
 * C) 工具
 * ========================= */
function nowMs() { return Date.now(); }
function money(n) {
  const s = String(Math.round(Number(n))).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `$${s}`;
}
function clampText(s, max = 4000) {
  const t = String(s || "");
  return t.length <= max ? t : t.slice(0, max - 3) + "...";
}
function normalizeText(s) {
  return String(s || "")
    .replace(/\u3000/g, " ")
    .replace(/[，,、/／]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
function includesAny(t, arr) {
  return arr.some((k) => String(t).includes(k));
}
function calcActivityPrice(msrp, discount) {
  if (!discount || typeof discount !== "number") return null;
  return Math.round(msrp * discount);
}
function uniqNonEmpty(arr) {
  const seen = new Set();
  const out = [];
  for (const x of arr || []) {
    const t = String(x || "").trim();
    if (!t) continue;
    if (seen.has(t)) continue;
    seen.add(t);
    out.push(t);
  }
  return out;
}
function stableJoinParts(parts) {
  return uniqNonEmpty(parts).map((p) => String(p).trim()).join("\n\n——\n\n");
}
function isLikelyAddress(text) {
  const t = String(text || "");
  return /(台北|臺北|新北|台中|臺中|台南|臺南|高雄|桃園|新竹|基隆|苗栗|彰化|南投|雲林|嘉義|屏東|宜蘭|花蓮|台東|臺東|澎湖|金門|馬祖).*(區|鄉|鎮|市)/.test(t)
    || /(路|街|巷|弄|段).*(號)/.test(t)
    || /(號).*(樓|F|f)/.test(t);
}
function getCityFromAddressLoose(text) {
  const raw = String(text || "");
  if (raw.includes("台北") || raw.includes("臺北")) return "台北";
  if (raw.includes("新北")) return "新北";
  if (raw.includes("台中") || raw.includes("臺中")) return "台中";
  if (raw.includes("台南") || raw.includes("臺南")) return "台南";
  if (raw.includes("高雄")) return "高雄";
  if (raw.includes("桃園")) return "桃園";
  return null;
}

/** =========================
 * D) 資料存檔：users.json & handoffs.json
 * ========================= */
const DATA_DIR = path.join(__dirname, "data");
const USERS_FILE = path.join(DATA_DIR, "users.json");
const HANDOFFS_FILE = path.join(DATA_DIR, "handoffs.json");
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

function loadJson(file, fallback) {
  try {
    if (!fs.existsSync(file)) return fallback;
    const raw = fs.readFileSync(file, "utf8");
    return raw ? JSON.parse(raw) : fallback;
  } catch (e) {
    console.error(`讀取 ${file} 失敗：`, e);
    return fallback;
  }
}
function saveJson(file, obj) {
  try {
    fs.writeFileSync(file, JSON.stringify(obj, null, 2), "utf8");
  } catch (e) {
    console.error(`寫入 ${file} 失敗：`, e);
  }
}
function loadUsers() { return loadJson(USERS_FILE, {}); }
function saveUsers(users) { saveJson(USERS_FILE, users); }
function loadHandoffs() { return loadJson(HANDOFFS_FILE, { list: [] }); }
function saveHandoffs(h) { saveJson(HANDOFFS_FILE, h); }

function ensureUser(userId) {
  const users = loadUsers();
  users[userId] = users[userId] || {};
  users[userId].state = users[userId].state || {
    lastProductKey: null,      // gel/drink/antler/soup
    lastSoupVariantKey: null,  // soup75/soup150/soup300/soup600
    menu: "main",              // main/product/price/buy/soup_menu/soup_variant/none
    lastSeenAt: nowMs(),
  };
  users[userId].draft = users[userId].draft || {
    active: false,
    method: null, // home | c2c | d2d | store
    items: [],
    ship: { address: null, store: null },
    updatedAt: 0,
  };
  users[userId].handoff = users[userId].handoff || { requested: false, requestedAt: 0, lastHandoffId: null };
  users[userId].state.lastSeenAt = nowMs();
  saveUsers(users);
  return users[userId];
}
function updateUser(userId, patchFn) {
  const users = loadUsers();
  users[userId] = users[userId] || {};
  users[userId].state = users[userId].state || {};
  users[userId].draft = users[userId].draft || {};
  users[userId].handoff = users[userId].handoff || {};
  patchFn(users[userId]);
  users[userId].state.lastSeenAt = nowMs();
  saveUsers(users);
}
function resetDraft(userId) {
  updateUser(userId, (u) => {
    u.draft = { active: false, method: null, items: [], ship: { address: null, store: null }, updatedAt: 0 };
  });
}
function touchDraft(userId) {
  updateUser(userId, (u) => {
    u.draft.active = true;
    u.draft.updatedAt = nowMs();
  });
}
function isDraftExpired(draft) {
  if (!draft || !draft.active) return false;
  return nowMs() - (draft.updatedAt || 0) > SETTINGS.draftTtlMs;
}

/** =========================
 * E) Quick Reply（數字選單）
 * ========================= */
function quickRepliesMain() {
  return {
    items: [
      { type: "action", action: { type: "message", label: "1 產品", text: "1" } },
      { type: "action", action: { type: "message", label: "2 容量", text: "2" } },
      { type: "action", action: { type: "message", label: "3 價格", text: "3" } },
      { type: "action", action: { type: "message", label: "4 購買", text: "4" } },
      { type: "action", action: { type: "message", label: "5 門市", text: "5" } },
      { type: "action", action: { type: "message", label: "6 真人", text: "6" } },
      { type: "action", action: { type: "message", label: "7 官網", text: "7" } },
    ],
  };
}
function quickRepliesBack() {
  return {
    items: [
      { type: "action", action: { type: "message", label: "0 回主選單", text: "0" } },
      { type: "action", action: { type: "message", label: "6 真人回覆", text: "6" } },
      { type: "action", action: { type: "uri", label: "來電", uri: `tel:${STORE.phoneTel}` } },
      { type: "action", action: { type: "uri", label: "官網", uri: STORE.website } },
    ],
  };
}
function textMessage(text, menu = "main") {
  const quickReply = (menu === "main") ? quickRepliesMain() : quickRepliesBack();
  return { type: "text", text: clampText(text), quickReply };
}

/** =========================
 * F) 真人回覆管理
 * ========================= */
function isAdmin(userId) { return ADMIN_IDS.includes(userId); }
function makeHandoffId() {
  const base = nowMs().toString(36);
  const rand = Math.random().toString(36).slice(2, 7);
  return `${base}${rand}`.slice(-12);
}
async function getProfileSafe(userId) {
  try { return await client.getProfile(userId); } catch { return null; }
}
async function notifyAdmins(text) {
  if (!ADMIN_IDS.length) return;
  await Promise.all(ADMIN_IDS.map(async (aid) => {
    try { await client.pushMessage(aid, { type: "text", text: clampText(text) }); }
    catch (e) { console.error("通知管理員失敗：", aid, e?.message || e); }
  }));
}
async function createHandoffCase({ userId, lastMessage }) {
  const h = loadHandoffs();
  const profile = await getProfileSafe(userId);
  const id = makeHandoffId();
  const createdAt = new Date().toISOString();

  const record = {
    id,
    userId,
    displayName: profile?.displayName || null,
    createdAt,
    status: "open",
    lastMessage: String(lastMessage || "").trim(),
    note: null,
    closedAt: null,
  };

  h.list = Array.isArray(h.list) ? h.list : [];
  h.list.unshift(record);
  saveHandoffs(h);

  updateUser(userId, (u) => {
    u.handoff.requested = true;
    u.handoff.requestedAt = nowMs();
    u.handoff.lastHandoffId = id;
  });

  await notifyAdmins([
    "【真人回覆｜新案件】",
    `案件ID：${id}`,
    `時間：${createdAt}`,
    `客人：${record.displayName || "（未取到姓名）"}`,
    `userId：${userId}`,
    `最後一句：${record.lastMessage || "（空）"}`,
    "",
    "管理指令：",
    `handoff show ${id}`,
    `handoff close ${id}`,
    `handoff note ${id} 已回覆/已下單...`,
  ].join("\n"));

  return record;
}
function handleAdminCommand(textRaw) {
  const t = normalizeText(textRaw).toLowerCase();
  if (!t.startsWith("handoff")) return null;

  const h = loadHandoffs();
  const list = Array.isArray(h.list) ? h.list : [];

  if (t === "handoff list") {
    const open = list.filter((x) => x.status === "open").slice(0, 20);
    if (!open.length) return "目前沒有未結案的真人回覆案件🙂";
    const lines = ["【未結案（open）】"];
    for (const x of open) {
      lines.push(`- ${x.id}｜${x.displayName || "（未取到）"}｜${x.createdAt}`);
      lines.push(`  最後一句：${(x.lastMessage || "").slice(0, 60)}`);
    }
    lines.push("", "指令：handoff show <id> / handoff close <id> / handoff note <id> <備註>");
    return lines.join("\n");
  }

  if (t.startsWith("handoff show ")) {
    const id = t.replace("handoff show ", "").trim();
    const x = list.find((r) => r.id === id);
    if (!x) return `找不到案件ID：${id}`;
    return [
      "【案件詳情】",
      `ID：${x.id}`,
      `狀態：${x.status}`,
      `時間：${x.createdAt}`,
      `客人：${x.displayName || "（未取到）"}`,
      `userId：${x.userId}`,
      `最後一句：${x.lastMessage || ""}`,
      `備註：${x.note || "（無）"}`,
      x.closedAt ? `結案時間：${x.closedAt}` : "",
    ].filter(Boolean).join("\n");
  }

  if (t.startsWith("handoff close ")) {
    const id = t.replace("handoff close ", "").trim();
    const idx = list.findIndex((r) => r.id === id);
    if (idx < 0) return `找不到案件ID：${id}`;
    if (list[idx].status === "closed") return `案件 ${id} 已經是 closed 了。`;
    list[idx].status = "closed";
    list[idx].closedAt = new Date().toISOString();
    saveHandoffs({ list });
    return `✅ 已結案：${id}`;
  }

  if (t.startsWith("handoff note ")) {
    const rest = textRaw.trim().slice("handoff note ".length);
    const [id, ...noteParts] = rest.split(" ");
    const note = noteParts.join(" ").trim();
    if (!id || !note) return "用法：handoff note <案件ID> <備註文字>";
    const idx = list.findIndex((r) => r.id === id);
    if (idx < 0) return `找不到案件ID：${id}`;
    list[idx].note = note;
    saveHandoffs({ list });
    return `✅ 已更新備註：${id}\n備註：${note}`;
  }

  return [
    "管理指令：",
    "handoff list",
    "handoff show <id>",
    "handoff close <id>",
    "handoff note <id> <備註>",
  ].join("\n");
}

/** =========================
 * G) 數字選單文案
 * ========================= */
function mainMenuText() {
  return [
    `您好🙂 這裡是【${STORE.brandName}】`,
    "",
    "請回覆數字：",
    "1) 產品介紹",
    "2) 容量／規格",
    "3) 價格（單品報價）",
    "4) 購買方式",
    "5) 門市資訊／來電",
    "6) 真人回覆",
    "7) 官網（看介紹）",
    "",
    `營業：${STORE.hours.weekdays}`,
    `自取：${STORE.hours.pickupLate}`,
    `週末：${STORE.hours.weekendPickup}`,
    "",
    "（隨時回 0 可回到主選單）",
  ].join("\n");
}

function productMenuText() {
  const p = STORE.products;
  return [
    "【產品介紹】請回覆數字：",
    `1) ${p.gel.name}（${p.gel.spec}）`,
    `2) ${p.drink.name}（${p.drink.spec}）`,
    `3) ${p.antler.name}（${p.antler.spec}）`,
    `4) ${p.soup.name}（含龜鹿仙膠/二仙膠）`,
    "",
    "0) 回主選單",
  ].join("\n");
}

function priceMenuText() {
  const p = STORE.products;
  return [
    "【價格（單品報價）】請回覆數字：",
    `1) ${p.gel.name}`,
    `2) ${p.drink.name}`,
    `3) ${p.antler.name}`,
    `4) ${p.soup.name}`,
    "",
    "0) 回主選單",
  ].join("\n");
}

function buyMenuText() {
  return [
    "【購買方式】請回覆數字：",
    "1) 宅配到府",
    "2) 超商店到店",
    "3) 雙北親送（台北/新北）",
    "4) 到店購買/自取",
    "5) 先請真人協助",
    "",
    "也可以直接打：龜鹿膏2罐／龜鹿飲10包／湯塊半斤1份",
    "0) 回主選單",
  ].join("\n");
}

// ✅ 新：湯塊主選單（介紹/價格/規格）
function soupMenuText() {
  return [
    `【${STORE.products.soup.name}】請回覆數字：`,
    "1) 產品介紹/食用建議",
    "2) 查價格（選規格）",
    "3) 看規格（不報價）",
    "",
    "0) 回主選單",
  ].join("\n");
}

function soupVariantMenuText(contextTitle = "價格查詢") {
  const v = STORE.products.soup.variants;
  const v75 = v.find(x=>x.key==="soup75");
  const v150 = v.find(x=>x.key==="soup150");
  const v300 = v.find(x=>x.key==="soup300");
  const v600 = v.find(x=>x.key==="soup600");
  return [
    `【${STORE.products.soup.name}｜${contextTitle}】請回覆數字：`,
    `1) ${v75.label}（${v75.spec}）`,
    `2) ${v150.label}（${v150.spec}）`,
    `3) ${v300.label}（${v300.spec}）`,
    `4) ${v600.label}（${v600.spec}）`,
    "",
    "0) 回主選單",
  ].join("\n");
}

/** =========================
 * H) 規格/門市/介紹/價格（單品）
 * ========================= */
function specsAllText() {
  const p = STORE.products;
  return [
    "【容量／規格】",
    `▪️ ${p.gel.name}：${p.gel.spec}`,
    `▪️ ${p.drink.name}：${p.drink.spec}`,
    `▪️ ${p.antler.name}：${p.antler.spec}`,
    `▪️ ${p.soup.name}：2兩75g／4兩150g／半斤300g／一斤600g`,
  ].join("\n");
}

function storeInfoText() {
  return [
    "【門市資訊】",
    `店名：${STORE.brandName}`,
    `地址：${STORE.address}`,
    `地圖：${STORE.mapUrl}`,
    `電話：${STORE.phoneDisplay}`,
    "",
    "【營業/自取】",
    `▪️ ${STORE.hours.weekdays}`,
    `▪️ ${STORE.hours.pickupLate}`,
    `▪️ ${STORE.hours.weekendPickup}`,
    "",
    REPLY_TIME_LINE,
    `官網：${STORE.website}`,
  ].join("\n");
}

function detailsLinkLine() {
  return `更多產品介紹：${STORE.website}`;
}

function productIntroText(productKey) {
  const p = STORE.products;
  if (SETTINGS.detailsStyle === "linkOnly") return detailsLinkLine();

  if (productKey === "gel") {
    return [
      `【${p.gel.name}】`,
      `規格：${p.gel.spec}`,
      p.gel.noteDays,
      "",
      "食用建議：",
      `• ${p.gel.usage[0]}`,
      `• ${p.gel.usage[1]}`,
      "",
      USAGE_FOOTER,
      "",
      detailsLinkLine(),
    ].join("\n");
  }
  if (productKey === "drink") {
    return [
      `【${p.drink.name}】`,
      `規格：${p.drink.spec}`,
      "",
      "飲用建議：",
      `• ${p.drink.usage[0]}`,
      `• ${p.drink.usage[1]}`,
      "",
      USAGE_FOOTER,
      "",
      detailsLinkLine(),
    ].join("\n");
  }
  if (productKey === "antler") {
    return [
      `【${p.antler.name}】`,
      `規格：${p.antler.spec}`,
      "",
      "食用建議：",
      `• ${p.antler.usage[0]}`,
      `• ${p.antler.usage[1]}`,
      "",
      USAGE_FOOTER,
      "",
      detailsLinkLine(),
    ].join("\n");
  }
  // soup
  return [
    `【${p.soup.name}】`,
    p.soup.packagingNote ? `（${p.soup.packagingNote}）` : "",
    "規格：2兩75g／4兩150g／半斤300g／一斤600g",
    "",
    "食用建議：",
    ...p.soup.usage.map((x) => `• ${x}`),
    "",
    USAGE_FOOTER,
    "",
    detailsLinkLine(),
  ].filter(Boolean).join("\n");
}

function priceTextForProduct(productKey) {
  const p = STORE.products;
  const base = [];

  if (productKey === "gel") {
    const act = calcActivityPrice(p.gel.msrp, p.gel.discount);
    base.push(`【${p.gel.name}｜${p.gel.spec}】`);
    base.push(`建議售價 ${money(p.gel.msrp)}`);
    if (act && act !== p.gel.msrp) base.push(`目前活動價 ${money(act)}（建議售價9折）`);
  } else if (productKey === "drink") {
    const act = calcActivityPrice(p.drink.msrp, p.drink.discount);
    base.push(`【${p.drink.name}｜${p.drink.spec}】`);
    base.push(`建議售價 ${money(p.drink.msrp)}`);
    if (act && act !== p.drink.msrp) base.push(`目前活動價 ${money(act)}（建議售價9折）`);
  } else if (productKey === "antler") {
    const act = calcActivityPrice(p.antler.msrp, p.antler.discount);
    base.push(`【${p.antler.name}｜${p.antler.spec}】`);
    base.push(`建議售價 ${money(p.antler.msrp)}`);
    if (act && act !== p.antler.msrp) base.push(`目前活動價 ${money(act)}（建議售價9折）`);
  } else {
    return null; // soup 走湯塊選單
  }

  base.push("");
  base.push(PRICE_FOOTER);
  return base.join("\n");
}

function priceTextForSoupVariant(variantKey) {
  const s = STORE.products.soup;
  const v = s.variants.find((x) => x.key === variantKey);
  if (!v) return null;

  const act = calcActivityPrice(v.msrp, v.discount);
  const lines = [];
  lines.push(`【${s.name}｜${v.label}（${v.spec}）】`);
  lines.push(`建議售價 ${money(v.msrp)}`);
  if (act && act !== v.msrp) lines.push(`目前活動價 ${money(act)}（建議售價9折）`);
  lines.push("");
  lines.push(PRICE_FOOTER);
  return lines.join("\n");
}

function soupSpecsOnlyText() {
  const s = STORE.products.soup;
  return [
    `【${s.name}｜規格】`,
    "▪️ 2兩：75g",
    "▪️ 4兩：150g",
    "▪️ 半斤：300g",
    "▪️ 一斤：600g",
    s.packagingNote ? `\n（${s.packagingNote}）` : "",
    "\n（回 0 回主選單）",
  ].join("\n");
}

/** =========================
 * I) 敏感問題導流
 * ========================= */
function sensitiveText() {
  return [
    "※ 因涉及個人體質與用藥安全，這類問題我不會在訊息中直接做判定，",
    "建議由中醫師一對一評估會更準確🙂",
    "",
    "這部分會因每個人的身體狀況不同，為了讓您得到更準確的說明與建議，",
    "建議先由合作的中醫師了解您的情況🙂",
    "",
    "✔ 專人一對一說明",
    "✔ 可詢問適不適合食用",
    "✔ 可詢問個人狀況與疑問",
    "",
    `➤ Line ID：${STORE.doctorLineId}`,
    "➤ 章無忌中醫師諮詢連結：",
    STORE.doctorLink,
  ].join("\n");
}

/** =========================
 * J) 不制式購買草稿（吸收，不鎖）
 * ========================= */
const ORDER_INTENT_WORDS = ["我要", "我想買", "想買", "訂購", "下單", "購買", "要買", "訂", "買"];
function looksLikeOrder(rawText) {
  return /([0-9]{1,3}|一|二|兩|三|四|五|六|七|八|九|十)\s*(罐|包|盒|組|份|個)/.test(rawText)
    || ORDER_INTENT_WORDS.some((w) => rawText.includes(w));
}
function parseItemsForDraft(rawText) {
  const raw = String(rawText || "");
  if (!looksLikeOrder(raw) && !includesAny(raw, ["龜鹿膏", "龜鹿飲", "鹿茸粉", "湯塊", "龜鹿仙膠", "二仙膠", "龜鹿膠"])) return [];

  const items = [];
  const qtyMatch = normalizeText(raw).match(/([0-9]{1,3}|一|二|兩|三|四|五|六|七|八|九|十)\s*(罐|包|份|個|盒|組)/);
  const qty = qtyMatch
    ? (Number.isFinite(parseInt(qtyMatch[1], 10)) ? parseInt(qtyMatch[1], 10) : ({ 一: 1, 二: 2, 兩: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10 }[qtyMatch[1]] || 1))
    : 1;

  if (includesAny(raw, ["龜鹿膏"])) items.push({ key: "gel", name: STORE.products.gel.name, qty, unit: "罐" });
  if (includesAny(raw, ["龜鹿飲"])) items.push({ key: "drink", name: STORE.products.drink.name, qty, unit: "包" });
  if (includesAny(raw, ["鹿茸粉"])) items.push({ key: "antler", name: STORE.products.antler.name, qty, unit: "罐" });
  if (includesAny(raw, ["湯塊", "龜鹿仙膠", "龜鹿二仙膠", "二仙膠", "龜鹿膠"])) items.push({ key: "soup", name: STORE.products.soup.name, qty, unit: "份" });

  return items;
}
function mergeItems(baseItems, newItems) {
  const map = new Map((baseItems || []).map((x) => [x.key, x]));
  for (const it of newItems || []) {
    if (!map.has(it.key)) map.set(it.key, it);
    else {
      const prev = map.get(it.key);
      prev.qty += it.qty;
      map.set(it.key, prev);
    }
  }
  return Array.from(map.values());
}
function detectMethodFromDigit(text) {
  const t = normalizeText(text);
  if (t === "1") return "home";
  if (t === "2") return "c2c";
  if (t === "3") return "d2d";
  if (t === "4") return "store";
  if (t === "5") return "handoff";
  return null;
}
function methodLabel(m) {
  if (m === "home") return "宅配到府";
  if (m === "c2c") return "超商店到店";
  if (m === "d2d") return "雙北親送";
  if (m === "store") return "到店購買/自取";
  return "";
}
function summarizeDraft(draft) {
  const lines = [];
  for (const it of draft.items || []) lines.push(`▪️ ${it.name} × ${it.qty} ${it.unit}`);
  return lines.join("\n");
}
function draftNeeds(draft) {
  if (!draft.active) return { need: null };
  if (!draft.items || draft.items.length === 0) return { need: "items" };
  if (!draft.method) return { need: "method" };

  if (draft.method === "home") {
    if (!draft.ship?.address) return { need: "address" };
    return { need: null };
  }
  if (draft.method === "c2c") {
    if (!draft.ship?.store) return { need: "store" };
    return { need: null };
  }
  if (draft.method === "d2d") {
    if (!draft.ship?.address) return { need: "address" };
    const city = getCityFromAddressLoose(draft.ship.address);
    if (city && city !== "台北" && city !== "新北") return { need: "d2dNotInRange", city };
    return { need: null };
  }
  if (draft.method === "store") return { need: null };

  return { need: null };
}
function buildDraftReply(userId) {
  const user = ensureUser(userId);
  const d = user.draft;

  const head = [];
  if (d.items && d.items.length) {
    head.push("我先幫您記下來～🙂");
    head.push(summarizeDraft(d));
  }

  const need = draftNeeds(d);
  if (!need.need) {
    const extra = [];
    if (d.method === "d2d") extra.push(D2D_NOTE);
    else extra.push(ETA_LINE);

    return stableJoinParts([
      head.join("\n"),
      d.method ? `了解～您選的是「${methodLabel(d.method)}」🙂\n我接著會把運費/到貨/付款資訊整理給您。` : "了解～🙂",
      extra.join("\n"),
      ORDER_TERMS,
      "（若想直接找真人，回 6）",
    ]);
  }

  if (need.need === "items") {
    return stableJoinParts([
      head.join("\n"),
      "您想買哪個品項、幾份呢？（例：龜鹿膏2罐／龜鹿飲10包／湯塊半斤1份）",
    ]);
  }

  if (need.need === "method") return stableJoinParts([head.join("\n"), buyMenuText()]);

  if (need.need === "address") {
    if (d.method === "d2d") {
      return stableJoinParts([
        head.join("\n"),
        "好的～雙北親送🙂 麻煩貼一下地址，我先確認是否在配送範圍與可安排的時段～",
        D2D_NOTE,
        PRIVACY_LINE,
      ]);
    }
    return stableJoinParts([
      head.join("\n"),
      "好的～麻煩您貼一下收件地址🙂",
      ETA_LINE,
      PRIVACY_LINE,
    ]);
  }

  if (need.need === "store") {
    return stableJoinParts([
      head.join("\n"),
      "好～店到店🙂 麻煩回我「超商品牌＋門市」就行（例：7-11 西昌門市）",
      ETA_LINE,
      PRIVACY_LINE,
    ]);
  }

  if (need.need === "d2dNotInRange") {
    return stableJoinParts([
      head.join("\n"),
      `我看地址是「${need.city || "非雙北"}」～雙北親送目前只限台北/新北🙂`,
      "我可以幫您改成：1) 宅配到府  2) 超商店到店",
      "回 1 或 2 就可以～",
    ]);
  }

  return head.join("\n");
}

// ✅ 吸收草稿：只有選了購買方式才吸收地址/門市（避免誤判聊天地名）
function absorbDraft(userId, rawText) {
  const raw = String(rawText || "");
  const user = ensureUser(userId);
  if (isDraftExpired(user.draft)) resetDraft(userId);

  // 吸收品項（不管有沒有選方式都可先記）
  const items = parseItemsForDraft(rawText);
  if (items.length) {
    updateUser(userId, (u) => {
      u.draft.active = true;
      u.draft.items = mergeItems(u.draft.items || [], items);
      u.draft.updatedAt = nowMs();
    });
  }

  const d = ensureUser(userId).draft;
  // 未選方式：不吸收地址/門市
  if (!d.active || !d.method) return;

  // 已選方式才吸收
  if ((d.method === "home" || d.method === "d2d") && isLikelyAddress(rawText)) {
    updateUser(userId, (u) => {
      u.draft.ship = u.draft.ship || {};
      u.draft.ship.address = String(rawText).trim();
      u.draft.updatedAt = nowMs();
    });
  } else if (d.method === "c2c") {
    const t = normalizeText(rawText);
    if (t.length >= 4) {
      updateUser(userId, (u) => {
        u.draft.ship = u.draft.ship || {};
        u.draft.ship.store = String(rawText).trim();
        u.draft.updatedAt = nowMs();
      });
    }
  }
}

/** =========================
 * K) 意圖偵測（關鍵字仍保留）
 * ========================= */
const INTENT = {
  handoff: ["真人回覆", "真人", "轉真人", "人工", "人工客服", "專人回覆", "有人回覆", "找人"],
  product: ["產品名", "產品", "商品", "品項", "清單"],
  specs: ["容量", "規格", "重量", "幾克", "公克", "克", "幾cc", "毫升", "ml"],
  pricing: ["價格", "價錢", "售價", "多少錢", "報價"],
  buy: ["購買方式", "怎麼買", "購買", "下單", "訂購", "訂"],
  store: ["門市", "地址", "在哪", "地圖", "電話", "聯絡", "營業時間", "幾點"],
  website: ["官網", "網站", "網址", "連結"],
  cancel: ["取消", "不用了", "先不要", "算了"],
  sensitive: [
    "孕婦","懷孕","備孕","哺乳",
    "慢性病","三高","高血壓","糖尿病","洗腎",
    "癌","癌症","化療","放療","術後",
    "用藥","抗凝血",
    "能不能吃","可以吃嗎","適不適合","副作用","禁忌"
  ],
  gel: ["龜鹿膏"],
  drink: ["龜鹿飲"],
  antler: ["鹿茸粉"],
  soup: ["龜鹿湯塊", "湯塊", "龜鹿仙膠", "龜鹿二仙膠", "二仙膠", "龜鹿膠"],
};

function detectProductKey(raw) {
  if (includesAny(raw, INTENT.gel)) return "gel";
  if (includesAny(raw, INTENT.drink)) return "drink";
  if (includesAny(raw, INTENT.antler)) return "antler";
  if (includesAny(raw, INTENT.soup)) return "soup";
  return null;
}
function detectSensitive(raw) { return includesAny(raw, INTENT.sensitive); }
function detectPricingIntent(raw) { return includesAny(raw, INTENT.pricing); }

/** =========================
 * L) 24h 追蹤（可保留）
 * ========================= */
async function scanAndSendFollowups() {
  const users = loadUsers();
  const now = nowMs();
  const dueMs = 24 * 60 * 60 * 1000;
  let changed = false;

  for (const [userId, u] of Object.entries(users)) {
    if (!u || !u.followedAt) continue;
    if (u.followupSent) continue;
    if (now - u.followedAt < dueMs) continue;

    try {
      await client.pushMessage(userId, textMessage("您好🙂 想看選單回 0\n或直接回：1產品 2容量 3價格 4購買 5門市 6真人 7官網", "main"));
      users[userId].followupSent = true;
      users[userId].followupSentAt = nowMs();
      changed = true;
    } catch (err) {
      console.error("24h 推播失敗：", userId, err?.message || err);
    }
  }
  if (changed) saveUsers(users);
}
cron.schedule("*/10 * * * *", () => scanAndSendFollowups().catch(() => {}));

/** =========================
 * M) Webhook
 * ========================= */
app.get("/", (req, res) => res.status(200).send("OK"));

app.post("/webhook", line.middleware(config), async (req, res) => {
  try {
    const events = req.body.events || [];
    await Promise.all(events.map(handleEvent));
    res.status(200).end();
  } catch (err) {
    console.error("Webhook error:", err);
    res.status(500).end();
  }
});

async function handleEvent(event) {
  // follow：歡迎訊息 + 設定初始狀態
  if (event.type === "follow") {
    const userId = event.source && event.source.userId;
    if (userId) {
      const users = loadUsers();
      users[userId] = users[userId] || {};
      users[userId].followedAt = users[userId].followedAt || nowMs();
      users[userId].followupSent = users[userId].followupSent || false;
      saveUsers(users);
      ensureUser(userId);
      updateUser(userId, (u) => { u.state.menu = "main"; });
    }
    return client.replyMessage(event.replyToken, textMessage(mainMenuText(), "main"));
  }

  if (event.type !== "message") return null;
  if (!event.message || event.message.type !== "text") return null;

  const userId = event.source && event.source.userId;
  const userTextRaw = event.message.text || "";
  const raw = normalizeText(userTextRaw);

  if (!userId) return client.replyMessage(event.replyToken, textMessage(mainMenuText(), "main"));
  ensureUser(userId);

  // 管理員指令
  if (isAdmin(userId)) {
    const adminReply = handleAdminCommand(userTextRaw);
    if (adminReply) return client.replyMessage(event.replyToken, { type: "text", text: clampText(adminReply) });
  }

  // 草稿過期自動清掉
  const user = ensureUser(userId);
  if (isDraftExpired(user.draft)) resetDraft(userId);

  // 0：回主選單（任何時候有效）
  if (raw === "0") {
    updateUser(userId, (u) => { u.state.menu = "main"; });
    return client.replyMessage(event.replyToken, textMessage(mainMenuText(), "main"));
  }

  // 敏感問題優先
  if (detectSensitive(raw)) return client.replyMessage(event.replyToken, textMessage(sensitiveText(), "sub"));

  // 真人回覆（任何時候有效）
  if (raw === "6" || includesAny(raw, INTENT.handoff)) {
    await createHandoffCase({ userId, lastMessage: userTextRaw });
    return client.replyMessage(
      event.replyToken,
      textMessage(
        [
          "好的🙂 我先幫您轉給真人同事處理。",
          "您方便留：想了解什麼 / 想買的品項＋數量 / 想用哪種購買方式（宅配/店到店/親送/到店）",
          "",
          REPLY_TIME_LINE,
        ].join("\n"),
        "sub"
      )
    );
  }

  // 解析產品關鍵字（不怕長輩直接打字）
  const pk = detectProductKey(raw);
  if (pk) updateUser(userId, (u) => { u.state.lastProductKey = pk; });

  // 主選單數字
  if (raw === "1") {
    updateUser(userId, (u) => { u.state.menu = "product"; });
    return client.replyMessage(event.replyToken, textMessage(productMenuText(), "sub"));
  }
  if (raw === "2") {
    updateUser(userId, (u) => { u.state.menu = "main"; });
    return client.replyMessage(event.replyToken, textMessage(specsAllText() + "\n\n（回 0 回主選單）", "sub"));
  }
  if (raw === "3") {
    updateUser(userId, (u) => { u.state.menu = "price"; });
    return client.replyMessage(event.replyToken, textMessage(priceMenuText(), "sub"));
  }
  if (raw === "4") {
    updateUser(userId, (u) => { u.state.menu = "buy"; });
    touchDraft(userId);
    return client.replyMessage(event.replyToken, textMessage(buyMenuText(), "sub"));
  }
  if (raw === "5") {
    updateUser(userId, (u) => { u.state.menu = "main"; });
    return client.replyMessage(event.replyToken, textMessage(storeInfoText(), "sub"));
  }
  if (raw === "7") {
    updateUser(userId, (u) => { u.state.menu = "main"; });
    return client.replyMessage(event.replyToken, textMessage(`官網：${STORE.website}\n（官網以產品介紹為主，價格請以官方LINE回覆為準🙂）`, "sub"));
  }

  // 關鍵字導覽（不依賴數字）
  if (includesAny(raw, INTENT.product)) {
    updateUser(userId, (u) => { u.state.menu = "product"; });
    return client.replyMessage(event.replyToken, textMessage(productMenuText(), "sub"));
  }
  if (includesAny(raw, INTENT.specs)) {
    return client.replyMessage(event.replyToken, textMessage(specsAllText() + "\n\n（回 0 回主選單）", "sub"));
  }
  if (includesAny(raw, INTENT.pricing)) {
    updateUser(userId, (u) => { u.state.menu = "price"; });
    return client.replyMessage(event.replyToken, textMessage(priceMenuText(), "sub"));
  }
  if (includesAny(raw, INTENT.buy)) {
    updateUser(userId, (u) => { u.state.menu = "buy"; });
    touchDraft(userId);
    return client.replyMessage(event.replyToken, textMessage(buyMenuText(), "sub"));
  }
  if (includesAny(raw, INTENT.store)) {
    return client.replyMessage(event.replyToken, textMessage(storeInfoText(), "sub"));
  }
  if (includesAny(raw, INTENT.website)) {
    return client.replyMessage(event.replyToken, textMessage(`官網：${STORE.website}`, "sub"));
  }

  // 取消草稿
  if (includesAny(raw, INTENT.cancel)) {
    resetDraft(userId);
    return client.replyMessage(event.replyToken, textMessage("好的～我先把這筆購買草稿清掉🙂 想買或想看資訊，回 0 叫出選單就可以。", "sub"));
  }

  // ====== 子選單：產品選單 ======
  const state = ensureUser(userId).state;

  if (state.menu === "product") {
    if (raw === "1") return client.replyMessage(event.replyToken, textMessage(productIntroText("gel"), "sub"));
    if (raw === "2") return client.replyMessage(event.replyToken, textMessage(productIntroText("drink"), "sub"));
    if (raw === "3") return client.replyMessage(event.replyToken, textMessage(productIntroText("antler"), "sub"));

    // ✅ 湯塊改成「湯塊主選單」
    if (raw === "4") {
      updateUser(userId, (u) => { u.state.menu = "soup_menu"; });
      return client.replyMessage(event.replyToken, textMessage(soupMenuText(), "sub"));
    }

    // 產品選單內打到產品關鍵字也OK
    if (pk) {
      if (pk === "soup") {
        updateUser(userId, (u) => { u.state.menu = "soup_menu"; });
        return client.replyMessage(event.replyToken, textMessage(soupMenuText(), "sub"));
      }
      return client.replyMessage(event.replyToken, textMessage(productIntroText(pk), "sub"));
    }

    return client.replyMessage(event.replyToken, textMessage("我有收到🙂\n請回覆 1～4 選產品，或回 0 回主選單。", "sub"));
  }

  // ====== 子選單：湯塊主選單（介紹/價格/規格） ======
  if (state.menu === "soup_menu") {
    if (raw === "1") return client.replyMessage(event.replyToken, textMessage(productIntroText("soup"), "sub"));
    if (raw === "2") {
      updateUser(userId, (u) => { u.state.menu = "soup_variant"; });
      return client.replyMessage(event.replyToken, textMessage(soupVariantMenuText("價格查詢"), "sub"));
    }
    if (raw === "3") return client.replyMessage(event.replyToken, textMessage(soupSpecsOnlyText(), "sub"));
    return client.replyMessage(event.replyToken, textMessage("請回覆 1～3 選擇湯塊內容，或回 0 回主選單。", "sub"));
  }

  // ====== 子選單：價格選單（單品） ======
  if (state.menu === "price") {
    if (raw === "1") return client.replyMessage(event.replyToken, textMessage(priceTextForProduct("gel"), "sub"));
    if (raw === "2") return client.replyMessage(event.replyToken, textMessage(priceTextForProduct("drink"), "sub"));
    if (raw === "3") return client.replyMessage(event.replyToken, textMessage(priceTextForProduct("antler"), "sub"));

    // 湯塊價格 -> 直接進湯塊規格價格
    if (raw === "4") {
      updateUser(userId, (u) => { u.state.menu = "soup_variant"; });
      return client.replyMessage(event.replyToken, textMessage(soupVariantMenuText("價格查詢"), "sub"));
    }

    // 價格選單內若打產品名：直接回該品項價格（湯塊->規格）
    if (pk) {
      if (pk === "soup") {
        updateUser(userId, (u) => { u.state.menu = "soup_variant"; });
        return client.replyMessage(event.replyToken, textMessage(soupVariantMenuText("價格查詢"), "sub"));
      }
      const msg = priceTextForProduct(pk);
      if (msg) return client.replyMessage(event.replyToken, textMessage(msg, "sub"));
    }

    return client.replyMessage(event.replyToken, textMessage("請回覆 1～4 選擇要查的品項，或回 0 回主選單。", "sub"));
  }

  // ====== 子選單：湯塊規格（價格查詢） ======
  if (state.menu === "soup_variant") {
    if (raw === "1") return client.replyMessage(event.replyToken, textMessage(priceTextForSoupVariant("soup75"), "sub"));
    if (raw === "2") return client.replyMessage(event.replyToken, textMessage(priceTextForSoupVariant("soup150"), "sub"));
    if (raw === "3") return client.replyMessage(event.replyToken, textMessage(priceTextForSoupVariant("soup300"), "sub"));
    if (raw === "4") return client.replyMessage(event.replyToken, textMessage(priceTextForSoupVariant("soup600"), "sub"));
    return client.replyMessage(event.replyToken, textMessage("請回覆 1～4 選擇湯塊規格，或回 0 回主選單。", "sub"));
  }

  // ====== 子選單：購買方式（不制式） ======
  if (state.menu === "buy") {
    const method = detectMethodFromDigit(raw);
    if (method === "handoff") {
      await createHandoffCase({ userId, lastMessage: `購買方式選單：想請真人協助｜${userTextRaw}` });
      return client.replyMessage(event.replyToken, textMessage(`好的🙂 我先幫您轉真人同事協助購買。\n您可以先留：想買的品項＋數量＋想用的方式（宅配/店到店/親送/到店）\n\n${REPLY_TIME_LINE}`, "sub"));
    }
    if (method) {
      touchDraft(userId);
      updateUser(userId, (u) => { u.draft.method = method; u.draft.active = true; u.draft.updatedAt = nowMs(); });

      const label = methodLabel(method);
      const extra = (method === "d2d") ? ("\n\n" + D2D_NOTE) : ("\n\n" + ETA_LINE);

      return client.replyMessage(
        event.replyToken,
        textMessage(
          `了解～您選的是「${label}」🙂\n您想買哪個品項、幾份呢？（例：龜鹿膏2罐／龜鹿飲10包／湯塊半斤1份）${extra}\n\n（回 0 回主選單）`,
          "sub"
        )
      );
    }

    // 沒按數字但直接輸入品項/地址/門市 → 吸收草稿並回提示
    absorbDraft(userId, userTextRaw);
    const reply = buildDraftReply(userId);
    return client.replyMessage(event.replyToken, textMessage(reply, "sub"));
  }

  // ====== 一般聊天：若有購買草稿，吸收並回覆 ======
  absorbDraft(userId, userTextRaw);
  const updated = ensureUser(userId);

  if (updated.draft && updated.draft.active) {
    const reply = buildDraftReply(userId);
    return client.replyMessage(event.replyToken, textMessage(reply, "sub"));
  }

  // 若客人直接問「湯塊/仙膠」且有價格意圖 -> 進湯塊規格價格；否則進湯塊主選單
  if (pk === "soup") {
    if (detectPricingIntent(raw)) {
      updateUser(userId, (u) => { u.state.menu = "soup_variant"; });
      return client.replyMessage(event.replyToken, textMessage(soupVariantMenuText("價格查詢"), "sub"));
    }
    updateUser(userId, (u) => { u.state.menu = "soup_menu"; });
    return client.replyMessage(event.replyToken, textMessage(soupMenuText(), "sub"));
  }

  // 最後 fallback：給主選單
  return client.replyMessage(event.replyToken, textMessage("我有收到🙂\n回 0 叫出主選單，或直接回：1產品 2容量 3價格 4購買 5門市 6真人 7官網", "main"));
}

app.listen(PORT, () => console.log(`LINE bot webhook listening on port ${PORT}`));
