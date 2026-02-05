/**
 * LINE Bot Webhook - 仙加味・龜鹿（完整版 + 訂單解析）
 * - 產品一段式成交回覆（規格+原價/特價+建議）
 * - 價格總表 / 規格總表
 * - 訂單句子解析（例：我要龜鹿膏2罐+龜鹿飲10包 寄台中）
 * - 敏感問題導流中醫師
 * - follow 加好友歡迎
 * - 24h 追蹤推播（穩定版：cron 掃描 users.json，不怕重啟）
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
 * A) 店家/產品設定（已依你提供資料填好）
 * ========================= */
const STORE = {
  brandName: "仙加味・龜鹿",
  address: "台北市萬華區西昌街 52 號",
  phoneDisplay: "(02) 2381-2990",
  website: "https://ts15825868.github.io/TaiShing/index.html",

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
        { label: "一斤", spec: "600公克", priceOriginal: 8000, pricePromo: 6000 },
        { label: "半斤", spec: "300公克", priceOriginal: 4000, pricePromo: 3200 },
        { label: "4兩", spec: "150公克", priceOriginal: 2000, pricePromo: 1600 },
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
    "付款方式可依訂單安排（如：轉帳等）。請回覆「品項＋數量＋寄送地區」，我會一併提供付款與運送方式。",

  shippingNote:
    "可安排宅配/超商等方式（依地區與品項而定）。請回覆「寄送縣市＋品項＋數量」，我會提供運費與到貨時間預估。",
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

/** =========================
 * C) 產品卡片回覆（像龜鹿膏那種一段式）
 * ========================= */
function buildGelCard() {
  const p = STORE.products.gel;
  return [
    `我們龜鹿膏是${p.spec}。`,
    `目前店內活動是特價 ${money(p.pricePromo)}（原價 ${money(p.priceOriginal)}）。`,
    p.noteDays,
    "",
    p.howTo[0],
    p.howTo[1],
  ].join("\n");
}

function buildDrinkCard() {
  const p = STORE.products.drink;
  return [
    `我們龜鹿飲是${p.spec}。`,
    `售價 ${money(p.priceOriginal)}，優惠價 ${money(p.pricePromo)}。`,
    "",
    p.howTo[0],
    p.howTo[1],
  ].join("\n");
}

function buildAntlerCard() {
  const p = STORE.products.antler;
  return [
    `我們鹿茸粉是${p.spec}。`,
    `售價 ${money(p.priceOriginal)}，優惠價 ${money(p.pricePromo)}。`,
    "",
    p.howTo[0],
    p.howTo[1],
  ].join("\n");
}

function buildSoupCardAll() {
  const p = STORE.products.soup;
  const lines = [
    `我們${p.name}目前有三種規格：`,
    "",
    ...p.variants.flatMap((v) => [
      `${v.label}（${v.spec}）`,
      `售價 ${money(v.priceOriginal)}，優惠價 ${money(v.pricePromo)}`,
      "",
    ]),
    p.howTo[0],
    p.howTo[1],
  ];
  while (lines.length && lines[lines.length - 1] === "") lines.pop();
  return lines.join("\n");
}

function buildSoupCardVariant(labelKey) {
  const p = STORE.products.soup;
  const v = p.variants.find((x) => x.label === labelKey);
  if (!v) return buildSoupCardAll();
  return [
    `我們${p.name}${v.label}是（${v.spec}）。`,
    `售價 ${money(v.priceOriginal)}，優惠價 ${money(v.pricePromo)}。`,
    "",
    p.howTo[0],
    p.howTo[1],
  ].join("\n");
}

/** =========================
 * D) 訂單解析（核心）
 * =========================
 * 支援：
 * - 我要/想買/訂購/下單/購買 + 品項 + 數量(2/兩/包/罐/盒/組) + 寄送縣市
 * - 例：我要龜鹿膏2罐+龜鹿飲10包 寄台中
 * - 例：下單 湯塊一斤1  鹿茸粉2罐  寄送新北
 *
 * 解析結果：
 * {
 *   items: [{key:"gel", name:"龜鹿膏", qty:2, unit:"罐", promoUnitPrice:1500}, ...],
 *   shipCity: "台中",
 *   hasOrderIntent: true/false
 * }
 */

const ORDER_INTENT_WORDS = ["我要", "我想買", "想買", "訂購", "下單", "購買", "訂", "買", "要買"];
const SHIP_WORDS = ["寄", "寄到", "寄送", "送到", "配送", "宅配", "寄去", "寄台", "寄新", "寄高"];

const PRODUCT_ALIASES = [
  { key: "gel", name: STORE.products.gel.name, aliases: ["龜鹿膏", "龜鹿"] },
  { key: "drink", name: STORE.products.drink.name, aliases: ["龜鹿飲", "飲"] },
  { key: "antler", name: STORE.products.antler.name, aliases: ["鹿茸粉", "鹿茸", "鹿粉", "粉"] },
  {
    key: "soup600",
    name: `${STORE.products.soup.name}一斤`,
    aliases: ["湯塊一斤", "一斤湯塊", "湯塊 600", "湯塊600", "600公克湯塊", "600g湯塊", "一斤"],
  },
  {
    key: "soup300",
    name: `${STORE.products.soup.name}半斤`,
    aliases: ["湯塊半斤", "半斤湯塊", "湯塊 300", "湯塊300", "300公克湯塊", "300g湯塊", "半斤"],
  },
  {
    key: "soup150",
    name: `${STORE.products.soup.name}4兩`,
    aliases: ["湯塊4兩", "4兩湯塊", "湯塊四兩", "四兩湯塊", "湯塊 150", "湯塊150", "150公克湯塊", "150g湯塊", "4兩", "四兩"],
  },
];

const CITY_LIST = [
  "台北", "新北", "基隆", "桃園", "新竹", "苗栗",
  "台中", "彰化", "南投", "雲林",
  "嘉義", "台南", "高雄", "屏東",
  "宜蘭", "花蓮", "台東",
  "澎湖", "金門", "馬祖",
];

// 嘗試抓「寄送地區」
function extractShipCity(rawText) {
  // 例：寄台中 / 寄到台中 / 寄送新北 / 送到高雄
  for (const city of CITY_LIST) {
    const patterns = [
      new RegExp(`(寄到|寄送|寄|送到|配送|宅配)\\s*${city}`),
      new RegExp(`${city}\\s*(市|縣)?`),
    ];
    if (patterns[0].test(rawText)) return city;
  }
  return null;
}

// 把「中文數字」簡單轉成阿拉伯數字（僅處理常見 1-10）
function cnNumToInt(token) {
  const map = { "一": 1, "二": 2, "兩": 2, "三": 3, "四": 4, "五": 5, "六": 6, "七": 7, "八": 8, "九": 9, "十": 10 };
  return map[token] ?? null;
}

// 從一段文字中抓「某品項後面的數量」
function extractQtyNear(text, alias) {
  // 允許：
  // 龜鹿膏2罐 / 龜鹿膏 2 罐 / 龜鹿膏兩罐 / 龜鹿膏2
  const unitGroup = "(罐|包|盒|組|份|個)?";
  const numGroup = "([0-9]{1,3}|一|二|兩|三|四|五|六|七|八|九|十)";
  const re = new RegExp(`${alias}\\s*${numGroup}\\s*${unitGroup}`);
  const m = text.match(re);
  if (!m) return null;

  const rawNum = m[1];
  const unit = m[2] || null;

  const qty =
    /^[0-9]+$/.test(rawNum) ? safeInt(rawNum) : cnNumToInt(rawNum);

  if (!qty || qty <= 0) return null;
  return { qty, unit };
}

function getPromoUnitPriceByKey(key) {
  if (key === "gel") return STORE.products.gel.pricePromo;
  if (key === "drink") return STORE.products.drink.pricePromo;
  if (key === "antler") return STORE.products.antler.pricePromo;
  if (key === "soup600") return STORE.products.soup.variants.find(v => v.label === "一斤")?.pricePromo || null;
  if (key === "soup300") return STORE.products.soup.variants.find(v => v.label === "半斤")?.pricePromo || null;
  if (key === "soup150") return STORE.products.soup.variants.find(v => v.label === "4兩")?.pricePromo || null;
  return null;
}

function defaultUnitByKey(key) {
  if (key === "gel") return "罐";
  if (key === "drink") return "包";
  if (key === "antler") return "罐";
  if (key.startsWith("soup")) return "份";
  return "";
}

function parseOrder(rawText) {
  const text = normalizeText(rawText);

  const hasOrderIntent = ORDER_INTENT_WORDS.some(w => rawText.includes(w));
  const shipCity = extractShipCity(rawText);

  // 若有明顯訂單意圖 or 有寄送字眼 or 有數字 + 商品，就嘗試解析
  const shouldTry =
    hasOrderIntent ||
    SHIP_WORDS.some(w => rawText.includes(w)) ||
    /[0-9一二兩三四五六七八九十]/.test(rawText);

  if (!shouldTry) return { hasOrderIntent: false, items: [], shipCity: null };

  const itemsMap = new Map();

  for (const p of PRODUCT_ALIASES) {
    // 找最先命中的 alias（避免粉/湯 這種泛詞干擾）
    const matchedAlias = p.aliases
      .filter(a => rawText.includes(a))
      .sort((a, b) => b.length - a.length)[0];

    if (!matchedAlias) continue;

    const near = extractQtyNear(text, matchedAlias);
    const qty = near?.qty ?? 1; // 沒寫數量，先當 1
    const unit = near?.unit ?? defaultUnitByKey(p.key);
    const promo = getPromoUnitPriceByKey(p.key);

    const id = p.key; // soup600/soup300/soup150/gel/drink/antler
    if (!itemsMap.has(id)) {
      itemsMap.set(id, {
        key: p.key,
        name: p.name,
        qty,
        unit,
        promoUnitPrice: promo,
      });
    } else {
      // 同品項重複出現就累加
      const prev = itemsMap.get(id);
      prev.qty += qty;
      itemsMap.set(id, prev);
    }
  }

  const items = Array.from(itemsMap.values());

  // 若只有泛詞命中造成誤判（例如只有「粉」但沒有買意圖），降低誤觸：
  if (!hasOrderIntent && items.length === 0) {
    return { hasOrderIntent: false, items: [], shipCity: shipCity || null };
  }

  // 若有買意圖但沒解析到品項 → 仍回「下單格式」
  return { hasOrderIntent, items, shipCity };
}

function calcSubtotal(items) {
  let sum = 0;
  for (const it of items) {
    if (typeof it.promoUnitPrice === "number") sum += it.promoUnitPrice * it.qty;
  }
  return sum;
}

function buildOrderReply(parsed) {
  const { items, shipCity, hasOrderIntent } = parsed;

  // 有下單意圖但沒辨識到品項
  if (hasOrderIntent && items.length === 0) {
    return [
      "好的😊 我可以協助您下單！",
      "",
      "麻煩您回覆以下資訊（照這個格式最清楚）：",
      "① 品項（龜鹿膏/龜鹿飲/龜鹿湯塊/鹿茸粉）",
      "② 數量",
      "③ 寄送縣市",
      "④ 收件人姓名／電話／地址",
      "",
      "我收到後會回覆：活動價、運費與付款方式。",
    ].join("\n");
  }

  // 有辨識到品項（不論是否寫「我要」）
  if (items.length > 0) {
    const lines = [
      "我先幫您整理目前需求如下（如有誤可直接更正）👇",
      "",
      ...items.map((it) => {
        const price = typeof it.promoUnitPrice === "number" ? `｜優惠價 ${money(it.promoUnitPrice)} /${it.unit}` : "";
        return `▪️ ${it.name} × ${it.qty} ${it.unit}${price}`;
      }),
    ];

    const subtotal = calcSubtotal(items);
    if (subtotal > 0) {
      lines.push("");
      lines.push(`小計（未含運）：${money(subtotal)}`);
    }

    lines.push("");
    lines.push("為了幫您安排出貨，麻煩再補充👇");
    lines.push(`① 寄送縣市：${shipCity ? shipCity : "（請提供）"}`);
    lines.push("② 收件人姓名：");
    lines.push("③ 收件人電話：");
    lines.push("④ 收件地址：");
    lines.push("");
    lines.push("我收到後會回覆：運費、到貨方式與付款資訊😊");

    return lines.join("\n");
  }

  // 沒買意圖也沒品項
  return null;
}

/** =========================
 * E) 文案（歡迎/追蹤/總表/敏感導流）
 * ========================= */
const TEXT = {
  welcome: [
    `您好，歡迎加入【${STORE.brandName}】😊`,
    "",
    "您可以直接輸入關鍵字快速取得資訊👇",
    "",
    "▪️ 有什麼產品",
    "▪️ 價格 / 售價",
    "▪️ 容量 / 規格",
    "▪️ 龜鹿膏 / 龜鹿飲 / 龜鹿湯塊 / 鹿茸粉",
    "▪️ 門市資訊",
    "",
    "如有個人狀況（孕哺／用藥／慢性病等），",
    "我們會協助轉由合作中醫師一對一說明🙂",
  ].join("\n"),

  followup24h: [
    `您好😊 這裡是【${STORE.brandName}】的小提醒`,
    "",
    "若您想快速了解，可以直接輸入👇",
    "▪️ 龜鹿膏 / 龜鹿飲 / 龜鹿湯塊 / 鹿茸粉",
    "▪️ 價格",
    "▪️ 容量",
    "▪️ 門市資訊",
    "",
    "也可以直接留言您的需求，我們會由專人協助您🙂",
  ].join("\n"),

  products: [
    "目前主要產品如下👇",
    "",
    "▪️ 龜鹿膏（100g/罐）",
    "▪️ 龜鹿飲（180cc/包）",
    "▪️ 龜鹿湯塊（一斤600g／半斤300g／4兩150g）",
    "▪️ 鹿茸粉（二兩75g/罐）",
    "",
    "想看活動價請輸入「價格」",
    "想看規格請輸入「容量」或「規格」",
    "想直接看某產品：輸入產品名即可（例：龜鹿膏）。",
  ].join("\n"),

  pricingAll: [
    "【目前店內活動價】",
    "",
    `▪️ 龜鹿膏 100g/罐：特價 ${money(STORE.products.gel.pricePromo)}（原價 ${money(
      STORE.products.gel.priceOriginal
    )}）`,
    `▪️ 龜鹿飲 180cc/包：優惠價 ${money(STORE.products.drink.pricePromo)}（售價 ${money(
      STORE.products.drink.priceOriginal
    )}）`,
    `▪️ 鹿茸粉 75g/罐：優惠價 ${money(STORE.products.antler.pricePromo)}（售價 ${money(
      STORE.products.antler.priceOriginal
    )}）`,
    "▪️ 龜鹿湯塊：輸入「湯塊價格」可看三種規格",
    "",
    "若您要訂購，也可以直接打：",
    "「我要龜鹿膏2罐+龜鹿飲10包 寄台中」我會幫您整理😊",
  ].join("\n"),

  specsAll: [
    "【容量／規格】",
    "",
    "▪️ 龜鹿膏：100g/罐",
    "▪️ 龜鹿飲：180cc/包",
    "▪️ 鹿茸粉：75g/罐（二兩）",
    "▪️ 龜鹿湯塊：一斤600g／半斤300g／4兩150g",
  ].join("\n"),

  gelCard: buildGelCard(),
  drinkCard: buildDrinkCard(),
  antlerCard: buildAntlerCard(),
  soupCardAll: buildSoupCardAll(),
  soupCard600: buildSoupCardVariant("一斤"),
  soupCard300: buildSoupCardVariant("半斤"),
  soupCard150: buildSoupCardVariant("4兩"),

  testing: ["【檢驗／報告】", "", STORE.testingNote].join("\n"),

  howToBuy: [
    "【怎麼買／下單流程】",
    "",
    "請直接回覆：",
    "① 品項（龜鹿膏/龜鹿飲/湯塊/鹿茸粉）",
    "② 數量",
    "③ 寄送地區（縣市）",
    "④ 收件人姓名／電話／地址",
    "",
    "我會回覆：活動價、運送方式與運費、付款方式。",
  ].join("\n"),

  payment: ["【付款方式】", "", STORE.paymentNote].join("\n"),
  shipping: ["【運送／運費／到貨】", "", STORE.shippingNote].join("\n"),

  storeInfo: [
    "【門市資訊】",
    `店名：${STORE.brandName}`,
    `地址：${STORE.address}`,
    `電話：${STORE.phoneDisplay}`,
    `官網：${STORE.website}`,
  ].join("\n"),

  website: ["官網連結在這裡👇", STORE.website].join("\n"),

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

  fallback: [
    "不好意思，我可能沒有完全理解您的意思 😊",
    "",
    "您可以試試輸入👇",
    "▪️ 價格 / 售價",
    "▪️ 容量 / 規格",
    "▪️ 龜鹿膏 / 龜鹿飲 / 龜鹿湯塊 / 鹿茸粉",
    "▪️ 湯塊價格 / 一斤 / 半斤 / 4兩",
    "▪️ 我要買 / 下單",
    "▪️ 門市資訊",
  ].join("\n"),
};

/** =========================
 * F) users.json（持久化）
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

/** =========================
 * G) 24h 追蹤（穩定版）：cron 掃描 users.json
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
      await client.pushMessage(userId, { type: "text", text: TEXT.followup24h });
      users[userId].followupSent = true;
      users[userId].followupSentAt = Date.now();
      changed = true;
      console.log("24h 追蹤已送出：", userId);
    } catch (err) {
      console.error("24h 推播失敗：", userId, err?.message || err);
      // 不標記 sent，避免暫時失敗就永久不送
    }
  }

  if (changed) saveUsers(users);
}

cron.schedule("*/10 * * * *", () => {
  scanAndSendFollowups().catch((e) => console.error("scan error:", e));
});

/** =========================
 * H) 關鍵字意圖（一般查詢）
 * ========================= */
const INTENT = {
  products: ["有什麼產品", "產品", "品項", "商品", "有哪些", "目錄", "介紹"],
  pricing: ["價格", "售價", "多少錢", "價錢", "報價", "批發", "折扣", "優惠", "活動", "特價"],
  specs: ["容量", "規格", "幾克", "幾g", "公克", "幾cc", "毫升", "ml", "包裝", "多少量", "多大"],

  gel: ["龜鹿膏", "膏"],
  drink: ["龜鹿飲", "飲"],
  soup: ["龜鹿湯塊", "湯塊", "湯"],
  antler: ["鹿茸粉", "鹿茸", "粉"],

  soupPrice: ["湯塊價格", "湯塊售價", "湯塊多少錢", "湯塊特價", "湯塊優惠"],
  soup600: ["一斤湯塊", "湯塊一斤", "600公克", "600g", "一斤"],
  soup300: ["半斤湯塊", "湯塊半斤", "300公克", "300g", "半斤"],
  soup150: ["四兩湯塊", "4兩湯塊", "湯塊四兩", "湯塊4兩", "150公克", "150g", "四兩", "4兩"],

  testing: ["檢驗", "報告", "檢測", "合格", "安全", "八大營養素"],
  howToBuy: ["怎麼買", "下單", "購買", "訂購", "要怎麼訂", "怎麼下訂", "購買方式", "我要買", "怎麼訂"],
  payment: ["付款", "轉帳", "匯款"],
  shipping: ["運送", "寄送", "運費", "到貨", "幾天到", "宅配", "超商", "店到店"],
  storeInfo: ["門市", "店面", "地址", "在哪", "位置", "營業", "電話", "怎麼去", "地點"],
  website: ["官網", "網站", "網址", "網頁"],

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
};

function pickReplyGeneral(userText) {
  const raw = normalizeText(userText);
  const t = raw.toLowerCase();

  // 敏感優先
  if (includesAny(raw, INTENT.sensitive) || includesAny(t, INTENT.sensitive)) return TEXT.sensitive;

  // 指定湯塊規格
  if (includesAny(raw, INTENT.soup600) || includesAny(t, INTENT.soup600)) return TEXT.soupCard600;
  if (includesAny(raw, INTENT.soup300) || includesAny(t, INTENT.soup300)) return TEXT.soupCard300;
  if (includesAny(raw, INTENT.soup150) || includesAny(t, INTENT.soup150)) return TEXT.soupCard150;

  // 門市/官網
  if (includesAny(t, INTENT.storeInfo)) return TEXT.storeInfo;
  if (includesAny(t, INTENT.website)) return TEXT.website;

  // 價格/規格
  if (includesAny(raw, INTENT.soupPrice) || includesAny(t, INTENT.soupPrice)) return TEXT.soupCardAll;

  if (includesAny(t, INTENT.pricing)) {
    if (includesAny(raw, INTENT.gel) || includesAny(t, INTENT.gel)) return TEXT.gelCard;
    if (includesAny(raw, INTENT.drink) || includesAny(t, INTENT.drink)) return TEXT.drinkCard;
    if (includesAny(raw, INTENT.antler) || includesAny(t, INTENT.antler)) return TEXT.antlerCard;
    if (includesAny(raw, INTENT.soup) || includesAny(t, INTENT.soup)) return TEXT.soupCardAll;
    return TEXT.pricingAll;
  }

  if (includesAny(t, INTENT.specs)) return TEXT.specsAll;

  // 直接輸入產品名
  if (includesAny(raw, INTENT.gel) || includesAny(t, INTENT.gel)) return TEXT.gelCard;
  if (includesAny(raw, INTENT.drink) || includesAny(t, INTENT.drink)) return TEXT.drinkCard;
  if (includesAny(raw, INTENT.antler) || includesAny(t, INTENT.antler)) return TEXT.antlerCard;
  if (includesAny(raw, INTENT.soup) || includesAny(t, INTENT.soup)) return TEXT.soupCardAll;

  // 其他
  if (includesAny(t, INTENT.products)) return TEXT.products;
  if (includesAny(t, INTENT.testing)) return TEXT.testing;
  if (includesAny(t, INTENT.howToBuy)) return TEXT.howToBuy;
  if (includesAny(t, INTENT.payment)) return TEXT.payment;
  if (includesAny(t, INTENT.shipping)) return TEXT.shipping;

  return TEXT.fallback;
}

/** =========================
 * I) Webhook
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
  // follow：回歡迎 + 記錄 follow 時間
  if (event.type === "follow") {
    const userId = event.source && event.source.userId;
    if (userId) {
      const users = loadUsers();
      users[userId] = users[userId] || {};
      users[userId].followedAt = users[userId].followedAt || Date.now();
      users[userId].followupSent = users[userId].followupSent || false;
      saveUsers(users);
    }
    return client.replyMessage(event.replyToken, { type: "text", text: TEXT.welcome });
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

  // 只處理文字訊息
  if (event.type !== "message") return null;
  if (!event.message || event.message.type !== "text") return null;

  const userTextRaw = event.message.text || "";

  // ✅ 0) 先做「訂單解析」：若解析到品項/訂單意圖，就優先回訂單整理
  const parsed = parseOrder(userTextRaw);
  const orderReply = buildOrderReply(parsed);
  if (orderReply) {
    return client.replyMessage(event.replyToken, { type: "text", text: orderReply });
  }

  // ✅ 1) 否則走一般查詢回覆
  const replyText = pickReplyGeneral(userTextRaw);
  return client.replyMessage(event.replyToken, { type: "text", text: replyText });
}

app.listen(PORT, () => {
  console.log(`LINE bot webhook listening on port ${PORT}`);
});
