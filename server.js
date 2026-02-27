"use strict";

/**
 * 仙加味・龜鹿 LINE Bot（最終完整版｜A 穩重老字號｜動態子選單只留當頁選項）
 *
 * ✅ 已依你最新要求全面修正
 * - 「產品介紹」內不再提示「想看成分」（因為內文已完整列成分）
 * - 產品介紹內的第一段不再重複列出原料名稱（避免你圈的那段重複）
 * - 龜鹿湯塊（膠）產品介紹會完整顯示規格（2兩/4兩/半斤/一斤）
 * - 產品選單「龜鹿湯塊（膠）」不再顯示（含龜鹿仙膠/二仙膠）
 *   - 但仍支援客人輸入「龜鹿仙膠/二仙膠/龜鹿膠」→ 統一視為「龜鹿湯塊（膠）」
 * - 數字選單「分組區隔」避免老人家混亂：
 *   - 主選單：1~7
 *   - 產品介紹選品：11~14
 *   - 規格選品：21~24
 *   - 價格選品：31~34
 *   - 購買方式：41~44
 *   - 湯塊規格（價格）：51~54
 * - 產品頁面「想看價格」直接給該品項專屬代碼（例：龜鹿膏→回 31）
 * - 快捷選單（Quick Reply）在子頁只顯示「該頁需要的選項」＋「0 回主選單」
 * - 價格格式：
 *   - 建議售價 + 目前活動價（9折）或不顯示（無活動價的品項）
 *   - 統一附上通路價差與到店活動聲明
 * - 真人回覆管理：真人模式中暫停自動（可回「解除真人」或回 0）
 * - 購買流程：先選購買方式 → 再自然收斂資訊（不會卡住）
 * - 雙北親送：依地址判斷（台北/新北優先提示可安排；不便親送改宅配/店到店）
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
 * A) 店家/產品資料（A 穩重老字號）
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

  hours: {
    weekday: "週一～週五 9:30–18:30",
    pickupLate: "自取可到約 21:30–22:00（請先訊息確認）",
    weekend: "週六日若剛好在店/方便外出，也可協助取貨（建議先訊息確認）",
    reply: "回覆時間多在白天～晚間（看到會盡快回覆）",
  },

  priceNote1: "※ 不同通路因服務內容／搭配方案不同，價格可能略有差異🙂",
  priceNote2: "※ 到店另有不定期活動或搭配方案，依現場為準。",
  deliverNote: "※ 若順路/時間允許就能安排親送；若不便親送會改以宅配或店到店協助。",
  infoDisclaimer: "※ 產品資訊以實際包裝標示為準（不同批次可能略有差異）。",

  orderNote:
    "※ 訂單確認後會依出貨方式提供付款資訊。\n※ 若需改單請於出貨前通知；已出貨將依物流狀況處理。\n※ 實際到貨時間以物流配送為準。",

  shippingNote:
    "※ 可安排宅配／店到店／到店自取。\n※ 雙北親送屬彈性安排，視順路與時間狀況而定。",

  humanModeNote:
    "我已先幫您轉真人協助🙂\n\n※ 真人回覆期間，系統會先暫停自動回覆，避免訊息打架。\n要回到主選單可回：0\n若要解除真人模式可回：解除真人",

  products: {
    gel: {
      key: "gel",
      name: "龜鹿膏",
      spec: "100g/罐",
      // ✅ 依你最新：建議售價 2000 / 目前活動價 9折（門市隱藏價不寫入）
      msrp: 2000,
      activityDiscount: 0.9,
      ingredients: ["鹿角", "全龜", "枸杞", "黃耆", "紅棗", "粉光蔘"],
      // ✅ 這裡不再重複列出枸杞/黃耆/紅棗/粉光蔘（避免你圈的那段重複）
      intro: [
        "傳統熬製、口感溫潤濃稠。",
        "可直接食用或以溫水化開。",
        "適合日常滋養，作息調整期間作為養身型食品補充。",
      ],
      usage: [
        "每日一次，一小匙（初次可從半匙開始）",
        "建議飯後或空腹前後皆可（以個人習慣為準）",
        "可溫水化開後飲用，或直接食用",
        "食用期間避免冰飲",
      ],
      note: "依每個人食用習慣不同，一罐約可食用 10 天～半個月。",
      storage: [
        "常溫保存，避免高溫與日曬",
        "開封後建議冷藏並儘早食用",
      ],
    },

    drink: {
      key: "drink",
      name: "龜鹿飲",
      spec: "180cc/包",
      msrp: 200,
      activityDiscount: 0.9,
      ingredients: ["鹿角", "全龜", "枸杞", "黃耆", "紅棗", "粉光蔘"],
      intro: [
        "即飲型設計，方便日常補充與外出攜帶。",
        "可溫熱飲用，口感順口，適合忙碌族群。",
      ],
      usage: ["每日一包", "可隔水加熱或溫熱飲用", "建議白天飲用較舒適", "避免冰飲"],
      storage: ["常溫保存，避免日曬與高溫", "開封後請一次飲用完畢"],
    },

    antler: {
      key: "antler",
      name: "鹿茸粉",
      spec: "75g/罐",
      msrp: 2000,
      activityDiscount: 0.9,
      ingredients: ["鹿茸"],
      intro: ["粉末型設計，便於少量調配。", "可搭配溫水或飲品使用，適合日常保養型食品補充。"],
      usage: ["建議少量開始，搭配溫水或飲品", "若容易口乾或睡不好，建議減量或間隔食用"],
      storage: ["常溫乾燥保存，避免潮濕", "取用請保持湯匙乾燥，避免結塊"],
    },

    soup: {
      key: "soup",
      name: "龜鹿湯塊（膠）",
      // ✅ 仍支援別名輸入，但不在選單上顯示
      aliasNames: ["龜鹿仙膠", "龜鹿二仙膠", "龜鹿膠", "二仙膠", "仙膠"],
      // ✅ 依你要求：湯塊成分只保留鹿角＋全龜
      ingredients: ["鹿角", "全龜"],
      intro: ["傳統熬製濃縮成塊，方便燉煮成湯。", "可依個人口味調整濃淡，適合搭配肉類／食材燉煮。"],
      usage: ["加入適量水煮滾後，可搭配雞肉或其他食材燉煮", "建議熱食熱飲，口感更佳", "不建議久煮過度，避免口感變得過濃"],
      storage: ["常溫保存，避免高溫潮濕", "開封後建議密封保存"],
      variants: [
        // 2兩：1000（盒子規劃中、傳統包裝出貨）
        { key: "soup75", label: "2兩", spec: "75g", msrp: 1000, activityDiscount: null, note: "盒子規劃中（目前以傳統包裝出貨）" },
        // 4兩：2000（✅ 取消優惠價）
        { key: "soup150", label: "4兩", spec: "150g", msrp: 2000, activityDiscount: null, note: null },
        // 半斤/一斤：有活動價 9折
        { key: "soup300", label: "半斤", spec: "300g", msrp: 4000, activityDiscount: 0.9, note: null },
        { key: "soup600", label: "一斤", spec: "600g", msrp: 8000, activityDiscount: 0.9, note: null },
      ],
    },
  },
};

/** =========================
 * B) 工具
 * ========================= */
function money(n) {
  const s = String(Math.round(Number(n))).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `$${s}`;
}
function roundPrice(n) {
  return Math.round(Number(n));
}
function calcActivityPrice(msrp, discount) {
  if (!msrp || !discount) return null;
  return roundPrice(msrp * discount);
}
function normalizeText(s) {
  return String(s || "")
    .replace(/\u3000/g, " ")
    .replace(/[，,、/／]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
function includesAny(t, arr) {
  const s = String(t || "");
  return arr.some((k) => s.includes(k));
}
function clampText(text) {
  const t = String(text || "");
  return t.length > 4900 ? t.slice(0, 4900) : t;
}
function safeDigits(raw) {
  return String(raw || "").replace(/[^\d]/g, "");
}

/** 台灣縣市判斷（雙北親送） */
const CITY_LIST = [
  "台北",
  "台北市",
  "新北",
  "新北市",
  "基隆",
  "基隆市",
  "桃園",
  "桃園市",
  "新竹",
  "新竹市",
  "新竹縣",
  "苗栗",
  "苗栗縣",
  "台中",
  "台中市",
  "彰化",
  "彰化縣",
  "南投",
  "南投縣",
  "雲林",
  "雲林縣",
  "嘉義",
  "嘉義市",
  "嘉義縣",
  "台南",
  "台南市",
  "高雄",
  "高雄市",
  "屏東",
  "屏東縣",
  "宜蘭",
  "宜蘭縣",
  "花蓮",
  "花蓮縣",
  "台東",
  "台東縣",
  "澎湖",
  "澎湖縣",
  "金門",
  "金門縣",
  "馬祖",
  "連江縣",
];
function guessCityFromText(text) {
  const t = String(text || "");
  if (t.includes("台北市") || t.includes("台北")) return "台北市";
  if (t.includes("新北市") || t.includes("新北")) return "新北市";
  for (const c of CITY_LIST) {
    if (t.includes(c)) return c;
  }
  return null;
}
function isShuangbeiCity(cityOrAddress) {
  const c = guessCityFromText(cityOrAddress);
  return c === "台北市" || c === "新北市";
}

/** =========================
 * C) users.json（持久化）
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
    lastMenu: "main",
    lastProductKey: null,
    rotate: {},
    humanMode: false,
    humanSince: null,
    lastSeenAt: Date.now(),
  };
  users[userId].draft = users[userId].draft || {
    buying: { active: false, method: null, itemsText: null, name: null, phone: null, address: null, storePickupName: null, storePickupPhone: null },
  };
  users[userId].state.lastSeenAt = Date.now();
  saveUsers(users);
  return users[userId];
}
function updateUser(userId, patchFn) {
  const users = loadUsers();
  users[userId] = users[userId] || {};
  users[userId].state = users[userId].state || {};
  users[userId].draft = users[userId].draft || { buying: { active: false, method: null } };
  patchFn(users[userId]);
  users[userId].state.lastSeenAt = Date.now();
  saveUsers(users);
}
function bumpRotate(userId, key, mod) {
  const u = ensureUser(userId);
  const cur = (u.state.rotate && u.state.rotate[key]) || 0;
  const next = (cur + 1) % mod;
  updateUser(userId, (x) => {
    x.state.rotate = x.state.rotate || {};
    x.state.rotate[key] = next;
  });
  return next;
}
function setHumanMode(userId, on) {
  updateUser(userId, (u) => {
    u.state.humanMode = !!on;
    u.state.humanSince = on ? Date.now() : null;
  });
}

/** =========================
 * D) Quick Reply（動態｜只留當頁選項）
 * ========================= */
function qr(label, text) {
  return { type: "action", action: { type: "message", label, text } };
}
function qrUri(label, uri) {
  return { type: "action", action: { type: "uri", label, uri } };
}

/** 主選單 Quick Reply（1~7） */
function quickRepliesMain() {
  return {
    items: [
      qr("1 產品介紹", "1"),
      qr("2 容量/規格", "2"),
      qr("3 價格(單品)", "3"),
      qr("4 購買方式", "4"),
      qr("5 門市/來電", "5"),
      qr("6 真人回覆", "6"),
      qr("7 官網", "7"),
    ],
  };
}

/**
 * 子頁 Quick Reply：
 * - 只顯示該頁需要的選項
 * - 一律保留 0 回主選單
 */
function quickRepliesByMenu(menu, ctx = {}) {
  switch (menu) {
    case "main":
      return quickRepliesMain();

    // 產品選單（11~14）
    case "product_menu":
      return { items: [qr("11 龜鹿膏", "11"), qr("12 龜鹿飲", "12"), qr("13 鹿茸粉", "13"), qr("14 湯塊(膠)", "14"), qr("0 回主選單", "0")] };

    // 規格（21~24）
    case "spec_menu":
      return { items: [qr("21 龜鹿膏", "21"), qr("22 龜鹿飲", "22"), qr("23 鹿茸粉", "23"), qr("24 湯塊(膠)", "24"), qr("0 回主選單", "0")] };

    // 價格（31~34）
    case "price_menu":
      return { items: [qr("31 龜鹿膏", "31"), qr("32 龜鹿飲", "32"), qr("33 鹿茸粉", "33"), qr("34 湯塊(膠)", "34"), qr("0 回主選單", "0")] };

    // 湯塊規格價格（51~54）
    case "soup_variant_price_menu":
      return { items: [qr("51 2兩", "51"), qr("52 4兩", "52"), qr("53 半斤", "53"), qr("54 一斤", "54"), qr("0 回主選單", "0")] };

    // 購買方式（41~44）
    case "buy_menu":
      return { items: [qr("41 宅配", "41"), qr("42 店到店", "42"), qr("43 雙北親送", "43"), qr("44 到店自取", "44"), qr("0 回主選單", "0")] };

    case "store_menu":
      return { items: [qr("0 回主選單", "0"), qrUri("地圖", STORE.mapUrl), qrUri("來電", `tel:${STORE.phoneTel}`), qrUri("官網", STORE.website)] };

    // 單一產品頁（只顯示該產品的價格代碼 + 回主選單）
    case "product_gel":
      return { items: [qr("回 31 看價格", "31"), qr("回 11~14 選其他產品", "1"), qr("0 回主選單", "0")] };
    case "product_drink":
      return { items: [qr("回 32 看價格", "32"), qr("回 11~14 選其他產品", "1"), qr("0 回主選單", "0")] };
    case "product_antler":
      return { items: [qr("回 33 看價格", "33"), qr("回 11~14 選其他產品", "1"), qr("0 回主選單", "0")] };
    case "product_soup":
      return { items: [qr("回 51~54 看價格", "34"), qr("回 11~14 選其他產品", "1"), qr("0 回主選單", "0")] };

    default:
      return { items: [qr("0 回主選單", "0")] };
  }
}

function textMessage(text, menu = "main", ctx = {}) {
  return { type: "text", text: clampText(text), quickReply: quickRepliesByMenu(menu, ctx) };
}

/** =========================
 * E) 文案輪替（更自然、但穩重）
 * ========================= */
function rotatePick(userId, key, arr) {
  const idx = bumpRotate(userId, key, arr.length);
  return arr[idx];
}
function commonPriceFoot() {
  return [STORE.priceNote1, STORE.priceNote2].join("\n");
}
function commonInfoFoot() {
  return STORE.infoDisclaimer;
}

/** =========================
 * F) 意圖
 * ========================= */
const INTENT = {
  main: ["主選單", "選單", "menu", "回主選單", "回到主選單"],

  humanOn: ["真人", "真人回覆", "專人", "客服", "有人嗎", "人工"],
  humanOff: ["解除真人", "取消真人", "恢復自動", "回到自動"],

  // ✅ 湯塊別名
  soupAlias: ["龜鹿仙膠", "龜鹿二仙膠", "龜鹿膠", "二仙膠", "仙膠"],

  whatIs: ["什麼是", "是什麼", "介紹", "了解", "用途"],
  ingredients: ["成分", "材料", "配方", "內容物", "原料"],

  pricing: ["價格", "價錢", "售價", "多少", "幾錢", "報價", "活動價"],
  specs: ["容量", "規格", "幾克", "幾g", "g", "公克", "克", "幾cc", "cc", "毫升", "ml", "重量"],
  buy: ["怎麼買", "怎麼購買", "下單", "訂購", "購買", "要買", "我要買", "怎麼訂", "寄送", "宅配", "店到店", "超商", "自取", "親送"],
  store: ["門市", "地址", "在哪", "位置", "怎麼去", "電話", "營業", "時間"],
  website: ["官網", "網站", "網址", "連結"],

  gel: ["龜鹿膏"],
  drink: ["龜鹿飲"],
  antler: ["鹿茸粉"],
  soup: ["龜鹿湯塊", "湯塊", "湯塊膠", "龜鹿湯塊膠", "龜鹿湯塊(膠)"],

  sensitive: [
    "孕婦",
    "懷孕",
    "備孕",
    "哺乳",
    "餵母乳",
    "慢性病",
    "三高",
    "高血壓",
    "糖尿病",
    "洗腎",
    "肝",
    "心臟",
    "癌",
    "癌症",
    "化療",
    "放療",
    "手術",
    "術後",
    "用藥",
    "抗凝血",
    "阿斯匹靈",
    "warfarin",
    "能不能吃",
    "可以吃嗎",
    "適不適合",
    "副作用",
    "禁忌",
  ],
};

function detectFlags(raw) {
  const t = String(raw || "");
  return {
    main: includesAny(t, INTENT.main),
    humanOn: includesAny(t, INTENT.humanOn) || t === "6",
    humanOff: includesAny(t, INTENT.humanOff),
    sensitive: includesAny(t, INTENT.sensitive),

    pricing: includesAny(t, INTENT.pricing),
    specs: includesAny(t, INTENT.specs),
    buy: includesAny(t, INTENT.buy),
    store: includesAny(t, INTENT.store),
    website: includesAny(t, INTENT.website),
    ingredients: includesAny(t, INTENT.ingredients),

    gel: includesAny(t, INTENT.gel),
    drink: includesAny(t, INTENT.drink),
    antler: includesAny(t, INTENT.antler),
    soup: includesAny(t, INTENT.soup) || includesAny(t, INTENT.soupAlias),

    whatIs: includesAny(t, INTENT.whatIs),
  };
}

function normalizeSoupAlias(raw) {
  let t = String(raw || "");
  if (includesAny(t, INTENT.soupAlias)) {
    t = t.replace(/龜鹿仙膠|龜鹿二仙膠|龜鹿膠|二仙膠|仙膠/g, "龜鹿湯塊（膠）");
  }
  return t;
}

/** =========================
 * G) 選單文字（A 穩重）
 * ========================= */
function mainMenuText(userId) {
  const templates = [
    `您好，這裡是【${STORE.brandName}】🙂\n請回覆數字快速查詢：\n\n1) 產品介紹\n2) 容量／規格\n3) 價格（單品報價）\n4) 購買方式\n5) 門市資訊／來電\n6) 真人回覆\n7) 官網（看介紹）\n\n（隨時回 0 可回到主選單）`,
    `您好🙂【${STORE.brandName}】為您服務。\n回覆數字即可：\n\n1 產品介紹\n2 規格\n3 價格\n4 購買方式\n5 門市/電話\n6 真人協助\n7 官網\n\n（回 0 回主選單）`,
  ];
  return rotatePick(userId, "mainMenu", templates);
}

function productMenuText(userId) {
  const templates = [
    `【產品介紹】請回覆代碼：\n11) 龜鹿膏（100g/罐）\n12) 龜鹿飲（180cc/包）\n13) 鹿茸粉（75g/罐）\n14) 龜鹿湯塊（膠）\n\n0) 回主選單`,
    `想先看哪一款？回代碼即可：\n11 龜鹿膏\n12 龜鹿飲\n13 鹿茸粉\n14 龜鹿湯塊（膠）\n\n0 回主選單`,
  ];
  return rotatePick(userId, "productMenu", templates);
}

function specMenuText() {
  return `【容量／規格】請回覆代碼：\n21) 龜鹿膏\n22) 龜鹿飲\n23) 鹿茸粉\n24) 龜鹿湯塊（膠）\n\n0) 回主選單`;
}

function priceMenuText() {
  return `【價格（單品報價）】請回覆代碼：\n31) 龜鹿膏\n32) 龜鹿飲\n33) 鹿茸粉\n34) 龜鹿湯塊（膠）\n\n0) 回主選單`;
}

function buyMenuText(userId) {
  const templates = [
    `【購買方式】先選一種方式即可（回覆代碼）：\n41) 宅配\n42) 超商店到店\n43) 雙北親送\n44) 到店自取\n\n選完我再跟您確認品項/數量與聯絡方式，不會一直填表🙂\n\n0) 回主選單`,
    `您想用哪種方式買比較方便？回代碼：\n41 宅配\n42 店到店\n43 雙北親送\n44 到店自取\n\n（選完我再跟您確認品項/數量即可）\n\n0 回主選單`,
  ];
  return rotatePick(userId, "buyMenu", templates);
}

function soupVariantPriceMenuText() {
  return `【龜鹿湯塊（膠）｜價格】請回覆代碼：\n51) 2兩（75g）\n52) 4兩（150g）\n53) 半斤（300g）\n54) 一斤（600g）\n\n0) 回主選單`;
}

function storeInfoText() {
  return [
    `【門市資訊｜${STORE.brandName}】`,
    `地址：${STORE.address}`,
    `電話：${STORE.phoneDisplay}`,
    "",
    `營業：${STORE.hours.weekday}`,
    `自取：${STORE.hours.pickupLate}`,
    `週末：${STORE.hours.weekend}`,
    `回覆：${STORE.hours.reply}`,
    "",
    "（回 0 可回到主選單）",
  ].join("\n");
}

/** =========================
 * H) 產品回覆（介紹 / 規格 / 成分 / 價格）
 * ========================= */
function productIntroText(userId, key) {
  const p = STORE.products[key];
  if (!p) return "我先確認一下您想看的品項🙂（回 0 可回主選單）";

  // 湯塊（膠）介紹：必須顯示完整規格（你說圖二缺）
  if (key === "soup") {
    const vLines = p.variants
      .map((v) => {
        const note = v.note ? `（${v.note}）` : "";
        return `• ${v.label}（${v.spec}）${note}`;
      })
      .join("\n");

    const out = [];
    out.push(`【${p.name}】`);
    out.push(p.intro.map((x) => `• ${x}`).join("\n"));
    out.push(`\n規格：\n${vLines}`);
    out.push(`\n成分：\n${p.ingredients.map((x) => `• ${x}`).join("\n")}`);
    out.push(`\n食用建議：\n${p.usage.map((x) => `• ${x}`).join("\n")}`);
    out.push(`\n想看價格：回 51 / 52 / 53 / 54`);
    out.push(`\n${commonInfoFoot()}`);
    return out.join("\n");
  }

  // 其他產品：固定格式 + 已內建「成分」→ 不再提示「想看成分」
  const out = [];
  out.push(`【${p.name}】`);
  if (p.intro && p.intro.length) out.push(p.intro.map((x) => `• ${x}`).join("\n"));
  out.push(`\n規格：${p.spec}`);
  out.push(`\n成分：\n${(p.ingredients || []).map((x) => `• ${x}`).join("\n")}`);
  out.push(`\n食用建議：\n${(p.usage || []).map((x) => `• ${x}`).join("\n")}`);
  if (key === "gel" && p.note) out.push(`\n補充：${p.note}`);

  // ✅ 產品頁直接給該品項價格代碼（你要的）
  const priceCode = key === "gel" ? "31" : key === "drink" ? "32" : key === "antler" ? "33" : "34";
  out.push(`\n想看價格：回 ${priceCode}`);
  out.push(`\n${commonInfoFoot()}`);
  return out.join("\n");
}

function productSpecText(key) {
  const p = STORE.products[key];
  if (!p) return "我先確認一下您想看的品項🙂（回 0 可回主選單）";
  if (key === "soup") {
    const lines = p.variants
      .map((v) => {
        const note = v.note ? `（${v.note}）` : "";
        return `• ${v.label}：${v.spec}${note}`;
      })
      .join("\n");
    return `【${p.name} 規格】\n${lines}\n\n（回 0 可回主選單）`;
  }
  return `【${p.name} 規格】\n${p.spec}\n\n（回 0 可回主選單）`;
}

function productIngredientsText(userId, key) {
  const p = STORE.products[key];
  if (!p) return "我先確認一下您想看的品項🙂（回 0 可回主選單）";

  const list = (p.ingredients || []).map((x) => `• ${x}`).join("\n") || "（成分依包裝標示為準）";
  return `【${p.name} 成分】\n${list}\n\n${commonInfoFoot()}\n（回 0 可回主選單）`;
}

function productPriceText(userId, key) {
  const p = STORE.products[key];
  if (!p) return "我先確認一下您想看的品項🙂（回 0 可回主選單）";

  // 湯塊（膠）價格：改成引導選 51~54（避免一次塞很多）
  if (key === "soup") {
    return `${soupVariantPriceMenuText()}\n\n${commonPriceFoot()}`;
  }

  const act = p.activityDiscount ? calcActivityPrice(p.msrp, p.activityDiscount) : null;
  const lines = [];
  lines.push(`【${p.name} 價格】`);
  lines.push(`建議售價：${money(p.msrp)}`);
  if (act) lines.push(`目前活動價：${money(act)}（9折）`);
  lines.push("");
  lines.push(commonPriceFoot());
  return lines.join("\n");
}

function soupVariantPriceText(code) {
  const map = { "51": "soup75", "52": "soup150", "53": "soup300", "54": "soup600" };
  const k = map[code];
  const v = STORE.products.soup.variants.find((x) => x.key === k);
  if (!v) return "我先確認一下您要看的規格🙂（回 0 可回主選單）";
  const act = v.activityDiscount ? calcActivityPrice(v.msrp, v.activityDiscount) : null;

  const out = [];
  out.push(`【龜鹿湯塊（膠）｜${v.label}（${v.spec}）】`);
  out.push(`建議售價：${money(v.msrp)}`);
  if (act) out.push(`目前活動價：${money(act)}（9折）`);
  if (v.note) out.push(`備註：${v.note}`);
  out.push("");
  out.push(commonPriceFoot());
  return out.join("\n");
}

/** =========================
 * I) 購買流程（自然收斂、不制式）
 * ========================= */
function startBuying(userId, method) {
  updateUser(userId, (u) => {
    u.draft.buying = {
      active: true,
      method,
      itemsText: null,
      name: null,
      phone: null,
      address: null,
      storePickupName: null,
      storePickupPhone: null,
    };
    u.state.lastMenu = "buy_flow";
  });
}
function stopBuying(userId) {
  updateUser(userId, (u) => {
    u.draft.buying = {
      active: false,
      method: null,
      itemsText: null,
      name: null,
      phone: null,
      address: null,
      storePickupName: null,
      storePickupPhone: null,
    };
  });
}

function buyMethodExplain(method) {
  const base = [];
  base.push("好的🙂 我先用這個方式協助您：");

  if (method === "home") {
    base.push("【宅配】");
    base.push("先回覆：要哪些品項＋數量");
    base.push("再貼：收件姓名＋電話＋地址");
  } else if (method === "c2c") {
    base.push("【超商店到店】");
    base.push("先回覆：要哪些品項＋數量");
    base.push("再貼：收件人姓名＋電話 + 取貨門市（店名/店號/地址）");
  } else if (method === "deliver") {
    base.push("【雙北親送】");
    base.push("先回覆：要哪些品項＋數量");
    base.push("再貼：收件姓名＋電話＋地址");
    base.push("");
    base.push(STORE.deliverNote);
    base.push("（我會看地址是否在台北/新北；若不便親送會協助改宅配/店到店🙂）");
  } else if (method === "pickup") {
    base.push("【到店自取】");
    base.push("先回覆：要哪些品項＋數量");
    base.push("再留：聯絡姓名＋電話，方便保留並確認取貨時間");
    base.push("");
    base.push(`取貨時間：${STORE.hours.pickupLate}`);
    base.push(`週末：${STORE.hours.weekend}`);
  }

  base.push("\n（回 0 回主選單）");
  return base.join("\n");
}

function tryHandleBuyingFlow(userId, rawText) {
  const u = ensureUser(userId);
  const b = u.draft.buying;
  if (!b || !b.active) return null;

  const raw = String(rawText || "").trim();
  const n = normalizeSoupAlias(normalizeText(raw));

  if (n === "0") {
    stopBuying(userId);
    updateUser(userId, (x) => {
      x.state.lastMenu = "main";
      x.state.lastProductKey = null;
    });
    return { reply: mainMenuText(userId), menu: "main" };
  }

  const hasItemSignal =
    includesAny(n, ["龜鹿膏", "龜鹿飲", "鹿茸粉", "湯塊", "龜鹿湯塊", "龜鹿湯塊（膠）"]) ||
    /([0-9]{1,3}|一|二|三|四|五|六|七|八|九|十)\s*(罐|包|份|盒|組|個)/.test(n);

  // 先收品項數量
  if (!b.itemsText && hasItemSignal) {
    updateUser(userId, (x) => {
      x.draft.buying.itemsText = normalizeSoupAlias(raw);
    });

    if (b.method === "pickup") {
      return { reply: "收到🙂\n接著麻煩留：聯絡姓名＋電話（例：王小明 0912xxxxxx）", menu: "buy_menu" };
    }
    if (b.method === "deliver") {
      return {
        reply: "收到🙂\n接著麻煩貼：收件姓名＋電話＋地址\n我會先看地址是否在台北/新北；若不便親送會協助改宅配/店到店🙂",
        menu: "buy_menu",
      };
    }
    if (b.method === "home") {
      return { reply: "收到🙂\n接著麻煩貼：收件姓名＋電話＋地址", menu: "buy_menu" };
    }
    if (b.method === "c2c") {
      return { reply: "收到🙂\n接著麻煩貼：收件人姓名＋電話 + 取貨門市（店名/店號/地址）", menu: "buy_menu" };
    }
  }

  const digits = safeDigits(raw);
  const hasPhone = digits.length >= 8 && digits.length <= 15;

  // 自取：姓名+電話
  if (b.method === "pickup" && b.itemsText) {
    if (hasPhone) {
      updateUser(userId, (x) => {
        x.draft.buying.storePickupPhone = digits;
        const nameGuess = normalizeText(raw.replace(digits, "")).slice(0, 20).trim();
        x.draft.buying.storePickupName = nameGuess || x.draft.buying.storePickupName || null;
      });

      const latest = ensureUser(userId).draft.buying;
      const summary = [
        "✅ 已收到自取資訊，我先幫您保留：",
        `品項：${latest.itemsText || "（未填）"}`,
        `聯絡：${latest.storePickupName || "（未填）"} ${latest.storePickupPhone || ""}`.trim(),
        "",
        `取貨時間：${STORE.hours.pickupLate}`,
        `地址：${STORE.address}`,
        "",
        "我這邊會再跟您確認可取貨的時間點🙂",
        "（回 0 可回主選單）",
      ].join("\n");

      stopBuying(userId);
      return { reply: summary, menu: "buy_menu" };
    }
    return { reply: "自取麻煩留：姓名＋電話（例：王小明 0912xxxxxx）", menu: "buy_menu" };
  }

  // 宅配/親送：姓名/電話/地址（允許分段貼）
  if ((b.method === "home" || b.method === "deliver") && b.itemsText) {
    updateUser(userId, (x) => {
      if (hasPhone) x.draft.buying.phone = digits;

      const looksLikeAddress =
        raw.length >= 6 &&
        (raw.includes("路") || raw.includes("街") || raw.includes("巷") || raw.includes("號") || raw.includes("樓") || raw.includes("段") || raw.includes("弄"));

      if (looksLikeAddress) x.draft.buying.address = raw.trim();

      const nn = normalizeText(raw);
      if (nn.length >= 2 && nn.length <= 10 && !includesAny(nn, ["路", "街", "巷", "號", "樓", "段", "弄", "台北", "新北", "市", "縣"]) && !hasPhone && !looksLikeAddress) {
        x.draft.buying.name = nn;
      }
    });

    const latest = ensureUser(userId).draft.buying;
    const need = [];
    if (!latest.name) need.push("姓名");
    if (!latest.phone) need.push("電話");
    if (!latest.address) need.push("地址");

    if (need.length > 0) return { reply: `收到🙂 目前我還需要：${need.join("、")}（可一次貼一段）`, menu: "buy_menu" };

    if (b.method === "deliver") {
      const ok = isShuangbeiCity(latest.address);
      const note = ok ? "✅ 地址看起來在雙北，我會再確認是否方便順路安排親送🙂" : "我看地址可能不在雙北/不便親送，我會優先用宅配或店到店幫您安排🙂";
      const summary = [
        "✅ 已收到購買資訊：",
        "方式：雙北親送（彈性安排）",
        `品項：${latest.itemsText}`,
        `收件：${latest.name} ${latest.phone}`,
        `地址：${latest.address}`,
        "",
        note,
        "",
        STORE.deliverNote,
        "",
        "我接著會回覆：可否親送/改用方式、以及出貨安排🙂",
        "（回 0 可回主選單）",
      ].join("\n");
      stopBuying(userId);
      return { reply: summary, menu: "buy_menu" };
    }

    const summary = [
      "✅ 已收到購買資訊：",
      "方式：宅配",
      `品項：${latest.itemsText}`,
      `收件：${latest.name} ${latest.phone}`,
      `地址：${latest.address}`,
      "",
      STORE.orderNote,
      "",
      "我接著會回覆：出貨方式與付款資訊🙂",
      "（回 0 可回主選單）",
    ].join("\n");

    stopBuying(userId);
    return { reply: summary, menu: "buy_menu" };
  }

  // 店到店：姓名/電話/門市
  if (b.method === "c2c" && b.itemsText) {
    updateUser(userId, (x) => {
      if (hasPhone) x.draft.buying.phone = digits;

      const nn = normalizeText(raw);
      if (nn.length >= 2 && nn.length <= 10 && !includesAny(nn, ["路", "街", "巷", "號", "樓", "段", "弄", "店", "門市"]) && !hasPhone) {
        x.draft.buying.name = nn;
      }

      if (includesAny(raw, ["門市", "店", "路", "街", "號", "全家", "7-11", "711", "萊爾富", "OK"])) {
        x.draft.buying.address = raw.trim();
      }
    });

    const latest = ensureUser(userId).draft.buying;
    const need = [];
    if (!latest.name) need.push("姓名");
    if (!latest.phone) need.push("電話");
    if (!latest.address) need.push("取貨門市（店名/店號/地址）");
    if (need.length > 0) return { reply: `收到🙂 目前我還需要：${need.join("、")}（可一次貼一段）`, menu: "buy_menu" };

    const summary = [
      "✅ 已收到購買資訊：",
      "方式：超商店到店",
      `品項：${latest.itemsText}`,
      `收件：${latest.name} ${latest.phone}`,
      `取貨門市：${latest.address}`,
      "",
      STORE.orderNote,
      "",
      "我接著會回覆：出貨安排與付款資訊🙂",
      "（回 0 可回主選單）",
    ].join("\n");

    stopBuying(userId);
    return { reply: summary, menu: "buy_menu" };
  }

  return { reply: "我有看到🙂 先麻煩回覆「品項＋數量」（例如：龜鹿膏1罐 龜鹿飲10包）我再接著協助您。", menu: "buy_menu" };
}

/** =========================
 * J) 敏感問題導流（保護你）
 * ========================= */
function sensitiveText() {
  return [
    "這部分會因每個人的身體狀況不同，為了讓您得到更準確的說明與建議，建議先由合作中醫師了解您的情況🙂",
    "",
    "✔ 可詢問適不適合食用 / 個人狀況 / 用藥搭配等",
    "",
    `➤ Line ID：${STORE.doctorLineId}`,
    "➤ 諮詢連結：",
    STORE.doctorLink,
    "",
    "（回 0 可回到主選單）",
  ].join("\n");
}

/** =========================
 * K) 24h 追蹤（保留）
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
      await client.pushMessage(userId, textMessage(`您好🙂 需要主選單請回：0\n要真人協助請回：6`, "main"));
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
      users[userId].state = users[userId].state || {};
      users[userId].draft = users[userId].draft || {};
      saveUsers(users);
      ensureUser(userId);
      return client.replyMessage(event.replyToken, textMessage(mainMenuText(userId), "main"));
    }
    return client.replyMessage(event.replyToken, textMessage(mainMenuText("guest"), "main"));
  }

  if (event.type !== "message") return null;
  if (!event.message || event.message.type !== "text") return null;

  const userId = event.source && event.source.userId;
  const userTextRaw = event.message.text || "";
  const rawNorm = normalizeSoupAlias(normalizeText(userTextRaw));

  if (!userId) {
    return client.replyMessage(event.replyToken, textMessage("您好🙂 請回 0 叫出主選單。", "main"));
  }

  const user = ensureUser(userId);
  const flags0 = detectFlags(rawNorm);

  /** 0) 真人模式開關 */
  if (flags0.humanOff) {
    setHumanMode(userId, false);
    stopBuying(userId);
    updateUser(userId, (u) => {
      u.state.lastMenu = "main";
      u.state.lastProductKey = null;
    });
    return client.replyMessage(event.replyToken, textMessage(mainMenuText(userId), "main"));
  }
  if (flags0.humanOn) {
    setHumanMode(userId, true);
    stopBuying(userId);
    updateUser(userId, (u) => {
      u.state.lastMenu = "human";
    });
    return client.replyMessage(event.replyToken, textMessage(STORE.humanModeNote, "main"));
  }

  // 真人模式中：只回最小提示（允許 0 回主選單、解除真人）
  if (user.state.humanMode) {
    if (rawNorm === "0") {
      setHumanMode(userId, false);
      stopBuying(userId);
      updateUser(userId, (u) => {
        u.state.lastMenu = "main";
        u.state.lastProductKey = null;
      });
      return client.replyMessage(event.replyToken, textMessage(mainMenuText(userId), "main"));
    }
    return client.replyMessage(event.replyToken, textMessage("我有收到🙂 已轉真人協助中。\n要回主選單回：0\n要解除真人回：解除真人", "main"));
  }

  /** 1) 0 回主選單（任何時候） */
  if (rawNorm === "0" || flags0.main) {
    stopBuying(userId);
    updateUser(userId, (u) => {
      u.state.lastMenu = "main";
      u.state.lastProductKey = null;
    });
    return client.replyMessage(event.replyToken, textMessage(mainMenuText(userId), "main"));
  }

  /** 2) 購買流程 */
  const buyingHandled = tryHandleBuyingFlow(userId, userTextRaw);
  if (buyingHandled) {
    return client.replyMessage(event.replyToken, textMessage(buyingHandled.reply, buyingHandled.menu || "buy_menu"));
  }

  /** 3) 敏感問題導流 */
  if (flags0.sensitive) {
    return client.replyMessage(event.replyToken, textMessage(sensitiveText(), "main"));
  }

  /** 4) 主選單（1~7） */
  if (user.state.lastMenu === "main") {
    if (rawNorm === "1") {
      updateUser(userId, (u) => (u.state.lastMenu = "product_menu"));
      return client.replyMessage(event.replyToken, textMessage(productMenuText(userId), "product_menu"));
    }
    if (rawNorm === "2") {
      updateUser(userId, (u) => (u.state.lastMenu = "spec_menu"));
      return client.replyMessage(event.replyToken, textMessage(specMenuText(), "spec_menu"));
    }
    if (rawNorm === "3") {
      updateUser(userId, (u) => (u.state.lastMenu = "price_menu"));
      return client.replyMessage(event.replyToken, textMessage(priceMenuText(), "price_menu"));
    }
    if (rawNorm === "4") {
      updateUser(userId, (u) => (u.state.lastMenu = "buy_menu"));
      return client.replyMessage(event.replyToken, textMessage(buyMenuText(userId), "buy_menu"));
    }
    if (rawNorm === "5") {
      updateUser(userId, (u) => (u.state.lastMenu = "store_menu"));
      return client.replyMessage(event.replyToken, textMessage(storeInfoText(), "store_menu"));
    }
    if (rawNorm === "7") {
      updateUser(userId, (u) => (u.state.lastMenu = "main"));
      return client.replyMessage(event.replyToken, textMessage(`官網（品牌介紹／產品資訊）：\n${STORE.website}\n\n（回 0 可回主選單）`, "main"));
    }
  }

  /** 5) 產品介紹選品（11~14；也容許老人家回 1~4） */
  if (user.state.lastMenu === "product_menu") {
    const code = rawNorm;
    const map = { "11": "gel", "12": "drink", "13": "antler", "14": "soup", "1": "gel", "2": "drink", "3": "antler", "4": "soup" };
    const key = map[code];
    if (key) {
      updateUser(userId, (u) => {
        u.state.lastProductKey = key;
        u.state.lastMenu = `product_${key}`;
      });
      const menuKey = `product_${key}`;
      return client.replyMessage(event.replyToken, textMessage(productIntroText(userId, key), menuKey));
    }
  }

  /** 6) 規格選品（21~24；也容許老人家回 1~4） */
  if (user.state.lastMenu === "spec_menu") {
    const map = { "21": "gel", "22": "drink", "23": "antler", "24": "soup", "1": "gel", "2": "drink", "3": "antler", "4": "soup" };
    const key = map[rawNorm];
    if (key) {
      updateUser(userId, (u) => {
        u.state.lastProductKey = key;
        u.state.lastMenu = "spec_menu";
      });
      return client.replyMessage(event.replyToken, textMessage(productSpecText(key), "spec_menu"));
    }
  }

  /** 7) 價格選品（31~34；也容許老人家回 1~4） */
  if (user.state.lastMenu === "price_menu") {
    const map = { "31": "gel", "32": "drink", "33": "antler", "34": "soup", "1": "gel", "2": "drink", "3": "antler", "4": "soup" };
    const key = map[rawNorm];
    if (key) {
      updateUser(userId, (u) => {
        u.state.lastProductKey = key;
        // 湯塊價格改導到 51~54 的頁
        u.state.lastMenu = key === "soup" ? "soup_variant_price_menu" : "price_menu";
      });
      if (key === "soup") return client.replyMessage(event.replyToken, textMessage(productPriceText(userId, "soup"), "soup_variant_price_menu"));
      return client.replyMessage(event.replyToken, textMessage(productPriceText(userId, key), "price_menu"));
    }
  }

  /** 8) 湯塊規格價格（51~54） */
  if (user.state.lastMenu === "soup_variant_price_menu") {
    if (["51", "52", "53", "54"].includes(rawNorm)) {
      updateUser(userId, (u) => {
        u.state.lastProductKey = "soup";
        u.state.lastMenu = "soup_variant_price_menu";
      });
      return client.replyMessage(event.replyToken, textMessage(soupVariantPriceText(rawNorm), "soup_variant_price_menu"));
    }
  }

  /** 9) 購買方式（41~44） */
  if (user.state.lastMenu === "buy_menu") {
    const methodMap = { "41": "home", "42": "c2c", "43": "deliver", "44": "pickup", "1": "home", "2": "c2c", "3": "deliver", "4": "pickup" };
    const method = methodMap[rawNorm];
    if (method) {
      startBuying(userId, method);
      return client.replyMessage(event.replyToken, textMessage(buyMethodExplain(method), "buy_menu"));
    }
  }

  /** 10) 產品頁面：允許直接打價格代碼（31~34 / 51~54）或回 1 回到產品選單 */
  if (String(user.state.lastMenu || "").startsWith("product_")) {
    if (rawNorm === "1") {
      updateUser(userId, (u) => (u.state.lastMenu = "product_menu"));
      return client.replyMessage(event.replyToken, textMessage(productMenuText(userId), "product_menu"));
    }
    if (["31", "32", "33", "34"].includes(rawNorm)) {
      const map = { "31": "gel", "32": "drink", "33": "antler", "34": "soup" };
      const key = map[rawNorm];
      updateUser(userId, (u) => {
        u.state.lastProductKey = key;
        u.state.lastMenu = key === "soup" ? "soup_variant_price_menu" : "price_menu";
      });
      if (key === "soup") return client.replyMessage(event.replyToken, textMessage(productPriceText(userId, "soup"), "soup_variant_price_menu"));
      return client.replyMessage(event.replyToken, textMessage(productPriceText(userId, key), "price_menu"));
    }
  }

  /** 11) 自然語句（不靠數字也能用） */
  const flags = detectFlags(rawNorm);

  if (flags.website) {
    updateUser(userId, (u) => {
      u.state.lastMenu = "main";
    });
    return client.replyMessage(event.replyToken, textMessage(`官網（品牌介紹／產品資訊）：\n${STORE.website}\n\n（回 0 可回主選單）`, "main"));
  }

  if (flags.store) {
    updateUser(userId, (u) => {
      u.state.lastMenu = "store_menu";
    });
    return client.replyMessage(event.replyToken, textMessage(storeInfoText(), "store_menu"));
  }

  if (flags.pricing) {
    updateUser(userId, (u) => {
      u.state.lastMenu = "price_menu";
    });
    return client.replyMessage(event.replyToken, textMessage(priceMenuText(), "price_menu"));
  }

  if (flags.specs) {
    updateUser(userId, (u) => {
      u.state.lastMenu = "spec_menu";
    });
    return client.replyMessage(event.replyToken, textMessage(specMenuText(), "spec_menu"));
  }

  if (flags.buy) {
    updateUser(userId, (u) => {
      u.state.lastMenu = "buy_menu";
    });
    return client.replyMessage(event.replyToken, textMessage(buyMenuText(userId), "buy_menu"));
  }

  // 若客人直接打產品名
  if (flags.gel || flags.drink || flags.antler || flags.soup) {
    const key = flags.gel ? "gel" : flags.drink ? "drink" : flags.antler ? "antler" : "soup";
    updateUser(userId, (u) => {
      u.state.lastProductKey = key;
      u.state.lastMenu = `product_${key}`;
    });
    return client.replyMessage(event.replyToken, textMessage(productIntroText(userId, key), `product_${key}`));
  }

  if (flags.whatIs) {
    updateUser(userId, (u) => {
      u.state.lastMenu = "product_menu";
    });
    return client.replyMessage(event.replyToken, textMessage(productMenuText(userId), "product_menu"));
  }

  // 成分關鍵字：仍保留功能（但不在產品介紹裡提示）
  if (flags.ingredients) {
    const key = flags.gel ? "gel" : flags.drink ? "drink" : flags.antler ? "antler" : flags.soup ? "soup" : user.state.lastProductKey || null;
    if (!key) {
      updateUser(userId, (u) => {
        u.state.lastMenu = "product_menu";
      });
      return client.replyMessage(event.replyToken, textMessage("想查哪一款的成分呢？🙂\n可回：11/12/13/14 或直接打：龜鹿膏成分 / 龜鹿飲成分 / 鹿茸粉成分 / 湯塊成分", "product_menu"));
    }
    updateUser(userId, (u) => {
      u.state.lastMenu = `product_${key}`;
      u.state.lastProductKey = key;
    });
    return client.replyMessage(event.replyToken, textMessage(productIngredientsText(userId, key), `product_${key}`));
  }

  /** 12) Fallback（穩重、但不機械） */
  const fallbackTemplates = [
    `我有收到🙂\n若要叫出主選單請回：0\n也可以直接回：1 產品介紹 / 3 價格 / 4 購買方式`,
    `收到🙂\n要查詢請回：0\n或直接回：1 產品介紹、3 價格、4 購買方式，我會帶您走。`,
  ];
  updateUser(userId, (u) => {
    u.state.lastMenu = "main";
  });
  return client.replyMessage(event.replyToken, textMessage(rotatePick(userId, "fallback", fallbackTemplates), "main"));
}

app.listen(PORT, () => console.log(`LINE bot webhook listening on port ${PORT}`));
