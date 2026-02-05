/**
 * LINE Bot Webhook - 仙加味・龜鹿（完整自動化）
 * 功能：
 * 1) 多意圖合併回覆（價格/容量/吃法/運送/付款/門市/官網/檢驗）
 * 2) 上下文連動（上一句提到產品，下一句只問「價格」也能對應）
 * 3) 訂單解析 + 缺欄位追問（寄送縣市→姓名→電話→地址→訂單確認）
 * 4) 敏感問題導流（章無忌中醫師）
 * 5) follow 歡迎 + 24h 追蹤推播（cron掃 users.json，不怕重啟）
 * 6) quick replies（價格/容量/怎麼買/門市/官網/來電）
 *
 * npm i express @line/bot-sdk node-cron
 *
 * ENV:
 *  - CHANNEL_ACCESS_TOKEN
 *  - CHANNEL_SECRET
 *  - PORT (optional)
 */

"use strict";

const express = require("express");
const line = require("@line/bot-sdk");
const fs = require("fs");
const path = require("path");
const cron = require("node-cron");

const { CHANNEL_ACCESS_TOKEN, CHANNEL_SECRET, PORT = 3000 } = process.env;
if (!CHANNEL_ACCESS_TOKEN || !CHANNEL_SECRET) {
  console.error("缺少環境變數：CHANNEL_ACCESS_TOKEN 或 CHANNEL_SECRET");
  process.exit(1);
}

const config = {
  channelAccessToken: CHANNEL_ACCESS_TOKEN,
  channelSecret: CHANNEL_SECRET,
};

const app = express();
const client = new line.Client(config);

/** =========================
 * A) 店家/產品資料（依你提供）
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
      priceOriginal: 1800,
      pricePromo: 1500,
      noteDays: "依每個人食用習慣不同，一罐大約可吃10天～半個月左右。",
      howTo: [
        "一般建議：先從小量、飯後開始（例如小湯匙量），連續觀察幾天；",
        "若本身容易上火、睡不好或口乾，建議減量或隔天吃。",
      ],
    },

    soup: {
      name: "龜鹿湯塊",
      variants: [
        { key: "soup600", label: "一斤", spec: "600公克", priceOriginal: 8000, pricePromo: 6000 },
        { key: "soup300", label: "半斤", spec: "300公克", priceOriginal: 4000, pricePromo: 3200 },
        { key: "soup150", label: "4兩", spec: "150公克", priceOriginal: 2000, pricePromo: 1600 },
      ],
      howTo: [
        "一般建議：依個人口味加水煮滾，可搭配肉類/食材燉煮；",
        "建議熱飲熱食，避免冰冷搭配。",
      ],
    },

    antler: {
      name: "鹿茸粉",
      spec: "二兩（75公克）/罐",
      priceOriginal: 2000,
      pricePromo: 1600,
      howTo: [
        "一般建議：先從小量開始，搭配溫水或飲品；",
        "若容易上火、睡不好或口乾，建議減量或間隔食用。",
      ],
    },

    drink: {
      name: "龜鹿飲",
      spec: "180cc/包",
      priceOriginal: 200,
      pricePromo: 160,
      howTo: [
        "一般建議：溫熱飲用（可隔水加熱），每日一包；",
        "飲用期間避免冰飲搭配。",
      ],
    },
  },

  testingNote:
    "目前我們可提供八大營養素等基本資訊（依批次/包裝標示為準）。如需更詳細資料，歡迎留言，我們整理後回覆您。",

  paymentNote:
    "付款方式可依訂單安排（如：轉帳等）。我整理好訂單後會一併提供付款資訊。",

  shippingNote:
    "可安排宅配/超商等方式（依地區與品項而定）。我收到寄送縣市後會提供運費與到貨時間預估。",
};

/** =========================
 * B) 工具
 * ========================= */
function money(n) {
  const s = String(Number(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
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

function quickRepliesCommon() {
  return {
    items: [
      { type: "action", action: { type: "message", label: "價格", text: "價格" } },
      { type: "action", action: { type: "message", label: "容量", text: "容量" } },
      { type: "action", action: { type: "message", label: "怎麼買", text: "怎麼買" } },
      { type: "action", action: { type: "message", label: "門市", text: "門市資訊" } },
      { type: "action", action: { type: "uri", label: "官網", uri: STORE.website } },
      { type: "action", action: { type: "uri", label: "來電", uri: `tel:${STORE.phoneTel}` } },
    ],
  };
}

function textMessage(text) {
  return { type: "text", text, quickReply: quickRepliesCommon() };
}

/** =========================
 * C) users.json（持久化：追蹤 + 上下文 + 訂單流程）
 * ========================= */
const DATA_DIR = path.join(__dirname, "data");
const USERS_FILE = path.join(DATA_DIR, "users.json");

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

function loadUsers() {
  try {
    if (!fs.existsSync(USERS_FILE)) return {};
    const raw = fs.readFileSync(USERS_FILE, "utf8");
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    console.error("讀取 users.json 失敗：", e);
    return {};
  }
}

function saveUsers(users) {
  try {
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), "utf8");
  } catch (e) {
    console.error("寫入 users.json 失敗：", e);
  }
}

function ensureUser(userId) {
  const users = loadUsers();
  users[userId] = users[userId] || {};
  users[userId].state = users[userId].state || { lastProductKey: null, lastSeenAt: Date.now() };
  users[userId].order = users[userId].order || {
    active: false,
    step: null, // "shipCity" | "name" | "phone" | "address" | null
    shipCity: null,
    name: null,
    phone: null,
    address: null,
    items: [], // [{key,name,qty,unit,promoUnitPrice}]
    updatedAt: Date.now(),
  };
  users[userId].state.lastSeenAt = Date.now();
  users[userId].order.updatedAt = Date.now();
  saveUsers(users);
  return users[userId];
}

function updateUser(userId, patchFn) {
  const users = loadUsers();
  users[userId] = users[userId] || {};
  users[userId].state = users[userId].state || {};
  users[userId].order = users[userId].order || { active: false, step: null, shipCity: null, name: null, phone: null, address: null, items: [], updatedAt: Date.now() };
  patchFn(users[userId]);
  users[userId].state.lastSeenAt = Date.now();
  users[userId].order.updatedAt = Date.now();
  saveUsers(users);
}

function resetOrder(userId) {
  updateUser(userId, (u) => {
    u.order = { active: false, step: null, shipCity: null, name: null, phone: null, address: null, items: [], updatedAt: Date.now() };
  });
}

/** =========================
 * D) 產品回覆（拆成：價格/規格/吃法/合併）
 * ========================= */
function gelPrice() {
  const p = STORE.products.gel;
  return `龜鹿膏｜${p.spec}\n目前店內活動是特價 ${money(p.pricePromo)}（原價 ${money(p.priceOriginal)}）。\n${p.noteDays}`;
}
function gelHow() {
  const p = STORE.products.gel;
  return `龜鹿膏｜食用建議\n${p.howTo[0]}\n${p.howTo[1]}`;
}
function gelFull() {
  return [gelPrice(), "", gelHow()].join("\n");
}

function drinkPrice() {
  const p = STORE.products.drink;
  return `龜鹿飲｜${p.spec}\n售價 ${money(p.priceOriginal)}，優惠價 ${money(p.pricePromo)}。`;
}
function drinkHow() {
  const p = STORE.products.drink;
  return `龜鹿飲｜飲用建議\n${p.howTo[0]}\n${p.howTo[1]}`;
}
function drinkFull() {
  return [drinkPrice(), "", drinkHow()].join("\n");
}

function antlerPrice() {
  const p = STORE.products.antler;
  return `鹿茸粉｜${p.spec}\n售價 ${money(p.priceOriginal)}，優惠價 ${money(p.pricePromo)}。`;
}
function antlerHow() {
  const p = STORE.products.antler;
  return `鹿茸粉｜食用建議\n${p.howTo[0]}\n${p.howTo[1]}`;
}
function antlerFull() {
  return [antlerPrice(), "", antlerHow()].join("\n");
}

function soupPriceAll() {
  const p = STORE.products.soup;
  const lines = ["龜鹿湯塊｜三種規格價格", ""];
  for (const v of p.variants) {
    lines.push(`${v.label}（${v.spec}）`);
    lines.push(`售價 ${money(v.priceOriginal)}，優惠價 ${money(v.pricePromo)}`);
    lines.push("");
  }
  while (lines.length && lines[lines.length - 1] === "") lines.pop();
  return lines.join("\n");
}
function soupHow() {
  const p = STORE.products.soup;
  return `龜鹿湯塊｜使用建議\n${p.howTo[0]}\n${p.howTo[1]}`;
}
function soupVariantByKey(key) {
  const v = STORE.products.soup.variants.find((x) => x.key === key);
  if (!v) return [soupPriceAll(), "", soupHow()].join("\n");
  return [
    `龜鹿湯塊｜${v.label}（${v.spec}）`,
    `售價 ${money(v.priceOriginal)}，優惠價 ${money(v.pricePromo)}。`,
    "",
    soupHow(),
  ].join("\n");
}
function soupFullAll() {
  return [soupPriceAll(), "", soupHow()].join("\n");
}

function specsAll() {
  return [
    "【容量／規格】",
    "▪️ 龜鹿膏：100g/罐",
    "▪️ 龜鹿飲：180cc/包",
    "▪️ 鹿茸粉：75g/罐（二兩）",
    "▪️ 龜鹿湯塊：一斤600g／半斤300g／4兩150g",
  ].join("\n");
}

function pricingAll() {
  return [
    "【目前店內活動價】",
    `▪️ 龜鹿膏 100g/罐：特價 ${money(STORE.products.gel.pricePromo)}（原價 ${money(STORE.products.gel.priceOriginal)}）`,
    `▪️ 龜鹿飲 180cc/包：優惠價 ${money(STORE.products.drink.pricePromo)}（售價 ${money(STORE.products.drink.priceOriginal)}）`,
    `▪️ 鹿茸粉 75g/罐：優惠價 ${money(STORE.products.antler.pricePromo)}（售價 ${money(STORE.products.antler.priceOriginal)}）`,
    "▪️ 龜鹿湯塊：輸入「湯塊價格」可看三種規格",
    "",
    "也可以直接打：",
    "「我要龜鹿膏2罐+龜鹿飲10包 寄台中」我會幫您整理並引導完成下單😊",
  ].join("\n");
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

/** =========================
 * E) 固定文案
 * ========================= */
const TEXT = {
  welcome: [
    `您好，歡迎加入【${STORE.brandName}】😊`,
    "",
    "您可以直接輸入👇",
    "▪️ 價格 / 容量 / 怎麼吃",
    "▪️ 龜鹿膏 / 龜鹿飲 / 龜鹿湯塊 / 鹿茸粉",
    "▪️ 我要買（直接打：我要龜鹿膏2罐+龜鹿飲10包 寄台中）",
    "▪️ 門市資訊",
    "",
    "如有個人狀況（孕哺／用藥／慢性病等）",
    "我們會協助轉由合作中醫師一對一說明🙂",
  ].join("\n"),

  followup24h: [
    `您好😊 這裡是【${STORE.brandName}】的小提醒`,
    "",
    "想快速了解可直接輸入👇",
    "▪️ 價格",
    "▪️ 容量",
    "▪️ 龜鹿膏 / 龜鹿飲 / 龜鹿湯塊 / 鹿茸粉",
    "▪️ 門市資訊",
    "",
    "也可以直接留言您的需求，我們會由專人協助您🙂",
  ].join("\n"),

  howToBuy: [
    "【怎麼買／下單流程】",
    "",
    "您可以直接打一段話：",
    "例：我要龜鹿膏2罐+龜鹿飲10包 寄台中",
    "",
    "我會自動整理訂單並引導您補齊：",
    "寄送縣市 → 收件人姓名 → 電話 → 地址",
  ].join("\n"),

  shipping: ["【運送／運費／到貨】", "", STORE.shippingNote].join("\n"),
  payment: ["【付款方式】", "", STORE.paymentNote].join("\n"),
  testing: ["【檢驗／報告】", "", STORE.testingNote].join("\n"),

  sensitive: [
    "這部分會因每個人的身體狀況不同，",
    "為了讓您得到更準確的說明與建議，",
    "建議先由合作的中醫師了解您的情況🙂",
    "",
    "✔ 專人一對一說明",
    "✔ 可詢問適不適合食用",
    "✔ 可詢問個人狀況與疑問",
    "",
    `➤ Line ID：${STORE.doctorLineId}`,
    "➤ 章無忌中醫師諮詢連結：",
    STORE.doctorLink,
  ].join("\n"),

  cancelOrder: "已為您取消本次下單流程。如需重新下單，直接輸入：我要龜鹿膏2罐+龜鹿飲10包 寄台中 😊",

  fallback: [
    "我先提供常用指令給您（也可直接留言需求）😊",
    "",
    "▪️ 價格 / 容量 / 怎麼吃",
    "▪️ 龜鹿膏 / 龜鹿飲 / 龜鹿湯塊 / 鹿茸粉",
    "▪️ 湯塊價格 / 一斤 / 半斤 / 4兩",
    "▪️ 我要買 / 下單",
    "▪️ 門市資訊",
  ].join("\n"),
};

/** =========================
 * F) 意圖 & 產品偵測
 * ========================= */
const INTENT = {
  pricing: ["價格", "售價", "多少錢", "價錢", "特價", "優惠", "活動", "報價", "批發"],
  specs: ["容量", "規格", "幾克", "g", "公克", "幾cc", "cc", "毫升", "ml", "多大", "多少量"],
  howto: ["怎麼吃", "吃法", "怎麼喝", "喝法", "用法", "怎麼用", "怎麼煮"],
  buy: ["怎麼買", "下單", "訂購", "購買", "我要買", "我要訂", "訂單", "我要"],
  shipping: ["運送", "寄送", "運費", "到貨", "宅配", "超商", "店到店"],
  payment: ["付款", "轉帳", "匯款"],
  testing: ["檢驗", "報告", "檢測", "八大營養素"],
  store: ["門市", "地址", "在哪", "位置", "電話", "怎麼去", "地圖"],
  website: ["官網", "網站", "網址"],
  soupPrice: ["湯塊價格", "湯塊售價", "湯塊多少錢", "湯塊特價"],

  gel: ["龜鹿膏", "膏"],
  drink: ["龜鹿飲", "飲"],
  antler: ["鹿茸粉", "鹿茸粉末", "鹿茸", "鹿粉"],
  soup: ["龜鹿湯塊", "湯塊", "湯"],
  soup600: ["湯塊一斤", "一斤湯塊", "600公克", "600g", "一斤"],
  soup300: ["湯塊半斤", "半斤湯塊", "300公克", "300g", "半斤"],
  soup150: ["湯塊4兩", "4兩湯塊", "湯塊四兩", "四兩湯塊", "150公克", "150g", "4兩", "四兩"],

  sensitive: [
    "孕婦","懷孕","備孕","哺乳","餵母乳",
    "小孩","兒童","未成年",
    "慢性病","三高","高血壓","血壓","糖尿病","血糖","痛風",
    "腎","腎臟","洗腎","肝","肝臟",
    "心臟","心血管","中風",
    "癌","癌症","腫瘤","化療","放療",
    "手術","術後",
    "用藥","正在吃藥","抗凝血","阿斯匹靈","warfarin",
    "過敏","體質","副作用",
    "能不能吃","可以吃嗎","適不適合","會不會","危險嗎",
  ],

  cancel: ["取消", "不用了", "先不要", "改天", "取消下單", "取消訂單"],
};

function detectProductKey(raw) {
  if (includesAny(raw, INTENT.soup600)) return "soup600";
  if (includesAny(raw, INTENT.soup300)) return "soup300";
  if (includesAny(raw, INTENT.soup150)) return "soup150";
  if (includesAny(raw, INTENT.gel)) return "gel";
  if (includesAny(raw, INTENT.drink)) return "drink";
  if (includesAny(raw, INTENT.antler)) return "antler";
  if (includesAny(raw, INTENT.soup)) return "soup";
  return null;
}

function detectIntents(raw) {
  const intents = new Set();
  if (includesAny(raw, INTENT.sensitive)) intents.add("sensitive");
  if (includesAny(raw, INTENT.cancel)) intents.add("cancel");
  if (includesAny(raw, INTENT.pricing)) intents.add("pricing");
  if (includesAny(raw, INTENT.specs)) intents.add("specs");
  if (includesAny(raw, INTENT.howto)) intents.add("howto");
  if (includesAny(raw, INTENT.buy)) intents.add("buy");
  if (includesAny(raw, INTENT.shipping)) intents.add("shipping");
  if (includesAny(raw, INTENT.payment)) intents.add("payment");
  if (includesAny(raw, INTENT.testing)) intents.add("testing");
  if (includesAny(raw, INTENT.store)) intents.add("store");
  if (includesAny(raw, INTENT.website)) intents.add("website");
  if (includesAny(raw, INTENT.soupPrice)) intents.add("soupPrice");
  return Array.from(intents);
}

/** =========================
 * G) 訂單解析 + 追問（slot filling）
 * ========================= */
const ORDER_INTENT_WORDS = ["我要", "我想買", "想買", "訂購", "下單", "購買", "要買", "訂", "買"];
const CITY_LIST = [
  "台北","新北","基隆","桃園","新竹","苗栗",
  "台中","彰化","南投","雲林",
  "嘉義","台南","高雄","屏東",
  "宜蘭","花蓮","台東",
  "澎湖","金門","馬祖",
];

function extractShipCity(rawText) {
  for (const city of CITY_LIST) {
    const re = new RegExp(`(寄到|寄送|寄|送到|配送|宅配)\\s*${city}`);
    if (re.test(rawText)) return city;
    // 允許只寫「台中/新北」且在句尾
    const re2 = new RegExp(`\\b${city}(市|縣)?\\b`);
    if (re2.test(rawText) && rawText.length <= 10) return city;
  }
  return null;
}

function cnNumToInt(token) {
  const map = { "一": 1, "二": 2, "兩": 2, "三": 3, "四": 4, "五": 5, "六": 6, "七": 7, "八": 8, "九": 9, "十": 10 };
  return map[token] ?? null;
}

function extractQtyNear(text, alias) {
  const unitGroup = "(罐|包|盒|組|份|個)?";
  const numGroup = "([0-9]{1,3}|一|二|兩|三|四|五|六|七|八|九|十)";
  const re = new RegExp(`${alias}\\s*${numGroup}\\s*${unitGroup}`);
  const m = text.match(re);
  if (!m) return null;

  const rawNum = m[1];
  const unit = m[2] || null;

  const qty = /^[0-9]+$/.test(rawNum) ? safeInt(rawNum) : cnNumToInt(rawNum);
  if (!qty || qty <= 0) return null;
  return { qty, unit };
}

function promoUnitPriceByKey(key) {
  if (key === "gel") return STORE.products.gel.pricePromo;
  if (key === "drink") return STORE.products.drink.pricePromo;
  if (key === "antler") return STORE.products.antler.pricePromo;
  if (key === "soup600") return STORE.products.soup.variants.find(v => v.key === "soup600")?.pricePromo ?? null;
  if (key === "soup300") return STORE.products.soup.variants.find(v => v.key === "soup300")?.pricePromo ?? null;
  if (key === "soup150") return STORE.products.soup.variants.find(v => v.key === "soup150")?.pricePromo ?? null;
  return null;
}

function defaultUnitByKey(key) {
  if (key === "gel") return "罐";
  if (key === "drink") return "包";
  if (key === "antler") return "罐";
  if (key.startsWith("soup")) return "份";
  return "";
}

const PRODUCT_ALIASES = [
  { key: "gel", name: "龜鹿膏", aliases: ["龜鹿膏"] },
  { key: "drink", name: "龜鹿飲", aliases: ["龜鹿飲"] },
  { key: "antler", name: "鹿茸粉", aliases: ["鹿茸粉", "鹿茸粉末"] },
  { key: "soup600", name: "龜鹿湯塊一斤", aliases: ["湯塊一斤", "一斤湯塊", "600公克湯塊", "600g湯塊"] },
  { key: "soup300", name: "龜鹿湯塊半斤", aliases: ["湯塊半斤", "半斤湯塊", "300公克湯塊", "300g湯塊"] },
  { key: "soup150", name: "龜鹿湯塊4兩", aliases: ["湯塊4兩", "4兩湯塊", "湯塊四兩", "四兩湯塊", "150公克湯塊", "150g湯塊"] },
];

function parseOrder(rawText) {
  const text = normalizeText(rawText);
  const hasOrderIntent = ORDER_INTENT_WORDS.some(w => rawText.includes(w));
  const shipCity = extractShipCity(rawText);

  const shouldTry = hasOrderIntent || /[0-9一二兩三四五六七八九十]/.test(rawText);
  if (!shouldTry) return { hasOrderIntent: false, items: [], shipCity: null };

  const itemsMap = new Map();

  for (const p of PRODUCT_ALIASES) {
    const matchedAlias = p.aliases
      .filter(a => rawText.includes(a))
      .sort((a, b) => b.length - a.length)[0];

    if (!matchedAlias) continue;

    const near = extractQtyNear(text, matchedAlias);
    const qty = near?.qty ?? 1;
    const unit = near?.unit ?? defaultUnitByKey(p.key);
    const promo = promoUnitPriceByKey(p.key);

    if (!itemsMap.has(p.key)) {
      itemsMap.set(p.key, { key: p.key, name: p.name, qty, unit, promoUnitPrice: promo });
    } else {
      const prev = itemsMap.get(p.key);
      prev.qty += qty;
      itemsMap.set(p.key, prev);
    }
  }

  return { hasOrderIntent, items: Array.from(itemsMap.values()), shipCity };
}

function calcSubtotal(items) {
  let sum = 0;
  for (const it of items) {
    if (typeof it.promoUnitPrice === "number") sum += it.promoUnitPrice * it.qty;
  }
  return sum;
}

function orderSummaryLines(order) {
  const lines = [];
  for (const it of order.items) {
    const price = typeof it.promoUnitPrice === "number" ? `｜優惠價 ${money(it.promoUnitPrice)} /${it.unit}` : "";
    lines.push(`▪️ ${it.name} × ${it.qty} ${it.unit}${price}`);
  }
  const subtotal = calcSubtotal(order.items);
  if (subtotal > 0) lines.push(`小計（未含運）：${money(subtotal)}`);
  return lines;
}

function startOrUpdateOrder(userId, parsed) {
  updateUser(userId, (u) => {
    u.order.active = true;
    // items：合併累加
    const map = new Map((u.order.items || []).map((x) => [x.key, x]));
    for (const it of parsed.items || []) {
      if (!map.has(it.key)) map.set(it.key, it);
      else {
        const prev = map.get(it.key);
        prev.qty += it.qty;
        map.set(it.key, prev);
      }
    }
    u.order.items = Array.from(map.values());
    if (parsed.shipCity) u.order.shipCity = parsed.shipCity;

    // 如果沒有 step，就決定下一步
    if (!u.order.step) u.order.step = "shipCity";
  });
}

function computeNextStep(order) {
  if (!order.shipCity) return "shipCity";
  if (!order.name) return "name";
  if (!order.phone) return "phone";
  if (!order.address) return "address";
  return null;
}

function buildOrderPrompt(order) {
  const summary = orderSummaryLines(order);
  const head = ["我先幫您整理目前訂單（如有誤可直接更正）👇", "", ...summary].join("\n");

  const next = computeNextStep(order);
  if (!next) {
    return [
      head,
      "",
      "✅ 訂單資料已齊全，我確認如下：",
      `寄送縣市：${order.shipCity}`,
      `收件人：${order.name}`,
      `電話：${order.phone}`,
      `地址：${order.address}`,
      "",
      "我接著會回覆：運費、到貨方式與付款資訊😊",
    ].join("\n");
  }

  if (next === "shipCity") {
    return [head, "", "請問要寄送到哪個縣市呢？（例：台北／新北／台中）"].join("\n");
  }
  if (next === "name") {
    return [head, "", `寄送縣市：${order.shipCity}`, "", "請問收件人姓名是？"].join("\n");
  }
  if (next === "phone") {
    return [head, "", `寄送縣市：${order.shipCity}`, `收件人：${order.name}`, "", "請問收件人電話是？"].join("\n");
  }
  if (next === "address") {
    return [head, "", `寄送縣市：${order.shipCity}`, `收件人：${order.name}`, `電話：${order.phone}`, "", "請問收件地址是？"].join("\n");
  }
  return head;
}

function tryFillOrderFromMessage(userId, rawText) {
  const raw = normalizeText(rawText);

  const user = ensureUser(userId);
  const order = user.order;

  // 取消
  if (includesAny(rawText, INTENT.cancel) || includesAny(raw, INTENT.cancel)) {
    resetOrder(userId);
    return { handled: true, reply: TEXT.cancelOrder, orderUpdated: false };
  }

  if (!order.active) return { handled: false, reply: null, orderUpdated: false };

  // 若使用者又在同一句補了品項/數量，也允許更新
  const parsed = parseOrder(rawText);
  if (parsed.items.length > 0 || parsed.shipCity) {
    startOrUpdateOrder(userId, parsed);
  }

  // 重新取一次最新 order
  const latest = ensureUser(userId).order;

  // 若還缺 shipCity，但這句提供了城市
  if (!latest.shipCity) {
    const city = extractShipCity(rawText) || CITY_LIST.find(c => rawText.includes(c));
    if (city) {
      updateUser(userId, (u) => (u.order.shipCity = city));
    }
  } else {
    // 有 shipCity 之後，依 step 填資料
    const step = latest.step || computeNextStep(latest);

    if (step === "name") {
      // 姓名：避免把「台中/價格/地址」誤當姓名，做基本排除
      if (raw.length >= 2 && raw.length <= 10 && !includesAny(raw, ["價格", "容量", "地址", "電話", "官網", "門市"])) {
        updateUser(userId, (u) => (u.order.name = raw));
      }
    } else if (step === "phone") {
      // 電話：抓數字（允許 09xxxxxxxx 或市話）
      const digits = rawText.replace(/[^\d]/g, "");
      if (digits.length >= 8 && digits.length <= 15) {
        updateUser(userId, (u) => (u.order.phone = digits));
      }
    } else if (step === "address") {
      // 地址：長度判斷，避免太短
      if (raw.length >= 6) {
        updateUser(userId, (u) => (u.order.address = rawText.trim()));
      }
    }
  }

  // 更新 step
  updateUser(userId, (u) => {
    u.order.step = computeNextStep(u.order);
  });

  const updatedOrder = ensureUser(userId).order;

  // 若訂單活躍但還沒有 items，提醒先提供品項
  if (updatedOrder.active && (!updatedOrder.items || updatedOrder.items.length === 0)) {
    return {
      handled: true,
      reply: [
        "好的😊 我可以協助您下單！",
        "",
        "請先告訴我您要的品項與數量（可直接這樣打）：",
        "例：我要龜鹿膏2罐+龜鹿飲10包",
        "",
        "我會再引導您補齊寄送與收件資料。",
      ].join("\n"),
      orderUpdated: true,
    };
  }

  return { handled: true, reply: buildOrderPrompt(updatedOrder), orderUpdated: true };
}

/** =========================
 * H) 聰明回覆（上下文 + 多意圖合併）
 * ========================= */
function buildSmartReply(raw, userState) {
  const intents = detectIntents(raw);

  // 敏感優先
  if (intents.includes("sensitive")) return TEXT.sensitive;

  // 決定產品上下文：本句有提到產品就更新；沒有就沿用 lastProductKey
  let productKey = detectProductKey(raw) || userState.lastProductKey || null;

  // 若完全沒命中意圖，但有產品名 → 回完整產品
  if (intents.length === 0 && productKey) {
    if (productKey === "gel") return gelFull();
    if (productKey === "drink") return drinkFull();
    if (productKey === "antler") return antlerFull();
    if (productKey === "soup") return soupFullAll();
    if (productKey === "soup600" || productKey === "soup300" || productKey === "soup150") return soupVariantByKey(productKey);
  }

  const parts = [];

  // 門市/官網/檢驗
  if (intents.includes("store")) parts.push(storeInfo());
  if (intents.includes("website")) parts.push(`官網連結：${STORE.website}`);
  if (intents.includes("testing")) parts.push(TEXT.testing);

  // 怎麼買/運送/付款
  if (intents.includes("buy")) parts.push(TEXT.howToBuy);
  if (intents.includes("shipping")) parts.push(TEXT.shipping);
  if (intents.includes("payment")) parts.push(TEXT.payment);

  // 價格（若有產品上下文就回該品項；否則總表）
  if (intents.includes("pricing") || intents.includes("soupPrice")) {
    if (intents.includes("soupPrice")) {
      parts.push(soupPriceAll());
    } else if (productKey === "gel") {
      parts.push(gelPrice());
    } else if (productKey === "drink") {
      parts.push(drinkPrice());
    } else if (productKey === "antler") {
      parts.push(antlerPrice());
    } else if (productKey === "soup") {
      parts.push(soupPriceAll());
    } else if (productKey === "soup600" || productKey === "soup300" || productKey === "soup150") {
      parts.push(soupVariantByKey(productKey).split("\n\n")[0]);
    } else {
      parts.push(pricingAll());
    }
  }

  // 規格
  if (intents.includes("specs")) {
    if (productKey === "gel") parts.push(`龜鹿膏｜規格\n${STORE.products.gel.spec}`);
    else if (productKey === "drink") parts.push(`龜鹿飲｜規格\n${STORE.products.drink.spec}`);
    else if (productKey === "antler") parts.push(`鹿茸粉｜規格\n${STORE.products.antler.spec}`);
    else if (productKey === "soup" || (productKey && productKey.startsWith("soup"))) parts.push("龜鹿湯塊｜規格\n一斤600g／半斤300g／4兩150g");
    else parts.push(specsAll());
  }

  // 吃法/用法
  if (intents.includes("howto")) {
    if (productKey === "gel") parts.push(gelHow());
    else if (productKey === "drink") parts.push(drinkHow());
    else if (productKey === "antler") parts.push(antlerHow());
    else if (productKey === "soup" || (productKey && productKey.startsWith("soup"))) parts.push(soupHow());
    else parts.push("想了解吃法/用法，請告訴我您問的是哪一款：龜鹿膏／龜鹿飲／龜鹿湯塊／鹿茸粉🙂");
  }

  if (parts.length === 0) return TEXT.fallback;
  return parts.join("\n\n——\n\n");
}

/** =========================
 * I) 24h 追蹤（cron）
 * ========================= */
async function scanAndSendFollowups() {
  const users = loadUsers();
  const now = Date.now();
  const dueMs = 24 * 60 * 60 * 1000;

  let changed = false;

  for (const [userId, u] of Object.entries(users)) {
    if (!u || !u.followedAt) continue;
    if (u.followupSent) continue;

    const isDue = now - u.followedAt >= dueMs;
    if (!isDue) continue;

    try {
      await client.pushMessage(userId, textMessage(TEXT.followup24h));
      users[userId].followupSent = true;
      users[userId].followupSentAt = Date.now();
      changed = true;
    } catch (err) {
      console.error("24h 推播失敗：", userId, err?.message || err);
    }
  }

  if (changed) saveUsers(users);
}

cron.schedule("*/10 * * * *", () => {
  scanAndSendFollowups().catch((e) => console.error("scan error:", e));
});

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
  // follow：歡迎 + 建檔
  if (event.type === "follow") {
    const userId = event.source && event.source.userId;
    if (userId) {
      const users = loadUsers();
      users[userId] = users[userId] || {};
      users[userId].followedAt = users[userId].followedAt || Date.now();
      users[userId].followupSent = users[userId].followupSent || false;
      users[userId].state = users[userId].state || { lastProductKey: null, lastSeenAt: Date.now() };
      users[userId].order = users[userId].order || { active: false, step: null, shipCity: null, name: null, phone: null, address: null, items: [], updatedAt: Date.now() };
      saveUsers(users);
    }
    return client.replyMessage(event.replyToken, textMessage(TEXT.welcome));
  }

  // unfollow：清掉
  if (event.type === "unfollow") {
    const userId = event.source && event.source.userId;
    if (userId) {
      const users = loadUsers();
      delete users[userId];
      saveUsers(users);
    }
    return null;
  }

  // 只處理文字
  if (event.type !== "message") return null;
  if (!event.message || event.message.type !== "text") return null;

  const userId = event.source && event.source.userId;
  const userTextRaw = event.message.text || "";
  const raw = normalizeText(userTextRaw);

  // 沒 userId 就退化成一般回覆
  if (!userId) {
    const reply = buildSmartReply(raw, { lastProductKey: null });
    return client.replyMessage(event.replyToken, textMessage(reply));
  }

  // 確保 user 結構
  const user = ensureUser(userId);

  // 1) 如果訂單流程已啟動 → 先走缺欄位追問（slot filling）
  if (user.order && user.order.active) {
    const filled = tryFillOrderFromMessage(userId, userTextRaw);
    if (filled.handled) return client.replyMessage(event.replyToken, textMessage(filled.reply));
  }

  // 2) 嘗試從本句啟動訂單（解析到品項 或 有明顯我要買意圖）
  const parsed = parseOrder(userTextRaw);
  const hasOrderIntent = ORDER_INTENT_WORDS.some(w => userTextRaw.includes(w));
  if ((parsed.items && parsed.items.length > 0) || hasOrderIntent) {
    startOrUpdateOrder(userId, parsed);
    const updated = ensureUser(userId).order;

    // 同時更新上下文產品（取第一個 items）
    if (updated.items && updated.items.length > 0) {
      updateUser(userId, (u) => (u.state.lastProductKey = updated.items[0].key));
    }

    // 設定 step & 回第一個追問
    updateUser(userId, (u) => {
      u.order.step = computeNextStep(u.order);
    });

    const orderNow = ensureUser(userId).order;
    return client.replyMessage(event.replyToken, textMessage(buildOrderPrompt(orderNow)));
  }

  // 3) 一般聰明回覆（上下文 + 多意圖合併）
  const productKey = detectProductKey(raw);
  if (productKey) {
    updateUser(userId, (u) => (u.state.lastProductKey = productKey));
  }
  const state = ensureUser(userId).state;
  const reply = buildSmartReply(raw, state);
  return client.replyMessage(event.replyToken, textMessage(reply));
}

app.listen(PORT, () => {
  console.log(`LINE bot webhook listening on port ${PORT}`);
});
