"use strict";

/**
 * 仙加味・龜鹿 LINE Bot（整包替換版）
 * 方案A：諮詢入口 + 聰明全連動 + 去重輪替 + 訂單解析強化 + 回覆排序器
 *
 * ✅ 你要的重點
 * - 同義詞全連動：售價/價錢/價格、容量/規格/重量、怎麼買/下單…
 * - 上下文：上一句提產品，下一句只問「價格/容量/怎麼買」也接得上
 * - 一句多問合併回覆 + 回覆排序器（避免亂序）
 * - 回覆去重 + 輪替模板（避免一直重複同一句）
 * - 訂單解析修正：避免「龜鹿膏1罐 龜鹿飲10包」誤判成龜鹿飲1罐
 * - 下單流程改成：寄送方式(宅配/超商) → 姓名 → 電話 → 地址/店到店資訊
 */

const express = require("express");
const line = require("@line/bot-sdk");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
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
 * A) 店家/產品資料（用詞統一：優惠價 / 售價）
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
      priceDeal: 1500,   // 優惠價
      // ✅ 依你官網資料整理（guilu.html）
      intro:
        "以全龜板與鹿角為基底，搭配粉光蔘、枸杞、紅棗與黃耆，依家族熬膠工法慢火收膏。質地濃稠、風味厚實，適合希望建立固定補養節奏、想觀察一段時間變化的人。",
      ingredients: "全龜板、鹿角、粉光蔘、枸杞、紅棗、黃耆",
      who: [
        "想把補養變成固定習慣的人",
        "希望從日常飲食補充風味厚度與濃度的人",
        "想先觀察一罐或一個月狀態變化的人",
      ],
      usage: [
        "每日一至兩小匙，不需沖泡，直接內服即可。",
        "若當天搭配龜鹿飲或湯塊，可先維持一匙，觀察作息與精神變化。",
      ],
      note: "若正在接受治療或長期服用藥物，可先與我們聊聊狀況，再一起評估是否適合。",
    },

    drink: {
      name: "龜鹿飲",
      spec: "180cc/包",
      priceList: 200,
      priceDeal: 160,
      // ✅ 依你官網資料整理（guilu-drink.html）
      intro:
        "把龜鹿補養濃縮進一包，常溫即可飲用，也可以隔水加溫至微溫。適合作息忙碌、常在外奔波，又希望維持補養節奏的人。",
      ingredients: "水、全龜板、鹿角、粉光蔘、枸杞、紅棗、黃耆",
      who: [
        "工作節奏快、通勤時間長，較少時間能在家熬煮的人",
        "常出差、跑外務，希望補養能帶著走的人",
        "想用飲品型態補充龜鹿，不需自己調膏、沖泡的人",
      ],
      usage: [
        "一般建議：每日 1 包，可依個人狀況與作息調整頻率。",
        "可常溫飲用，亦可隔水稍微加溫至溫熱，不建議直接大火煮沸。",
        "空腹或飯後皆可；若晚間飲用後精神較好，建議改在白天或下午飲用。",
        "若同時搭配龜鹿膏或湯塊，建議先以其中一種作為主要補養，再由我們協助調整節奏。",
      ],
      storage: [
        "未開封：置於陰涼乾燥處，避免陽光直射與高溫環境。",
        "開封後：建議當日飲用完畢；未喝完請冷藏並儘速飲用。",
      ],
    },

    antler: {
      name: "鹿茸粉",
      spec: "75g/罐",
      priceList: 2000,
      priceDeal: 1600,
      // ✅ 依你官網資料整理（lurong.html）
      intro:
        "讓補養融入早餐、飲品與三餐料理，吃的方式不改，補養就開始。加在日常飲食中就能持續補充。",
      ingredients: "鹿茸細粉（以產品外包裝標示為準）",
      who: [
        "不想額外安排補養步驟，但願意每天照常吃喝的人",
        "平時早餐喝牛奶、豆漿、優酪乳的人",
        "希望用飲食調整生活節奏，不想改變作息的人",
        "喜歡補養融入三餐，而非額外添加補品的人",
      ],
      usage: [
        "加在飲品：1 匙加入牛奶、豆漿、優酪乳或果汁中混合飲用。",
        "加在餐食：拌入粥品、湯品或溫熱餐食中。",
        "頻率建議：每日 1～2 匙，可依個人狀況調整。",
      ],
      storage: ["存放於陰涼乾燥處，避免陽光照射與潮濕；開封後確實密封並儘速使用完畢。"],
    },

    soup: {
      name: "龜鹿湯塊",
      variants: [
        { key: "soup600", label: "一斤", spec: "600g", priceList: 8000, priceDeal: 6000 },
        { key: "soup300", label: "半斤", spec: "300g", priceList: 4000, priceDeal: 3200 },
        { key: "soup150", label: "4兩", spec: "150g", priceList: 2000, priceDeal: 1600 },
      ],
      // ✅ 依你官網資料整理（soup.html）
      intro:
        "把龜鹿熬膠濃縮成一塊湯底，一鍋湯就能兼顧風味與補養，全家共享。省去長時間顧爐火，一塊就能沖泡或作為燉湯基底。",
      ingredients: "全龜板萃取、鹿角萃取（以產品外包裝標示為準）",
      usage: [
        "日常飲用：1 塊放入保溫瓶/馬克杯，加熱水溶解後分次飲用；可依喜好調整水量或湯塊數。",
        "家庭燉湯：作為雞湯、排骨湯、牛腱湯等湯底，建議先從 1～2 塊開始，依鍋子大小與風味濃度再微調。",
        "可搭配紅棗、枸杞或家中習慣食材一起熬煮。",
        "頻率：多數家庭每週 1～2 次湯品為主，視作息彈性安排。",
      ],
      storage: ["置於陰涼乾燥處，避免陽光直射與潮濕；開封後建議密封保存，減少受潮。"],
    },
  },

  testingNote:
    "目前我們可提供八大營養素等基本資訊（依批次/包裝標示為準）。如需更詳細資料，歡迎留言，我們整理後回覆您。",
  paymentNote:
    "付款方式可依訂單安排（如：轉帳等）。我整理好訂單後會一併提供付款資訊。",
  shippingNote:
    "可安排宅配到府或超商店到店（依品項與收件資訊為準）。我收到寄送方式與收件資料後會提供運費與到貨時間預估。",
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
function sha1(text) {
  return crypto.createHash("sha1").update(String(text), "utf8").digest("hex");
}
function safeInt(x) {
  const n = parseInt(String(x), 10);
  return Number.isFinite(n) ? n : null;
}
function cnNumToInt(token) {
  const map = { "一": 1, "二": 2, "兩": 2, "三": 3, "四": 4, "五": 5, "六": 6, "七": 7, "八": 8, "九": 9, "十": 10 };
  return map[token] ?? null;
}
function isProbablyPhone(rawText) {
  const digits = String(rawText).replace(/[^\d]/g, "");
  return digits.length >= 8 && digits.length <= 15;
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
    // 去重/輪替
    lastReplyHash: null,
    lastReplyAt: 0,
    templateCursor: {},   // { key: idx }
    recentReplyHashes: [],// [{h,t}]
  };
  users[userId].order = users[userId].order || {
    active: false,
    step: null,             // method/name/phone/address/confirm
    shipMethod: null,       // "home" | "cvs"
    name: null,
    phone: null,
    address: null,          // 宅配：完整地址；店到店：門市名稱+店號+地址
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
  users[userId].order = users[userId].order || {
    active: false, step: null, shipMethod: null, name: null, phone: null, address: null, items: [], updatedAt: Date.now(),
  };
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
 * E) 文案（模板輪替 + 去重）
 * ========================= */
function pickTemplate(userId, key, templates) {
  const user = ensureUser(userId);
  const state = user.state;

  state.templateCursor = state.templateCursor || {};
  const cur = safeInt(state.templateCursor[key]) ?? 0;

  // 避免同一模板剛剛用過：最多嘗試 3 次找不同
  const recent = (state.recentReplyHashes || []).slice(-10);
  let chosen = templates[cur % templates.length];
  let tries = 0;

  while (tries < Math.min(3, templates.length)) {
    const h = sha1(chosen);
    const isTooRecent = recent.some((x) => x && x.h === h && Date.now() - x.t < 2 * 60 * 1000);
    if (!isTooRecent) break;

    tries += 1;
    chosen = templates[(cur + tries) % templates.length];
  }

  updateUser(userId, (u) => {
    u.state.templateCursor = u.state.templateCursor || {};
    u.state.templateCursor[key] = (cur + 1) % templates.length;
  });

  return chosen;
}

function commitReplyMemory(userId, replyText) {
  const h = sha1(replyText);
  updateUser(userId, (u) => {
    u.state.lastReplyHash = h;
    u.state.lastReplyAt = Date.now();
    u.state.recentReplyHashes = (u.state.recentReplyHashes || []).concat([{ h, t: Date.now() }]).slice(-30);
  });
}

function avoidImmediateDuplicate(userId, replyText, fallbackAltText) {
  const user = ensureUser(userId);
  const state = user.state;
  const h = sha1(replyText);

  // 若 90 秒內完全相同，改用替代模板（或加一小句變化）
  if (state.lastReplyHash === h && Date.now() - (state.lastReplyAt || 0) < 90 * 1000) {
    return fallbackAltText || (replyText + "\n\n（如果你願意，也可以直接回：品項+數量，我幫你一步步完成下單😊）");
  }
  return replyText;
}

/** =========================
 * F) 固定資訊輸出
 * ========================= */
function pricingAllText() {
  const p = STORE.products;
  return [
    "【價格（優惠價 / 售價）】",
    `▪️ 龜鹿膏 ${p.gel.spec}：優惠價 ${money(p.gel.priceDeal)}（售價 ${money(p.gel.priceList)}）`,
    `▪️ 龜鹿飲 ${p.drink.spec}：優惠價 ${money(p.drink.priceDeal)}（售價 ${money(p.drink.priceList)}）`,
    `▪️ 鹿茸粉 ${p.antler.spec}：優惠價 ${money(p.antler.priceDeal)}（售價 ${money(p.antler.priceList)}）`,
    `▪️ 龜鹿湯塊：回「湯塊價格」看三種規格`,
    "",
    "想直接下單可回：",
    "例：龜鹿膏2罐＋龜鹿飲10包",
  ].join("\n");
}
function soupPriceAll() {
  const v = STORE.products.soup.variants;
  const lines = ["【龜鹿湯塊｜三種規格價格】", ""];
  for (const x of v) {
    lines.push(`${x.label}（${x.spec}）`);
    lines.push(`優惠價 ${money(x.priceDeal)}（售價 ${money(x.priceList)}）`);
    lines.push("");
  }
  while (lines.length && lines[lines.length - 1] === "") lines.pop();
  return lines.join("\n");
}
function specsAllText() {
  const p = STORE.products;
  return [
    "【容量／規格】",
    `▪️ 龜鹿膏：${p.gel.spec}`,
    `▪️ 龜鹿飲：${p.drink.spec}`,
    `▪️ 鹿茸粉：${p.antler.spec}`,
    "▪️ 龜鹿湯塊：一斤600g／半斤300g／4兩150g",
  ].join("\n");
}
function productListText() {
  const p = STORE.products;
  return [
    "【產品清單】",
    `▪️ 龜鹿膏（${p.gel.spec}）`,
    `▪️ 龜鹿飲（${p.drink.spec}）`,
    `▪️ 鹿茸粉（${p.antler.spec}）`,
    "▪️ 龜鹿湯塊（一斤600g／半斤300g／4兩150g）",
    "",
    "你也可以直接回：",
    "「龜鹿膏 / 龜鹿飲 / 鹿茸粉 / 湯塊價格」",
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

function productDetailText(productKey) {
  const p = STORE.products;
  if (productKey === "gel") {
    const x = p.gel;
    return [
      `【${x.name}】`,
      x.intro,
      "",
      `規格：${x.spec}`,
      `價格：優惠價 ${money(x.priceDeal)}（售價 ${money(x.priceList)}）`,
      "",
      "成分：",
      x.ingredients,
      "",
      "適合族群：",
      ...x.who.map((s) => `• ${s}`),
      "",
      "使用方式：",
      ...x.usage.map((s) => `• ${s}`),
      "",
      x.note,
    ].join("\n");
  }
  if (productKey === "drink") {
    const x = p.drink;
    return [
      `【${x.name}】`,
      x.intro,
      "",
      `規格：${x.spec}`,
      `價格：優惠價 ${money(x.priceDeal)}（售價 ${money(x.priceList)}）`,
      "",
      "成分：",
      x.ingredients,
      "",
      "適合族群：",
      ...x.who.map((s) => `• ${s}`),
      "",
      "建議使用方式：",
      ...x.usage.map((s) => `• ${s}`),
      "",
      "保存方式：",
      ...x.storage.map((s) => `• ${s}`),
    ].join("\n");
  }
  if (productKey === "antler") {
    const x = p.antler;
    return [
      `【${x.name}】`,
      x.intro,
      "",
      `規格：${x.spec}`,
      `價格：優惠價 ${money(x.priceDeal)}（售價 ${money(x.priceList)}）`,
      "",
      "成分：",
      x.ingredients,
      "",
      "適合族群：",
      ...x.who.map((s) => `• ${s}`),
      "",
      "建議使用方式：",
      ...x.usage.map((s) => `• ${s}`),
      "",
      "保存方式：",
      ...x.storage.map((s) => `• ${s}`),
    ].join("\n");
  }
  if (productKey === "soup" || String(productKey).startsWith("soup")) {
    const x = p.soup;
    return [
      `【${x.name}】`,
      x.intro,
      "",
      "成分：",
      x.ingredients,
      "",
      "建議使用方式：",
      ...x.usage.map((s) => `• ${s}`),
      "",
      "保存方式：",
      ...x.storage.map((s) => `• ${s}`),
      "",
      soupPriceAll(),
    ].join("\n");
  }
  return null;
}

/** =========================
 * G) 歡迎/諮詢入口（模板輪替）
 * ========================= */
const TEMPLATES = {
  welcome: [
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
      "例：龜鹿膏2罐＋龜鹿飲10包",
    ].join("\n"),
    [
      `歡迎加入【${STORE.brandName}】🙂`,
      "我可以幫你快速整理：價格、規格、怎麼買，或直接協助下單。",
      "",
      "快速指令：諮詢 / 產品名 / 價格 / 容量 / 怎麼買 / 湯塊價格 / 門市資訊",
      "",
      "想直接下單也OK：",
      "例：我要龜鹿膏2罐（宅配）",
    ].join("\n"),
  ],

  consultEntry: [
    [
      `您好😊 這裡是【${STORE.brandName}】`,
      "我可以先幫您快速整理常見資訊，或直接協助下單。",
      "",
      "請回覆其中一個即可：",
      "① 想了解：龜鹿膏／龜鹿飲／湯塊／鹿茸粉",
      "② 直接問：價格／容量／怎麼買",
      "③ 直接下單：例 龜鹿膏2罐＋龜鹿飲10包",
      "",
      "若是孕哺／慢性病／用藥等狀況，我會改由合作中醫師協助您🙂",
    ].join("\n"),
    [
      `您好🙂 我是【${STORE.brandName}】的小幫手`,
      "你想先看「價格/容量」，還是直接告訴我你要的品項+數量？",
      "",
      "你可以回：價格 / 容量 / 產品名",
      "或直接回：龜鹿膏2罐、龜鹿飲10包…我幫你接著做下單流程。",
    ].join("\n"),
  ],

  buyGuide: [
    [
      "【怎麼買／下單流程】",
      "你可以直接打一段話：",
      "例：龜鹿膏2罐＋龜鹿飲10包",
      "",
      "我會依序跟你確認：",
      "1) 寄送方式（宅配/超商）",
      "2) 收件人姓名",
      "3) 電話",
      "4) 地址（或超商門市資料）",
    ].join("\n"),
    [
      "【下單方式】",
      "直接回：品項+數量即可（例如：龜鹿膏2罐、龜鹿飲10包）。",
      "",
      "接著我會問你寄送方式（宅配/超商），再補收件資料完成訂單🙂",
    ].join("\n"),
  ],

  pricingAsk: [
    [
      "我可以直接給你完整價目😊",
      "也可以只回某一款（例如：龜鹿膏價格 / 龜鹿飲價格）。",
    ].join("\n"),
    [
      "想問哪一款的價格呢？🙂（龜鹿膏/龜鹿飲/鹿茸粉/湯塊）",
      "如果你直接回品項+數量，我也可以直接幫你算小計。",
    ].join("\n"),
  ],

  sensitive: [
    [
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
  ],

  fallback: [
    [
      "我先把常用入口整理給你（你也可以直接留言需求）😊",
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
      "我可能沒完全抓到你的意思🙂",
      "你可以回：諮詢 / 產品名 / 價格 / 容量 / 怎麼買",
      "或直接回：龜鹿膏2罐、龜鹿飲10包…我直接幫你往下完成。",
    ].join("\n"),
  ],
};

/** =========================
 * H) 意圖（同義詞全連動）
 * ========================= */
const INTENT = {
  consult: ["諮詢", "客服", "真人", "專人", "有人嗎", "請協助", "幫我", "詢問", "問題"],
  pricing: ["價格", "價錢", "售價", "多少錢", "幾錢", "優惠", "活動", "折扣", "報價", "批發"],
  specs: ["容量", "規格", "重量", "幾克", "幾g", "公克", "克", "幾cc", "cc", "毫升", "ml", "多少量", "多大"],
  productList: ["產品名", "有哪些產品", "有什麼產品", "產品", "商品", "品項", "清單"],
  buy: ["怎麼買", "怎麼購買", "下單", "訂購", "購買", "我要買", "我要", "訂單", "訂購方式", "怎麼訂"],
  shipping: ["運送", "寄送", "運費", "到貨", "配送", "宅配", "超商", "店到店", "多久到", "幾天到"],
  payment: ["付款", "怎麼付", "轉帳", "匯款", "刷卡", "貨到付款", "付款方式"],
  testing: ["檢驗", "報告", "檢測", "八大營養素", "合格", "安全", "驗證"],
  store: ["門市", "店面", "地址", "在哪", "位置", "怎麼去", "地圖", "電話", "聯絡", "營業時間"],
  website: ["官網", "網站", "網址", "連結"],
  soupPrice: ["湯塊價格", "湯塊售價", "湯塊多少錢", "湯塊優惠", "湯塊價錢"],

  gel: ["龜鹿膏"],
  drink: ["龜鹿飲"],
  antler: ["鹿茸粉"],
  soup: ["龜鹿湯塊", "湯塊"],

  sensitive: [
    "孕婦","懷孕","備孕","哺乳","餵母乳",
    "慢性病","三高","高血壓","糖尿病","洗腎","肝","心臟",
    "癌","癌症","化療","放療","手術","術後",
    "用藥","抗凝血","阿斯匹靈","warfarin",
    "能不能吃","可以吃嗎","適不適合","副作用","禁忌"
  ],
  cancel: ["取消", "不用了", "先不要", "改天", "取消下單", "取消訂單"],
};

function detectProductKey(raw) {
  if (includesAny(raw, INTENT.gel)) return "gel";
  if (includesAny(raw, INTENT.drink)) return "drink";
  if (includesAny(raw, INTENT.antler)) return "antler";
  if (includesAny(raw, INTENT.soup)) return "soup";
  return null;
}

function detectIntents(raw) {
  const s = String(raw || "");
  const intents = new Set();

  if (includesAny(s, INTENT.sensitive)) intents.add("sensitive");
  if (includesAny(s, INTENT.cancel)) intents.add("cancel");
  if (includesAny(s, INTENT.consult)) intents.add("consult");
  if (includesAny(s, INTENT.productList)) intents.add("productList");
  if (includesAny(s, INTENT.pricing)) intents.add("pricing");
  if (includesAny(s, INTENT.specs)) intents.add("specs");
  if (includesAny(s, INTENT.buy)) intents.add("buy");
  if (includesAny(s, INTENT.shipping)) intents.add("shipping");
  if (includesAny(s, INTENT.payment)) intents.add("payment");
  if (includesAny(s, INTENT.testing)) intents.add("testing");
  if (includesAny(s, INTENT.store)) intents.add("store");
  if (includesAny(s, INTENT.website)) intents.add("website");
  if (includesAny(s, INTENT.soupPrice)) intents.add("soupPrice");

  return Array.from(intents);
}

/** =========================
 * I) 訂單解析（強化版：避免「1罐 龜鹿飲10包」誤判）
 * ========================= */
const ORDER_WORDS = ["我要", "我想買", "想買", "訂購", "下單", "購買", "要買", "訂", "買"];
const PRODUCT_ALIASES = [
  { key: "gel", name: "龜鹿膏", aliases: ["龜鹿膏"], defaultUnit: "罐", unitPrice: () => STORE.products.gel.priceDeal },
  { key: "drink", name: "龜鹿飲", aliases: ["龜鹿飲"], defaultUnit: "包", unitPrice: () => STORE.products.drink.priceDeal },
  { key: "antler", name: "鹿茸粉", aliases: ["鹿茸粉"], defaultUnit: "罐", unitPrice: () => STORE.products.antler.priceDeal },
  // 湯塊用 variants key 直接當品項
  { key: "soup600", name: "龜鹿湯塊一斤(600g)", aliases: ["湯塊一斤", "一斤湯塊", "600g", "600公克", "一斤"], defaultUnit: "份", unitPrice: () => STORE.products.soup.variants.find(v => v.key === "soup600").priceDeal },
  { key: "soup300", name: "龜鹿湯塊半斤(300g)", aliases: ["湯塊半斤", "半斤湯塊", "300g", "300公克", "半斤"], defaultUnit: "份", unitPrice: () => STORE.products.soup.variants.find(v => v.key === "soup300").priceDeal },
  { key: "soup150", name: "龜鹿湯塊4兩(150g)", aliases: ["湯塊4兩", "湯塊四兩", "四兩", "4兩", "150g", "150公克"], defaultUnit: "份", unitPrice: () => STORE.products.soup.variants.find(v => v.key === "soup150").priceDeal },
];

function looksLikeOrder(rawText) {
  return /([0-9]{1,3}|一|二|兩|三|四|五|六|七|八|九|十)\s*(罐|包|盒|組|份|個)/.test(rawText);
}

function parseNumToken(token) {
  if (/^[0-9]+$/.test(token)) return safeInt(token);
  return cnNumToInt(token);
}

function findClosestQtyAround(text, alias) {
  // 目標：以 alias 為中心，找「alias後的數量」優先；避免吃到前一品項的「1罐」。
  // after: alias 10包 / alias10包 / alias 10
  const afterRe = new RegExp(`${alias}\\s*([0-9]{1,3}|一|二|兩|三|四|五|六|七|八|九|十)\\s*(罐|包|盒|組|份|個)?`, "g");
  // before: 10包 alias
  const beforeRe = new RegExp(`([0-9]{1,3}|一|二|兩|三|四|五|六|七|八|九|十)\\s*(罐|包|盒|組|份|個)\\s*${alias}`, "g");

  // 先找 after：更可靠（避免前一品項的數量黏到下一個）
  let m;
  afterRe.lastIndex = 0;
  const afterHits = [];
  while ((m = afterRe.exec(text)) !== null) {
    afterHits.push({ idx: m.index, num: m[1], unit: m[2] || null, kind: "after" });
  }
  if (afterHits.length > 0) {
    // 選第一個（通常就是 alias 後面那個）
    const hit = afterHits[0];
    const qty = parseNumToken(hit.num);
    if (qty && qty > 0) return { qty, unit: hit.unit, source: "after" };
  }

  // 再找 before
  beforeRe.lastIndex = 0;
  const beforeHits = [];
  while ((m = beforeRe.exec(text)) !== null) {
    beforeHits.push({ idx: m.index, num: m[1], unit: m[2] || null, kind: "before" });
  }
  if (beforeHits.length > 0) {
    const hit = beforeHits[beforeHits.length - 1]; // 取最靠近 alias 的一個
    const qty = parseNumToken(hit.num);
    if (qty && qty > 0) return { qty, unit: hit.unit, source: "before" };
  }

  return null;
}

function parseOrder(rawText) {
  const raw = String(rawText || "");
  const text = normalizeText(raw);

  const hasOrderIntent = ORDER_WORDS.some((w) => raw.includes(w)) || looksLikeOrder(raw);
  const hits = new Map();

  // 逐品項解析
  for (const p of PRODUCT_ALIASES) {
    const alias = p.aliases
      .filter((a) => raw.includes(a))
      .sort((a, b) => b.length - a.length)[0];
    if (!alias) continue;

    const q = findClosestQtyAround(text, alias);
    const qty = q?.qty ?? 1;
    const unit = q?.unit || p.defaultUnit;

    hits.set(p.key, {
      key: p.key,
      name: p.name,
      qty,
      unit,
      promoUnitPrice: typeof p.unitPrice === "function" ? p.unitPrice() : null,
    });
  }

  return {
    hasOrderIntent,
    items: Array.from(hits.values()),
  };
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
    const price = typeof it.promoUnitPrice === "number" ? `｜優惠價 ${money(it.promoUnitPrice)}/${it.unit}` : "";
    lines.push(`▪️ ${it.name} × ${it.qty}${it.unit}${price}`);
  }
  const subtotal = calcSubtotal(items);
  if (subtotal > 0) lines.push(`小計（未含運）：${money(subtotal)}`);
  return lines;
}

function computeNextStep(order) {
  if (!order.shipMethod) return "method";
  if (!order.name) return "name";
  if (!order.phone) return "phone";
  if (!order.address) return "address";
  return "confirm";
}

function buildOrderPrompt(order) {
  const summary = orderSummaryLines(order.items || []);
  const head = ["我先幫您整理目前訂單（如有誤可直接更正）👇", "", ...summary].join("\n");

  if (!order.items || order.items.length === 0) {
    return [
      "好的😊 我可以協助您下單！",
      "",
      "請先告訴我您要的品項與數量（可直接這樣打）：",
      "例：龜鹿膏2罐＋龜鹿飲10包",
    ].join("\n");
  }

  const next = computeNextStep(order);

  if (next === "method") {
    return [
      head,
      "",
      "請問要用哪種寄送方式呢？回覆 1 或 2 即可：",
      "1) 宅配到府",
      "2) 超商店到店",
    ].join("\n");
  }
  if (next === "name") {
    const methodText = order.shipMethod === "home" ? "宅配到府" : "超商店到店";
    return [head, "", `寄送方式：${methodText}`, "", "請問收件人姓名是？"].join("\n");
  }
  if (next === "phone") {
    const methodText = order.shipMethod === "home" ? "宅配到府" : "超商店到店";
    return [head, "", `寄送方式：${methodText}`, `收件人：${order.name}`, "", "請問收件人電話是？"].join("\n");
  }
  if (next === "address") {
    const methodText = order.shipMethod === "home" ? "宅配到府" : "超商店到店";
    const addressAsk =
      order.shipMethod === "home"
        ? "請回覆收件地址（完整地址，例如：台北市萬華區西昌街52號）"
        : "請回覆超商店到店資料（擇一即可）：\n• 門市名稱＋店號\n• 或貼上門市地址＋門市名稱";
    return [head, "", `寄送方式：${methodText}`, `收件人：${order.name}`, `電話：${order.phone}`, "", addressAsk].join("\n");
  }

  // confirm
  const methodText = order.shipMethod === "home" ? "宅配到府" : "超商店到店";
  return [
    head,
    "",
    "✅ 訂單資料已齊全，我確認如下：",
    `寄送方式：${methodText}`,
    `收件人：${order.name}`,
    `電話：${order.phone}`,
    `收件資訊：${order.address}`,
    "",
    "我接著會回覆：運費、到貨方式與付款資訊😊",
  ].join("\n");
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
        // 單位/單價保留原本
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
    return { handled: true, reply: "已為您取消本次下單流程。如需重新下單，直接回：龜鹿膏2罐 或 龜鹿膏2罐＋龜鹿飲10包 😊" };
  }
  if (!order.active) return { handled: false, reply: null };

  // 若這句又包含品項數量，先更新 items
  const parsed = parseOrder(rawText);
  if (parsed.items && parsed.items.length > 0) startOrUpdateOrder(userId, parsed);

  const latest = ensureUser(userId).order;
  const step = computeNextStep(latest);

  // 依 step 補資料
  if (step === "method") {
    if (raw === "1" || raw.includes("宅配")) updateUser(userId, (u) => (u.order.shipMethod = "home"));
    else if (raw === "2" || raw.includes("超商") || raw.includes("店到店")) updateUser(userId, (u) => (u.order.shipMethod = "cvs"));
  } else if (step === "name") {
    // 避免把「價格/容量/地址」誤當姓名
    if (raw.length >= 2 && raw.length <= 12 && !includesAny(raw, ["價格", "容量", "規格", "官網", "門市", "地址", "電話", "怎麼買", "下單"])) {
      updateUser(userId, (u) => (u.order.name = raw));
    }
  } else if (step === "phone") {
    if (isProbablyPhone(rawText)) {
      const digits = String(rawText).replace(/[^\d]/g, "");
      updateUser(userId, (u) => (u.order.phone = digits));
    }
  } else if (step === "address") {
    if (raw.length >= 4) updateUser(userId, (u) => (u.order.address = String(rawText).trim()));
  }

  updateUser(userId, (u) => (u.order.step = computeNextStep(u.order)));
  const updated = ensureUser(userId).order;

  return { handled: true, reply: buildOrderPrompt(updated) };
}

/** =========================
 * J) 回覆排序器 + 去重合併
 * ========================= */
const PART_ORDER = [
  "consult",
  "productDetail",
  "pricing",
  "specs",
  "buy",
  "soupPrice",
  "shipping",
  "payment",
  "testing",
  "store",
  "website",
];

function uniqueParts(parts) {
  const seen = new Set();
  const out = [];
  for (const p of parts) {
    const h = sha1(p.text);
    if (seen.has(h)) continue;
    seen.add(h);
    out.push(p);
  }
  return out;
}

function sortParts(parts) {
  const idx = (k) => {
    const i = PART_ORDER.indexOf(k);
    return i >= 0 ? i : 999;
  };
  return parts.slice().sort((a, b) => idx(a.kind) - idx(b.kind));
}

/** =========================
 * K) 聰明回覆（方案A）
 * ========================= */
function buildSmartReply(userId, rawText) {
  const raw = normalizeText(rawText);
  const user = ensureUser(userId);
  const intents = detectIntents(raw);

  // 最高優先：敏感
  if (intents.includes("sensitive")) {
    const s = pickTemplate(userId, "sensitive", TEMPLATES.sensitive);
    return avoidImmediateDuplicate(userId, s);
  }

  // 產品上下文
  const pk = detectProductKey(raw) || user.state.lastProductKey || null;

  // 只打產品名 → 直接回產品完整整理（避免你截圖那種亂跳）
  if (intents.length === 0 && pk) {
    const detail = productDetailText(pk);
    if (detail) return avoidImmediateDuplicate(userId, detail);
  }

  const parts = [];

  // consult
  if (intents.includes("consult")) {
    parts.push({ kind: "consult", text: pickTemplate(userId, "consultEntry", TEMPLATES.consultEntry) });
  }

  // 產品清單
  if (intents.includes("productList")) {
    parts.push({ kind: "productDetail", text: productListText() });
  }

  // 產品詳細（如果這句提到某產品+問法）
  if (pk && (intents.includes("pricing") || intents.includes("specs") || intents.includes("buy"))) {
    const detail = productDetailText(pk);
    // 不要整段塞太長：只在「純產品關鍵」或「未明確問價格/容量」才回整段
    // 這裡改成：如果你只問價格/容量，就回對應短訊息，不整段貼
  }

  // pricing
  if (intents.includes("pricing")) {
    if (pk === "gel") {
      const x = STORE.products.gel;
      parts.push({ kind: "pricing", text: `${x.name}｜${x.spec}\n價格：優惠價 ${money(x.priceDeal)}（售價 ${money(x.priceList)}）` });
    } else if (pk === "drink") {
      const x = STORE.products.drink;
      parts.push({ kind: "pricing", text: `${x.name}｜${x.spec}\n價格：優惠價 ${money(x.priceDeal)}（售價 ${money(x.priceList)}）` });
    } else if (pk === "antler") {
      const x = STORE.products.antler;
      parts.push({ kind: "pricing", text: `${x.name}｜${x.spec}\n價格：優惠價 ${money(x.priceDeal)}（售價 ${money(x.priceList)}）` });
    } else if (pk === "soup") {
      parts.push({ kind: "soupPrice", text: soupPriceAll() });
    } else {
      parts.push({ kind: "pricing", text: pricingAllText() });
    }
  }

  // specs
  if (intents.includes("specs")) {
    if (!pk) parts.push({ kind: "specs", text: specsAllText() });
    else if (pk === "gel") parts.push({ kind: "specs", text: `龜鹿膏｜規格\n${STORE.products.gel.spec}` });
    else if (pk === "drink") parts.push({ kind: "specs", text: `龜鹿飲｜規格\n${STORE.products.drink.spec}` });
    else if (pk === "antler") parts.push({ kind: "specs", text: `鹿茸粉｜規格\n${STORE.products.antler.spec}` });
    else parts.push({ kind: "specs", text: "龜鹿湯塊｜規格\n一斤600g／半斤300g／4兩150g" });
  }

  // soupPrice
  if (intents.includes("soupPrice")) parts.push({ kind: "soupPrice", text: soupPriceAll() });

  // buy
  if (intents.includes("buy")) parts.push({ kind: "buy", text: pickTemplate(userId, "buyGuide", TEMPLATES.buyGuide) });

  // shipping/payment/testing/store/website
  if (intents.includes("shipping")) parts.push({ kind: "shipping", text: ["【運送／運費／到貨】", "", STORE.shippingNote].join("\n") });
  if (intents.includes("payment")) parts.push({ kind: "payment", text: ["【付款方式】", "", STORE.paymentNote].join("\n") });
  if (intents.includes("testing")) parts.push({ kind: "testing", text: ["【檢驗／資料】", "", STORE.testingNote].join("\n") });
  if (intents.includes("store")) parts.push({ kind: "store", text: storeInfo() });
  if (intents.includes("website")) parts.push({ kind: "website", text: `官網連結：${STORE.website}` });

  // 如果問了但沒有任何 parts（例如只打「售價」），給一個「引導但不囉嗦」並輪替
  if (parts.length === 0) {
    const s = pickTemplate(userId, "fallback", TEMPLATES.fallback);
    return avoidImmediateDuplicate(userId, s);
  }

  // 排序 + 去重 + 合併輸出
  const merged = sortParts(uniqueParts(parts))
    .map((p) => p.text)
    .join("\n\n——\n\n");

  // 去重：避免同一句一直回
  const alt = pickTemplate(userId, "fallback", TEMPLATES.fallback);
  return avoidImmediateDuplicate(userId, merged, alt);
}

/** =========================
 * L) 24h 追蹤（可保留）
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
        textMessage(`您好😊 這裡是【${STORE.brandName}】\n\n需要快速導引可回：諮詢\n想看清單可回：產品名`)
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
  // follow：歡迎訊息（輪替）
  if (event.type === "follow") {
    const userId = event.source && event.source.userId;
    if (userId) {
      const users = loadUsers();
      users[userId] = users[userId] || {};
      users[userId].followedAt = users[userId].followedAt || Date.now();
      users[userId].followupSent = users[userId].followupSent || false;

      users[userId].state = users[userId].state || {
        lastProductKey: null,
        lastSeenAt: Date.now(),
        lastReplyHash: null,
        lastReplyAt: 0,
        templateCursor: {},
        recentReplyHashes: [],
      };
      users[userId].order = users[userId].order || {
        active: false, step: null, shipMethod: null, name: null, phone: null, address: null, items: [], updatedAt: Date.now(),
      };
      saveUsers(users);
    }

    const text = pickTemplate(userId || "anonymous", "welcome", TEMPLATES.welcome);
    if (userId) commitReplyMemory(userId, text);
    return client.replyMessage(event.replyToken, textMessage(text));
  }

  if (event.type !== "message") return null;
  if (!event.message || event.message.type !== "text") return null;

  const userId = event.source && event.source.userId;
  const userTextRaw = event.message.text || "";
  const raw = normalizeText(userTextRaw);

  if (!userId) {
    const reply = buildSmartReply("anonymous", raw);
    return client.replyMessage(event.replyToken, textMessage(reply));
  }

  const user = ensureUser(userId);

  // 1) 訂單流程已啟動：先補資料
  if (user.order && user.order.active) {
    const filled = tryFillOrderFromMessage(userId, userTextRaw);
    if (filled.handled) {
      commitReplyMemory(userId, filled.reply);
      return client.replyMessage(event.replyToken, textMessage(filled.reply));
    }
  }

  // 2) 解析是否想下單
  const parsed = parseOrder(userTextRaw);
  if ((parsed.items && parsed.items.length > 0) || parsed.hasOrderIntent) {
    startOrUpdateOrder(userId, parsed);

    // 更新上下文產品（第一個 item）
    const updated = ensureUser(userId);
    if (updated.order.items && updated.order.items.length > 0) {
      updateUser(userId, (u) => (u.state.lastProductKey = updated.order.items[0].key.startsWith("soup") ? "soup" : updated.order.items[0].key));
    }

    const reply = buildOrderPrompt(updated.order);
    commitReplyMemory(userId, reply);
    return client.replyMessage(event.replyToken, textMessage(reply));
  }

  // 3) 一般全連動回覆
  const pk = detectProductKey(raw);
  if (pk) updateUser(userId, (u) => (u.state.lastProductKey = pk));

  const reply = buildSmartReply(userId, userTextRaw);
  commitReplyMemory(userId, reply);
  return client.replyMessage(event.replyToken, textMessage(reply));
}

app.listen(PORT, () => console.log(`LINE bot webhook listening on port ${PORT}`));
