"use strict";

/**
 * 仙加味・龜鹿 LINE Bot（整包替換版｜全連動引擎）
 *
 * ✅ 重點功能
 * - 同義詞意圖統一：售價/價錢/價格、容量/規格/重量…都能抓
 * - 上下文連動：上一句提產品，下一句只問「價格/容量/怎麼買/運送/付款/檢驗」也會接上
 * - 一句多問合併回覆：價格+容量+怎麼買+運送 → 一次回
 * - 「產品名/有哪些產品/商品」→ 回產品清單（並可接著連動）
 * - 下單解析：支援「龜鹿膏2罐」+「2罐龜鹿膏」+「湯塊一斤1份」
 * - 下單引導：寄送縣市 → 姓名 → 電話 → 地址 → 訂單確認
 * - 敏感問題導流中醫師（你提供的固定話術）
 * - follow 歡迎訊息 + 24h 追蹤提醒（存檔 users.json，不怕重啟）
 *
 * ✅ ENV
 * - CHANNEL_ACCESS_TOKEN
 * - CHANNEL_SECRET
 * - PORT (optional)
 *
 * ✅ Webhook path
 * - POST /webhook
 */

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

const config = { channelAccessToken: CHANNEL_ACCESS_TOKEN, channelSecret: CHANNEL_SECRET };
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

  // 你先前提到的檢驗回答（可再擴充）
  testingNote:
    "目前我們可提供八大營養素等基本資訊（依批次/包裝標示為準）。如需更詳細資料，歡迎留言，我們整理後回覆您。",

  paymentNote:
    "付款方式可依訂單安排（如：轉帳等）。我整理好訂單後會一併提供付款資訊。",

  shippingNote:
    "可安排宅配/超商等方式（依地區與品項而定）。我收到寄送縣市後會提供運費與到貨時間預估。",
};

/** =========================
 * B) 基礎工具
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

function cnNumToInt(token) {
  const map = { "一": 1, "二": 2, "兩": 2, "三": 3, "四": 4, "五": 5, "六": 6, "七": 7, "八": 8, "九": 9, "十": 10 };
  return map[token] ?? null;
}

/** =========================
 * C) Quick Replies（可依你要的再調整）
 * ========================= */
function quickRepliesCommon() {
  return {
    items: [
      { type: "action", action: { type: "message", label: "產品名", text: "產品名" } },
      { type: "action", action: { type: "message", label: "價格", text: "價格" } },
      { type: "action", action: { type: "message", label: "容量", text: "容量" } },
      { type: "action", action: { type: "message", label: "湯塊價格", text: "湯塊價格" } },
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
 * D) users.json（持久化：追蹤 + 上下文 + 訂單流程）
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
    step: null,
    shipCity: null,
    name: null,
    phone: null,
    address: null,
    items: [],
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
 * E) 回覆內容（可再擴充：保存方式/期限/推薦組合…）
 * ========================= */
function pricingAll() {
  return [
    "【目前店內活動價】",
    `▪️ 龜鹿膏 ${STORE.products.gel.spec}：特價 ${money(STORE.products.gel.pricePromo)}（原價 ${money(STORE.products.gel.priceOriginal)}）`,
    `▪️ 龜鹿飲 ${STORE.products.drink.spec}：優惠價 ${money(STORE.products.drink.pricePromo)}（售價 ${money(STORE.products.drink.priceOriginal)}）`,
    `▪️ 鹿茸粉 ${STORE.products.antler.spec}：優惠價 ${money(STORE.products.antler.pricePromo)}（售價 ${money(STORE.products.antler.priceOriginal)}）`,
    "▪️ 龜鹿湯塊：輸入「湯塊價格」可看三種規格",
    "",
    "若要直接下單可這樣打：",
    "例：2罐龜鹿膏 / 我要龜鹿膏2罐+龜鹿飲10包 寄台中",
  ].join("\n");
}

function specsAll() {
  return [
    "【容量／規格】",
    `▪️ 龜鹿膏：${STORE.products.gel.spec}`,
    `▪️ 龜鹿飲：${STORE.products.drink.spec}`,
    `▪️ 鹿茸粉：75g/罐（二兩）`,
    "▪️ 龜鹿湯塊：一斤600g／半斤300g／4兩150g",
  ].join("\n");
}

function productListText() {
  return [
    "【產品清單】",
    `▪️ 龜鹿膏（${STORE.products.gel.spec}）`,
    `▪️ 龜鹿飲（${STORE.products.drink.spec}）`,
    `▪️ 鹿茸粉（75g/罐）`,
    "▪️ 龜鹿湯塊（一斤600g／半斤300g／4兩150g）",
    "",
    "您可以直接回：",
    "「龜鹿膏 / 龜鹿飲 / 鹿茸粉 / 湯塊價格」",
    "我會立即整理價格/容量/怎麼買😊",
  ].join("\n");
}

function gelFull() {
  const p = STORE.products.gel;
  return [
    `我們龜鹿膏是${p.spec}。`,
    `目前店內活動是特價 ${money(p.pricePromo)}（原價 ${money(p.priceOriginal)}）。`,
    p.noteDays,
    "",
    "一般建議：",
    `• ${p.howTo[0]}`,
    `• ${p.howTo[1]}`,
  ].join("\n");
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

const TEXT = {
  welcome: [
    `您好，歡迎加入【${STORE.brandName}】😊`,
    "",
    "您可以直接輸入👇",
    "▪️ 產品名（看有哪些產品）",
    "▪️ 價格 / 售價 / 價錢",
    "▪️ 容量 / 規格 / 重量",
    "▪️ 怎麼買 / 下單",
    "▪️ 門市資訊 / 官網 / 來電",
    "",
    "也可以直接下單：",
    "例：2罐龜鹿膏 / 10包龜鹿飲 / 湯塊一斤1份",
  ].join("\n"),

  followup24h: [
    `您好😊 這裡是【${STORE.brandName}】的小提醒`,
    "",
    "想快速了解可直接輸入👇",
    "▪️ 產品名",
    "▪️ 價格 / 容量",
    "▪️ 龜鹿膏 / 龜鹿飲 / 湯塊價格 / 鹿茸粉",
    "▪️ 門市資訊",
  ].join("\n"),

  howToBuy: [
    "【怎麼買／下單流程】",
    "您可以直接打一段話：",
    "例：我要龜鹿膏2罐+龜鹿飲10包 寄台中",
    "",
    "我會自動整理訂單並引導您補齊：",
    "寄送縣市 → 收件人姓名 → 電話 → 地址",
  ].join("\n"),

  shipping: ["【運送／運費／到貨】", "", STORE.shippingNote].join("\n"),
  payment: ["【付款方式】", "", STORE.paymentNote].join("\n"),
  testing: ["【檢驗／報告】", "", STORE.testingNote].join("\n"),

  // 你提供的敏感問題固定回覆
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

  cancelOrder: "已為您取消本次下單流程。如需重新下單，直接輸入：2罐龜鹿膏 或 我要龜鹿膏2罐+龜鹿飲10包 寄台中 😊",

  fallback: [
    "我先提供常用指令給您（也可直接留言需求）😊",
    "",
    "▪️ 產品名（看有哪些產品）",
    "▪️ 價格 / 售價 / 價錢",
    "▪️ 容量 / 規格 / 重量",
    "▪️ 怎麼買 / 下單",
    "▪️ 湯塊價格 / 一斤 / 半斤 / 4兩",
    "▪️ 門市資訊 / 官網 / 來電",
  ].join("\n"),
};

/** =========================
 * F) 意圖 & 產品偵測（全連動）
 * ========================= */
const INTENT = {
  // 價格同義詞
  pricing: ["價格","價錢","售價","多少錢","幾錢","特價","優惠","活動","折扣","報價","批發"],

  // 容量/規格同義詞
  specs: ["容量","規格","幾克","幾g","g","公克","克","幾cc","cc","毫升","ml","多大","多少量","重量"],

  // 產品名/有哪些/清單
  productList: ["產品名","有哪些產品","有什麼產品","產品","商品","品項","商品清單","品項清單"],

  // 怎麼買/下單
  buy: ["怎麼買","怎麼購買","下單","訂購","購買","我要買","我要","訂單","訂購方式","怎麼訂"],

  // 運送
  shipping: ["運送","寄送","運費","到貨","配送","宅配","超商","店到店","多久到","幾天到"],

  // 付款
  payment: ["付款","怎麼付","轉帳","匯款","刷卡","貨到付款","付款方式"],

  // 檢驗
  testing: ["檢驗","報告","檢測","八大營養素","合格","安全","驗證"],

  // 門市/聯絡
  store: ["門市","店面","地址","在哪","位置","怎麼去","地圖","電話","聯絡","營業時間"],

  // 官網
  website: ["官網","網站","網址","連結"],

  // 湯塊價格
  soupPrice: ["湯塊價格","湯塊售價","湯塊多少錢","湯塊特價"],

  // 產品偵測
  gel: ["龜鹿膏"],
  drink: ["龜鹿飲"],
  antler: ["鹿茸粉"],
  soup: ["龜鹿湯塊","湯塊"],
  soup600: ["湯塊一斤","一斤湯塊","600公克","600g","一斤"],
  soup300: ["湯塊半斤","半斤湯塊","300公克","300g","半斤"],
  soup150: ["湯塊4兩","4兩湯塊","湯塊四兩","四兩湯塊","150公克","150g","4兩","四兩"],

  // 敏感導流
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
    "能不能吃","可以吃嗎","適不適合","會不會","危險嗎","禁忌"
  ],

  cancel: ["取消","不用了","先不要","改天","取消下單","取消訂單"],
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
  if (includesAny(raw, INTENT.productList)) intents.add("productList");
  if (includesAny(raw, INTENT.pricing)) intents.add("pricing");
  if (includesAny(raw, INTENT.specs)) intents.add("specs");
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
 * G) 訂單解析 + 追問（支援數量前後）
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
  }
  return null;
}

// 看起來像下單：有「數量+單位」或有「我要/下單」類
function looksLikeOrder(rawText) {
  return /([0-9]{1,3}|一|二|兩|三|四|五|六|七|八|九|十)\s*(罐|包|盒|組|份|個)/.test(rawText);
}

// 產品在前：龜鹿膏2罐
function extractQtyAfterProduct(text, productAlias) {
  const unitGroup = "(罐|包|盒|組|份|個)?";
  const numGroup = "([0-9]{1,3}|一|二|兩|三|四|五|六|七|八|九|十)";
  const re = new RegExp(`${productAlias}\\s*${numGroup}\\s*${unitGroup}`);
  const m = text.match(re);
  if (!m) return null;

  const rawNum = m[1];
  const unit = m[2] || null;
  const qty = /^[0-9]+$/.test(rawNum) ? safeInt(rawNum) : cnNumToInt(rawNum);
  if (!qty || qty <= 0) return null;
  return { qty, unit };
}

// 數量在前：2罐龜鹿膏
function extractQtyBeforeProduct(text, productAlias) {
  const unitGroup = "(罐|包|盒|組|份|個)";
  const numGroup = "([0-9]{1,3}|一|二|兩|三|四|五|六|七|八|九|十)";
  const re = new RegExp(`${numGroup}\\s*${unitGroup}\\s*${productAlias}`);
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
  { key: "antler", name: "鹿茸粉", aliases: ["鹿茸粉"] },
  { key: "soup600", name: "龜鹿湯塊一斤", aliases: ["湯塊一斤","一斤湯塊","600公克湯塊","600g湯塊","一斤"] },
  { key: "soup300", name: "龜鹿湯塊半斤", aliases: ["湯塊半斤","半斤湯塊","300公克湯塊","300g湯塊","半斤"] },
  { key: "soup150", name: "龜鹿湯塊4兩", aliases: ["湯塊4兩","4兩湯塊","湯塊四兩","四兩湯塊","150公克湯塊","150g湯塊","4兩","四兩"] },
];

function parseOrder(rawText) {
  const text = normalizeText(rawText);
  const hasOrderIntent = ORDER_INTENT_WORDS.some(w => rawText.includes(w));
  const shipCity = extractShipCity(rawText);

  const shouldTry = hasOrderIntent || looksLikeOrder(rawText) || /[0-9一二兩三四五六七八九十]/.test(rawText);
  if (!shouldTry) return { hasOrderIntent: false, items: [], shipCity: null };

  const itemsMap = new Map();

  for (const p of PRODUCT_ALIASES) {
    const matchedAlias = p.aliases
      .filter(a => rawText.includes(a))
      .sort((a, b) => b.length - a.length)[0];

    if (!matchedAlias) continue;

    const before = extractQtyBeforeProduct(text, matchedAlias);
    const after = extractQtyAfterProduct(text, matchedAlias);
    const near = before || after;

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

  // 注意：若只有「2罐」但沒寫產品名，items會是空；這種情況交給下單流程追問品項
  return { hasOrderIntent: hasOrderIntent || looksLikeOrder(rawText), items: Array.from(itemsMap.values()), shipCity };
}

function calcSubtotal(items) {
  let sum = 0;
  for (const it of items) {
    if (typeof it.promoUnitPrice === "number") sum += it.promoUnitPrice * it.qty;
  }
  return sum;
}

function orderSummaryLines(items) {
  const lines = [];
  for (const it of items) {
    const price = typeof it.promoUnitPrice === "number" ? `｜優惠價 ${money(it.promoUnitPrice)} /${it.unit}` : "";
    lines.push(`▪️ ${it.name} × ${it.qty} ${it.unit}${price}`);
  }
  const subtotal = calcSubtotal(items);
  if (subtotal > 0) lines.push(`小計（未含運）：${money(subtotal)}`);
  return lines;
}

function computeNextStep(order) {
  if (!order.shipCity) return "shipCity";
  if (!order.name) return "name";
  if (!order.phone) return "phone";
  if (!order.address) return "address";
  return null;
}

function buildOrderPrompt(order) {
  const summary = orderSummaryLines(order.items || []);
  const head = ["我先幫您整理目前訂單（如有誤可直接更正）👇", "", ...summary].join("\n");

  // 若啟動下單但 items 空，先追問品項
  if (!order.items || order.items.length === 0) {
    return [
      "好的😊 我可以協助您下單！",
      "",
      "請先告訴我您要的品項與數量（可直接這樣打）：",
      "例：2罐龜鹿膏 / 10包龜鹿飲 / 湯塊一斤1份",
      "",
      "或您也可以回：龜鹿膏、龜鹿飲、鹿茸粉、湯塊價格",
    ].join("\n");
  }

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

  if (next === "shipCity") return [head, "", "請問要寄送到哪個縣市呢？（例：台北／新北／台中）"].join("\n");
  if (next === "name") return [head, "", `寄送縣市：${order.shipCity}`, "", "請問收件人姓名是？"].join("\n");
  if (next === "phone") return [head, "", `寄送縣市：${order.shipCity}`, `收件人：${order.name}`, "", "請問收件人電話是？"].join("\n");
  if (next === "address") return [head, "", `寄送縣市：${order.shipCity}`, `收件人：${order.name}`, `電話：${order.phone}`, "", "請問收件地址是？"].join("\n");
  return head;
}

function startOrUpdateOrder(userId, parsed) {
  updateUser(userId, (u) => {
    u.order.active = true;

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

    u.order.step = computeNextStep(u.order);
  });
}

function tryFillOrderFromMessage(userId, rawText) {
  const raw = normalizeText(rawText);
  const user = ensureUser(userId);
  const order = user.order;

  if (includesAny(raw, INTENT.cancel)) {
    resetOrder(userId);
    return { handled: true, reply: TEXT.cancelOrder };
  }
  if (!order.active) return { handled: false, reply: null };

  // 若同一句補品項/數量或縣市 → 更新
  const parsed = parseOrder(rawText);
  if ((parsed.items && parsed.items.length > 0) || parsed.shipCity) {
    startOrUpdateOrder(userId, parsed);
  }

  // 重新取得最新 order
  const latest = ensureUser(userId).order;
  const step = computeNextStep(latest);

  if (step === "shipCity") {
    const city = extractShipCity(rawText) || CITY_LIST.find(c => rawText.includes(c));
    if (city) updateUser(userId, (u) => (u.order.shipCity = city));
  } else if (step === "name") {
    if (raw.length >= 2 && raw.length <= 10 && !includesAny(raw, ["價格","容量","地址","電話","官網","門市"])) {
      updateUser(userId, (u) => (u.order.name = raw));
    }
  } else if (step === "phone") {
    const digits = rawText.replace(/[^\d]/g, "");
    if (digits.length >= 8 && digits.length <= 15) updateUser(userId, (u) => (u.order.phone = digits));
  } else if (step === "address") {
    if (raw.length >= 6) updateUser(userId, (u) => (u.order.address = rawText.trim()));
  }

  updateUser(userId, (u) => (u.order.step = computeNextStep(u.order)));
  const updated = ensureUser(userId).order;
  return { handled: true, reply: buildOrderPrompt(updated) };
}

/** =========================
 * H) 全連動回覆引擎（售價/價錢/價格/容量/產品名/其他）
 * ========================= */
function buildSmartReply(raw, userState) {
  const intents = detectIntents(raw);

  // 敏感問題：永遠優先導流
  if (intents.includes("sensitive")) return TEXT.sensitive;

  // 產品上下文（本句有就更新；沒有就沿用上一句）
  const productKey = detectProductKey(raw) || userState.lastProductKey || null;

  // 只打產品名（例如：龜鹿膏）→ 回完整介紹
  if (intents.length === 0 && productKey === "gel") return gelFull();
  if (intents.length === 0 && (productKey === "soup" || (productKey && productKey.startsWith("soup")))) return soupPriceAll();
  if (intents.length === 0 && productKey === "drink") {
    return [
      `龜鹿飲｜${STORE.products.drink.spec}`,
      `售價 ${money(STORE.products.drink.priceOriginal)}，優惠價 ${money(STORE.products.drink.pricePromo)}。`,
      "",
      "一般建議：",
      `• ${STORE.products.drink.howTo[0]}`,
      `• ${STORE.products.drink.howTo[1]}`,
    ].join("\n");
  }
  if (intents.length === 0 && productKey === "antler") {
    return [
      `鹿茸粉｜${STORE.products.antler.spec}`,
      `售價 ${money(STORE.products.antler.priceOriginal)}，優惠價 ${money(STORE.products.antler.pricePromo)}。`,
      "",
      "一般建議：",
      `• ${STORE.products.antler.howTo[0]}`,
      `• ${STORE.products.antler.howTo[1]}`,
    ].join("\n");
  }

  const parts = [];

  // 產品名/清單
  if (intents.includes("productList")) parts.push(productListText());

  // 門市/官網/檢驗/運送/付款/怎麼買
  if (intents.includes("store")) parts.push(storeInfo());
  if (intents.includes("website")) parts.push(`官網連結：${STORE.website}`);
  if (intents.includes("testing")) parts.push(TEXT.testing);
  if (intents.includes("shipping")) parts.push(TEXT.shipping);
  if (intents.includes("payment")) parts.push(TEXT.payment);
  if (intents.includes("buy")) parts.push(TEXT.howToBuy);

  // 價格（售價/價錢/價格）
  if (intents.includes("pricing") || intents.includes("soupPrice")) {
    if (intents.includes("soupPrice")) {
      parts.push(soupPriceAll());
    } else if (productKey === "gel") {
      parts.push(`龜鹿膏｜${STORE.products.gel.spec}\n特價 ${money(STORE.products.gel.pricePromo)}（原價 ${money(STORE.products.gel.priceOriginal)}）`);
    } else if (productKey === "drink") {
      parts.push(`龜鹿飲｜${STORE.products.drink.spec}\n優惠價 ${money(STORE.products.drink.pricePromo)}（售價 ${money(STORE.products.drink.priceOriginal)}）`);
    } else if (productKey === "antler") {
      parts.push(`鹿茸粉｜${STORE.products.antler.spec}\n優惠價 ${money(STORE.products.antler.pricePromo)}（售價 ${money(STORE.products.antler.priceOriginal)}）`);
    } else if (productKey === "soup" || (productKey && productKey.startsWith("soup"))) {
      parts.push(soupPriceAll());
    } else {
      parts.push(pricingAll());
    }
  }

  // 容量/規格（連動產品）
  if (intents.includes("specs")) {
    if (!productKey) parts.push(specsAll());
    else if (productKey === "gel") parts.push(`龜鹿膏｜規格\n${STORE.products.gel.spec}`);
    else if (productKey === "drink") parts.push(`龜鹿飲｜規格\n${STORE.products.drink.spec}`);
    else if (productKey === "antler") parts.push(`鹿茸粉｜規格\n${STORE.products.antler.spec}`);
    else parts.push("龜鹿湯塊｜規格\n一斤600g／半斤300g／4兩150g");
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
    if (now - u.followedAt < dueMs) continue;

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

cron.schedule("*/10 * * * *", () => scanAndSendFollowups().catch(() => {}));

/** =========================
 * J) Webhook
 * ========================= */
app.get("/", (req, res) => res.status(200).send("OK"));

// 你的 webhook endpoint：POST /webhook
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

  if (event.type === "unfollow") {
    const userId = event.source && event.source.userId;
    if (userId) {
      const users = loadUsers();
      delete users[userId];
      saveUsers(users);
    }
    return null;
  }

  // 只處理文字訊息
  if (event.type !== "message") return null;
  if (!event.message || event.message.type !== "text") return null;

  const userId = event.source && event.source.userId;
  const userTextRaw = event.message.text || "";
  const raw = normalizeText(userTextRaw);

  if (!userId) {
    const reply = buildSmartReply(raw, { lastProductKey: null });
    return client.replyMessage(event.replyToken, textMessage(reply));
  }

  // 取使用者狀態
  const user = ensureUser(userId);

  // 1) 若訂單流程已啟動 → 先追問補資料
  if (user.order && user.order.active) {
    const filled = tryFillOrderFromMessage(userId, userTextRaw);
    if (filled.handled) return client.replyMessage(event.replyToken, textMessage(filled.reply));
  }

  // 2) 解析本句是否為下單（含：2罐龜鹿膏 / 龜鹿膏2罐）
  const parsed = parseOrder(userTextRaw);
  if ((parsed.items && parsed.items.length > 0) || parsed.hasOrderIntent) {
    startOrUpdateOrder(userId, parsed);

    // 更新上下文產品（取第一個 item）
    const updated = ensureUser(userId);
    if (updated.order.items && updated.order.items.length > 0) {
      updateUser(userId, (u) => (u.state.lastProductKey = updated.order.items[0].key));
    }

    return client.replyMessage(event.replyToken, textMessage(buildOrderPrompt(updated.order)));
  }

  // 3) 一般全連動回覆（上下文 + 同義詞）
  const pk = detectProductKey(raw);
  if (pk) updateUser(userId, (u) => (u.state.lastProductKey = pk));

  const latestState = ensureUser(userId).state;
  const reply = buildSmartReply(raw, latestState);
  return client.replyMessage(event.replyToken, textMessage(reply));
}

app.listen(PORT, () => console.log(`LINE bot webhook listening on port ${PORT}`));
