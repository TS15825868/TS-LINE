"use strict";

/**
 * 仙加味・龜鹿 LINE Bot（整包替換版｜方案A：諮詢入口）
 *
 * ✅ 重點功能
 * - Rich Menu「LINE諮詢」送出「諮詢」→ 回「諮詢入口導引」（方案A）
 * - 同義詞全連動：售價/價錢/價格、容量/規格/重量…
 * - 上下文連動：上一句提產品，下一句只問「售價/容量/怎麼買」也能接上
 * - 一句多問合併回覆 + 回覆排序器（避免亂序）+ 去重（避免湯塊重複）
 * - 輪替模板：同一類型回答不會一直同一句
 * - 強化下單解析：
 *    - 支援：龜鹿膏2罐、2罐龜鹿膏、我要買龜鹿飲10包
 *    - 支援：①龜鹿膏 ②1罐 ③台北市... 這種「分行/編號」格式
 * - 下單流程（已依你要求改）：
 *    先選寄送方式（宅配到府 / 超商店到店）→ 姓名 → 電話 → 地址/店到店資訊 → 完整確認
 * - 敏感問題導流合作中醫師（你提供話術）
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
 * A) 店家/產品資料（售價/優惠價 統一用語）
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
      priceList: 1800,   // 售價
      pricePromo: 1500,  // 優惠價
      noteDays: "依每個人食用習慣不同，一罐大約可吃10天～半個月左右。",
      howTo: [
        "一般建議：先從小量、飯後開始（例如小湯匙量），連續觀察幾天；",
        "若本身容易上火、睡不好或口乾，建議減量或隔天吃。",
      ],
      usage: [
        "建議早上或空腹前後食用",
        "一天一次，一小匙（初次可先半匙）",
        "可用熱水化開後搭配溫水，或直接食用",
        "食用期間避免冰飲",
      ],
    },

    drink: {
      name: "龜鹿飲",
      spec: "180cc/包",
      priceList: 200,
      pricePromo: 160,
      usage: [
        "每日一包",
        "可隔水加熱或溫熱飲用",
        "建議早上或白天飲用",
        "飲用期間避免冰飲",
      ],
    },

    antler: {
      name: "鹿茸粉",
      spec: "二兩（75公克）/罐",
      priceList: 2000,
      pricePromo: 1600,
      usage: [
        "一般建議：先從小量開始，搭配溫水或飲品",
        "若容易上火、睡不好或口乾，建議減量或間隔食用",
      ],
    },

    soup: {
      name: "龜鹿湯塊",
      variants: [
        { key: "soup600", label: "一斤", spec: "600公克", priceList: 8000, pricePromo: 6000 },
        { key: "soup300", label: "半斤", spec: "300公克", priceList: 4000, pricePromo: 3200 },
        { key: "soup150", label: "4兩", spec: "150公克", priceList: 2000, pricePromo: 1600 },
      ],
      usage: [
        "依個人口味加水煮滾，可搭配肉類/食材燉煮",
        "建議熱飲熱食，避免冰冷搭配",
      ],
    },
  },

  testingNote:
    "目前我們可提供八大營養素等基本資訊（依批次/包裝標示為準）。如需更詳細資料，歡迎留言，我們整理後回覆您。",
  paymentNote:
    "付款方式可依訂單安排（如：轉帳等）。我整理好訂單後會一併提供付款資訊。",
  shippingNote:
    "可安排宅配/超商店到店（依品項與地區而定）。我收到寄送方式與資料後會提供運費與到貨時間預估。",
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
function cnNumToInt(token) {
  const map = { "一": 1, "二": 2, "兩": 2, "三": 3, "四": 4, "五": 5, "六": 6, "七": 7, "八": 8, "九": 9, "十": 10 };
  return map[token] ?? null;
}
function uniqStrings(arr) {
  const seen = new Set();
  const out = [];
  for (const s of arr) {
    const key = String(s || "").trim();
    if (!key) continue;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(s);
  }
  return out;
}

/** =========================
 * C) Quick Replies
 * ========================= */
function quickRepliesCommon() {
  return {
    items: [
      { type: "action", action: { type: "message", label: "諮詢", text: "諮詢" } },
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
 * D) users.json（持久化）
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
  users[userId].state = users[userId].state || {
    lastProductKey: null,
    lastSeenAt: Date.now(),
    // 輪替模板計數器
    rotation: {},
  };
  users[userId].order = users[userId].order || {
    active: false,
    step: null,
    shipMethod: null,  // home | store
    name: null,
    phone: null,
    address: null,     // 宅配地址 或 店到店資訊
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
  users[userId].state = users[userId].state || { lastProductKey: null, lastSeenAt: Date.now(), rotation: {} };
  users[userId].order = users[userId].order || { active: false, step: null, shipMethod: null, name: null, phone: null, address: null, items: [], updatedAt: Date.now() };
  patchFn(users[userId]);
  users[userId].state.lastSeenAt = Date.now();
  users[userId].order.updatedAt = Date.now();
  saveUsers(users);
}
function resetOrder(userId) {
  updateUser(userId, (u) => {
    u.order = { active: false, step: null, shipMethod: null, name: null, phone: null, address: null, items: [], updatedAt: Date.now() };
  });
}

/** =========================
 * E) 輪替模板（避免一直同一句）
 * ========================= */
function pickTemplate(userState, key, templates) {
  const rotation = userState.rotation || {};
  const idx = rotation[key] || 0;
  const chosen = templates[idx % templates.length];
  // 下一次輪替
  rotation[key] = (idx + 1) % templates.length;
  userState.rotation = rotation;
  return chosen;
}

/** =========================
 * F) 固定文案（用語統一：優惠價/售價）
 * ========================= */
function pricingAll() {
  const p = STORE.products;
  return [
    "【目前優惠價】",
    `▪️ 龜鹿膏 ${p.gel.spec}：優惠價 ${money(p.gel.pricePromo)}（售價 ${money(p.gel.priceList)}）`,
    `▪️ 龜鹿飲 ${p.drink.spec}：優惠價 ${money(p.drink.pricePromo)}（售價 ${money(p.drink.priceList)}）`,
    `▪️ 鹿茸粉 ${p.antler.spec}：優惠價 ${money(p.antler.pricePromo)}（售價 ${money(p.antler.priceList)}）`,
    "▪️ 龜鹿湯塊：輸入「湯塊價格」可看三種規格",
    "",
    "可直接下單（範例）：",
    "我要龜鹿膏2罐＋龜鹿飲10包",
  ].join("\n");
}
function specsAll() {
  return [
    "【容量／規格】",
    `▪️ 龜鹿膏：${STORE.products.gel.spec}`,
    `▪️ 龜鹿飲：${STORE.products.drink.spec}`,
    `▪️ 鹿茸粉：${STORE.products.antler.spec}`,
    "▪️ 龜鹿湯塊：一斤600g／半斤300g／4兩150g",
  ].join("\n");
}
function productListText() {
  return [
    "【產品清單】",
    `▪️ 龜鹿膏（${STORE.products.gel.spec}）`,
    `▪️ 龜鹿飲（${STORE.products.drink.spec}）`,
    `▪️ 鹿茸粉（${STORE.products.antler.spec}）`,
    "▪️ 龜鹿湯塊（一斤600g／半斤300g／4兩150g）",
    "",
    "你也可以直接回：",
    "龜鹿膏 / 龜鹿飲 / 鹿茸粉 / 湯塊價格",
  ].join("\n");
}
function gelFull() {
  const p = STORE.products.gel;
  return [
    `我們龜鹿膏是${p.spec}。`,
    `目前店內活動是優惠價 ${money(p.pricePromo)}（售價 ${money(p.priceList)}）。`,
    p.noteDays,
    "",
    "一般建議：",
    `• ${p.howTo[0]}`,
    `• ${p.howTo[1]}`,
  ].join("\n");
}
function soupPriceAll() {
  const p = STORE.products.soup;
  const lines = ["【龜鹿湯塊｜三種規格價格】", ""];
  for (const v of p.variants) {
    lines.push(`${v.label}（${v.spec}）`);
    lines.push(`優惠價 ${money(v.pricePromo)}（售價 ${money(v.priceList)}）`);
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
  welcomeVariants: [
    [
      `您好，歡迎加入【${STORE.brandName}】😊`,
      "",
      "你可以直接輸入👇",
      "▪️ 諮詢（快速導引）",
      "▪️ 產品名（看有哪些產品）",
      "▪️ 價格 / 售價 / 價錢",
      "▪️ 容量 / 規格 / 重量",
      "▪️ 怎麼買 / 下單",
      "",
      "也可以直接下單：",
      "例：我要龜鹿膏2罐＋龜鹿飲10包",
    ].join("\n"),
    [
      `歡迎加入【${STORE.brandName}】🙂`,
      "想快速了解：回「諮詢」就可以一步一步帶你看價格、容量與下單方式。",
      "",
      "常用指令：產品名 / 價格 / 容量 / 怎麼買 / 湯塊價格 / 門市資訊",
    ].join("\n"),
  ],

  consultEntryVariants: [
    [
      `您好😊 這裡是【${STORE.brandName}】`,
      "我可以先幫你整理常見資訊，或直接協助下單。",
      "",
      "請回覆其中一個即可：",
      "① 想了解：龜鹿膏／龜鹿飲／湯塊／鹿茸粉",
      "② 直接問：價格／容量／怎麼買",
      "③ 直接下單：例 龜鹿膏2罐＋龜鹿飲10包",
      "",
      "若是孕哺／慢性病／用藥等狀況，我會改由合作中醫師協助🙂",
    ].join("\n"),
    [
      `您好～這裡是【${STORE.brandName}】😊`,
      "想問價格/容量/怎麼買都可以直接打，我會自動整理給你～",
      "",
      "也可以直接下單（範例）：龜鹿膏2罐＋龜鹿飲10包",
    ].join("\n"),
  ],

  howToBuyVariants: [
    // 0 通用
    [
      "【怎麼買／下單】",
      "你可以直接打一段話：品項＋數量",
      "例：龜鹿膏2罐 / 龜鹿飲10包 / 鹿茸粉1罐 / 湯塊半斤1份",
      "",
      "我會接著問你：寄送方式（宅配/店到店）→ 收件資料 → 完整確認🙂",
    ].join("\n"),
    // 1 膏
    [
      "好的🙂要下單龜鹿膏，請直接回：",
      "例：龜鹿膏 1罐 / 龜鹿膏 2罐",
      "",
      "接著我會請你選寄送方式：",
      "1) 宅配到府  2) 超商店到店",
    ].join("\n"),
    // 2 飲
    [
      "好的🙂要下單龜鹿飲，請直接回：",
      "例：龜鹿飲 5包 / 龜鹿飲 10包",
      "",
      "接著我會請你選：宅配到府 或 超商店到店🙂",
    ].join("\n"),
    // 3 粉
    [
      "好的🙂要下單鹿茸粉，請直接回：",
      "例：鹿茸粉 1罐 / 鹿茸粉 2罐",
      "",
      "接著我會請你選：宅配到府 或 超商店到店🙂",
    ].join("\n"),
    // 4 湯塊（上下文重點）
    [
      "好的🙂要下單龜鹿湯塊，請先回覆「規格＋數量」：",
      "例：一斤1份 / 半斤2份 / 4兩3份",
      "",
      "接著我會請你選寄送方式：",
      "1) 宅配到府  2) 超商店到店",
    ].join("\n"),
  ],

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

  cancelOrder: "已為您取消本次下單流程。如需重新下單，直接輸入：龜鹿膏2罐 或 龜鹿膏2罐＋龜鹿飲10包 😊",

  fallbackVariants: [
    [
      "我先提供常用指令給您（也可直接留言需求）😊",
      "",
      "▪️ 諮詢",
      "▪️ 產品名",
      "▪️ 價格 / 售價 / 價錢",
      "▪️ 容量 / 規格 / 重量",
      "▪️ 怎麼買 / 下單",
      "▪️ 湯塊價格",
      "▪️ 門市資訊 / 官網 / 來電",
    ].join("\n"),
    [
      "我這邊可以直接幫你整理😊",
      "你可以回：諮詢 / 產品名 / 價格 / 容量 / 怎麼買 / 湯塊價格",
    ].join("\n"),
  ],
};

/** =========================
 * G) 意圖（含 sorter）
 * ========================= */
const INTENT = {
  consult: ["諮詢","客服","真人","專人","有人嗎","請協助","幫我"],
  pricing: ["價格","價錢","售價","多少錢","幾錢","優惠","活動","折扣","報價","批發"],
  specs: ["容量","規格","幾克","幾g","g","公克","克","幾cc","cc","毫升","ml","多大","多少量","重量"],
  productList: ["產品名","有哪些產品","有什麼產品","產品","商品","品項","商品清單","品項清單"],
  buy: ["怎麼買","怎麼購買","下單","訂購","購買","我要買","我要","訂單","訂購方式","怎麼訂"],
  shipping: ["運送","寄送","運費","到貨","配送","宅配","超商","店到店","多久到","幾天到"],
  payment: ["付款","怎麼付","轉帳","匯款","刷卡","貨到付款","付款方式"],
  testing: ["檢驗","報告","檢測","八大營養素","合格","安全","驗證"],
  store: ["門市","店面","地址","在哪","位置","怎麼去","地圖","電話","聯絡","營業時間"],
  website: ["官網","網站","網址","連結"],
  soupPrice: ["湯塊價格","湯塊售價","湯塊多少錢","湯塊優惠"],

  gel: ["龜鹿膏"],
  drink: ["龜鹿飲"],
  antler: ["鹿茸粉"],
  soup: ["龜鹿湯塊","湯塊"],

  sensitive: [
    "孕婦","懷孕","備孕","哺乳","餵母乳",
    "慢性病","三高","高血壓","糖尿病","洗腎","肝","心臟",
    "癌","癌症","化療","放療","手術","術後",
    "用藥","抗凝血","阿斯匹靈","warfarin",
    "能不能吃","可以吃嗎","適不適合","副作用","禁忌"
  ],
  cancel: ["取消","不用了","先不要","改天","取消下單","取消訂單"],

  // 寄送方式（下單流程）
  shipHome: ["宅配","宅配到府","到府","寄到家","寄家裡","送到家"],
  shipStore: ["店到店","超商","711","7-11","全家","萊爾富","OK","超商取貨"],
};

function detectProductKey(raw) {
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
  if (includesAny(raw, INTENT.consult)) intents.add("consult");
  if (includesAny(raw, INTENT.productList)) intents.add("productList");
  if (includesAny(raw, INTENT.soupPrice)) intents.add("soupPrice");
  if (includesAny(raw, INTENT.pricing)) intents.add("pricing");
  if (includesAny(raw, INTENT.specs)) intents.add("specs");
  if (includesAny(raw, INTENT.buy)) intents.add("buy");
  if (includesAny(raw, INTENT.shipping)) intents.add("shipping");
  if (includesAny(raw, INTENT.payment)) intents.add("payment");
  if (includesAny(raw, INTENT.testing)) intents.add("testing");
  if (includesAny(raw, INTENT.store)) intents.add("store");
  if (includesAny(raw, INTENT.website)) intents.add("website");
  if (includesAny(raw, INTENT.shipHome)) intents.add("shipHome");
  if (includesAny(raw, INTENT.shipStore)) intents.add("shipStore");
  return Array.from(intents);
}

// sorter：你要的「排序器」
const INTENT_PRIORITY = [
  "sensitive",
  "cancel",
  "consult",
  "productList",
  "soupPrice",
  "pricing",
  "specs",
  "buy",
  "shipping",
  "payment",
  "testing",
  "store",
  "website",
];

function sortIntents(intents) {
  const rank = new Map(INTENT_PRIORITY.map((k, i) => [k, i]));
  return [...new Set(intents)].sort((a, b) => (rank.get(a) ?? 999) - (rank.get(b) ?? 999));
}

/** =========================
 * H) 訂單解析（品項/數量）
 * ========================= */
const ORDER_INTENT_WORDS = ["我要", "我想買", "想買", "訂購", "下單", "購買", "要買", "訂", "買"];

function looksLikeOrder(rawText) {
  return /([0-9]{1,3}|一|二|兩|三|四|五|六|七|八|九|十)\s*(罐|包|盒|組|份|個)/.test(rawText);
}

function extractQtyUnitAnywhere(text) {
  const m = text.match(/([0-9]{1,3}|一|二|兩|三|四|五|六|七|八|九|十)\s*(罐|包|盒|組|份|個)/);
  if (!m) return null;
  const rawNum = m[1];
  const unit = m[2];
  const qty = /^[0-9]+$/.test(rawNum) ? safeInt(rawNum) : cnNumToInt(rawNum);
  if (!qty || qty <= 0) return null;
  return { qty, unit };
}

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
function listUnitPriceByKey(key) {
  if (key === "gel") return STORE.products.gel.priceList;
  if (key === "drink") return STORE.products.drink.priceList;
  if (key === "antler") return STORE.products.antler.priceList;
  if (key === "soup600") return STORE.products.soup.variants.find(v => v.key === "soup600")?.priceList ?? null;
  if (key === "soup300") return STORE.products.soup.variants.find(v => v.key === "soup300")?.priceList ?? null;
  if (key === "soup150") return STORE.products.soup.variants.find(v => v.key === "soup150")?.priceList ?? null;
  return null;
}
function defaultUnitByKey(key) {
  if (key === "gel") return "罐";
  if (key === "drink") return "包";
  if (key === "antler") return "罐";
  if (String(key).startsWith("soup")) return "份";
  if (key === "soup") return "份";
  return "";
}

const PRODUCT_ALIASES = [
  { key: "gel", name: "龜鹿膏", aliases: ["龜鹿膏"] },
  { key: "drink", name: "龜鹿飲", aliases: ["龜鹿飲"] },
  { key: "antler", name: "鹿茸粉", aliases: ["鹿茸粉"] },
  { key: "soup600", name: "龜鹿湯塊（一斤）", aliases: ["湯塊一斤","一斤湯塊","600公克","600g","一斤"] },
  { key: "soup300", name: "龜鹿湯塊（半斤）", aliases: ["湯塊半斤","半斤湯塊","300公克","300g","半斤"] },
  { key: "soup150", name: "龜鹿湯塊（4兩）", aliases: ["湯塊4兩","4兩湯塊","湯塊四兩","四兩湯塊","150公克","150g","4兩","四兩"] },
];

function parseOrder(rawText) {
  const text = normalizeText(rawText);
  const hasOrderIntent = ORDER_INTENT_WORDS.some(w => rawText.includes(w));
  const shouldTry = hasOrderIntent || looksLikeOrder(rawText);

  // 若完全不像下單且沒提產品
  if (!shouldTry && !includesAny(rawText, ["龜鹿膏","龜鹿飲","鹿茸粉","湯塊","龜鹿湯塊"])) {
    return { hasOrderIntent: false, items: [] };
  }

  const itemsMap = new Map();

  // 抓每個產品的近距離數量
  for (const p of PRODUCT_ALIASES) {
    const matchedAlias = p.aliases
      .filter(a => rawText.includes(a))
      .sort((a, b) => b.length - a.length)[0];
    if (!matchedAlias) continue;

    const before = extractQtyBeforeProduct(text, matchedAlias);
    const after = extractQtyAfterProduct(text, matchedAlias);
    const near = before || after;

    const qty = near?.qty ?? null;
    const unit = (near?.unit ?? null) || defaultUnitByKey(p.key);

    itemsMap.set(p.key, {
      key: p.key,
      name: p.name,
      qty,
      unit,
      promoUnitPrice: promoUnitPriceByKey(p.key),
      listUnitPrice: listUnitPriceByKey(p.key),
    });
  }

  // 若只有一個品項，但數量寫在別處（①②③格式常見）
  if (itemsMap.size === 1) {
    const only = Array.from(itemsMap.values())[0];
    if (!only.qty) {
      const q = extractQtyUnitAnywhere(text);
      if (q) {
        only.qty = q.qty;
        only.unit = q.unit || only.unit;
      } else {
        only.qty = 1;
      }
      itemsMap.set(only.key, only);
    }
  }

  // 多品項：沒抓到 qty 就預設 1，但 unit 仍用各自預設（避免龜鹿飲被顯示成罐）
  for (const [k, it] of itemsMap.entries()) {
    if (!it.qty) it.qty = 1;
    if (!it.unit) it.unit = defaultUnitByKey(k);
    itemsMap.set(k, it);
  }

  return { hasOrderIntent: hasOrderIntent || looksLikeOrder(rawText), items: Array.from(itemsMap.values()) };
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
    const u = it.unit || defaultUnitByKey(it.key);
    const promo = typeof it.promoUnitPrice === "number" ? `優惠價 ${money(it.promoUnitPrice)}/${u}` : "";
    const list = typeof it.listUnitPrice === "number" ? `（售價 ${money(it.listUnitPrice)}/${u}）` : "";
    lines.push(`▪️ ${it.name} × ${it.qty}${u}｜${promo}${list ? " " + list : ""}`.trim());
  }
  const subtotal = calcSubtotal(items);
  if (subtotal > 0) lines.push(`小計（未含運）：${money(subtotal)}`);
  return lines;
}

/** =========================
 * I) 下單流程：先寄送方式 → 姓名 → 電話 → 地址/店到店
 * ========================= */
function computeNextStep(order) {
  if (!order.shipMethod) return "shipMethod";
  if (!order.name) return "name";
  if (!order.phone) return "phone";
  if (!order.address) return "address";
  return null;
}

function buildOrderPrompt(order) {
  if (!order.items || order.items.length === 0) {
    return [
      "好的😊我可以協助您下單！",
      "",
      "請先告訴我：品項＋數量（可直接這樣打）",
      "例：龜鹿膏2罐 / 龜鹿飲10包 / 湯塊半斤1份",
    ].join("\n");
  }

  const summary = orderSummaryLines(order.items || []);
  const head = ["我先幫您整理目前訂單（如有誤可直接更正）👇", "", ...summary].join("\n");

  const next = computeNextStep(order);
  if (!next) {
    const shipText = order.shipMethod === "home" ? "宅配到府" : "超商店到店";
    return [
      head,
      "",
      "✅ 訂單資料已齊全，我確認如下：",
      `寄送方式：${shipText}`,
      `收件人：${order.name}`,
      `電話：${order.phone}`,
      `${order.shipMethod === "home" ? "地址" : "店到店資訊"}：${order.address}`,
      "",
      "我接著會回覆：運費、到貨方式與付款資訊😊",
    ].join("\n");
  }

  if (next === "shipMethod") {
    return [
      head,
      "",
      "請問要用哪種寄送方式呢？回覆 1 或 2 即可：",
      "1) 宅配到府",
      "2) 超商店到店",
    ].join("\n");
  }
  if (next === "name") return [head, "", "請問收件人姓名是？"].join("\n");
  if (next === "phone") return [head, "", `收件人：${order.name}`, "", "請問收件人電話是？"].join("\n");
  if (next === "address") {
    if (order.shipMethod === "home") {
      return [head, "", "請問宅配收件地址是？（含縣市區路號）"].join("\n");
    }
    return [
      head,
      "",
      "請回覆超商店到店資訊（擇一即可）：",
      "A) 超商種類＋門市店名（例：7-11 萬華XX門市）",
      "或",
      "B) 店到店取貨人資訊（例：全家 XX店）",
    ].join("\n");
  }
  return head;
}

function startOrUpdateOrder(userId, parsed) {
  updateUser(userId, (u) => {
    u.order.active = true;

    const map = new Map((u.order.items || []).map((x) => [x.key, x]));
    for (const it of parsed.items || []) {
      const prev = map.get(it.key);
      if (!prev) map.set(it.key, it);
      else {
        prev.qty += it.qty;
        // unit 以原本的為主（避免被錯覆蓋）
        prev.unit = prev.unit || it.unit;
        map.set(it.key, prev);
      }
    }
    u.order.items = Array.from(map.values());
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

  // 可邊聊邊加品項
  const parsed = parseOrder(rawText);
  if (parsed.items && parsed.items.length > 0) startOrUpdateOrder(userId, parsed);

  // 依 step 填寫
  const latest = ensureUser(userId).order;
  const step = computeNextStep(latest);

  if (step === "shipMethod") {
    // 支援 1/2 或文字
    if (raw === "1" || includesAny(raw, INTENT.shipHome)) updateUser(userId, (u) => (u.order.shipMethod = "home"));
    else if (raw === "2" || includesAny(raw, INTENT.shipStore)) updateUser(userId, (u) => (u.order.shipMethod = "store"));
  } else if (step === "name") {
    if (raw.length >= 2 && raw.length <= 10 && !includesAny(raw, ["價格","容量","地址","電話","官網","門市","怎麼買"])) {
      updateUser(userId, (u) => (u.order.name = raw));
    }
  } else if (step === "phone") {
    const digits = rawText.replace(/[^\d]/g, "");
    if (digits.length >= 8 && digits.length <= 15) updateUser(userId, (u) => (u.order.phone = digits));
  } else if (step === "address") {
    if (raw.length >= 4) updateUser(userId, (u) => (u.order.address = rawText.trim()));
  }

  updateUser(userId, (u) => (u.order.step = computeNextStep(u.order)));
  const updated = ensureUser(userId).order;
  return { handled: true, reply: buildOrderPrompt(updated) };
}

/** =========================
 * J) 智慧回覆（方案A + sorter + 去重 + 上下文怎麼買）
 * ========================= */
function buildSmartReply(raw, userState) {
  let intents = detectIntents(raw);
  intents = sortIntents(intents);

  if (intents.includes("sensitive")) return TEXT.sensitive;

  const productKey = detectProductKey(raw) || userState.lastProductKey || null;

  // 只打產品名 → 回該產品資訊（含售價/優惠價）
  if (intents.length === 0 && productKey === "gel") return gelFull();
  if (intents.length === 0 && productKey === "drink") {
    const p = STORE.products.drink;
    return [
      "【龜鹿飲｜飲用方式】",
      ...p.usage.map(x => `• ${x}`),
      "",
      `規格：${p.spec}`,
      `優惠價：${money(p.pricePromo)}（售價 ${money(p.priceList)}）`,
    ].join("\n");
  }
  if (intents.length === 0 && productKey === "antler") {
    const p = STORE.products.antler;
    return [
      "【鹿茸粉｜食用建議】",
      ...p.usage.map(x => `• ${x}`),
      "",
      `規格：${p.spec}`,
      `優惠價：${money(p.pricePromo)}（售價 ${money(p.priceList)}）`,
    ].join("\n");
  }
  if (intents.length === 0 && productKey === "soup") {
    return [
      "【龜鹿湯塊｜使用建議】",
      ...STORE.products.soup.usage.map(x => `• ${x}`),
      "",
      soupPriceAll(),
    ].join("\n");
  }

  const parts = [];

  for (const k of intents) {
    if (k === "consult") {
      parts.push(pickTemplate(userState, "consultEntry", TEXT.consultEntryVariants));
      continue;
    }
    if (k === "productList") { parts.push(productListText()); continue; }
    if (k === "store") { parts.push(storeInfo()); continue; }
    if (k === "website") { parts.push(`官網連結：${STORE.website}`); continue; }
    if (k === "testing") { parts.push(TEXT.testing); continue; }
    if (k === "shipping") { parts.push(TEXT.shipping); continue; }
    if (k === "payment") { parts.push(TEXT.payment); continue; }

    if (k === "soupPrice") {
      parts.push(soupPriceAll());
      continue;
    }

    if (k === "pricing") {
      // 若同時命中「湯塊價格」，價格就交給 soupPrice，不重複
      if (intents.includes("soupPrice")) continue;

      if (productKey === "gel") {
        const p = STORE.products.gel;
        parts.push(`龜鹿膏｜${p.spec}\n優惠價 ${money(p.pricePromo)}（售價 ${money(p.priceList)}）`);
      } else if (productKey === "drink") {
        const p = STORE.products.drink;
        parts.push(`龜鹿飲｜${p.spec}\n優惠價 ${money(p.pricePromo)}（售價 ${money(p.priceList)}）`);
      } else if (productKey === "antler") {
        const p = STORE.products.antler;
        parts.push(`鹿茸粉｜${p.spec}\n優惠價 ${money(p.pricePromo)}（售價 ${money(p.priceList)}）`);
      } else if (productKey === "soup") {
        parts.push(soupPriceAll());
      } else {
        parts.push(pricingAll());
      }
      continue;
    }

    if (k === "specs") {
      if (!productKey) parts.push(specsAll());
      else if (productKey === "gel") parts.push(`龜鹿膏｜規格\n${STORE.products.gel.spec}`);
      else if (productKey === "drink") parts.push(`龜鹿飲｜規格\n${STORE.products.drink.spec}`);
      else if (productKey === "antler") parts.push(`鹿茸粉｜規格\n${STORE.products.antler.spec}`);
      else parts.push("龜鹿湯塊｜規格\n一斤600g／半斤300g／4兩150g");
      continue;
    }

    if (k === "buy") {
      // 上下文怎麼買：依產品選對版本
      let idx = 0;
      if (productKey === "gel") idx = 1;
      else if (productKey === "drink") idx = 2;
      else if (productKey === "antler") idx = 3;
      else if (productKey === "soup") idx = 4;

      parts.push(TEXT.howToBuyVariants[idx]);
      continue;
    }
  }

  // 去重（避免湯塊價格重複）
  const cleanParts = uniqStrings(parts);

  if (cleanParts.length === 0) {
    return pickTemplate(userState, "fallback", TEXT.fallbackVariants);
  }
  return cleanParts.join("\n\n——\n\n");
}

/** =========================
 * K) 24h 追蹤（可保留）
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
      await client.pushMessage(userId, textMessage(`您好😊 這裡是【${STORE.brandName}】\n\n需要快速導引可回：諮詢\n想看清單可回：產品名`));
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
 * L) Webhook
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
      users[userId].followedAt = users[userId].followedAt || Date.now();
      users[userId].followupSent = users[userId].followupSent || false;
      users[userId].state = users[userId].state || { lastProductKey: null, lastSeenAt: Date.now(), rotation: {} };
      users[userId].order = users[userId].order || { active: false, step: null, shipMethod: null, name: null, phone: null, address: null, items: [], updatedAt: Date.now() };
      saveUsers(users);
    }
    const u = ensureUser(userId);
    const welcome = pickTemplate(u.state, "welcome", TEXT.welcomeVariants);
    updateUser(userId, (x) => (x.state = u.state));
    return client.replyMessage(event.replyToken, textMessage(welcome));
  }

  if (event.type !== "message") return null;
  if (!event.message || event.message.type !== "text") return null;

  const userId = event.source && event.source.userId;
  const userTextRaw = event.message.text || "";
  const raw = normalizeText(userTextRaw);

  if (!userId) {
    const reply = buildSmartReply(raw, { lastProductKey: null, rotation: {} });
    return client.replyMessage(event.replyToken, textMessage(reply));
  }

  const user = ensureUser(userId);

  // 1) 訂單流程已啟動：先補資料
  if (user.order && user.order.active) {
    const filled = tryFillOrderFromMessage(userId, userTextRaw);
    if (filled.handled) return client.replyMessage(event.replyToken, textMessage(filled.reply));
  }

  // 2) 解析本句是否為下單（或帶入品項）
  const parsed = parseOrder(userTextRaw);
  if ((parsed.items && parsed.items.length > 0) || parsed.hasOrderIntent) {
    startOrUpdateOrder(userId, parsed);

    // 更新上下文產品（第一個 item）
    const updated = ensureUser(userId);
    if (updated.order.items && updated.order.items.length > 0) {
      // soup600/300/150 也視為 soup 上下文（方便怎麼買）
      const firstKey = updated.order.items[0].key;
      const ctx = String(firstKey).startsWith("soup") ? "soup" : firstKey;
      updateUser(userId, (u) => (u.state.lastProductKey = ctx));
    }

    return client.replyMessage(event.replyToken, textMessage(buildOrderPrompt(updated.order)));
  }

  // 3) 一般全連動回覆
  const pk = detectProductKey(raw);
  if (pk) updateUser(userId, (u) => (u.state.lastProductKey = pk));

  const latest = ensureUser(userId);
  const reply = buildSmartReply(raw, latest.state);

  // 保存 rotation 狀態
  updateUser(userId, (u) => (u.state = latest.state));

  return client.replyMessage(event.replyToken, textMessage(reply));
}

app.listen(PORT, () => console.log(`LINE bot webhook listening on port ${PORT}`));
