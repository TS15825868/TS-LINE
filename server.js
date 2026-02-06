"use strict";

/**
 * 仙加味・龜鹿 LINE Bot（整包替換版｜方案A：諮詢入口）
 *
 * ✅ 已包含
 * - 排序器：多意圖合併回覆順序固定（先諮詢入口→產品→價格→容量→怎麼買→運送→付款→檢驗→門市/官網）
 * - 模板輪替：同類問題輪替不同版本；避免重複同一段
 * - 去重：若本次回覆與上次回覆「相同簽章」，自動切換下一模板
 * - 上下文連動：上一句提產品，下一句只問「價格/容量/怎麼買」也能接上
 * - 下單解析加強：支援「①②③」編號格式、2罐龜鹿膏、龜鹿膏2罐、我要買龜鹿飲1包…等
 * - 下單流程：縣市 → 姓名 → 電話 → 地址 → 完整確認
 * - 敏感問題導流合作中醫師（你提供話術）
 *
 * ⚙️ 環境變數
 * - CHANNEL_ACCESS_TOKEN
 * - CHANNEL_SECRET
 * - PORT（可選）
 */

const express = require("express");
const line = require("@line/bot-sdk");
const fs = require("fs");
const path = require("path");
const cron = require("node-cron");
const crypto = require("crypto");

const { CHANNEL_ACCESS_TOKEN, CHANNEL_SECRET, PORT = 3000 } = process.env;
if (!CHANNEL_ACCESS_TOKEN || !CHANNEL_SECRET) {
  console.error("缺少環境變數：CHANNEL_ACCESS_TOKEN 或 CHANNEL_SECRET");
  process.exit(1);
}

const config = { channelAccessToken: CHANNEL_ACCESS_TOKEN, channelSecret: CHANNEL_SECRET };
const app = express();
const client = new line.Client(config);

/** =========================
 * A) 店家/產品資料（價格依你提供；使用方式依官網文案）
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

  // ✅ 用詞統一：售價（原價）／優惠價（特價）
  products: {
    gel: {
      key: "gel",
      name: "龜鹿膏",
      specShort: "100g/罐",
      priceList: 1800,  // 售價
      pricePromo: 1500, // 優惠價
      // 依官網內容（精簡、但保留核心邏輯）
      usageBlocks: [
        [
          "【龜鹿膏｜使用方式】",
          "• 每日 1～2 小匙，不需沖泡，直接內服即可。",
          "• 也可搭配溫開水沖開，或加入日常湯品中。",
          "• 若當天同時搭配龜鹿飲或湯塊，可先維持 1 匙，觀察作息與精神變化。",
          "• 若正在接受治療或長期服用藥物，可先留言我們再一起評估。",
        ],
      ],
    },

    drink: {
      key: "drink",
      name: "龜鹿飲",
      specShort: "180cc/包",
      priceList: 200,
      pricePromo: 160,
      usageBlocks: [
        [
          "【龜鹿飲｜建議飲用方式】",
          "• 一般建議：每日 1 包，可依個人狀況與作息調整頻率。",
          "• 可常溫飲用；亦可隔水加溫至溫熱，不建議直接大火煮沸。",
          "• 空腹或飯後皆可；若晚間飲用後精神較好，建議改在白天或下午。",
          "• 若同時搭配龜鹿膏或湯塊，建議先以其中一種為主軸，再討論如何分工安排。",
        ],
      ],
    },

    antler: {
      key: "antler",
      name: "鹿茸粉",
      specShort: "75g/罐",
      priceList: 2000,
      pricePromo: 1600,
      usageBlocks: [
        [
          "【鹿茸粉｜建議使用方式】",
          "• 加在飲品：1 匙加入牛奶、豆漿、優酪乳或果汁中混合飲用。",
          "• 加在餐食：拌入粥品、湯品或溫熱餐食中。",
          "• 頻率建議：每日 1～2 匙，可依個人狀況調整；搭配其他龜鹿產品可協助安排節奏。",
        ],
      ],
    },

    soup: {
      key: "soup",
      name: "龜鹿湯塊",
      variants: [
        { key: "soup600", label: "一斤", spec: "600公克", priceList: 8000, pricePromo: 6000 },
        { key: "soup300", label: "半斤", spec: "300公克", priceList: 4000, pricePromo: 3200 },
        { key: "soup150", label: "4兩",  spec: "150公克", priceList: 2000, pricePromo: 1600 },
      ],
      usageBlocks: [
        [
          "【湯塊｜建議使用方式】",
          "【日常飲用（單人/少數人）】",
          "• 1 塊放入保溫瓶/馬克杯，加熱水溶解後分次飲用；可調整水量或湯塊數量。",
          "",
          "【家庭燉湯（多人共享）】",
          "• 可作為雞湯、排骨湯、牛腱湯等湯底使用。",
          "• 建議先從 1～2 塊開始，依鍋子大小與風味濃度再微調。",
          "• 可搭配紅棗、枸杞或家中習慣食材一起熬煮。",
          "",
          "【頻率建議】",
          "• 多數家庭每週 1～2 次湯品為主；若同時搭配龜鹿膏/龜鹿飲，建議先以其中一種為主，再協助調整整體節奏。",
        ],
      ],
    },
  },

  testingNote:
    "目前我們可提供八大營養素等基本資訊（以外包裝/批次標示為準）。如需更詳細資料，歡迎留言，我們整理後回覆您。",
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

function sha1(s) {
  return crypto.createHash("sha1").update(String(s || ""), "utf8").digest("hex");
}

// 把 ①②③… 轉成 1/2/3，方便下單解析
function normalizeCircledNumbers(s) {
  const map = {
    "①": "1", "②": "2", "③": "3", "④": "4", "⑤": "5",
    "⑥": "6", "⑦": "7", "⑧": "8", "⑨": "9", "⑩": "10",
    "⑪": "11", "⑫": "12", "⑬": "13", "⑭": "14", "⑮": "15",
    "⑯": "16", "⑰": "17", "⑱": "18", "⑲": "19", "⑳": "20",
  };
  return String(s || "").replace(/[①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳]/g, (m) => map[m] || m);
}

function normalizeText(s) {
  return normalizeCircledNumbers(String(s || ""))
    .replace(/\u3000/g, " ")
    .replace(/[，,、/／]+/g, " ")
    .replace(/[：:]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function includesAny(t, arr) {
  const s = String(t || "");
  return arr.some((k) => s.includes(k));
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
    lastReplySig: null,
    rotator: {}, // { intentKey: number }
  };
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
  users[userId].state = users[userId].state || { lastProductKey: null, lastSeenAt: Date.now(), lastReplySig: null, rotator: {} };
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
 * E) 模板輪替器（避免重複）
 * ========================= */
function pickVariant(userId, key, variants) {
  const user = ensureUser(userId);
  const rot = user.state.rotator || {};
  const idx = (rot[key] || 0) % variants.length;
  rot[key] = (rot[key] || 0) + 1;

  // 先選 idx 版本
  let chosen = variants[idx];

  // 若與上次回覆完全一樣 → 改用下一個版本
  const sig = sha1(chosen);
  if (user.state.lastReplySig && user.state.lastReplySig === sig && variants.length > 1) {
    const idx2 = (idx + 1) % variants.length;
    chosen = variants[idx2];
    rot[key] = (rot[key] || 0) + 1;
  }

  updateUser(userId, (u) => {
    u.state.rotator = rot;
    u.state.lastReplySig = sha1(chosen);
  });

  return chosen;
}

/** =========================
 * F) 固定文案（用詞統一：售價/優惠價）
 * ========================= */
function soupPriceAllText() {
  const p = STORE.products.soup;
  const lines = ["【龜鹿湯塊｜三種規格價格】", ""];
  for (const v of p.variants) {
    lines.push(`${v.label}（${v.spec}）`);
    lines.push(`售價 ${money(v.priceList)}｜優惠價 ${money(v.pricePromo)}`);
    lines.push("");
  }
  while (lines.length && lines[lines.length - 1] === "") lines.pop();
  return lines.join("\n");
}

function pricingAllText() {
  const gel = STORE.products.gel;
  const drink = STORE.products.drink;
  const antler = STORE.products.antler;

  return [
    "【價格總覽（售價／優惠價）】",
    `▪️ 龜鹿膏 ${gel.specShort}：售價 ${money(gel.priceList)}｜優惠價 ${money(gel.pricePromo)}`,
    `▪️ 龜鹿飲 ${drink.specShort}：售價 ${money(drink.priceList)}｜優惠價 ${money(drink.pricePromo)}`,
    `▪️ 鹿茸粉 ${antler.specShort}：售價 ${money(antler.priceList)}｜優惠價 ${money(antler.pricePromo)}`,
    "▪️ 龜鹿湯塊：輸入「湯塊價格」查看一斤/半斤/4兩",
    "",
    "可直接下單（擇一方式）：",
    "• 文字下單：我要龜鹿膏2罐+龜鹿飲10包 寄台中",
    "• 編號下單：①龜鹿膏 ②2罐 ③台中",
  ].join("\n");
}

function specsAllText() {
  return [
    "【容量／規格】",
    `▪️ 龜鹿膏：${STORE.products.gel.specShort}`,
    `▪️ 龜鹿飲：${STORE.products.drink.specShort}`,
    `▪️ 鹿茸粉：${STORE.products.antler.specShort}`,
    "▪️ 龜鹿湯塊：一斤600g／半斤300g／4兩150g",
  ].join("\n");
}

function productListText() {
  return [
    "【產品清單】",
    `▪️ 龜鹿膏（${STORE.products.gel.specShort}）`,
    `▪️ 龜鹿飲（${STORE.products.drink.specShort}）`,
    `▪️ 龜鹿湯塊（一斤600g／半斤300g／4兩150g）`,
    `▪️ 鹿茸粉（${STORE.products.antler.specShort}）`,
    "",
    "你可以直接回：龜鹿膏 / 龜鹿飲 / 湯塊價格 / 鹿茸粉",
  ].join("\n");
}

function storeInfoText() {
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
 * G) 入口/常用回覆（輪替模板）
 * ========================= */
const TPL = {
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
      "也可直接下單：我要龜鹿膏2罐+龜鹿飲10包 寄台中",
    ].join("\n"),
    [
      `嗨您好😊 這裡是【${STORE.brandName}】`,
      "想最快拿到資訊，可以回：",
      "• 價格  • 容量  • 怎麼買  • 產品名",
      "",
      "也可以直接打：龜鹿膏2罐 寄台北",
    ].join("\n"),
    [
      `歡迎加入【${STORE.brandName}】🌿`,
      "",
      "快速選單：諮詢 / 產品名 / 價格 / 容量 / 怎麼買 / 湯塊價格 / 門市資訊",
      "（你也可以直接打一段話下單，我會一步一步帶你完成）",
    ].join("\n"),
  ],

  consultEntry: [
    [
      `您好😊 這裡是【${STORE.brandName}】`,
      "我可以先幫你快速整理常見資訊，或直接協助下單。",
      "",
      "請回覆其中一個即可：",
      "① 想了解：龜鹿膏／龜鹿飲／湯塊／鹿茸粉",
      "② 直接問：價格／容量／怎麼買",
      "③ 直接下單：例 2罐龜鹿膏、或 龜鹿膏2罐+龜鹿飲10包 寄台中",
      "",
      "若是孕哺／慢性病／用藥等狀況，我會改由合作中醫師協助🙂",
    ].join("\n"),
    [
      `收到👌 我先當你的「快速導覽」`,
      "",
      "你想先看哪一類？",
      "• 價格（售價/優惠價）",
      "• 容量（規格/重量）",
      "• 怎麼買（下單流程）",
      "• 或直接回產品名：龜鹿膏/龜鹿飲/湯塊/鹿茸粉",
    ].join("\n"),
    [
      `了解😊 你可以直接丟一句話就好：`,
      "• 想問：價格 / 容量 / 怎麼買",
      "• 想看：產品名",
      "• 想下單：龜鹿膏2罐 寄台北",
      "",
      "我會把你需要的資訊一次整理給你。",
    ].join("\n"),
  ],

  howToBuy: [
    [
      "【怎麼買／下單流程】",
      "你可以直接打一段話：",
      "例：我要龜鹿膏2罐+龜鹿飲10包 寄台中",
      "",
      "或用編號也可以：",
      "① 品項（龜鹿膏/龜鹿飲/湯塊/鹿茸粉）",
      "② 數量（例：1罐/10包/一斤1份）",
      "③ 寄送縣市（例：台北/新北/台中）",
    ].join("\n"),
    [
      "要下單的話很快😊",
      "你只要回我三件事：品項＋數量＋寄送縣市",
      "例如：龜鹿飲10包 寄新北",
    ].join("\n"),
    [
      "下單可以用「一行完成」：",
      "• 龜鹿膏2罐 寄台北",
      "或用「三行編號」：",
      "①龜鹿膏 ②2罐 ③台北",
    ].join("\n"),
  ],

  shipping: [
    ["【運送／運費／到貨】", "", STORE.shippingNote].join("\n"),
    ["運送說明：", STORE.shippingNote, "你給我寄送縣市，我就能一起回覆運費與到貨方式😊"].join("\n"),
    ["可以寄送喔👌", STORE.shippingNote].join("\n"),
  ],

  payment: [
    ["【付款方式】", "", STORE.paymentNote].join("\n"),
    ["付款方式我會在訂單確認後一併整理給你😊", STORE.paymentNote].join("\n"),
    ["付款可配合安排（如轉帳等）", "我先幫你把品項/數量/寄送整理好，再回覆付款資訊👌"].join("\n"),
  ],

  testing: [
    ["【檢驗／報告】", "", STORE.testingNote].join("\n"),
    ["關於檢驗資料：", STORE.testingNote].join("\n"),
    ["目前可提供基本標示資訊（八大營養素等）", "若你想看哪一項，我可以幫你整理後回覆😊"].join("\n"),
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
      "我先給你最常用的指令😊（也可以直接留言需求）",
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
      "我可能沒抓到你想問的重點😅",
      "你可以用這種方式問我：",
      "• 龜鹿膏價格",
      "• 鹿茸粉容量",
      "• 我要買龜鹿飲10包 寄台中",
    ].join("\n"),
    [
      "你可以回我：價格／容量／怎麼買／產品名",
      "或直接打一段話下單：龜鹿膏2罐 寄台北 😊",
    ].join("\n"),
  ],
};

/** =========================
 * H) 意圖判斷（含同義詞）
 * ========================= */
const INTENT = {
  consult: ["諮詢","客服","真人","專人","有人嗎","請協助","幫我","詢問","問一下","我要問"],
  pricing: ["價格","價錢","售價","多少錢","幾錢","優惠","活動","折扣","報價","批發","一包多少","一罐多少","一盒多少"],
  specs: ["容量","規格","幾克","幾g","g","公克","克","幾cc","cc","毫升","ml","多大","多少量","重量","尺寸"],
  productList: ["產品名","有哪些產品","有什麼產品","產品","商品","品項","商品清單","品項清單"],
  buy: ["怎麼買","怎麼購買","下單","訂購","購買","我要買","我要","訂單","訂購方式","怎麼訂","怎麼下單"],
  shipping: ["運送","寄送","運費","到貨","配送","宅配","超商","店到店","多久到","幾天到","貨到"],
  payment: ["付款","怎麼付","轉帳","匯款","刷卡","貨到付款","付款方式","付錢"],
  testing: ["檢驗","報告","檢測","八大營養素","合格","安全","驗證","有驗嗎"],
  store: ["門市","店面","地址","在哪","位置","怎麼去","地圖","電話","聯絡","營業時間"],
  website: ["官網","網站","網址","連結","官網連結"],
  soupPrice: ["湯塊價格","湯塊售價","湯塊多少錢","湯塊優惠","湯塊價錢"],

  gel: ["龜鹿膏"],
  drink: ["龜鹿飲"],
  antler: ["鹿茸粉","鹿茸"],
  soup: ["龜鹿湯塊","湯塊","湯底"],

  sensitive: [
    "孕婦","懷孕","備孕","哺乳","餵母乳",
    "慢性病","三高","高血壓","糖尿病","洗腎","肝","心臟",
    "癌","癌症","化療","放療","手術","術後",
    "用藥","抗凝血","阿斯匹靈","warfarin",
    "能不能吃","可以吃嗎","適不適合","副作用","禁忌"
  ],
  cancel: ["取消","不用了","先不要","改天","取消下單","取消訂單","不要買了"],
};

function detectProductKey(raw) {
  if (raw.includes("湯塊") || raw.includes("龜鹿湯塊")) return "soup";
  if (raw.includes("龜鹿膏")) return "gel";
  if (raw.includes("龜鹿飲")) return "drink";
  if (raw.includes("鹿茸粉") || raw.includes("鹿茸")) return "antler";
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
  return Array.from(intents);
}

/** =========================
 * I) 訂單解析（強化：支援編號/分行/數量分離）
 * ========================= */
const ORDER_INTENT_WORDS = ["我要", "我想買", "想買", "訂購", "下單", "購買", "要買", "訂", "買", "來一", "給我", "幫我出"];
const CITY_LIST = [
  "台北","新北","基隆","桃園","新竹","苗栗",
  "台中","彰化","南投","雲林",
  "嘉義","台南","高雄","屏東",
  "宜蘭","花蓮","台東",
  "澎湖","金門","馬祖",
];

function extractShipCity(rawText) {
  const t = normalizeText(rawText);
  for (const city of CITY_LIST) {
    const re = new RegExp(`(寄到|寄送|寄|送到|配送|宅配)\\s*${city}`);
    if (re.test(t)) return city;
  }
  for (const city of CITY_LIST) {
    if (t.includes(city)) return city;
  }
  return null;
}

function looksLikeOrder(rawText) {
  const t = normalizeText(rawText);
  // 允許：2罐 / 10包 / 1份 / 3盒
  return /([0-9]{1,3}|一|二|兩|三|四|五|六|七|八|九|十)\s*(罐|包|盒|組|份|個)/.test(t);
}

function hasNumberedOrderFormat(rawText) {
  // ①龜鹿膏 ②2罐 ③台北（或 1 龜鹿膏 2 2罐 3 台北）
  const t = normalizeText(rawText);
  return /(^|\s)(1|2|3)\s*(龜鹿膏|龜鹿飲|湯塊|龜鹿湯塊|鹿茸粉|鹿茸)/.test(t) ||
         /(龜鹿膏|龜鹿飲|湯塊|龜鹿湯塊|鹿茸粉|鹿茸)\s*(1|2|3)\s*([0-9]{1,3}|一|二|兩|三|四|五|六|七|八|九|十)\s*(罐|包|盒|組|份|個)?/.test(t);
}

function extractQtyUnitAnywhere(text) {
  const t = normalizeText(text);
  const m = t.match(/([0-9]{1,3}|一|二|兩|三|四|五|六|七|八|九|十)\s*(罐|包|盒|組|份|個)/);
  if (!m) return null;
  const rawNum = m[1];
  const unit = m[2];
  const qty = /^[0-9]+$/.test(rawNum) ? safeInt(rawNum) : cnNumToInt(rawNum);
  if (!qty || qty <= 0) return null;
  return { qty, unit };
}

function extractQtyAfterProduct(text, productAlias) {
  const t = normalizeText(text);
  const unitGroup = "(罐|包|盒|組|份|個)?";
  const numGroup = "([0-9]{1,3}|一|二|兩|三|四|五|六|七|八|九|十)";
  const re = new RegExp(`${productAlias}\\s*${numGroup}\\s*${unitGroup}`);
  const m = t.match(re);
  if (!m) return null;
  const rawNum = m[1];
  const unit = m[2] || null;
  const qty = /^[0-9]+$/.test(rawNum) ? safeInt(rawNum) : cnNumToInt(rawNum);
  if (!qty || qty <= 0) return null;
  return { qty, unit };
}

function extractQtyBeforeProduct(text, productAlias) {
  const t = normalizeText(text);
  const unitGroup = "(罐|包|盒|組|份|個)";
  const numGroup = "([0-9]{1,3}|一|二|兩|三|四|五|六|七|八|九|十)";
  const re = new RegExp(`${numGroup}\\s*${unitGroup}\\s*${productAlias}`);
  const m = t.match(re);
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
  return "";
}

// 產品別名
const PRODUCT_ALIASES = [
  { key: "gel", name: "龜鹿膏", aliases: ["龜鹿膏"] },
  { key: "drink", name: "龜鹿飲", aliases: ["龜鹿飲"] },
  { key: "antler", name: "鹿茸粉", aliases: ["鹿茸粉","鹿茸"] },
  { key: "soup600", name: "龜鹿湯塊一斤", aliases: ["湯塊一斤","一斤湯塊","600公克湯塊","600g湯塊","一斤"] },
  { key: "soup300", name: "龜鹿湯塊半斤", aliases: ["湯塊半斤","半斤湯塊","300公克湯塊","300g湯塊","半斤"] },
  { key: "soup150", name: "龜鹿湯塊4兩", aliases: ["湯塊4兩","4兩湯塊","湯塊四兩","四兩湯塊","150公克湯塊","150g湯塊","4兩","四兩"] },
];

function isLikelyOrderMessage(rawText) {
  const t = normalizeText(rawText);
  const hasOrderWord = ORDER_INTENT_WORDS.some(w => t.includes(w));
  const hasQty = looksLikeOrder(t);
  const hasCity = !!extractShipCity(t);
  const hasProduct = includesAny(t, ["龜鹿膏","龜鹿飲","湯塊","龜鹿湯塊","鹿茸粉","鹿茸"]);
  const hasNumbered = hasNumberedOrderFormat(rawText);
  // ✅ 只要「產品 +（數量或縣市或編號）」就優先視為下單
  return (hasProduct && (hasQty || hasCity || hasNumbered)) || hasOrderWord;
}

function parseOrder(rawText) {
  const text = normalizeText(rawText);
  const hasOrderIntent = ORDER_INTENT_WORDS.some(w => text.includes(w));
  const shipCity = extractShipCity(text);

  const shouldTry = hasOrderIntent || looksLikeOrder(text) || hasNumberedOrderFormat(rawText) || (shipCity && includesAny(text, ["龜鹿膏","龜鹿飲","湯塊","鹿茸粉","鹿茸"]));
  if (!shouldTry && !includesAny(text, ["龜鹿膏","龜鹿飲","鹿茸粉","鹿茸","湯塊"])) {
    return { hasOrderIntent: false, items: [], shipCity: null };
  }

  const itemsMap = new Map();

  // 抓「產品 + 近距離數量」
  for (const p of PRODUCT_ALIASES) {
    const matchedAlias = p.aliases
      .filter(a => text.includes(a))
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
      qty: qty,
      unit,
      promoUnitPrice: promoUnitPriceByKey(p.key),
      listUnitPrice: listUnitPriceByKey(p.key),
    });
  }

  // ✅ 若只有一個品項但數量寫在別處（編號/分行），套用全句第一個 qty
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

  // ✅ 多品項但缺 qty → 預設 1
  for (const [k, it] of itemsMap.entries()) {
    if (!it.qty) it.qty = 1;
    itemsMap.set(k, it);
  }

  return { hasOrderIntent: hasOrderIntent || looksLikeOrder(text) || hasNumberedOrderFormat(rawText), items: Array.from(itemsMap.values()), shipCity };
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
    const unit = it.unit || defaultUnitByKey(it.key);
    const price = (typeof it.promoUnitPrice === "number" && typeof it.listUnitPrice === "number")
      ? `｜售價 ${money(it.listUnitPrice)}｜優惠價 ${money(it.promoUnitPrice)} /${unit}`
      : "";
    lines.push(`▪️ ${it.name} × ${it.qty} ${unit}${price}`);
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
  if (!order.items || order.items.length === 0) {
    return [
      "好的😊 我可以協助你下單！",
      "",
      "請先告訴我品項與數量（可直接這樣打）：",
      "例：2罐龜鹿膏 / 10包龜鹿飲 / 湯塊一斤1份",
    ].join("\n");
  }

  const summary = orderSummaryLines(order.items || []);
  const head = ["我先幫你整理目前訂單（如有誤可直接更正）👇", "", ...summary].join("\n");

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
    return { handled: true, reply: "已為你取消本次下單流程。如需重新下單，直接輸入：龜鹿膏2罐 寄台中 😊" };
  }
  if (!order.active) return { handled: false, reply: null };

  // 允許在流程中補品項/數量/縣市
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
    // 避免把「價格/容量」當姓名
    if (raw.length >= 2 && raw.length <= 12 && !includesAny(raw, ["價格","容量","地址","電話","官網","門市","湯塊","龜鹿","鹿茸"])) {
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
 * J) 智能回覆（排序器＋輪替模板）
 * ========================= */

// ✅ 排序器：同一句多意圖時，回覆順序固定
const INTENT_PRIORITY = [
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

// 產品頁快速回答（價格/容量/使用方式）
function productQuickPricing(key) {
  if (key === "gel") {
    const p = STORE.products.gel;
    return `【龜鹿膏｜價格】\n售價 ${money(p.priceList)}｜優惠價 ${money(p.pricePromo)}\n規格：${p.specShort}`;
  }
  if (key === "drink") {
    const p = STORE.products.drink;
    return `【龜鹿飲｜價格】\n售價 ${money(p.priceList)}｜優惠價 ${money(p.pricePromo)}\n規格：${p.specShort}`;
  }
  if (key === "antler") {
    const p = STORE.products.antler;
    return `【鹿茸粉｜價格】\n售價 ${money(p.priceList)}｜優惠價 ${money(p.pricePromo)}\n規格：${p.specShort}`;
  }
  if (key === "soup") return soupPriceAllText();
  return null;
}

function productQuickSpecs(key) {
  if (key === "gel") return `【龜鹿膏｜規格】\n${STORE.products.gel.specShort}`;
  if (key === "drink") return `【龜鹿飲｜規格】\n${STORE.products.drink.specShort}`;
  if (key === "antler") return `【鹿茸粉｜規格】\n${STORE.products.antler.specShort}`;
  if (key === "soup") return "【龜鹿湯塊｜規格】\n一斤600g／半斤300g／4兩150g";
  return null;
}

function productUsageByKey(key) {
  if (key === "gel") return STORE.products.gel.usageBlocks[0].join("\n");
  if (key === "drink") return STORE.products.drink.usageBlocks[0].join("\n");
  if (key === "antler") return STORE.products.antler.usageBlocks[0].join("\n");
  if (key === "soup") return STORE.products.soup.usageBlocks[0].join("\n");
  return null;
}

// ✅ 把同義詞/模糊問法也導向：價格/容量/怎麼買
function inferImplicitIntents(raw) {
  const t = normalizeText(raw);
  const extra = new Set();
  if (/^(價格|價錢|售價|多少錢|幾錢)$/.test(t)) extra.add("pricing");
  if (/^(容量|規格|重量|幾克|幾g|幾cc|多大)$/.test(t)) extra.add("specs");
  if (/^(怎麼買|下單|訂購|購買|我要買)$/.test(t)) extra.add("buy");
  return Array.from(extra);
}

function buildSmartReply(userId, raw, userState) {
  const intents0 = detectIntents(raw);
  const intents = Array.from(new Set([...intents0, ...inferImplicitIntents(raw)]));

  if (intents.includes("sensitive")) {
    return pickVariant(userId, "sensitive", TPL.sensitive);
  }

  // 上下文產品連動
  const productKey = detectProductKey(raw) || userState.lastProductKey || null;

  // ✅ 只打產品名（且不是在下單語境）→ 回使用方式（依官網文案）
  if (intents.length === 0 && productKey) {
    const usage = productUsageByKey(productKey);
    if (usage) return usage;
  }

  // ✅ 排序器：按照固定順序拼接
  const ordered = intents.sort((a, b) => INTENT_PRIORITY.indexOf(a) - INTENT_PRIORITY.indexOf(b));
  const parts = [];

  for (const it of ordered) {
    if (it === "consult") parts.push(pickVariant(userId, "consultEntry", TPL.consultEntry));
    else if (it === "productList") parts.push(productListText());
    else if (it === "soupPrice") parts.push(soupPriceAllText());
    else if (it === "pricing") {
      const p = productKey ? productQuickPricing(productKey) : null;
      parts.push(p || pricingAllText());
    }
    else if (it === "specs") {
      const p = productKey ? productQuickSpecs(productKey) : null;
      parts.push(p || specsAllText());
    }
    else if (it === "buy") parts.push(pickVariant(userId, "howToBuy", TPL.howToBuy));
    else if (it === "shipping") parts.push(pickVariant(userId, "shipping", TPL.shipping));
    else if (it === "payment") parts.push(pickVariant(userId, "payment", TPL.payment));
    else if (it === "testing") parts.push(pickVariant(userId, "testing", TPL.testing));
    else if (it === "store") parts.push(storeInfoText());
    else if (it === "website") parts.push(`官網連結：${STORE.website}`);
  }

  if (parts.length === 0) return pickVariant(userId, "fallback", TPL.fallback);

  // ✅ 合併時加分隔，讓閱讀清楚
  return parts.join("\n\n——\n\n");
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
      users[userId].state = users[userId].state || { lastProductKey: null, lastSeenAt: Date.now(), lastReplySig: null, rotator: {} };
      users[userId].order = users[userId].order || { active: false, step: null, shipCity: null, name: null, phone: null, address: null, items: [], updatedAt: Date.now() };
      saveUsers(users);
    }
    // ✅ 歡迎訊息也輪替
    const welcome = userId ? pickVariant(userId, "welcome", TPL.welcome) : TPL.welcome[0];
    return client.replyMessage(event.replyToken, textMessage(welcome));
  }

  if (event.type !== "message") return null;
  if (!event.message || event.message.type !== "text") return null;

  const userId = event.source && event.source.userId;
  const userTextRaw = event.message.text || "";
  const raw = normalizeText(userTextRaw);

  // 沒有 userId（極少）就直接回
  if (!userId) {
    const reply = pickVariant("anonymous", "fallback", TPL.fallback);
    return client.replyMessage(event.replyToken, textMessage(reply));
  }

  const user = ensureUser(userId);

  // 0) 若正在下單流程：先嘗試補資料
  if (user.order && user.order.active) {
    const filled = tryFillOrderFromMessage(userId, userTextRaw);
    if (filled.handled) return client.replyMessage(event.replyToken, textMessage(filled.reply));
  }

  // ✅ 1) 只要判定像下單 → 優先走下單（避免你截圖那種跳去食用方式）
  if (isLikelyOrderMessage(userTextRaw)) {
    const parsed = parseOrder(userTextRaw);
    if ((parsed.items && parsed.items.length > 0) || parsed.hasOrderIntent || parsed.shipCity) {
      startOrUpdateOrder(userId, parsed);

      // 更新上下文產品（第一個 item）
      const updated = ensureUser(userId);
      if (updated.order.items && updated.order.items.length > 0) {
        updateUser(userId, (u) => (u.state.lastProductKey = updated.order.items[0].key === "soup600" || updated.order.items[0].key === "soup300" || updated.order.items[0].key === "soup150" ? "soup" : updated.order.items[0].key));
      }
      return client.replyMessage(event.replyToken, textMessage(buildOrderPrompt(updated.order)));
    }
  }

  // 2) 一般回覆：更新上下文產品
  const pk = detectProductKey(raw);
  if (pk) updateUser(userId, (u) => (u.state.lastProductKey = pk));

  const latestState = ensureUser(userId).state;
  const reply = buildSmartReply(userId, raw, latestState);
  return client.replyMessage(event.replyToken, textMessage(reply));
}

app.listen(PORT, () => console.log(`LINE bot webhook listening on port ${PORT}`));
