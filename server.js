"use strict";

/**
 * 仙加味・龜鹿 LINE Bot（整包替換版｜方案A：諮詢入口＋排序器＋輪替模板＋去重）
 *
 * ✅ 核心
 * - Rich Menu「LINE諮詢」送「諮詢」→ 回「諮詢入口導引」（方案A）
 * - 同義詞全連動：售價/價錢/價格、容量/規格/重量…
 * - 上下文連動：上一句提產品，下一句只問「價格/容量/怎麼買」也會接上
 * - 一句多問合併回覆（排序器：下單>價格>規格>其他）
 * - 回覆去重 + 輪替模板（同意圖不會一直回同一段）
 *
 * ✅ 訂單
 * - 支援：龜鹿膏2罐、2罐龜鹿膏、我要買龜鹿飲10包
 * - 支援：①龜鹿膏 ②1罐 ③台北市...（分行/編號）
 * - 下單流程改成：寄送方式(宅配/店到店) → 地址/店名店號 → 姓名 → 電話 → 完整確認
 *
 * ✅ 敏感問題導流合作中醫師（你提供話術）
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
 * A) 店家/產品資料（售價/優惠價統一）
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

  // ✅ 售價=原價、優惠價=特價（用語統一）
  products: {
    gel: {
      key: "gel",
      name: "龜鹿膏",
      spec: "100g/罐",
      priceList: 1800,  // 售價
      pricePromo: 1500, // 優惠價
      // 你先前提供的版本（若官網另有更完整，之後可替換）
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
      key: "drink",
      name: "龜鹿飲",
      // 官網：單包 180cc；也提到 10包一袋
      spec: "180cc/包（另有 10包/袋）",
      priceList: 200,
      pricePromo: 160,
      // 官網建議使用方式（整理自頁面）
      usage: [
        "一般建議：每日 1 包，可依個人狀況與作息調整頻率",
        "可常溫飲用，亦可隔水稍微加溫至溫熱（不建議大火煮沸）",
        "空腹或飯後皆可；若晚間飲用精神較好，建議改在白天或下午",
        "若同時搭配龜鹿膏/湯塊，建議先以其中一種為主軸再調整節奏",
      ],
      storage: [
        "未開封：陰涼乾燥處，避免陽光直射與高溫",
        "開封後：建議當日飲用；未喝完請冷藏並儘速飲用",
      ],
    },

    antler: {
      key: "antler",
      name: "鹿茸粉",
      spec: "75g/罐",
      priceList: 2000,
      pricePromo: 1600,
      // 官網建議使用方式（整理自頁面）
      usage: [
        "加在飲品：1 匙加入牛奶、豆漿、優酪乳或果汁中混合飲用",
        "加在餐食：拌入粥品、湯品或溫熱餐食中",
        "頻率建議：每日 1～2 匙，可依個人狀況調整",
        "搭配其他龜鹿產品時，可透過 LINE 協助安排整體節奏",
      ],
      storage: [
        "陰涼乾燥處，避免陽光照射與潮濕",
        "開封後請確實密封，盡速使用完畢",
      ],
    },

    soup: {
      key: "soup",
      name: "龜鹿湯塊",
      variants: [
        { key: "soup600", label: "一斤", spec: "600g", priceList: 8000, pricePromo: 6000 },
        { key: "soup300", label: "半斤", spec: "300g", priceList: 4000, pricePromo: 3200 },
        { key: "soup150", label: "4兩", spec: "150g", priceList: 2000, pricePromo: 1600 },
      ],
      // 官網建議使用方式（整理自頁面）
      usage: [
        "日常飲用：1 塊放入保溫瓶/馬克杯，加熱水溶解後分次飲用，可調整水量或湯塊數量",
        "家庭燉湯：作為雞湯、排骨湯、牛腱湯等湯底；建議先從 1～2 塊開始再微調",
        "可搭配紅棗、枸杞或家中習慣食材一起熬煮",
        "頻率：多數家庭每週 1～2 次湯品為主；若與膏/飲搭配，先以一種為主軸再調整",
      ],
      storage: [
        "陰涼乾燥處，避免陽光直射與高溫潮濕",
        "開封後若短期內無法用畢，建議密封保存，減少受潮",
      ],
    },
  },

  testingNote:
    "目前我們可提供八大營養素等基本資訊（依批次/包裝標示為準）。如需更詳細資料，歡迎留言，我們整理後回覆您。",
  paymentNote:
    "付款方式可依訂單安排（如：轉帳等）。我整理好訂單後會一併提供付款資訊。",
  shippingNote:
    "可安排宅配或超商店到店（依地區/品項而定）。我整理好寄送方式與收件資料後，會一併回覆運費與到貨時間預估。",
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
function clampStr(s, max = 1200) {
  const x = String(s || "");
  return x.length > max ? x.slice(0, max) + "…" : x;
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
  return { type: "text", text: clampStr(text), quickReply: quickRepliesCommon() };
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
    // ✅ 去重&輪替
    lastReplyHash: null,
    lastReplyAt: 0,
    intentRotation: {}, // {intent: idx}
    intentLastAt: {},   // {intent: ts}
  };
  users[userId].order = users[userId].order || {
    active: false,
    step: null,
    shipMethod: null,    // "home" | "cvs"
    address: null,       // home
    cvsName: null,       // cvs
    cvsCode: null,       // cvs (可選)
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
  users[userId].state = users[userId].state || {
    lastProductKey: null,
    lastSeenAt: Date.now(),
    lastReplyHash: null,
    lastReplyAt: 0,
    intentRotation: {},
    intentLastAt: {},
  };
  users[userId].order = users[userId].order || {
    active: false, step: null, shipMethod: null, address: null, cvsName: null, cvsCode: null, name: null, phone: null, items: [], updatedAt: Date.now(),
  };
  patchFn(users[userId]);
  users[userId].state.lastSeenAt = Date.now();
  users[userId].order.updatedAt = Date.now();
  saveUsers(users);
}
function resetOrder(userId) {
  updateUser(userId, (u) => {
    u.order = {
      active: false,
      step: null,
      shipMethod: null,
      address: null,
      cvsName: null,
      cvsCode: null,
      name: null,
      phone: null,
      items: [],
      updatedAt: Date.now(),
    };
  });
}

/** =========================
 * E) 固定文案（售價/優惠價統一）
 * ========================= */
function pricingAll() {
  const p = STORE.products;
  return [
    "【價格】（售價/優惠價）",
    `▪️ 龜鹿膏 ${p.gel.spec}：優惠價 ${money(p.gel.pricePromo)}（售價 ${money(p.gel.priceList)}）`,
    `▪️ 龜鹿飲 180cc/包：優惠價 ${money(p.drink.pricePromo)}（售價 ${money(p.drink.priceList)}）`,
    `▪️ 鹿茸粉 75g/罐：優惠價 ${money(p.antler.pricePromo)}（售價 ${money(p.antler.priceList)}）`,
    "▪️ 龜鹿湯塊：輸入「湯塊價格」看三種規格",
    "",
    "也可以直接下單：",
    "例：我要龜鹿膏2罐+龜鹿飲10包",
  ].join("\n");
}
function specsAll() {
  const p = STORE.products;
  return [
    "【容量／規格】",
    `▪️ 龜鹿膏：${p.gel.spec}`,
    `▪️ 龜鹿飲：180cc/包（另有 10包/袋）`,
    `▪️ 鹿茸粉：75g/罐`,
    "▪️ 龜鹿湯塊：一斤600g／半斤300g／4兩150g",
  ].join("\n");
}
function productListText() {
  const p = STORE.products;
  return [
    "【產品清單】",
    `▪️ 龜鹿膏（${p.gel.spec}）`,
    "▪️ 龜鹿飲（180cc/包；另有 10包/袋）",
    "▪️ 鹿茸粉（75g/罐）",
    "▪️ 龜鹿湯塊（一斤600g／半斤300g／4兩150g）",
    "",
    "你也可以直接回：",
    "「龜鹿膏 / 龜鹿飲 / 鹿茸粉 / 湯塊價格」",
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
function gelFull() {
  const p = STORE.products.gel;
  return [
    `我們龜鹿膏是 ${p.spec}。`,
    `目前優惠價 ${money(p.pricePromo)}（售價 ${money(p.priceList)}）。`,
    p.noteDays,
    "",
    "一般建議：",
    `• ${p.howTo[0]}`,
    `• ${p.howTo[1]}`,
  ].join("\n");
}
function drinkUsageBlock() {
  const p = STORE.products.drink;
  return [
    "【龜鹿飲｜建議使用方式】",
    ...p.usage.map((x) => `• ${x}`),
    "",
    `規格：${p.spec}`,
    `價格：優惠價 ${money(p.pricePromo)}（售價 ${money(p.priceList)}）`,
  ].join("\n");
}
function antlerUsageBlock() {
  const p = STORE.products.antler;
  return [
    "【鹿茸粉｜建議使用方式】",
    ...p.usage.map((x) => `• ${x}`),
    "",
    `規格：${p.spec}`,
    `價格：優惠價 ${money(p.pricePromo)}（售價 ${money(p.priceList)}）`,
  ].join("\n");
}
function soupUsageBlock() {
  const p = STORE.products.soup;
  return [
    "【龜鹿湯塊｜建議使用方式】",
    ...p.usage.map((x) => `• ${x}`),
    "",
    soupPriceAll(),
  ].join("\n");
}

/** =========================
 * F) 輪替模板 + 去重（同意圖不連續重複）
 * ========================= */
function hashText(s) {
  // 簡單 hash（避免引入套件）
  const str = String(s || "");
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (h * 31 + str.charCodeAt(i)) >>> 0;
  }
  return String(h);
}
const ROTATE_COOLDOWN_MS = 90 * 1000; // 同意圖 90 秒內不回一樣
const HARD_DEDUPE_MS = 45 * 1000;     // 45 秒內絕不回同一段

function pickTemplate(userState, intentKey, templates) {
  const now = Date.now();
  const lastAt = userState.intentLastAt?.[intentKey] || 0;
  const rotation = userState.intentRotation || {};
  const idx = rotation[intentKey] ?? 0;

  // 若很短時間內重複問同意圖，往下一個模板輪替
  let nextIdx = idx;
  if (now - lastAt < ROTATE_COOLDOWN_MS) nextIdx = (idx + 1) % templates.length;

  // 寫回 rotation + lastAt
  updateUser(userState.__userId, (u) => {
    u.state.intentRotation = u.state.intentRotation || {};
    u.state.intentLastAt = u.state.intentLastAt || {};
    u.state.intentRotation[intentKey] = nextIdx;
    u.state.intentLastAt[intentKey] = now;
  });

  return templates[nextIdx];
}

function shouldHardDedupe(userState, replyText) {
  const now = Date.now();
  const h = hashText(replyText);
  if (userState.lastReplyHash === h && (now - (userState.lastReplyAt || 0)) < HARD_DEDUPE_MS) {
    return true;
  }
  return false;
}
function commitReplyMemory(userId, replyText) {
  const now = Date.now();
  const h = hashText(replyText);
  updateUser(userId, (u) => {
    u.state.lastReplyHash = h;
    u.state.lastReplyAt = now;
  });
}

/** =========================
 * G) 固定文案（多版本）
 * ========================= */
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
      "也可直接下單：",
      "例：我要龜鹿膏2罐+龜鹿飲10包",
    ].join("\n"),
    [
      `哈囉～這裡是【${STORE.brandName}】🙂`,
      "想看哪一塊資訊，直接回關鍵字就好：",
      "「諮詢 / 產品名 / 價格 / 容量 / 怎麼買 / 湯塊價格 / 門市資訊」",
      "",
      `官網：${STORE.website}`,
      `電話：${STORE.phoneDisplay}`,
    ].join("\n"),
    [
      `歡迎加入【${STORE.brandName}】✨`,
      "我可以幫你：",
      "① 查價格/容量",
      "② 看產品差異",
      "③ 直接協助下單",
      "",
      "先回「諮詢」我帶你走最快 🙂",
    ].join("\n"),
  ],

  consultEntryVariants: [
    [
      `您好😊 這裡是【${STORE.brandName}】`,
      "我可以先幫您整理常見資訊，或直接協助下單。",
      "",
      "請回覆其中一個即可：",
      "① 想了解：龜鹿膏／龜鹿飲／湯塊／鹿茸粉",
      "② 直接問：價格／容量／怎麼買",
      "③ 直接下單：例 2罐龜鹿膏 或 龜鹿膏2罐+龜鹿飲10包",
      "",
      "若是孕哺／慢性病／用藥等狀況，我會改由合作中醫師協助您🙂",
    ].join("\n"),
    [
      `您好～這裡是【${STORE.brandName}】🙂`,
      "我可以用 10 秒幫您整理：",
      "• 產品清單",
      "• 價格/容量",
      "• 下單方式",
      "",
      "直接回：諮詢 / 產品名 / 價格 / 容量 / 怎麼買",
    ].join("\n"),
    [
      `收到～我在🙂`,
      "您先回 1 個就好：",
      "1) 想問產品差異",
      "2) 想查價格/容量",
      "3) 想直接下單",
      "",
      "也可直接打：我要龜鹿膏2罐+龜鹿飲10包",
    ].join("\n"),
  ],

  howToBuyVariants: [
    [
      "【怎麼買／下單】",
      "你可以直接打一段話：",
      "例：我要龜鹿膏2罐+龜鹿飲10包",
      "",
      "我會接著問你：寄送方式（宅配/店到店）→ 收件資料 → 完整確認🙂",
    ].join("\n"),
    [
      "【下單方式】",
      "直接回：品項＋數量",
      "例：龜鹿膏2罐、龜鹿飲10包",
      "",
      "下一步我會請你選：",
      "1) 宅配到府  2) 超商店到店",
    ].join("\n"),
    [
      "【訂購流程】",
      "先回：要買什麼＋幾份",
      "例：龜鹿湯塊半斤1份",
      "",
      "之後我會請你選寄送方式，再補齊收件資訊🙂",
    ].join("\n"),
  ],

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

  shipping: ["【運送／運費／到貨】", "", STORE.shippingNote].join("\n"),
  payment: ["【付款方式】", "", STORE.paymentNote].join("\n"),
  testing: ["【檢驗／報告】", "", STORE.testingNote].join("\n"),

  cancelOrder:
    "已為您取消本次下單流程。如需重新下單，直接輸入：我要龜鹿膏2罐 或 龜鹿膏2罐+龜鹿飲10包 😊",

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
      "我可能沒抓到你的重點🙂",
      "你可以直接回：",
      "「諮詢 / 產品名 / 價格 / 容量 / 怎麼買 / 湯塊價格 / 門市資訊」",
    ].join("\n"),
    [
      "你想先看哪一塊？回一個字也行🙂",
      "諮詢｜產品名｜價格｜容量｜怎麼買",
    ].join("\n"),
  ],
};

/** =========================
 * H) 意圖（同義詞）
 * ========================= */
const INTENT = {
  consult: ["諮詢","客服","真人","專人","有人嗎","請協助","幫我","詢問","問一下","請問"],
  pricing: ["價格","價錢","售價","多少錢","幾錢","優惠","活動","折扣","報價","批發"],
  specs: ["容量","規格","幾克","幾g","公克","克","幾cc","cc","毫升","ml","多少量","重量","多大"],
  productList: ["產品名","有哪些產品","有什麼產品","產品","商品","品項","清單"],
  buy: ["怎麼買","怎麼購買","下單","訂購","購買","我要買","我要","訂單","訂購方式","怎麼訂","買"],
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
 * I) 訂單解析（支援分行/數量分離/多品項）
 * ========================= */
const ORDER_INTENT_WORDS = ["我要", "我想買", "想買", "訂購", "下單", "購買", "要買", "訂", "買"];

// 寄送方式
function detectShipMethod(rawText) {
  const t = String(rawText || "");
  if (/(店到店|超商|7-?11|711|全家|萊爾富|OK|便利商店)/i.test(t)) return "cvs";
  if (/(宅配|到府|寄到家|送到家|黑貓|新竹物流|郵寄)/i.test(t)) return "home";
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
  const p = STORE.products;
  if (key === "gel") return p.gel.pricePromo;
  if (key === "drink") return p.drink.pricePromo;
  if (key === "antler") return p.antler.pricePromo;
  if (key === "soup600") return p.soup.variants.find(v => v.key === "soup600")?.pricePromo ?? null;
  if (key === "soup300") return p.soup.variants.find(v => v.key === "soup300")?.pricePromo ?? null;
  if (key === "soup150") return p.soup.variants.find(v => v.key === "soup150")?.pricePromo ?? null;
  return null;
}
function listUnitPriceByKey(key) {
  const p = STORE.products;
  if (key === "gel") return p.gel.priceList;
  if (key === "drink") return p.drink.priceList;
  if (key === "antler") return p.antler.priceList;
  if (key === "soup600") return p.soup.variants.find(v => v.key === "soup600")?.priceList ?? null;
  if (key === "soup300") return p.soup.variants.find(v => v.key === "soup300")?.priceList ?? null;
  if (key === "soup150") return p.soup.variants.find(v => v.key === "soup150")?.priceList ?? null;
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
  { key: "soup600", name: "龜鹿湯塊（一斤）", aliases: ["湯塊一斤","一斤湯塊","600公克湯塊","600g湯塊","一斤600","600g"] },
  { key: "soup300", name: "龜鹿湯塊（半斤）", aliases: ["湯塊半斤","半斤湯塊","300公克湯塊","300g湯塊","半斤300","300g"] },
  { key: "soup150", name: "龜鹿湯塊（4兩）", aliases: ["湯塊4兩","4兩湯塊","湯塊四兩","四兩湯塊","150公克湯塊","150g湯塊","4兩150","150g"] },
];

function parseOrder(rawText) {
  const text = normalizeText(rawText);
  const hasOrderIntent = ORDER_INTENT_WORDS.some(w => rawText.includes(w));
  const shouldTry = hasOrderIntent || looksLikeOrder(rawText);

  const itemsMap = new Map();

  // 抓品項 + 近距離數量
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
    const list = listUnitPriceByKey(p.key);

    itemsMap.set(p.key, { key: p.key, name: p.name, qty, unit, promoUnitPrice: promo, listUnitPrice: list });
  }

  // ✅ 若只有一個品項但數量在別處（分行/編號/斷行）
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

  // ✅ 多品項：沒抓到 qty → 預設 1
  for (const [k, it] of itemsMap.entries()) {
    if (!it.qty) it.qty = 1;
    if (!it.unit) it.unit = defaultUnitByKey(k);
    itemsMap.set(k, it);
  }

  const shipMethod = detectShipMethod(rawText);

  // 如果根本不像下單也沒產品，就不回傳 items（避免誤判）
  if (!shouldTry && itemsMap.size === 0) {
    return { hasOrderIntent: false, items: [], shipMethod: shipMethod || null };
  }

  return {
    hasOrderIntent: hasOrderIntent || looksLikeOrder(rawText) || itemsMap.size > 0,
    items: Array.from(itemsMap.values()),
    shipMethod: shipMethod || null,
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
    const promo = typeof it.promoUnitPrice === "number" ? `優惠價 ${money(it.promoUnitPrice)}/${it.unit}` : "";
    const list = typeof it.listUnitPrice === "number" ? `（售價 ${money(it.listUnitPrice)}/${it.unit}）` : "";
    lines.push(`▪️ ${it.name} × ${it.qty}${it.unit}｜${promo}${list}`);
  }
  const subtotal = calcSubtotal(items);
  if (subtotal > 0) lines.push(`小計（未含運）：${money(subtotal)}`);
  return lines;
}

/** 下單步驟（先寄送方式，再地址/店到店，再姓名電話） */
function computeNextStep(order) {
  if (!order.shipMethod) return "shipMethod";
  if (order.shipMethod === "home" && !order.address) return "address";
  if (order.shipMethod === "cvs" && !order.cvsName) return "cvs";
  if (!order.name) return "name";
  if (!order.phone) return "phone";
  return null;
}

function buildShipMethodAsk() {
  return [
    "請問要用哪種寄送方式呢？回覆 1 或 2 即可：",
    "1) 宅配到府",
    "2) 超商店到店",
  ].join("\n");
}

function buildOrderPrompt(order) {
  const summary = orderSummaryLines(order.items || []);
  const head = ["我先幫您整理目前訂單（如有誤可直接更正）👇", "", ...summary].join("\n");

  if (!order.items || order.items.length === 0) {
    return [
      "好的😊 我可以協助您下單！",
      "",
      "請先告訴我：品項＋數量（可直接這樣打）",
      "例：龜鹿膏2罐 / 龜鹿飲10包 / 湯塊半斤1份",
    ].join("\n");
  }

  const next = computeNextStep(order);
  if (!next) {
    const ship =
      order.shipMethod === "home"
        ? `寄送方式：宅配到府\n地址：${order.address}`
        : `寄送方式：超商店到店\n門市：${order.cvsName}${order.cvsCode ? `（店號 ${order.cvsCode}）` : ""}`;

    return [
      head,
      "",
      "✅ 訂單資料已齊全，我確認如下：",
      ship,
      `收件人：${order.name}`,
      `電話：${order.phone}`,
      "",
      "我接著會回覆：運費、到貨方式與付款資訊🙂",
    ].join("\n");
  }

  if (next === "shipMethod") return [head, "", buildShipMethodAsk()].join("\n");

  if (next === "address") {
    return [
      head,
      "",
      "請回覆收件地址（宅配到府）：",
      "例：台北市萬華區西昌街52號",
    ].join("\n");
  }

  if (next === "cvs") {
    return [
      head,
      "",
      "請回覆超商店到店資訊（擇一即可）：",
      "A) 門市名稱（可加店號更好）",
      "例：全家 萬華西昌店 12345",
      "B) 直接貼門市資訊文字也可以",
    ].join("\n");
  }

  if (next === "name") return [head, "", "請問收件人姓名是？"].join("\n");
  if (next === "phone") return [head, "", "請問收件人電話是？"].join("\n");

  return head;
}

function startOrUpdateOrder(userId, parsed) {
  updateUser(userId, (u) => {
    u.order.active = true;

    const map = new Map((u.order.items || []).map((x) => [x.key, x]));
    for (const it of parsed.items || []) {
      if (!map.has(it.key)) {
        map.set(it.key, it);
      } else {
        const prev = map.get(it.key);
        // 合併同品項：qty 累加；unit 以 prev 為主（避免被錯誤覆蓋）
        prev.qty += it.qty;
        prev.promoUnitPrice = prev.promoUnitPrice ?? it.promoUnitPrice;
        prev.listUnitPrice = prev.listUnitPrice ?? it.listUnitPrice;
        map.set(it.key, prev);
      }
    }
    u.order.items = Array.from(map.values());

    if (parsed.shipMethod) u.order.shipMethod = parsed.shipMethod;

    u.order.step = computeNextStep(u.order);
  });
}

/** 嘗試把訊息補進下單流程 */
function tryFillOrderFromMessage(userId, rawText) {
  const raw = normalizeText(rawText);
  const user = ensureUser(userId);
  const order = user.order;

  if (includesAny(raw, INTENT.cancel)) {
    resetOrder(userId);
    return { handled: true, reply: TEXT.cancelOrder };
  }
  if (!order.active) return { handled: false, reply: null };

  // 先看是否有寄送方式
  const sm = detectShipMethod(rawText);
  if (sm) updateUser(userId, (u) => (u.order.shipMethod = sm));

  // 解析是否又追加了品項/數量
  const parsed = parseOrder(rawText);
  if (parsed.items && parsed.items.length > 0) startOrUpdateOrder(userId, parsed);

  // 再依 step 填資料
  const latest = ensureUser(userId).order;
  const step = computeNextStep(latest);

  if (step === "shipMethod") {
    // 支援回覆 1/2
    if (/^\s*1\s*$/.test(raw)) updateUser(userId, (u) => (u.order.shipMethod = "home"));
    if (/^\s*2\s*$/.test(raw)) updateUser(userId, (u) => (u.order.shipMethod = "cvs"));
  } else if (step === "address") {
    // 地址：長度判斷＋包含市/區/路等關鍵字，避免把「台北」當地址
    if (raw.length >= 6 && /(市|縣|區|鄉|鎮|村|里|路|街|巷|弄|號|樓)/.test(rawText)) {
      updateUser(userId, (u) => (u.order.address = rawText.trim()));
    }
  } else if (step === "cvs") {
    // 店到店：抓門市名稱與可選店號（純數字 4~6 位常見）
    const code = (rawText.match(/(\d{4,6})/) || [])[1] || null;
    // 去掉店號後當門市名稱
    let name = rawText.replace(/\d{4,6}/g, "").trim();
    name = name.replace(/^(1|2)\s*[).、．]?\s*/g, "").trim();
    if (name.length >= 2) {
      updateUser(userId, (u) => {
        u.order.cvsName = name;
        if (code) u.order.cvsCode = code;
      });
    }
  } else if (step === "name") {
    // 名字：避免把「價格/容量」當名字
    if (raw.length >= 2 && raw.length <= 20 && !includesAny(raw, ["價格","容量","地址","電話","官網","門市","怎麼買"])) {
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
 * J) 回覆排序器 + 聰明回覆（方案A）
 * ========================= */
const INTENT_PRIORITY = [
  "cancel",
  "sensitive",
  "consult",
  "buy",
  "productList",
  "pricing",
  "specs",
  "soupPrice",
  "store",
  "website",
  "shipping",
  "payment",
  "testing",
];

function sortIntents(intents) {
  const set = new Set(intents);
  return INTENT_PRIORITY.filter((k) => set.has(k));
}

function buildSmartReply(userId, raw, userState) {
  // 讓 pickTemplate 可寫回用（不污染原資料結構就用 __userId 暫掛）
  userState.__userId = userId;

  const intentsRaw = detectIntents(raw);
  const intents = sortIntents(intentsRaw);

  // 最高優先：敏感
  if (intents.includes("sensitive")) return TEXT.sensitive;

  // 產品上下文
  const productKey = detectProductKey(raw) || userState.lastProductKey || null;

  // 只打產品名（沒有其他意圖）→ 回該產品「官網式使用說明」
  if (intents.length === 0 && productKey === "gel") return gelFull();
  if (intents.length === 0 && productKey === "drink") return drinkUsageBlock();
  if (intents.length === 0 && productKey === "antler") return antlerUsageBlock();
  if (intents.length === 0 && productKey === "soup") return soupUsageBlock();

  // 一句多問 → parts 合併（排序器已排序）
  const parts = [];

  for (const k of intents) {
    if (k === "cancel") {
      parts.push(TEXT.cancelOrder);
      continue;
    }

    if (k === "consult") {
      const t = pickTemplate(userState, "consult", TEXT.consultEntryVariants);
      parts.push(t);
      continue;
    }

    if (k === "buy") {
      const t = pickTemplate(userState, "buy", TEXT.howToBuyVariants);
      parts.push(t);
      continue;
    }

    if (k === "productList") {
      parts.push(productListText());
      continue;
    }

    if (k === "store") {
      parts.push(storeInfo());
      continue;
    }

    if (k === "website") {
      parts.push(`官網連結：${STORE.website}`);
      continue;
    }

    if (k === "testing") {
      parts.push(TEXT.testing);
      continue;
    }

    if (k === "shipping") {
      parts.push(TEXT.shipping);
      continue;
    }

    if (k === "payment") {
      parts.push(TEXT.payment);
      continue;
    }

    if (k === "soupPrice") {
      parts.push(soupPriceAll());
      continue;
    }

    if (k === "pricing") {
      // 有上下文產品 → 回該產品價格；無 → 全品項
      const p = STORE.products;
      if (productKey === "gel") parts.push(`【龜鹿膏｜價格】\n規格：${p.gel.spec}\n優惠價 ${money(p.gel.pricePromo)}（售價 ${money(p.gel.priceList)}）`);
      else if (productKey === "drink") parts.push(`【龜鹿飲｜價格】\n規格：${p.drink.spec}\n優惠價 ${money(p.drink.pricePromo)}（售價 ${money(p.drink.priceList)}）`);
      else if (productKey === "antler") parts.push(`【鹿茸粉｜價格】\n規格：${p.antler.spec}\n優惠價 ${money(p.antler.pricePromo)}（售價 ${money(p.antler.priceList)}）`);
      else if (productKey === "soup") parts.push(soupPriceAll());
      else parts.push(pricingAll());
      continue;
    }

    if (k === "specs") {
      const p = STORE.products;
      if (!productKey) parts.push(specsAll());
      else if (productKey === "gel") parts.push(`【龜鹿膏｜規格】\n${p.gel.spec}`);
      else if (productKey === "drink") parts.push(`【龜鹿飲｜規格】\n${p.drink.spec}`);
      else if (productKey === "antler") parts.push(`【鹿茸粉｜規格】\n${p.antler.spec}`);
      else parts.push("【龜鹿湯塊｜規格】\n一斤600g／半斤300g／4兩150g");
      continue;
    }
  }

  // 沒偵測到任何意圖 → fallback（輪替）
  if (parts.length === 0) {
    const t = pickTemplate(userState, "fallback", TEXT.fallbackVariants);
    return t;
  }

  const reply = parts.join("\n\n——\n\n");

  // ✅ 硬去重：短時間內完全相同就改用 fallback 變體（避免你截圖那種重複）
  if (shouldHardDedupe(userState, reply)) {
    const t = pickTemplate(userState, "fallback", TEXT.fallbackVariants);
    return t;
  }

  return reply;
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
        intentRotation: {},
        intentLastAt: {},
      };
      users[userId].order = users[userId].order || {
        active: false, step: null, shipMethod: null, address: null, cvsName: null, cvsCode: null, name: null, phone: null, items: [], updatedAt: Date.now(),
      };
      saveUsers(users);

      // 歡迎訊息輪替
      const u = ensureUser(userId);
      u.state.__userId = userId;
      const welcomeText = pickTemplate(u.state, "welcome", TEXT.welcomeVariants);
      return client.replyMessage(event.replyToken, textMessage(welcomeText));
    }
    // 沒 userId 也回固定歡迎
    return client.replyMessage(event.replyToken, textMessage(TEXT.welcomeVariants[0]));
  }

  if (event.type !== "message") return null;
  if (!event.message || event.message.type !== "text") return null;

  const userId = event.source && event.source.userId;
  const userTextRaw = event.message.text || "";
  const raw = normalizeText(userTextRaw);

  // 無 userId：用無狀態回覆
  if (!userId) {
    const reply = buildSmartReply("__nouser__", raw, { lastProductKey: null, lastReplyHash: null, lastReplyAt: 0, intentRotation: {}, intentLastAt: {} });
    return client.replyMessage(event.replyToken, textMessage(reply));
  }

  const user = ensureUser(userId);

  // 0) 取消
  if (includesAny(raw, INTENT.cancel)) {
    resetOrder(userId);
    const reply = TEXT.cancelOrder;
    commitReplyMemory(userId, reply);
    return client.replyMessage(event.replyToken, textMessage(reply));
  }

  // 1) 訂單流程已啟動：先補資料
  if (user.order && user.order.active) {
    const filled = tryFillOrderFromMessage(userId, userTextRaw);
    if (filled.handled) {
      commitReplyMemory(userId, filled.reply);
      return client.replyMessage(event.replyToken, textMessage(filled.reply));
    }
  }

  // 2) 解析本句是否為下單（或包含品項/數量）
  const parsed = parseOrder(userTextRaw);
  if ((parsed.items && parsed.items.length > 0) || parsed.hasOrderIntent) {
    startOrUpdateOrder(userId, parsed);

    // 更新上下文產品（第一個 item）
    const updated = ensureUser(userId);
    if (updated.order.items && updated.order.items.length > 0) {
      updateUser(userId, (u) => (u.state.lastProductKey = updated.order.items[0].key));
    }

    const reply = buildOrderPrompt(updated.order);
    commitReplyMemory(userId, reply);
    return client.replyMessage(event.replyToken, textMessage(reply));
  }

  // 3) 一般全連動回覆
  const pk = detectProductKey(raw);
  if (pk) updateUser(userId, (u) => (u.state.lastProductKey = pk));

  const latestState = ensureUser(userId).state;
  const reply = buildSmartReply(userId, raw, latestState);

  commitReplyMemory(userId, reply);
  return client.replyMessage(event.replyToken, textMessage(reply));
}

app.listen(PORT, () => console.log(`LINE bot webhook listening on port ${PORT}`));
