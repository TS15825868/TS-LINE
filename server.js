"use strict";

/**
 * 仙加味・龜鹿 LINE Bot（整包替換版｜方案C：不制式購買＋草稿30分鐘＋真人回覆管理）
 *
 * ✅ 新增：真人回覆管理
 * - 客人觸發「真人回覆」→ 立即 push 通知管理員（ADMIN_USER_IDS）
 * - 案件落地存到 data/handoffs.json（open/closed + note）
 * - 管理員可在與 bot 對話用指令管理：
 *   - handoff list
 *   - handoff show <id>
 *   - handoff close <id>
 *   - handoff note <id> <text>
 */

const express = require("express");
const line = require("@line/bot-sdk");
const fs = require("fs");
const path = require("path");
const cron = require("node-cron");

const { CHANNEL_ACCESS_TOKEN, CHANNEL_SECRET, PORT = 3000, ADMIN_USER_IDS = "" } = process.env;

if (!CHANNEL_ACCESS_TOKEN || !CHANNEL_SECRET) {
  console.error("缺少環境變數：CHANNEL_ACCESS_TOKEN 或 CHANNEL_SECRET");
  process.exit(1);
}

const config = { channelAccessToken: CHANNEL_ACCESS_TOKEN, channelSecret: CHANNEL_SECRET };
const app = express();
const client = new line.Client(config);

const ADMIN_IDS = ADMIN_USER_IDS.split(",").map(s => s.trim()).filter(Boolean);

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

  doctorLineId: "@changwuchi",
  doctorLink: "https://lin.ee/1MK4NR9",

  products: {
    gel: {
      name: "龜鹿膏",
      spec: "100g/罐",
      priceList: 1800,
      activityDiscount: 0.9,
      usage: [
        "建議早上或空腹前後食用",
        "一天一次，一小匙（初次可先半匙）",
        "可用熱水化開後搭配溫水，或直接食用",
        "食用期間避免冰飲",
      ],
      noteDays: "依每個人食用習慣不同，一罐大約可吃10天～半個月左右。",
    },

    drink: {
      name: "龜鹿飲",
      spec: "180cc/包",
      priceList: 200,
      activityDiscount: 0.9,
      usage: [
        "每日一包",
        "可隔水加熱或溫熱飲用",
        "建議早上或白天飲用",
        "飲用期間避免冰飲",
      ],
    },

    antler: {
      name: "鹿茸粉",
      spec: "75g/罐",
      priceList: 2000,
      activityDiscount: 0.9,
      usage: [
        "一般建議：先從小量開始，搭配溫水或飲品",
        "若容易上火、睡不好或口乾，建議減量或間隔食用",
      ],
    },

    soup: {
      name: "龜鹿湯塊(膠)",
      variants: [
        { key: "soup600", label: "一斤", spec: "600g", priceList: 8000, activityDiscount: 0.9 },
        { key: "soup300", label: "半斤", spec: "300g", priceList: 4000, activityDiscount: 0.9 },
        { key: "soup150", label: "4兩", spec: "150g", priceList: 2000, activityDiscount: null }, // ✅ 4兩不打折
      ],
      usage: [
        "依個人口味加水煮滾，可搭配肉類/食材燉煮",
        "建議熱飲熱食，避免冰冷搭配",
      ],
      packagingNote: "目前為傳統盒裝（新包裝仍在規劃中）。",
    },
  },

  shippingNote:
    "可安排宅配／超商店到店／雙北親送（台北/新北）／到店購買。運費與到貨時間會依地區與方式確認後回覆您。",
  paymentNote:
    "付款方式會依訂單確認後提供（例如轉帳等）。我整理好後會一次回覆給您🙂",
  testingNote:
    "可提供基本資訊（依批次/包裝標示為準）。如需更完整資料，歡迎留言，我整理後回覆您。",
};

const SETTINGS = {
  draftTtlMs: 30 * 60 * 1000,
  replyDedupMs: 12 * 1000,
  detailsStyle: "hybrid", // "hybrid" or "linkOnly"
};

/** =========================
 * B) 工具
 * ========================= */
function money(n) {
  const s = String(Math.round(Number(n))).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `$${s}`;
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
function safeInt(x) {
  const n = parseInt(String(x), 10);
  return Number.isFinite(n) ? n : null;
}
function cnNumToInt(token) {
  const map = { "一": 1, "二": 2, "兩": 2, "三": 3, "四": 4, "五": 5, "六": 6, "七": 7, "八": 8, "九": 9, "十": 10 };
  return map[token] ?? null;
}
function clampText(s, max = 4000) {
  const t = String(s || "");
  return t.length <= max ? t : t.slice(0, max - 3) + "...";
}
function nowMs() { return Date.now(); }

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
  if (raw.includes("新竹")) return "新竹";
  if (raw.includes("基隆")) return "基隆";
  if (raw.includes("苗栗")) return "苗栗";
  if (raw.includes("彰化")) return "彰化";
  if (raw.includes("南投")) return "南投";
  if (raw.includes("雲林")) return "雲林";
  if (raw.includes("嘉義")) return "嘉義";
  if (raw.includes("屏東")) return "屏東";
  if (raw.includes("宜蘭")) return "宜蘭";
  if (raw.includes("花蓮")) return "花蓮";
  if (raw.includes("台東") || raw.includes("臺東")) return "台東";
  if (raw.includes("澎湖")) return "澎湖";
  if (raw.includes("金門")) return "金門";
  if (raw.includes("馬祖")) return "馬祖";
  return null;
}

function calcActivityPrice(priceList, discount) {
  if (!discount || typeof discount !== "number") return null;
  return Math.round(priceList * discount);
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
  const clean = uniqNonEmpty(parts).map(p => String(p).trim());
  return clean.join("\n\n——\n\n");
}

/** =========================
 * C) Quick Replies
 * ========================= */
function quickRepliesCommon() {
  return {
    items: [
      { type: "action", action: { type: "message", label: "諮詢", text: "諮詢" } },
      { type: "action", action: { type: "message", label: "產品名", text: "產品名" } },
      { type: "action", action: { type: "message", label: "容量", text: "容量" } },
      { type: "action", action: { type: "message", label: "湯塊價格", text: "湯塊價格" } },
      { type: "action", action: { type: "message", label: "購買方式", text: "購買方式" } },
      { type: "action", action: { type: "message", label: "真人回覆", text: "真人回覆" } },
      { type: "action", action: { type: "message", label: "門市", text: "門市資訊" } },
      { type: "action", action: { type: "uri", label: "官網", uri: STORE.website } },
      { type: "action", action: { type: "uri", label: "來電", uri: `tel:${STORE.phoneTel}` } },
    ],
  };
}
function textMessage(text) {
  return { type: "text", text: clampText(text), quickReply: quickRepliesCommon() };
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
    lastProductKey: null,
    lastSeenAt: nowMs(),
    lastReplyHash: null,
    lastReplyAt: 0,
    variantIdx: {},
  };
  users[userId].draft = users[userId].draft || {
    active: false,
    method: null,
    items: [],
    contact: { name: null, phone: null },
    ship: { address: null, store: null },
    notes: null,
    updatedAt: 0,
  };
  users[userId].handoff = users[userId].handoff || {
    requested: false,
    requestedAt: 0,
    note: null,
    lastHandoffId: null,
  };
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
    u.draft = {
      active: false,
      method: null,
      items: [],
      contact: { name: null, phone: null },
      ship: { address: null, store: null },
      notes: null,
      updatedAt: 0,
    };
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
  const t = draft.updatedAt || 0;
  return nowMs() - t > SETTINGS.draftTtlMs;
}

/** =========================
 * E) 真人回覆管理：建立案件 + 通知管理員
 * ========================= */
function makeHandoffId() {
  // 短ID：時間後 5 碼
  const base = nowMs().toString(36);
  const rand = Math.random().toString(36).slice(2, 7);
  return `${base}${rand}`.slice(-12);
}
async function getProfileSafe(userId) {
  try {
    return await client.getProfile(userId); // {displayName, userId, pictureUrl, statusMessage}
  } catch {
    return null;
  }
}
async function notifyAdmins(text) {
  if (!ADMIN_IDS.length) return;
  await Promise.all(
    ADMIN_IDS.map(async (aid) => {
      try { await client.pushMessage(aid, { type: "text", text: clampText(text) }); }
      catch (e) { console.error("通知管理員失敗：", aid, e?.message || e); }
    })
  );
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
  h.list.unshift(record); // 最新在最上
  saveHandoffs(h);

  updateUser(userId, (u) => {
    u.handoff.requested = true;
    u.handoff.requestedAt = nowMs();
    u.handoff.note = lastMessage;
    u.handoff.lastHandoffId = id;
  });

  const adminText = [
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
  ].join("\n");

  await notifyAdmins(adminText);
  return record;
}

/** =========================
 * F) 文案
 * ========================= */
function pricingLine(name, spec, priceList, activityPrice) {
  if (activityPrice && activityPrice !== priceList) {
    return `▪️ ${name}（${spec}）：目前活動價 ${money(activityPrice)}（售價 ${money(priceList)}）`;
  }
  return `▪️ ${name}（${spec}）：售價 ${money(priceList)}`;
}
function soupPriceAll() {
  const p = STORE.products.soup;
  const lines = ["【龜鹿湯塊(膠)｜規格與價格】", p.packagingNote ? `（${p.packagingNote}）` : "", ""].filter(Boolean);

  for (const v of p.variants) {
    const act = calcActivityPrice(v.priceList, v.activityDiscount);
    lines.push(`${v.label}（${v.spec}）`);
    if (act && act !== v.priceList) lines.push(`目前活動價 ${money(act)}（售價 ${money(v.priceList)}）`);
    else lines.push(`售價 ${money(v.priceList)}`);
    lines.push("");
  }
  while (lines.length && lines[lines.length - 1] === "") lines.pop();
  return lines.join("\n");
}
function storeInfo() {
  return [
    "【門市資訊】",
    `店名：${STORE.brandName}`,
    `地址：${STORE.address}`,
    `地圖：${STORE.mapUrl}`,
    `電話：${STORE.phoneDisplay}`,
    `官網：${STORE.website}`,
  ].join("\n");
}
function detailsLinkLine() {
  return `更多產品介紹／成分／食用方式：${STORE.website}`;
}
function productIntroReply(productKey) {
  const p = STORE.products;
  if (SETTINGS.detailsStyle === "linkOnly") return detailsLinkLine();

  const lines = [];
  if (productKey === "gel") {
    const act = calcActivityPrice(p.gel.priceList, p.gel.activityDiscount);
    lines.push(`【${p.gel.name}】`);
    lines.push(pricingLine(p.gel.name, p.gel.spec, p.gel.priceList, act));
    lines.push(p.gel.noteDays);
    lines.push("食用建議：");
    lines.push(`• ${p.gel.usage[0]}`);
    lines.push(`• ${p.gel.usage[1]}`);
    lines.push("");
    lines.push(detailsLinkLine());
  } else if (productKey === "drink") {
    const act = calcActivityPrice(p.drink.priceList, p.drink.activityDiscount);
    lines.push(`【${p.drink.name}】`);
    lines.push(pricingLine(p.drink.name, p.drink.spec, p.drink.priceList, act));
    lines.push("飲用建議：");
    lines.push(`• ${p.drink.usage[0]}`);
    lines.push(`• ${p.drink.usage[1]}`);
    lines.push("");
    lines.push(detailsLinkLine());
  } else if (productKey === "antler") {
    const act = calcActivityPrice(p.antler.priceList, p.antler.activityDiscount);
    lines.push(`【${p.antler.name}】`);
    lines.push(pricingLine(p.antler.name, p.antler.spec, p.antler.priceList, act));
    lines.push("食用建議：");
    lines.push(`• ${p.antler.usage[0]}`);
    lines.push(`• ${p.antler.usage[1]}`);
    lines.push("");
    lines.push(detailsLinkLine());
  } else {
    lines.push(soupPriceAll());
    lines.push("");
    lines.push("食用建議：");
    for (const x of p.soup.usage) lines.push(`• ${x}`);
    lines.push("");
    lines.push(detailsLinkLine());
  }
  return lines.join("\n");
}

const TEXT = {
  welcome: [
    `您好，歡迎加入【${STORE.brandName}】🙂`,
    "",
    "我可以幫您：",
    "▪️ 看產品：回「產品名」",
    "▪️ 看規格：回「容量」",
    "▪️ 看湯塊規格：回「湯塊價格」",
    "▪️ 了解購買方式：回「購買方式」",
    "▪️ 需要真人：回「真人回覆」",
  ].join("\n"),

  purchaseMethods: [
    "【購買方式】您想用哪種比較方便？🙂",
    "1) 宅配到府",
    "2) 超商店到店",
    "3) 雙北親送（台北/新北）",
    "4) 到店購買",
    "",
    "也可以直接打：龜鹿膏2罐＋龜鹿飲10包 / 湯塊半斤1份",
  ].join("\n"),

  sensitive: [
    "這部分會因每個人的狀況不同，為了更精準，建議由合作中醫師協助您🙂",
    "",
    `➤ Line ID：${STORE.doctorLineId}`,
    "➤ 諮詢連結：",
    STORE.doctorLink,
  ].join("\n"),

  handoffToUser: [
    "好的🙂 我先幫您轉給真人同事處理。",
    "您方便留：想了解什麼 / 想買的品項＋數量",
    "如果也願意留電話／方便聯絡時間，我們會更快回覆您。",
  ].join("\n"),

  fallback: [
    "我有收到～🙂",
    "您想先看哪一個？",
    "▪️ 產品名｜容量｜湯塊價格｜購買方式｜真人回覆｜門市資訊",
  ].join("\n"),
};

/** =========================
 * G) 意圖
 * ========================= */
const INTENT = {
  handoff: ["真人回覆","真人","轉真人","人工","人工客服","請真人","專人回覆","有人回覆","人工回覆","找人"],
  productList: ["產品名","有哪些產品","有什麼產品","產品","商品","品項","清單","有哪些"],
  specs: ["容量","規格","幾克","幾g","g","公克","克","幾cc","cc","毫升","ml","重量"],
  buy: ["怎麼買","怎麼購買","下單","訂購","購買","我要買","訂","怎麼訂","購買方式","買法"],
  store: ["門市","店面","地址","在哪","位置","地圖","電話","聯絡"],
  website: ["官網","網站","網址","連結"],
  soupPrice: ["湯塊價格","湯塊","龜鹿湯塊","龜鹿膠","龜鹿仙膠","龜鹿二仙膠","二仙膠"],
  gel: ["龜鹿膏"],
  drink: ["龜鹿飲"],
  antler: ["鹿茸粉"],
  soup: ["龜鹿湯塊","湯塊","龜鹿膠","龜鹿仙膠","龜鹿二仙膠","二仙膠"],
  cancel: ["取消","不用了","先不要","改天","算了"],
  sensitive: [
    "孕婦","懷孕","備孕","哺乳",
    "慢性病","三高","高血壓","糖尿病","洗腎",
    "癌","癌症","化療","放療","術後",
    "用藥","抗凝血",
    "能不能吃","可以吃嗎","適不適合","副作用","禁忌"
  ],
};

function detectProductKey(raw) {
  if (includesAny(raw, INTENT.gel)) return "gel";
  if (includesAny(raw, INTENT.drink)) return "drink";
  if (includesAny(raw, INTENT.antler)) return "antler";
  if (includesAny(raw, INTENT.soup)) return "soup"; // ✅ 含「龜鹿仙膠」等
  return null;
}
function detectIntents(raw) {
  const intents = new Set();
  if (includesAny(raw, INTENT.sensitive)) intents.add("sensitive");
  if (includesAny(raw, INTENT.handoff)) intents.add("handoff");
  if (includesAny(raw, INTENT.cancel)) intents.add("cancel");
  if (includesAny(raw, INTENT.productList)) intents.add("productList");
  if (includesAny(raw, INTENT.specs)) intents.add("specs");
  if (includesAny(raw, INTENT.buy)) intents.add("buy");
  if (includesAny(raw, INTENT.store)) intents.add("store");
  if (includesAny(raw, INTENT.website)) intents.add("website");
  if (includesAny(raw, INTENT.soupPrice)) intents.add("soupPrice");
  return Array.from(intents);
}

/** =========================
 * H) 管理員指令（真人回覆清單）
 * ========================= */
function isAdmin(userId) {
  return ADMIN_IDS.includes(userId);
}
function handleAdminCommand(userId, textRaw) {
  const t = normalizeText(textRaw).toLowerCase();
  if (!t.startsWith("handoff")) return null;

  const h = loadHandoffs();
  const list = Array.isArray(h.list) ? h.list : [];

  // handoff list
  if (t === "handoff list") {
    const open = list.filter(x => x.status === "open").slice(0, 20);
    if (!open.length) return "目前沒有未結案的真人回覆案件🙂";
    const lines = ["【未結案（open）】"];
    for (const x of open) {
      lines.push(
        `- ${x.id}｜${x.displayName || "（未取到）"}｜${x.createdAt}`,
        `  最後一句：${(x.lastMessage || "").slice(0, 60)}`
      );
    }
    lines.push("", "指令：handoff show <id> / handoff close <id> / handoff note <id> <備註>");
    return lines.join("\n");
  }

  // handoff show <id>
  if (t.startsWith("handoff show ")) {
    const id = t.replace("handoff show ", "").trim();
    const x = list.find(r => r.id === id);
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

  // handoff close <id>
  if (t.startsWith("handoff close ")) {
    const id = t.replace("handoff close ", "").trim();
    const idx = list.findIndex(r => r.id === id);
    if (idx < 0) return `找不到案件ID：${id}`;
    if (list[idx].status === "closed") return `案件 ${id} 已經是 closed 了。`;
    list[idx].status = "closed";
    list[idx].closedAt = new Date().toISOString();
    saveHandoffs({ list });
    return `✅ 已結案：${id}`;
  }

  // handoff note <id> <text>
  if (t.startsWith("handoff note ")) {
    const rest = textRaw.trim().slice("handoff note ".length);
    const [id, ...noteParts] = rest.split(" ");
    const note = noteParts.join(" ").trim();
    if (!id || !note) return "用法：handoff note <案件ID> <備註文字>";
    const idx = list.findIndex(r => r.id === id);
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
 * I) 追蹤（保留）
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
      await client.pushMessage(userId, textMessage(`您好🙂 這裡是【${STORE.brandName}】\n想看清單回：產品名\n想看怎麼買回：購買方式\n需要真人回：真人回覆`));
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
 * J) Webhook
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
  // follow：歡迎訊息
  if (event.type === "follow") {
    const userId = event.source && event.source.userId;
    if (userId) {
      const users = loadUsers();
      users[userId] = users[userId] || {};
      users[userId].followedAt = users[userId].followedAt || nowMs();
      users[userId].followupSent = users[userId].followupSent || false;
      users[userId].state = users[userId].state || { lastProductKey: null, lastSeenAt: nowMs(), lastReplyHash: null, lastReplyAt: 0, variantIdx: {} };
      users[userId].draft = users[userId].draft || { active: false, method: null, items: [], contact: { name: null, phone: null }, ship: { address: null, store: null }, notes: null, updatedAt: 0 };
      users[userId].handoff = users[userId].handoff || { requested: false, requestedAt: 0, note: null, lastHandoffId: null };
      saveUsers(users);
    }
    return client.replyMessage(event.replyToken, textMessage(TEXT.welcome));
  }

  if (event.type !== "message") return null;
  if (!event.message || event.message.type !== "text") return null;

  const userId = event.source && event.source.userId;
  const userTextRaw = event.message.text || "";
  const raw = normalizeText(userTextRaw);

  // 管理員指令
  if (userId && isAdmin(userId)) {
    const adminReply = handleAdminCommand(userId, userTextRaw);
    if (adminReply) return client.replyMessage(event.replyToken, { type: "text", text: clampText(adminReply) });
  }

  if (!userId) return client.replyMessage(event.replyToken, textMessage(TEXT.fallback));
  ensureUser(userId);

  // 草稿過期自動重置
  const u = ensureUser(userId);
  if (isDraftExpired(u.draft)) resetDraft(userId);

  const intents = detectIntents(raw);

  // 取消（只清草稿）
  if (intents.includes("cancel")) {
    resetDraft(userId);
    return client.replyMessage(event.replyToken, textMessage("好的～我先把這筆購買草稿清掉🙂 之後想買或想看資訊，直接跟我說就可以。"));
  }

  // 敏感
  if (intents.includes("sensitive")) return client.replyMessage(event.replyToken, textMessage(TEXT.sensitive));

  // 真人回覆（✅ 建案件 + 通知管理員）
  if (intents.includes("handoff")) {
    await createHandoffCase({ userId, lastMessage: userTextRaw });
    return client.replyMessage(event.replyToken, textMessage(TEXT.handoffToUser));
  }

  // 資訊回覆（不做購買鎖流程）
  if (intents.includes("productList")) {
    const p = STORE.products;
    const msg = [
      "【產品清單】",
      `▪️ ${p.gel.name}（${p.gel.spec}）`,
      `▪️ ${p.drink.name}（${p.drink.spec}）`,
      `▪️ ${p.antler.name}（${p.antler.spec}）`,
      "▪️ 龜鹿湯塊(膠)（一斤600g／半斤300g／4兩150g）",
      "",
      "想看湯塊規格：回「湯塊價格」",
    ].join("\n");
    return client.replyMessage(event.replyToken, textMessage(msg));
  }

  if (intents.includes("specs")) {
    const p = STORE.products;
    const msg = [
      "【容量／規格】",
      `▪️ ${p.gel.name}：${p.gel.spec}`,
      `▪️ ${p.drink.name}：${p.drink.spec}`,
      `▪️ ${p.antler.name}：${p.antler.spec}`,
      "▪️ 龜鹿湯塊(膠)：一斤600g／半斤300g／4兩150g",
    ].join("\n");
    return client.replyMessage(event.replyToken, textMessage(msg));
  }

  if (intents.includes("soupPrice")) {
    return client.replyMessage(event.replyToken, textMessage(soupPriceAll()));
  }

  if (intents.includes("buy")) {
    return client.replyMessage(event.replyToken, textMessage(TEXT.purchaseMethods));
  }

  if (intents.includes("store")) {
    return client.replyMessage(event.replyToken, textMessage(storeInfo()));
  }

  if (intents.includes("website")) {
    return client.replyMessage(event.replyToken, textMessage(`官網：${STORE.website}`));
  }

  // 產品關鍵字（含「龜鹿仙膠」→ 湯塊）
  const pk = detectProductKey(raw);
  if (pk) {
    const reply = productIntroReply(pk === "soup" ? "soup" : pk);
    return client.replyMessage(event.replyToken, textMessage(reply));
  }

  // fallback
  return client.replyMessage(event.replyToken, textMessage(TEXT.fallback));
}

app.listen(PORT, () => console.log(`LINE bot webhook listening on port ${PORT}`));
