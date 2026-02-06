"use strict";

/**
 * 仙加味・龜鹿 LINE Bot（整包替換版｜方案A：諮詢入口｜含排序器＋模板輪替＋不重複回覆）
 *
 * ✅ 重點功能
 * - Rich Menu「LINE諮詢」送出「諮詢」→ 回「諮詢入口導引」（方案A）
 * - 同義詞全連動：售價/價格/價錢、容量/規格/重量/幾cc...
 * - 上下文連動：上一句提產品，下一句只問「價格/容量/怎麼買」也會接上
 * - 一句多問合併回覆（排序器控制回覆順序）
 * - 回覆模板輪替：同意圖不會一直回同一句（避免重複感）
 * - 訂單解析：龜鹿膏2罐 / 2罐龜鹿膏 / 我要龜鹿飲1包 / 分行①②③
 * - 下單流程（已改你要的）：寄送方式(宅配/店到店) → 地址/門市 → 姓名 → 電話 → 確認
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
 * A) 店家/產品資料（用語統一：售價/優惠價）
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
      intro:
        "以全龜板與鹿角為基底，搭配粉光蔘、枸杞、紅棗與黃耆，依家族熬膠工法慢火收膏；質地濃稠、風味厚實。",
      usage: [
        "每日一至兩小匙，不需沖泡，直接內服即可。",
        "若當天搭配龜鹿飲或湯塊，可先維持一匙，觀察作息與精神變化。",
      ],
      ingredients: "全龜板、鹿角、粉光蔘、枸杞、紅棗、黃耆",
      audience: ["想把補養變成固定習慣的人", "希望從日常飲食補充風味厚度與濃度的人", "想先觀察一罐或一個月狀態變化的人"],
    },

    drink: {
      name: "龜鹿飲",
      spec: "180cc/包",
      priceList: 200,    // 售價
      pricePromo: 160,   // 優惠價
      intro:
        "把龜鹿補養濃縮進一包，常溫即可飲用，也可以隔水加溫至微溫；適合作息忙碌、常在外奔波又希望維持補養節奏的人。",
      usage: [
        "一般建議：每日 1 包，可依個人狀況與作息調整頻率。",
        "飲用溫度：可常溫飲用，亦可隔水稍微加溫至溫熱，不建議直接大火煮沸。",
        "時間點：空腹或飯後皆可；若晚間飲用後精神較好，建議改在白天或下午飲用。",
        "若同時搭配龜鹿膏或湯塊，建議先維持「其中一種為主軸」，再討論如何分工安排。",
      ],
      ingredients: "水、全龜板、鹿角、粉光蔘、枸杞、紅棗、黃耆",
      audience: ["工作節奏快、通勤時間長，較少時間能在家熬煮的人", "常出差、跑外務，希望補養能「帶著走」的人", "想用飲品型態補充龜鹿，不需自己調膏、沖泡的人"],
    },

    antler: {
      name: "鹿茸粉",
      spec: "75g/罐",
      priceList: 2000,   // 售價
      pricePromo: 1600,  // 優惠價
      intro:
        "讓補養融入早餐、飲品與三餐料理；不需另開步驟，加在日常飲食中就能持續補充。",
      usage: [
        "加在飲品裡：1 匙加入牛奶、豆漿、優酪乳或果汁中混合飲用。",
        "加在餐食裡：拌入粥品、湯品或溫熱餐食中。",
        "頻率建議：建議每日 1～2 匙，可依個人狀況調整。",
        "搭配其他龜鹿產品時，可透過 LINE 協助安排整體節奏。",
      ],
      ingredients: "鹿茸細粉（實際以產品外包裝標示為準）",
      audience: ["不想額外安排補養步驟，但願意每天照常吃喝的人", "平時早餐喝牛奶、豆漿、優酪乳的人", "希望用飲食調整生活節奏，不想改變作息的人"],
    },

    soup: {
      name: "龜鹿湯塊",
      specNote: "湯塊尺寸皆相同，差別在包裝容量與塊數。",
      variants: [
        { key: "soup600", label: "一斤", spec: "600公克", priceList: 8000, pricePromo: 6000 },
        { key: "soup300", label: "半斤", spec: "300公克", priceList: 4000, pricePromo: 3200 },
        { key: "soup150", label: "4兩",  spec: "150公克", priceList: 2000, pricePromo: 1600 },
      ],
      intro:
        "把龜鹿熬膠濃縮成一塊湯底，一鍋湯就能兼顧風味與補養，全家共享；可做日常飲用或家庭燉湯的基底。",
      usage: [
        "日常飲用（單人或少數人）：將 1 塊湯塊放入保溫瓶或馬克杯中，加入熱水溶解後分次飲用；可依喜好調整水量或湯塊數量。",
        "家庭燉湯（多人共享）：作為雞湯/排骨湯/牛腱湯等湯底使用；建議先從 1～2 塊開始，再依鍋子大小與風味濃度微調；可搭配紅棗、枸杞或習慣食材熬煮。",
        "頻率建議：多數家庭會以每週 1～2 次湯品為主；若與龜鹿膏/龜鹿飲一起搭配，建議先以其中一種為主要補養，再協助調整節奏。",
      ],
      ingredients: "全龜板萃取、鹿角萃取（實際以產品外包裝標示為準）",
      audience: ["平常就會煮湯，想順手兼顧補養的人", "希望家人一起喝，一鍋湯照顧多位成員的族群", "不想長時間顧爐火，但希望湯頭有深度與厚度的人"],
    },
  },

  testingNote:
    "目前可提供八大營養素等基本資訊（依批次/外包裝標示為準）。如需更詳細資料，歡迎留言，我們整理後回覆您。",
  paymentNote:
    "付款方式可依訂單安排（如：轉帳等）。我整理好訂單後會一併提供付款資訊。",
  shippingNote:
    "可安排宅配或超商店到店（依品項與地區而定）。我收到寄送方式與地址/門市後，會提供運費與到貨時間預估。",
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
function clamp(n, min, max) { return Math.max(min, Math.min(max, n)); }
function pickNonEmpty(arr) { return (arr || []).filter(Boolean); }

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
    lastReplySig: null, // 用來避免同一句重複
    rot: {},            // 模板輪替記錄
  };
  users[userId].order = users[userId].order || {
    active: false,
    step: null,
    delivery: null,        // "home" | "store"
    deliveryText: null,    // 使用者原文（宅配/店到店）
    addressOrStore: null,  // 地址或門市
    name: null,
    phone: null,
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
  users[userId].state = users[userId].state || { lastProductKey: null, lastSeenAt: Date.now(), lastReplySig: null, rot: {} };
  users[userId].order = users[userId].order || {
    active: false, step: null, delivery: null, deliveryText: null, addressOrStore: null, name: null, phone: null, items: [], updatedAt: Date.now(),
  };
  patchFn(users[userId]);
  users[userId].state.lastSeenAt = Date.now();
  users[userId].order.updatedAt = Date.now();
  saveUsers(users);
}
function resetOrder(userId) {
  updateUser(userId, (u) => {
    u.order = { active: false, step: null, delivery: null, deliveryText: null, addressOrStore: null, name: null, phone: null, items: [], updatedAt: Date.now() };
  });
}

/** =========================
 * E) 文案（模板輪替用）
 * ========================= */
function pricingAll() {
  const P = STORE.products;
  return [
    "【目前價格】（用語：售價/優惠價）",
    `▪️ 龜鹿膏 ${P.gel.spec}：優惠價 ${money(P.gel.pricePromo)}（售價 ${money(P.gel.priceList)}）`,
    `▪️ 龜鹿飲 ${P.drink.spec}：優惠價 ${money(P.drink.pricePromo)}（售價 ${money(P.drink.priceList)}）`,
    `▪️ 鹿茸粉 ${P.antler.spec}：優惠價 ${money(P.antler.pricePromo)}（售價 ${money(P.antler.priceList)}）`,
    "▪️ 龜鹿湯塊：輸入「湯塊價格」可看三種規格",
    "",
    "要直接下單也可以（任意一句都行）：",
    "例：龜鹿膏2罐 + 龜鹿飲10包",
  ].join("\n");
}
function specsAll() {
  const P = STORE.products;
  return [
    "【容量／規格】",
    `▪️ 龜鹿膏：${P.gel.spec}`,
    `▪️ 龜鹿飲：${P.drink.spec}`,
    `▪️ 鹿茸粉：${P.antler.spec}`,
    "▪️ 龜鹿湯塊：一斤600g／半斤300g／4兩150g",
  ].join("\n");
}
function productListText() {
  const P = STORE.products;
  return [
    "【產品清單】",
    `▪️ 龜鹿膏（${P.gel.spec}）`,
    `▪️ 龜鹿飲（${P.drink.spec}）`,
    `▪️ 鹿茸粉（${P.antler.spec}）`,
    "▪️ 龜鹿湯塊（一斤600g／半斤300g／4兩150g）",
    "",
    "你也可以直接回：龜鹿膏 / 龜鹿飲 / 鹿茸粉 / 湯塊價格",
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
function productFull(key) {
  const P = STORE.products[key];
  if (!P) return null;

  const lines = [];
  lines.push(`【${P.name}】`);
  if (P.intro) lines.push(P.intro);
  lines.push("");
  if (P.spec) lines.push(`規格：${P.spec}`);
  if (typeof P.pricePromo === "number") {
    lines.push(`價格：優惠價 ${money(P.pricePromo)}（售價 ${money(P.priceList)}）`);
  }
  if (P.ingredients) lines.push(`成分：${P.ingredients}`);
  lines.push("");

  // 湯塊另外補規格說明與 variants
  if (key === "soup") {
    lines.push(`規格說明：${STORE.products.soup.specNote}`);
    lines.push(soupPriceAll());
    lines.push("");
  }

  if (Array.isArray(P.usage) && P.usage.length) {
    lines.push("【建議使用方式】");
    for (const u of P.usage) lines.push(`• ${u}`);
    lines.push("");
  }
  if (Array.isArray(P.audience) && P.audience.length) {
    lines.push("【適合族群】");
    for (const a of P.audience) lines.push(`• ${a}`);
  }

  return lines.join("\n").trim();
}

const TEXT = {
  welcome: [
    `您好，歡迎加入【${STORE.brandName}】😊`,
    "",
    "你可以直接輸入👇（任意一句都行）",
    "▪️ 諮詢（快速導引）",
    "▪️ 產品名（看有哪些產品）",
    "▪️ 價格 / 售價 / 價錢",
    "▪️ 容量 / 規格 / 重量",
    "▪️ 怎麼買 / 下單",
    "",
    "也可以直接下單：",
    "例：龜鹿膏2罐 + 龜鹿飲10包",
  ].join("\n"),

  consultEntry: [
    `您好😊 這裡是【${STORE.brandName}】`,
    "我可以先幫你快速整理資訊，或直接協助下單。",
    "",
    "請回覆其中一個即可：",
    "① 想了解：龜鹿膏／龜鹿飲／湯塊／鹿茸粉",
    "② 直接問：價格／容量／怎麼買",
    "③ 直接下單：例 龜鹿膏2罐 + 龜鹿飲10包",
    "",
    "若是孕哺／慢性病／用藥等狀況，我會改由合作中醫師協助你🙂",
  ].join("\n"),

  howToBuyA: [
    "【怎麼買／下單】",
    "你可以直接打一段話：",
    "例：龜鹿膏2罐 + 龜鹿飲10包",
    "",
    "我會接著問你：寄送方式（宅配/店到店）→ 地址/門市 → 姓名 → 電話",
  ].join("\n"),

  howToBuyB: [
    "要下單很簡單😊",
    "直接回我「品項+數量」就可以。",
    "例：龜鹿飲10包 / 鹿茸粉1罐 / 湯塊半斤1份",
    "",
    "接著我會請你選：宅配到府 or 超商店到店。",
  ].join("\n"),

  shipping: ["【運送／運費／到貨】", "", STORE.shippingNote].join("\n"),
  payment: ["【付款方式】", "", STORE.paymentNote].join("\n"),
  testing: ["【檢驗／資料】", "", STORE.testingNote].join("\n"),

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

  cancelOrder: "已為您取消本次下單流程。如需重新下單，直接輸入：龜鹿膏2罐 或 龜鹿膏2罐+龜鹿飲10包 😊",

  fallbackA: [
    "我先給你常用指令😊",
    "▪️ 諮詢",
    "▪️ 產品名",
    "▪️ 價格 / 售價 / 價錢",
    "▪️ 容量 / 規格 / 重量",
    "▪️ 怎麼買 / 下單",
    "▪️ 湯塊價格",
    "▪️ 門市資訊 / 官網 / 來電",
  ].join("\n"),

  fallbackB: [
    "我可能還沒抓到你的需求🙂",
    "你可以直接回：產品名 / 價格 / 容量 / 怎麼買",
    "",
    "或直接告訴我你想了解哪一款：龜鹿膏／龜鹿飲／鹿茸粉／湯塊",
  ].join("\n"),
};

/** =========================
 * F) 意圖（方案A）＋排序器
 * ========================= */
const INTENT = {
  consult: ["諮詢","客服","真人","專人","有人嗎","請協助","幫我","詢問","諮詢入口"],
  pricing: ["價格","價錢","售價","多少錢","幾錢","優惠","活動","折扣","報價","批發"],
  specs: ["容量","規格","幾克","幾g","g","公克","克","幾cc","cc","毫升","ml","多大","多少量","重量","份量"],
  productList: ["產品名","有哪些產品","有什麼產品","產品","商品","品項","清單"],
  buy: ["怎麼買","怎麼購買","下單","訂購","購買","我要買","我要","訂單","訂購方式","怎麼訂","怎麼下單"],
  shipping: ["運送","寄送","運費","到貨","配送","宅配","超商","店到店","多久到","幾天到"],
  payment: ["付款","怎麼付","轉帳","匯款","刷卡","貨到付款","付款方式"],
  testing: ["檢驗","報告","檢測","八大營養素","合格","安全","驗證","成分表"],
  store: ["門市","店面","地址","在哪","位置","怎麼去","地圖","電話","聯絡"],
  website: ["官網","網站","網址","連結"],
  soupPrice: ["湯塊價格","湯塊售價","湯塊多少錢","湯塊優惠"],

  gel: ["龜鹿膏"],
  drink: ["龜鹿飲"],
  antler: ["鹿茸粉"],
  soup: ["龜鹿湯塊","湯塊"],
  soup600: ["湯塊一斤","一斤湯塊","600公克","600g","一斤"],
  soup300: ["湯塊半斤","半斤湯塊","300公克","300g","半斤"],
  soup150: ["湯塊4兩","4兩湯塊","湯塊四兩","四兩湯塊","150公克","150g","4兩","四兩"],

  sensitive: [
    "孕婦","懷孕","備孕","哺乳","餵母乳",
    "慢性病","三高","高血壓","糖尿病","洗腎","肝","心臟",
    "癌","癌症","化療","放療","手術","術後",
    "用藥","抗凝血","阿斯匹靈","warfarin",
    "能不能吃","可以吃嗎","適不適合","副作用","禁忌"
  ],
  cancel: ["取消","不用了","先不要","改天","取消下單","取消訂單"],
};

const INTENT_PRIORITY = [
  "sensitive",
  "cancel",
  "consult",
  "buy",
  "pricing",
  "specs",
  "productList",
  "soupPrice",
  "shipping",
  "payment",
  "testing",
  "store",
  "website",
];

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
  if (includesAny(raw, INTENT.consult)) intents.add("consult");
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

function sortIntents(intents) {
  const idx = new Map(INTENT_PRIORITY.map((k, i) => [k, i]));
  return (intents || []).slice().sort((a, b) => (idx.get(a) ?? 999) - (idx.get(b) ?? 999));
}

/** =========================
 * G) 回覆模板輪替＋避免同句重複
 * ========================= */
function rotPick(userState, key, variants) {
  const arr = pickNonEmpty(variants);
  if (!arr.length) return "";

  const rot = userState.rot || {};
  const last = safeInt(rot[key]) ?? 0;

  // 讓同意圖輪替（0→1→2→0…）
  const next = (last + 1) % arr.length;
  rot[key] = next;

  // 寫回 state.rot（呼叫端要 updateUser）
  userState.rot = rot;
  return arr[next];
}

function buildReplySig(text) {
  // 粗略 fingerprint：去空白＋截前 120
  return normalizeText(text).replace(/\s+/g, "").slice(0, 120);
}

function ensureNotRepeat(userId, userState, candidateText) {
  const sig = buildReplySig(candidateText);
  const lastSig = userState.lastReplySig || null;
  if (sig && lastSig && sig === lastSig) {
    // 若剛好同句，再加一個「短變體」避免完全相同
    return candidateText + "\n\n（若你想更快，我也可以直接幫你整理成：品項＋數量 😊）";
  }
  updateUser(userId, (u) => { u.state.lastReplySig = sig; u.state.rot = userState.rot || {}; });
  return candidateText;
}

/** =========================
 * H) 訂單解析（強化：分行/編號/數量分離）
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
  const P = STORE.products;
  if (key === "gel") return P.gel.pricePromo;
  if (key === "drink") return P.drink.pricePromo;
  if (key === "antler") return P.antler.pricePromo;
  if (key === "soup600") return P.soup.variants.find(v => v.key === "soup600")?.pricePromo ?? null;
  if (key === "soup300") return P.soup.variants.find(v => v.key === "soup300")?.pricePromo ?? null;
  if (key === "soup150") return P.soup.variants.find(v => v.key === "soup150")?.pricePromo ?? null;
  return null;
}
function listUnitPriceByKey(key) {
  const P = STORE.products;
  if (key === "gel") return P.gel.priceList;
  if (key === "drink") return P.drink.priceList;
  if (key === "antler") return P.antler.priceList;
  if (key === "soup600") return P.soup.variants.find(v => v.key === "soup600")?.priceList ?? null;
  if (key === "soup300") return P.soup.variants.find(v => v.key === "soup300")?.priceList ?? null;
  if (key === "soup150") return P.soup.variants.find(v => v.key === "soup150")?.priceList ?? null;
  return null;
}
function defaultUnitByKey(key) {
  if (key === "gel") return "罐";
  if (key === "drink") return "包";
  if (key === "antler") return "罐";
  if (String(key).startsWith("soup")) return "份";
  return "";
}

const PRODUCT_ALIASES = [
  { key: "gel", name: "龜鹿膏", aliases: ["龜鹿膏"] },
  { key: "drink", name: "龜鹿飲", aliases: ["龜鹿飲"] },
  { key: "antler", name: "鹿茸粉", aliases: ["鹿茸粉"] },
  { key: "soup600", name: "龜鹿湯塊一斤", aliases: ["湯塊一斤","一斤湯塊","600公克湯塊","600g湯塊","一斤"] },
  { key: "soup300", name: "龜鹿湯塊半斤", aliases: ["湯塊半斤","半斤湯塊","300公克湯塊","300g湯塊","半斤"] },
  { key: "soup150", name: "龜鹿湯塊4兩",  aliases: ["湯塊4兩","4兩湯塊","湯塊四兩","四兩湯塊","150公克湯塊","150g湯塊","4兩","四兩"] },
];

function parseOrder(rawText) {
  const text = normalizeText(rawText);
  const hasOrderIntent = ORDER_INTENT_WORDS.some(w => rawText.includes(w));

  const shouldTry = hasOrderIntent || looksLikeOrder(rawText);
  if (!shouldTry && !includesAny(rawText, ["龜鹿膏","龜鹿飲","鹿茸粉","湯塊"])) {
    return { hasOrderIntent: false, items: [] };
  }

  const itemsMap = new Map();

  // 先抓「產品 + 近距離數量」
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

  // 若只有一個品項但數量在別行（①龜鹿膏 ②2罐）
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

  // 多品項未抓到 qty → 預設 1
  for (const [k, it] of itemsMap.entries()) {
    if (!it.qty) it.qty = 1;
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
    const price = (typeof it.promoUnitPrice === "number")
      ? `｜優惠價 ${money(it.promoUnitPrice)}/${it.unit}（售價 ${money(it.listUnitPrice)}/${it.unit}）`
      : "";
    lines.push(`▪️ ${it.name} × ${it.qty}${it.unit}${price}`);
  }
  const subtotal = calcSubtotal(items);
  if (subtotal > 0) lines.push(`小計（未含運）：${money(subtotal)}`);
  return lines;
}

/** =========================
 * I) 下單流程（改成：寄送方式→地址/門市→姓名→電話）
 * ========================= */
function detectDelivery(rawText) {
  const t = normalizeText(rawText);
  if (includesAny(t, ["店到店","超商","7-11","711","全家","萊爾富","ok","OK"])) return { delivery: "store", label: "超商店到店" };
  if (includesAny(t, ["宅配","寄到家","到府","住址","地址"])) return { delivery: "home", label: "宅配到府" };
  // 使用者只回「1」「2」
  if (/^\s*1\s*$/.test(t)) return { delivery: "home", label: "宅配到府" };
  if (/^\s*2\s*$/.test(t)) return { delivery: "store", label: "超商店到店" };
  return null;
}

function computeNextStep(order) {
  if (!order.delivery) return "delivery";
  if (!order.addressOrStore) return "addressOrStore";
  if (!order.name) return "name";
  if (!order.phone) return "phone";
  return null;
}

function buildOrderPrompt(order) {
  const summary = orderSummaryLines(order.items || []);
  const head = ["我先幫您整理目前訂單（如有誤可直接更正）👇", "", ...summary].join("\n");

  if (!order.items || order.items.length === 0) {
    return [
      "好的😊 我可以協助您下單！",
      "",
      "請先告訴我您要的品項與數量（可直接這樣打）：",
      "例：龜鹿膏2罐 / 龜鹿飲10包 / 湯塊半斤1份",
    ].join("\n");
  }

  const next = computeNextStep(order);
  if (!next) {
    const deliveryLabel = order.delivery === "store" ? "超商店到店" : "宅配到府";
    return [
      head,
      "",
      "✅ 訂單資料已齊全，我確認如下：",
      `寄送方式：${deliveryLabel}`,
      `地址/門市：${order.addressOrStore}`,
      `收件人：${order.name}`,
      `電話：${order.phone}`,
      "",
      "我接著會回覆：運費、到貨方式與付款資訊😊",
    ].join("\n");
  }

  if (next === "delivery") {
    return [
      head,
      "",
      "請問要用哪種寄送方式呢？回覆 1 或 2 即可：",
      "1) 宅配到府",
      "2) 超商店到店",
    ].join("\n");
  }

  if (next === "addressOrStore") {
    if (order.delivery === "store") {
      return [
        head,
        "",
        "好👌 請貼上「超商店到店」取貨門市資訊（任一種都可以）：",
        "▪️ 7-11 / 全家 的門市名稱 或 門市代碼",
        "（例如：全家 XX店 / 7-11 XX門市）",
      ].join("\n");
    }
    return [
      head,
      "",
      "好👌 請回覆「收件地址」（含縣市區路段門牌）。",
    ].join("\n");
  }

  if (next === "name") {
    return [head, "", "請問收件人姓名是？"].join("\n");
  }

  if (next === "phone") {
    return [head, "", "請問收件人電話是？"].join("\n");
  }

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

  // 允許在流程中補品項
  const parsed = parseOrder(rawText);
  if (parsed.items && parsed.items.length > 0) startOrUpdateOrder(userId, parsed);

  const latest = ensureUser(userId).order;
  const step = computeNextStep(latest);

  if (step === "delivery") {
    const d = detectDelivery(rawText);
    if (d) updateUser(userId, (u) => { u.order.delivery = d.delivery; u.order.deliveryText = d.label; });
  } else if (step === "addressOrStore") {
    const d = latest.delivery;
    if (d === "store") {
      // 店到店：要有門市資訊
      if (raw.length >= 3) updateUser(userId, (u) => (u.order.addressOrStore = rawText.trim()));
    } else {
      // 宅配：要像地址
      if (raw.length >= 6) updateUser(userId, (u) => (u.order.addressOrStore = rawText.trim()));
    }
  } else if (step === "name") {
    if (raw.length >= 2 && raw.length <= 10 && !includesAny(raw, ["價格","容量","地址","電話","官網","門市","店到店","宅配"])) {
      updateUser(userId, (u) => (u.order.name = raw));
    }
  } else if (step === "phone") {
    const digits = rawText.replace(/[^\d]/g, "");
    if (digits.length >= 8 && digits.length <= 15) updateUser(userId, (u) => (u.order.phone = digits));
  }

  updateUser(userId, (u) => (u.order.step = computeNextStep(u.order)));
  const updated = ensureUser(userId).order;
  return { handled: true, reply: buildOrderPrompt(updated) };
}

/** =========================
 * J) 全連動回覆（方案A＋排序器＋輪替）
 * ========================= */
function buildSmartReply(raw, userState) {
  let intents = detectIntents(raw);
  intents = sortIntents(intents);

  if (intents.includes("sensitive")) return TEXT.sensitive;

  const productKey = detectProductKey(raw) || userState.lastProductKey || null;

  // 只打產品名（且沒有其他意圖）→ 回官網一致的完整介紹
  if (intents.length === 0 && productKey) {
    const key = (String(productKey).startsWith("soup") ? "soup" : productKey);
    const full = productFull(key);
    return full || TEXT.fallbackA;
  }

  const parts = [];

  // 方案A：諮詢入口
  if (intents.includes("consult")) parts.push(TEXT.consultEntry);

  // 產品清單
  if (intents.includes("productList")) parts.push(productListText());

  // 門市 / 官網
  if (intents.includes("store")) parts.push(storeInfo());
  if (intents.includes("website")) parts.push(`官網連結：${STORE.website}`);

  // 檢驗 / 運送 / 付款
  if (intents.includes("testing")) parts.push(TEXT.testing);
  if (intents.includes("shipping")) parts.push(TEXT.shipping);
  if (intents.includes("payment")) parts.push(TEXT.payment);

  // 怎麼買（輪替兩種說法）
  if (intents.includes("buy")) {
    const how = rotPick(userState, "buy", [TEXT.howToBuyA, TEXT.howToBuyB]);
    parts.push(how);
  }

  // 湯塊價格
  if (intents.includes("soupPrice")) parts.push(soupPriceAll());

  // 價格（有上下文產品就回單品；沒有就回總表）
  if (intents.includes("pricing") && !intents.includes("soupPrice")) {
    const key = (String(productKey).startsWith("soup") ? "soup" : productKey);
    if (key === "gel") {
      const p = STORE.products.gel;
      parts.push(`【龜鹿膏｜價格】\n優惠價 ${money(p.pricePromo)}（售價 ${money(p.priceList)}）\n規格：${p.spec}`);
    } else if (key === "drink") {
      const p = STORE.products.drink;
      parts.push(`【龜鹿飲｜價格】\n優惠價 ${money(p.pricePromo)}（售價 ${money(p.priceList)}）\n規格：${p.spec}`);
    } else if (key === "antler") {
      const p = STORE.products.antler;
      parts.push(`【鹿茸粉｜價格】\n優惠價 ${money(p.pricePromo)}（售價 ${money(p.priceList)}）\n規格：${p.spec}`);
    } else if (key === "soup") {
      parts.push(soupPriceAll());
    } else {
      // 無上下文 → 輪替兩種總表（避免一直同句）
      const v1 = pricingAll();
      const v2 = pricingAll().replace("【目前價格】", "【價格整理】");
      parts.push(rotPick(userState, "pricingAll", [v1, v2]));
    }
  }

  // 容量/規格（有上下文產品就回單品；沒有就回總表）
  if (intents.includes("specs")) {
    const key = (String(productKey).startsWith("soup") ? "soup" : productKey);
    if (!key) {
      const v1 = specsAll();
      const v2 = specsAll().replace("【容量／規格】", "【規格整理】");
      parts.push(rotPick(userState, "specsAll", [v1, v2]));
    } else if (key === "gel") parts.push(`【龜鹿膏｜規格】\n${STORE.products.gel.spec}`);
    else if (key === "drink") parts.push(`【龜鹿飲｜規格】\n${STORE.products.drink.spec}`);
    else if (key === "antler") parts.push(`【鹿茸粉｜規格】\n${STORE.products.antler.spec}`);
    else parts.push("【龜鹿湯塊｜規格】\n一斤600g／半斤300g／4兩150g");
  }

  // 若同時問「價格＋容量」等，最後補一句「也可直接下單」
  if (intents.includes("pricing") || intents.includes("specs")) {
    parts.push(rotPick(userState, "softCTA", [
      "要直接下單也可以：例「龜鹿膏2罐 + 龜鹿飲10包」😊",
      "若你已決定品項，直接回「品項+數量」我就幫你往下走😊",
    ]));
  }

  if (parts.length === 0) {
    const fb = rotPick(userState, "fallback", [TEXT.fallbackA, TEXT.fallbackB]);
    return fb;
  }

  return parts.join("\n\n——\n\n");
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
      await client.pushMessage(
        userId,
        textMessage(`您好😊 這裡是【${STORE.brandName}】\n\n需要快速導引可回：諮詢\n想看清單可回：產品名\n想看價格可回：價格`)
      );
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
 * L) Webhook / health
 * ========================= */
app.get("/", (req, res) => res.status(200).send("OK"));
app.get("/health", (req, res) => res.status(200).json({ ok: true, ts: Date.now() }));

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
      users[userId].state = users[userId].state || { lastProductKey: null, lastSeenAt: Date.now(), lastReplySig: null, rot: {} };
      users[userId].order = users[userId].order || {
        active: false, step: null, delivery: null, deliveryText: null, addressOrStore: null, name: null, phone: null, items: [], updatedAt: Date.now(),
      };
      saveUsers(users);
    }
    return client.replyMessage(event.replyToken, textMessage(TEXT.welcome));
  }

  if (event.type !== "message") return null;
  if (!event.message || event.message.type !== "text") return null;

  const userId = event.source && event.source.userId;
  const userTextRaw = event.message.text || "";
  const raw = normalizeText(userTextRaw);

  // 沒 userId（極少）
  if (!userId) {
    const reply = buildSmartReply(raw, { lastProductKey: null, rot: {}, lastReplySig: null });
    return client.replyMessage(event.replyToken, textMessage(reply));
  }

  const user = ensureUser(userId);

  // 0) 取消
  if (includesAny(raw, INTENT.cancel)) {
    resetOrder(userId);
    return client.replyMessage(event.replyToken, textMessage(TEXT.cancelOrder));
  }

  // 1) 訂單流程已啟動：先補資料
  if (user.order && user.order.active) {
    const filled = tryFillOrderFromMessage(userId, userTextRaw);
    if (filled.handled) return client.replyMessage(event.replyToken, textMessage(filled.reply));
  }

  // 2) 解析本句是否為下單（品項/數量）
  const parsed = parseOrder(userTextRaw);
  if ((parsed.items && parsed.items.length > 0) || parsed.hasOrderIntent) {
    startOrUpdateOrder(userId, parsed);

    // 更新上下文產品（第一個 item）
    const updated = ensureUser(userId);
    if (updated.order.items && updated.order.items.length > 0) {
      updateUser(userId, (u) => (u.state.lastProductKey = updated.order.items[0].key));
    }

    return client.replyMessage(event.replyToken, textMessage(buildOrderPrompt(updated.order)));
  }

  // 3) 一般全連動回覆
  const pk = detectProductKey(raw);
  if (pk) updateUser(userId, (u) => (u.state.lastProductKey = pk));

  const latest = ensureUser(userId);
  const state = latest.state;

  // buildSmartReply 會改 state.rot（輪替記錄），所以傳可變 state
  const replyRaw = buildSmartReply(raw, state);

  // 避免同一句重複
  const finalReply = ensureNotRepeat(userId, state, replyRaw);

  return client.replyMessage(event.replyToken, textMessage(finalReply));
}

app.listen(PORT, () => console.log(`LINE bot webhook listening on port ${PORT}`));
