"use strict";

/**
 * 仙加味・龜鹿 LINE Bot（整包替換版｜方案A：諮詢入口）
 *
 * ✅ 功能
 * - Rich Menu「LINE諮詢」送出「諮詢」→ 回「諮詢入口導引」(方案A)
 * - 同義詞全連動：售價/價錢/價格、容量/規格/重量…
 * - 上下文連動：上一句提產品，下一句只問「價格/容量/怎麼買」也會接上
 * - 一句多問合併回覆
 * - 強化下單解析：
 *    - 支援：龜鹿膏2罐、2罐龜鹿膏、我要買龜鹿飲1包
 *    - 支援：①龜鹿膏 ②1罐 ③台北市... 這種「分行/編號」格式
 *    - 若有產品但數量寫在別處，會自動套到該產品（單一品項時）
 * - 下單流程：縣市 → 姓名 → 電話 → 地址 → 完整確認
 * - 敏感問題導流合作中醫師（你提供話術）
 *
 * ✅ 新增（你要求的）
 * - 模板輪替：同一意圖短時間重複問 → 不會一直貼同一段
 * - 去重：2分鐘內同一段內容完全相同 → 改回「我剛剛回覆過…」避免鬼打牆
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
      priceOriginal: 1800,
      pricePromo: 1500,
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
      priceOriginal: 200,
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
      priceOriginal: 2000,
      pricePromo: 1600,
      usage: [
        "一般建議：先從小量開始，搭配溫水或飲品",
        "若容易上火、睡不好或口乾，建議減量或間隔食用",
      ],
    },

    soup: {
      name: "龜鹿湯塊",
      variants: [
        { key: "soup600", label: "一斤", spec: "600公克", priceOriginal: 8000, pricePromo: 6000 },
        { key: "soup300", label: "半斤", spec: "300公克", priceOriginal: 4000, pricePromo: 3200 },
        { key: "soup150", label: "4兩", spec: "150公克", priceOriginal: 2000, pricePromo: 1600 },
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
function cnNumToInt(token) {
  const map = { "一": 1, "二": 2, "兩": 2, "三": 3, "四": 4, "五": 5, "六": 6, "七": 7, "八": 8, "九": 9, "十": 10 };
  return map[token] ?? null;
}

/** =========================
 * B-2) 去重 + 模板輪替（新增）
 * ========================= */
function simpleHash(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = ((h << 5) - h) + str.charCodeAt(i);
  return String(h >>> 0);
}
function shouldDedupeReply(userObj, replyText) {
  const cache = userObj?.state?.replyCache;
  if (!cache) return { dedupe: false, newText: replyText };

  const now = Date.now();
  const hash = simpleHash(replyText);
  const within = (now - (cache.lastAt || 0)) < 2 * 60 * 1000; // 2 分鐘
  const same = cache.lastHash && cache.lastHash === hash;

  if (within && same) {
    cache.repeatCount = (cache.repeatCount || 0) + 1;
    const alt = [
      "我剛剛已回覆過這段資訊😊",
      "要我再貼一次完整內容嗎？",
      "或您也可以直接回我：",
      "① 品項（龜鹿膏/龜鹿飲/湯塊/鹿茸粉）",
      "② 數量",
      "③ 寄送縣市",
      "例：龜鹿膏2罐 寄台北",
    ].join("\n");
    return { dedupe: true, newText: alt };
  }

  cache.lastText = replyText;
  cache.lastHash = hash;
  cache.lastAt = now;
  cache.repeatCount = 0;
  return { dedupe: false, newText: replyText };
}
function nextRotation(userObj, key, windowMs = 3 * 60 * 1000) {
  const now = Date.now();
  userObj.state.rotate = userObj.state.rotate || {};
  const slot = userObj.state.rotate[key] || { lastAt: 0, n: 0 };
  if (now - slot.lastAt > windowMs) slot.n = 0;
  slot.n += 1;
  slot.lastAt = now;
  userObj.state.rotate[key] = slot;
  return slot.n; // 1,2,3...
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
  users[userId].state = users[userId].state || { lastProductKey: null, lastSeenAt: Date.now() };

  // ✅ 新增：輪替 + 去重 cache
  users[userId].state.rotate = users[userId].state.rotate || {};
  users[userId].state.replyCache = users[userId].state.replyCache || {
    lastText: null,
    lastHash: null,
    lastAt: 0,
    repeatCount: 0,
  };

  users[userId].order = users[userId].order || {
    active: false, step: null, shipCity: null, name: null, phone: null, address: null, items: [], updatedAt: Date.now(),
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
  users[userId].state.rotate = users[userId].state.rotate || {};
  users[userId].state.replyCache = users[userId].state.replyCache || { lastText: null, lastHash: null, lastAt: 0, repeatCount: 0 };

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
 * E) 固定文案
 * ========================= */
function pricingAll() {
  return [
    "【目前店內活動價】",
    `▪️ 龜鹿膏 ${STORE.products.gel.spec}：特價 ${money(STORE.products.gel.pricePromo)}（原價 ${money(STORE.products.gel.priceOriginal)}）`,
    `▪️ 龜鹿飲 ${STORE.products.drink.spec}：優惠價 ${money(STORE.products.drink.pricePromo)}（售價 ${money(STORE.products.drink.priceOriginal)}）`,
    `▪️ 鹿茸粉 ${STORE.products.antler.spec}：優惠價 ${money(STORE.products.antler.pricePromo)}（售價 ${money(STORE.products.antler.priceOriginal)}）`,
    "▪️ 龜鹿湯塊：輸入「湯塊價格」可看三種規格",
    "",
    "可直接下單：",
    "例：2罐龜鹿膏 / 我要龜鹿膏2罐+龜鹿飲10包 寄台中",
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
    `▪️ 鹿茸粉（75g/罐）`,
    "▪️ 龜鹿湯塊（一斤600g／半斤300g／4兩150g）",
    "",
    "您可以直接回：",
    "「龜鹿膏 / 龜鹿飲 / 鹿茸粉 / 湯塊價格」",
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

/** =========================
 * E-2) 輪替模板庫（新增）
 * ========================= */
function pricingOne(productKey) {
  if (productKey === "gel") return `龜鹿膏｜${STORE.products.gel.spec}\n特價 ${money(STORE.products.gel.pricePromo)}（原價 ${money(STORE.products.gel.priceOriginal)}）`;
  if (productKey === "drink") return `龜鹿飲｜${STORE.products.drink.spec}\n優惠價 ${money(STORE.products.drink.pricePromo)}（售價 ${money(STORE.products.drink.priceOriginal)}）`;
  if (productKey === "antler") return `鹿茸粉｜${STORE.products.antler.spec}\n優惠價 ${money(STORE.products.antler.pricePromo)}（售價 ${money(STORE.products.antler.priceOriginal)}）`;
  if (productKey === "soup" || String(productKey).startsWith("soup")) return soupPriceAll();
  return pricingAll();
}
function specsOne(productKey) {
  if (!productKey) return specsAll();
  if (productKey === "gel") return `龜鹿膏｜規格\n${STORE.products.gel.spec}`;
  if (productKey === "drink") return `龜鹿飲｜規格\n${STORE.products.drink.spec}`;
  if (productKey === "antler") return `鹿茸粉｜規格\n${STORE.products.antler.spec}`;
  return "龜鹿湯塊｜規格\n一斤600g／半斤300g／4兩150g";
}

const TEMPLATES = {
  pricing: (productKey) => ([
    // 1 完整
    pricingOne(productKey),
    // 2 精簡 + 追問
    productKey
      ? "我可以再幫您補上「怎麼買/寄送」😊\n請回我：數量 + 寄送縣市（例：2罐 寄台北）"
      : "想問哪一款的價格呢？回我：龜鹿膏／龜鹿飲／湯塊／鹿茸粉",
    // 3 引導下單
    "我可以直接幫您下單🙂\n請回：品項 + 數量 + 寄送縣市\n例：龜鹿膏2罐 寄台北",
    // 4 只問關鍵
    "請回我：品項/數量/寄送縣市（例：龜鹿飲10包 寄台中）我立刻幫您整理～",
  ]),
  specs: (productKey) => ([
    specsOne(productKey),
    productKey
      ? "要不要我也把「價格/怎麼買」一起整理給您？（回：價格／怎麼買）"
      : "想問哪一款的容量呢？回我：龜鹿膏／龜鹿飲／湯塊／鹿茸粉",
    "若要直接下單：回「品項 + 數量 + 寄送縣市」🙂\n例：鹿茸粉1罐 寄新北",
    "請回：品項 + 數量 + 寄送縣市，我幫您整理。",
  ]),
  buy: () => ([
    TEXT.howToBuy,
    "最快下單方式：直接回「品項 + 數量 + 寄送縣市」🙂\n例：龜鹿膏2罐 寄台北",
    "如果您只想先問價格/容量也可以～回：價格／容量",
    "請回：品項 + 數量 + 寄送縣市，我立刻幫您整理～",
  ]),
  store: () => ([
    storeInfo(),
    `也可以直接來電：${STORE.phoneDisplay}`,
    "需要我幫您安排寄送也可以：回「品項 + 數量 + 寄送縣市」🙂",
    "要我直接幫您下單嗎？回：品項 + 數量 + 寄送縣市",
  ]),
  consult: () => ([
    TEXT.consultEntry,
    "您也可以直接一句話下單：例 龜鹿膏2罐 寄台北 🙂",
    "如果只想先看價格：回「價格」；看容量：回「容量」",
    "我可以直接幫您整理：品項 + 數量 + 寄送縣市",
  ]),
};

const TEXT = {
  welcome: [
    `您好，歡迎加入【${STORE.brandName}】😊`,
    "",
    "您可以直接輸入👇",
    "▪️ 諮詢（快速導引）",
    "▪️ 產品名（看有哪些產品）",
    "▪️ 價格 / 售價 / 價錢",
    "▪️ 容量 / 規格 / 重量",
    "▪️ 怎麼買 / 下單",
    "",
    "也可以直接下單：",
    "例：我要龜鹿膏2罐+龜鹿飲10包 寄台中",
  ].join("\n"),

  consultEntry: [
    `您好😊 這裡是【${STORE.brandName}】`,
    "我可以先幫您快速整理常見資訊，或直接協助下單。",
    "",
    "請回覆其中一個即可：",
    "① 想了解：龜鹿膏／龜鹿飲／湯塊／鹿茸粉",
    "② 直接問：價格／容量／怎麼買",
    "③ 直接下單：例 2罐龜鹿膏、或 龜鹿膏2罐+龜鹿飲10包 寄台中",
    "",
    "若是孕哺／慢性病／用藥等狀況，我會改由合作中醫師協助您🙂",
  ].join("\n"),

  howToBuy: [
    "【怎麼買／下單流程】",
    "您可以直接打一段話：",
    "例：我要龜鹿膏2罐+龜鹿飲10包 寄台中",
    "",
    "或用編號也可以：",
    "① 品項（龜鹿膏/龜鹿飲/湯塊/鹿茸粉）",
    "② 數量（例：1罐/10包/一斤1份）",
    "③ 寄送縣市（例：台北/新北/台中）",
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

  cancelOrder: "已為您取消本次下單流程。如需重新下單，直接輸入：2罐龜鹿膏 或 我要龜鹿膏2罐+龜鹿飲10包 寄台中 😊",

  fallback: [
    "我想確認一下您的需求😊",
    "請回我其中一個即可：",
    "① 品項（龜鹿膏/龜鹿飲/湯塊/鹿茸粉）",
    "② 想了解：價格／容量／怎麼買／門市",
    "",
    "也可以直接下單：例 龜鹿膏2罐 寄台北",
  ].join("\n"),
};

/** =========================
 * F) 意圖（方案A：諮詢入口）
 * ========================= */
const INTENT = {
  consult: ["諮詢","客服","真人","專人","有人嗎","請協助","幫我"],
  pricing: ["價格","價錢","售價","多少錢","幾錢","特價","優惠","活動","折扣","報價","批發"],
  specs: ["容量","規格","幾克","幾g","g","公克","克","幾cc","cc","毫升","ml","多大","多少量","重量"],
  productList: ["產品名","有哪些產品","有什麼產品","產品","商品","品項","商品清單","品項清單"],
  buy: ["怎麼買","怎麼購買","下單","訂購","購買","我要買","我要","訂單","訂購方式","怎麼訂"],
  shipping: ["運送","寄送","運費","到貨","配送","宅配","超商","店到店","多久到","幾天到"],
  payment: ["付款","怎麼付","轉帳","匯款","刷卡","貨到付款","付款方式"],
  testing: ["檢驗","報告","檢測","八大營養素","合格","安全","驗證"],
  store: ["門市","店面","地址","在哪","位置","怎麼去","地圖","電話","聯絡","營業時間"],
  website: ["官網","網站","網址","連結"],
  soupPrice: ["湯塊價格","湯塊售價","湯塊多少錢","湯塊特價"],

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

/** =========================
 * G) 訂單解析（強化：分行/編號/數量分離）
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
  for (const city of CITY_LIST) {
    if (rawText.includes(city)) return city;
  }
  return null;
}

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
  { key: "soup150", name: "龜鹿湯塊4兩", aliases: ["湯塊4兩","4兩湯塊","湯塊四兩","四兩湯塊","150公克湯塊","150g湯塊","4兩","四兩"] },
];

function parseOrder(rawText) {
  const text = normalizeText(rawText);
  const hasOrderIntent = ORDER_INTENT_WORDS.some(w => rawText.includes(w));
  const shipCity = extractShipCity(rawText);

  const shouldTry = hasOrderIntent || looksLikeOrder(rawText);
  if (!shouldTry && !includesAny(rawText, ["龜鹿膏","龜鹿飲","鹿茸粉","湯塊"])) {
    return { hasOrderIntent: false, items: [], shipCity: null };
  }

  const itemsMap = new Map();

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
    const promo = promoUnitPriceByKey(p.key);

    itemsMap.set(p.key, {
      key: p.key,
      name: p.name,
      qty,
      unit,
      promoUnitPrice: promo
    });
  }

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

  for (const [k, it] of itemsMap.entries()) {
    if (!it.qty) it.qty = 1;
    itemsMap.set(k, it);
  }

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

  if (!order.items || order.items.length === 0) {
    return [
      "好的😊 我可以協助您下單！",
      "",
      "請先告訴我您要的品項與數量（可直接這樣打）：",
      "例：2罐龜鹿膏 / 10包龜鹿飲 / 湯塊一斤1份",
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

  const parsed = parseOrder(rawText);
  if ((parsed.items && parsed.items.length > 0) || parsed.shipCity) {
    startOrUpdateOrder(userId, parsed);
  }

  const latest = ensureUser(userId).order;
  const step = computeNextStep(latest);

  if (step === "shipCity") {
    const city = extractShipCity(rawText);
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
 * H) 全連動回覆（方案A：諮詢入口）
 * ========================= */
function buildSmartReply(raw, userObj) {
  const intents = detectIntents(raw);
  const userState = userObj?.state || { lastProductKey: null };

  if (intents.includes("sensitive")) return TEXT.sensitive;

  const productKey = detectProductKey(raw) || userState.lastProductKey || null;

  // 只打產品名 → 回「產品完整」或「使用方式」
  if (intents.length === 0 && productKey === "gel") return gelFull();
  if (intents.length === 0 && productKey === "drink") {
    return [
      "【龜鹿飲 飲用方式】",
      ...STORE.products.drink.usage.map(x => `• ${x}`),
      "",
      `規格：${STORE.products.drink.spec}`,
      `價格：優惠價 ${money(STORE.products.drink.pricePromo)}（售價 ${money(STORE.products.drink.priceOriginal)}）`,
    ].join("\n");
  }
  if (intents.length === 0 && productKey === "antler") {
    return [
      "【鹿茸粉 食用建議】",
      ...STORE.products.antler.usage.map(x => `• ${x}`),
      "",
      `規格：${STORE.products.antler.spec}`,
      `價格：優惠價 ${money(STORE.products.antler.pricePromo)}（售價 ${money(STORE.products.antler.priceOriginal)}）`,
    ].join("\n");
  }
  if (intents.length === 0 && (productKey === "soup" || String(productKey).startsWith("soup"))) {
    return [
      "【龜鹿湯塊 使用建議】",
      ...STORE.products.soup.usage.map(x => `• ${x}`),
      "",
      soupPriceAll(),
    ].join("\n");
  }

  const parts = [];

  // ✅ 方案A：諮詢入口（輪替）
  if (intents.includes("consult")) {
    const n = nextRotation(userObj, "consult");
    const list = TEMPLATES.consult();
    parts.push(list[Math.min(n, list.length) - 1]);
  }

  if (intents.includes("productList")) parts.push(productListText());
  if (intents.includes("website")) parts.push(`官網連結：${STORE.website}`);
  if (intents.includes("testing")) parts.push(TEXT.testing);
  if (intents.includes("shipping")) parts.push(TEXT.shipping);
  if (intents.includes("payment")) parts.push(TEXT.payment);

  // ✅ buy（輪替）
  if (intents.includes("buy")) {
    const n = nextRotation(userObj, "buy");
    const list = TEMPLATES.buy();
    parts.push(list[Math.min(n, list.length) - 1]);
  }

  // ✅ store（輪替）
  if (intents.includes("store")) {
    const n = nextRotation(userObj, "store");
    const list = TEMPLATES.store();
    parts.push(list[Math.min(n, list.length) - 1]);
  }

  if (intents.includes("soupPrice")) parts.push(soupPriceAll());

  // ✅ pricing（輪替）
  if (intents.includes("pricing") && !intents.includes("soupPrice")) {
    const n = nextRotation(userObj, "pricing");
    const list = TEMPLATES.pricing(productKey);
    parts.push(list[Math.min(n, list.length) - 1]);
  }

  // ✅ specs（輪替）
  if (intents.includes("specs")) {
    const n = nextRotation(userObj, "specs");
    const list = TEMPLATES.specs(productKey);
    parts.push(list[Math.min(n, list.length) - 1]);
  }

  if (parts.length === 0) return TEXT.fallback;
  return parts.join("\n\n——\n\n");
}

/** =========================
 * I) 24h 追蹤（可保留）
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
      users[userId].followedAt = users[userId].followedAt || Date.now();
      users[userId].followupSent = users[userId].followupSent || false;
      users[userId].state = users[userId].state || { lastProductKey: null, lastSeenAt: Date.now(), rotate: {}, replyCache: { lastText: null, lastHash: null, lastAt: 0, repeatCount: 0 } };
      users[userId].state.rotate = users[userId].state.rotate || {};
      users[userId].state.replyCache = users[userId].state.replyCache || { lastText: null, lastHash: null, lastAt: 0, repeatCount: 0 };
      users[userId].order = users[userId].order || { active: false, step: null, shipCity: null, name: null, phone: null, address: null, items: [], updatedAt: Date.now() };
      saveUsers(users);
    }
    return client.replyMessage(event.replyToken, textMessage(TEXT.welcome));
  }

  if (event.type !== "message") return null;
  if (!event.message || event.message.type !== "text") return null;

  const userId = event.source && event.source.userId;
  const userTextRaw = event.message.text || "";
  const raw = normalizeText(userTextRaw);

  if (!userId) {
    const tempUser = { state: { lastProductKey: null, rotate: {}, replyCache: { lastText: null, lastHash: null, lastAt: 0, repeatCount: 0 } } };
    const reply0 = buildSmartReply(raw, tempUser);
    return client.replyMessage(event.replyToken, textMessage(reply0));
  }

  const user = ensureUser(userId);

  // 1) 訂單流程已啟動：先補資料
  if (user.order && user.order.active) {
    const filled = tryFillOrderFromMessage(userId, userTextRaw);
    if (filled.handled) {
      const ded = shouldDedupeReply(user, filled.reply);
      updateUser(userId, (u) => {
        u.state.rotate = user.state.rotate;
        u.state.replyCache = user.state.replyCache;
      });
      return client.replyMessage(event.replyToken, textMessage(ded.newText));
    }
  }

  // 2) 解析本句是否為下單
  const parsed = parseOrder(userTextRaw);
  if ((parsed.items && parsed.items.length > 0) || parsed.hasOrderIntent) {
    startOrUpdateOrder(userId, parsed);

    // 更新上下文產品（第一個 item）
    const updated = ensureUser(userId);
    if (updated.order.items && updated.order.items.length > 0) {
      updateUser(userId, (u) => (u.state.lastProductKey = updated.order.items[0].key));
    }

    const replyOrder = buildOrderPrompt(updated.order);
    const ded = shouldDedupeReply(user, replyOrder);
    updateUser(userId, (u) => {
      u.state.rotate = user.state.rotate;
      u.state.replyCache = user.state.replyCache;
    });
    return client.replyMessage(event.replyToken, textMessage(ded.newText));
  }

  // 3) 一般全連動回覆
  const pk = detectProductKey(raw);
  if (pk) updateUser(userId, (u) => (u.state.lastProductKey = pk));

  // 取最新 state（包含 lastProductKey）
  const latestUser = ensureUser(userId);
  const reply = buildSmartReply(raw, latestUser);

  const ded = shouldDedupeReply(latestUser, reply);
  updateUser(userId, (u) => {
    u.state.rotate = latestUser.state.rotate;
    u.state.replyCache = latestUser.state.replyCache;
  });

  return client.replyMessage(event.replyToken, textMessage(ded.newText));
}

app.listen(PORT, () => console.log(`LINE bot webhook listening on port ${PORT}`));
