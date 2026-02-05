/**
 * LINE Bot Webhook - 自動回覆全集（含敏感問題導流 + 新好友24h追蹤推播）
 * npm i express @line/bot-sdk
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

  specs: {
    gel: { name: "龜鹿膏", size: 100, unit: "g/罐" },
    drink: { name: "龜鹿飲", size: 180, unit: "cc/包" },
    soup: { name: "龜鹿湯塊", size: "一斤／半斤／4兩", unit: "" },
    antler: { name: "鹿茸粉", size: 75, unit: "g/罐" },
  },

  pricingNote:
    "價格會依購買數量／組合與出貨方式不同。麻煩回覆「品項＋數量＋寄送地區」，我這邊立即報價給您😊",

  testingNote:
    "目前我們可提供八大營養素等基本資訊（依批次/包裝標示為準）。如需更詳細資料，歡迎留言，我們整理後回覆您。",

  paymentNote:
    "付款方式可依訂單安排（如：轉帳等）。請回覆「品項＋數量＋寄送地區」，我會一併提供付款與運送方式。",

  shippingNote:
    "可安排宅配/超商等方式（依地區與品項而定）。請回覆「寄送縣市＋品項＋數量」，我會提供運費與到貨時間預估。",

  doctorLineId: "@changwuchi",
  doctorLink: "https://lin.ee/1MK4NR9",
};

/** =========================
 * B) 回覆文案
 * ========================= */
const TEXT = {
  // ✅ 歡迎訊息（建議：新好友加好友即收到）
  welcome: [
    "您好，歡迎加入【仙加味・龜鹿】😊",
    "",
    "我們提供龜鹿相關產品與補養資訊，",
    "可依您的需求協助說明與建議。",
    "",
    "您可以直接輸入下列關鍵字👇",
    "",
    "1️⃣ 有什麼產品",
    "2️⃣ 價格／售價",
    "3️⃣ 容量／規格",
    "4️⃣ 龜鹿膏怎麼吃",
    "5️⃣ 龜鹿飲怎麼喝",
    "6️⃣ 怎麼買／運送／付款",
    "7️⃣ 門市資訊",
    "",
    "如有個人狀況（孕哺／用藥／慢性病等），",
    "我們會協助轉由合作中醫師一對一說明。",
    "",
    "也歡迎直接留言，我們將由專人回覆您🙂",
  ].join("\n"),

  // ✅ 24h 追蹤提醒（不打擾版）
  followup24h: [
    "您好😊 這裡是【仙加味・龜鹿】的小提醒",
    "",
    "若您想快速了解，可以直接輸入👇",
    "▪️ 有什麼產品",
    "▪️ 價格",
    "▪️ 容量",
    "▪️ 龜鹿膏怎麼吃",
    "▪️ 龜鹿飲怎麼喝",
    "▪️ 門市資訊",
    "",
    "也可以直接留言您的需求，",
    "我們會由專人協助您🙂",
  ].join("\n"),

  products: [
    "目前主要產品如下👇",
    "",
    "▪️ 龜鹿膏",
    "▪️ 龜鹿飲",
    "▪️ 龜鹿湯塊",
    "▪️ 鹿茸粉",
    "",
    "想看規格請輸入「容量」或「規格」",
    "想看食用方式請輸入：",
    "「龜鹿膏怎麼吃」／「龜鹿飲怎麼喝」",
  ].join("\n"),

  pricing: [
    "關於價格／售價：",
    STORE.pricingNote,
    "",
    "建議您回覆：",
    "① 品項（龜鹿膏/龜鹿飲/湯塊/鹿茸粉）",
    "② 數量",
    "③ 寄送地區（縣市）",
    "我就能一次報：商品＋運費＋到貨方式😊",
  ].join("\n"),

  specs: [
    "【容量／規格】",
    "",
    `▪️ ${STORE.specs.gel.name}：每罐 ${STORE.specs.gel.size} ${STORE.specs.gel.unit}`,
    `▪️ ${STORE.specs.drink.name}：每包 ${STORE.specs.drink.size} ${STORE.specs.drink.unit}`,
    `▪️ ${STORE.specs.soup.name}：${STORE.specs.soup.size}`,
    `▪️ ${STORE.specs.antler.name}：每罐 ${STORE.specs.antler.size} ${STORE.specs.antler.unit}`,
    "",
    "若您要搭配購買，回覆「品項＋數量＋寄送縣市」，我可以直接幫您整理合適方案。",
  ].join("\n"),

  gelHow: [
    "【龜鹿膏 食用方式】",
    "",
    "▪️ 建議早上或空腹前後食用",
    "▪️ 一天一次，一小匙（初次可先半匙）",
    "▪️ 可用熱水化開後搭配溫水，或直接食用",
    "▪️ 食用期間避免冰飲",
    "",
    "若您屬於孕哺／慢性病用藥中／特殊體質等情況，建議先諮詢合作中醫師了解後再食用。",
  ].join("\n"),

  drinkHow: [
    "【龜鹿飲 飲用方式】",
    "",
    "▪️ 每日一包",
    "▪️ 可隔水加熱或溫熱飲用",
    "▪️ 建議早上或白天飲用",
    "▪️ 飲用期間避免冰飲",
    "",
    "若您屬於孕哺／慢性病用藥中／特殊體質等情況，建議先諮詢合作中醫師了解後再飲用。",
  ].join("\n"),

  soupHow: [
    "【龜鹿湯塊 使用方式】",
    "",
    "▪️ 依個人口味加入適量水煮滾",
    "▪️ 可搭配肉類/食材一起燉煮",
    "▪️ 建議熱飲熱食，避免冰冷搭配",
  ].join("\n"),

  antlerHow: [
    "【鹿茸粉 食用建議】",
    "",
    "▪️ 可依個人習慣搭配溫水/飲品",
    "▪️ 建議白天食用為主",
    "▪️ 避免冰飲搭配",
    "",
    "若您屬於孕哺／慢性病用藥中／特殊體質等情況，建議先諮詢合作中醫師了解後再食用。",
  ].join("\n"),

  ingredients: [
    "【成分／原料】",
    "",
    "若您想了解特定品項的成分，請回覆：",
    "「成分 龜鹿膏」或「成分 龜鹿飲」",
  ].join("\n"),

  ingredientsGel: [
    "【龜鹿膏｜成分】",
    "請以實際包裝標示為準。",
  ].join("\n"),

  ingredientsDrink: [
    "【龜鹿飲｜成分】",
    "請以實際包裝標示為準。",
  ].join("\n"),

  storage: [
    "【保存方式／保存期限】",
    "",
    "▪️ 請依包裝標示之保存方式為準",
    "▪️ 避免高溫、潮濕、日照直射",
    "▪️ 開封後建議盡快食用/冷藏（依品項標示）",
  ].join("\n"),

  testing: ["【檢驗／報告】", "", STORE.testingNote].join("\n"),

  whoSuitable: [
    "【適合對象／注意事項】",
    "",
    "每個人體質、作息與飲食習慣不同，建議以「補養/日常保健」角度評估。",
    "若您有孕哺/慢性病/用藥/手術等狀況，建議先由合作中醫師一對一了解後再評估是否適合。",
  ].join("\n"),

  howToBuy: [
    "【怎麼買／下單流程】",
    "",
    "請直接回覆：",
    "① 品項",
    "② 數量",
    "③ 寄送地區（縣市）",
    "",
    "我會回覆：商品資訊/規格、價格（依數量/組合）、運送與付款方式。",
  ].join("\n"),

  payment: ["【付款方式】", "", STORE.paymentNote].join("\n"),
  shipping: ["【運送／運費／到貨】", "", STORE.shippingNote].join("\n"),

  storeInfo: [
    "【門市資訊】",
    "",
    `店名：${STORE.brandName}`,
    `地址：${STORE.address}`,
    `電話：${STORE.phoneDisplay}`,
    `官網：${STORE.website}`,
  ].join("\n"),

  website: ["官網連結在這裡👇", STORE.website].join("\n"),

  // ✅ 敏感問題統一導流（你提供的完整回覆）
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
    "▪️ 有什麼產品",
    "▪️ 價格",
    "▪️ 容量",
    "▪️ 龜鹿膏怎麼吃",
    "▪️ 龜鹿飲怎麼喝",
    "▪️ 怎麼買",
    "▪️ 門市資訊",
    "",
    "或直接留言您的需求，我們將由專人回覆您。",
  ].join("\n"),
};

/** =========================
 * C) 追蹤推播：檔案儲存（不需資料庫）
 * ========================= */
const DATA_DIR = path.join(__dirname, "data");
const USERS_FILE = path.join(DATA_DIR, "users.json");

// 確保資料夾存在
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

// users.json 格式：{ "<userId>": { followedAt: 1234567890, followupSent: true/false } }
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

async function schedule24hFollowup(userId) {
  // 24h 後推播（毫秒）
  const delayMs = 24 * 60 * 60 * 1000;

  setTimeout(async () => {
    try {
      const users = loadUsers();
      const u = users[userId];
      if (!u) return;
      if (u.followupSent) return; // 已送過就不再送

      await client.pushMessage(userId, {
        type: "text",
        text: TEXT.followup24h,
      });

      users[userId].followupSent = true;
      users[userId].followupSentAt = Date.now();
      saveUsers(users);
    } catch (err) {
      console.error("24h 推播失敗：", err);
    }
  }, delayMs);
}

/** =========================
 * D) 關鍵字規則（同義詞 + 模糊命中）
 * ========================= */

function normalizeText(s) {
  return String(s || "").replace(/\u3000/g, " ").replace(/\s+/g, " ").trim();
}

function matchAny(t, patterns) {
  return patterns.some((p) => String(t).includes(p));
}

const INTENT = {
  welcome: ["你好", "哈囉", "嗨", "幫助", "開始", "menu", "選單", "諮詢", "line諮詢", "客服"],
  products: ["有什麼產品", "產品", "品項", "商品", "有哪些", "目錄", "介紹"],
  pricing: ["價格", "售價", "多少錢", "價錢", "報價", "批發", "折扣", "優惠", "一罐多少", "一盒多少"],
  specs: ["容量", "規格", "幾克", "幾g", "幾公克", "幾cc", "幾毫升", "ml", "包裝", "一盒幾包", "一罐幾g", "多大", "多少量"],
  gelHow: ["龜鹿膏怎麼吃", "龜鹿膏吃法", "膏怎麼吃", "龜鹿膏"],
  drinkHow: ["龜鹿飲怎麼喝", "龜鹿飲喝法", "飲怎麼喝", "龜鹿飲"],
  soupHow: ["湯塊怎麼用", "湯塊", "怎麼煮", "怎麼煮湯", "料理方式"],
  antlerHow: ["鹿茸粉怎麼吃", "粉怎麼吃", "鹿茸粉", "鹿茸"],
  ingredients: ["成分", "原料", "內容物", "配方", "有加什麼"],
  storage: ["保存", "保存期限", "有效期限", "期限", "放多久", "要冰嗎", "要冷藏嗎", "常溫", "開封"],
  testing: ["檢驗", "報告", "檢測", "合格", "安全", "八大營養素"],
  whoSuitable: ["適合", "不適合", "誰可以", "誰不能"],
  howToBuy: ["怎麼買", "下單", "購買", "訂購", "要怎麼訂", "怎麼下訂", "購買方式", "怎麼下單"],
  payment: ["付款", "轉帳", "貨到付款", "刷卡", "匯款"],
  shipping: ["運送", "寄送", "運費", "到貨", "幾天到", "宅配", "超商", "店到店"],
  storeInfo: ["門市", "店面", "地址", "在哪", "位置", "營業", "電話", "怎麼去", "地點"],
  website: ["官網", "網站", "網址", "網頁"],

  // 敏感問題：命中就導到中醫師
  sensitive: [
    "孕婦","懷孕","備孕","哺乳","餵母乳",
    "小孩","兒童","未成年",
    "慢性病","三高","高血壓","血壓","糖尿病","血糖","高血糖","痛風",
    "腎","腎臟","洗腎","肝","肝臟",
    "心臟","心血管","中風",
    "癌","癌症","腫瘤","化療","放療",
    "手術","術後",
    "用藥","正在吃藥","抗凝血","阿斯匹靈","warfarin",
    "過敏","體質","副作用",
    "能不能吃","可以吃嗎","適不適合","會不會","危險嗎",
  ],
};

function pickReply(userText) {
  const raw = normalizeText(userText);
  const t = raw.toLowerCase();

  // 敏感健康狀況 → 優先導流
  if (matchAny(raw, INTENT.sensitive) || matchAny(t, INTENT.sensitive)) {
    return TEXT.sensitive;
  }

  // 「成分 + 品項」：成分 龜鹿膏 / 成分 龜鹿飲
  if (raw.includes("成分")) {
    if (raw.includes("龜鹿膏") || raw.includes("膏")) return TEXT.ingredientsGel;
    if (raw.includes("龜鹿飲") || raw.includes("飲")) return TEXT.ingredientsDrink;
    return TEXT.ingredients;
  }

  if (matchAny(t, INTENT.welcome)) return TEXT.welcome;
  if (matchAny(t, INTENT.storeInfo)) return TEXT.storeInfo;
  if (matchAny(t, INTENT.website)) return TEXT.website;

  if (matchAny(t, INTENT.products)) return TEXT.products;
  if (matchAny(t, INTENT.pricing)) return TEXT.pricing;
  if (matchAny(t, INTENT.specs)) return TEXT.specs;

  if (matchAny(t, INTENT.gelHow)) return TEXT.gelHow;
  if (matchAny(t, INTENT.drinkHow)) return TEXT.drinkHow;
  if (matchAny(t, INTENT.soupHow)) return TEXT.soupHow;
  if (matchAny(t, INTENT.antlerHow)) return TEXT.antlerHow;

  if (matchAny(t, INTENT.ingredients)) return TEXT.ingredients;
  if (matchAny(t, INTENT.storage)) return TEXT.storage;
  if (matchAny(t, INTENT.testing)) return TEXT.testing;
  if (matchAny(t, INTENT.whoSuitable)) return TEXT.whoSuitable;

  if (matchAny(t, INTENT.howToBuy)) return TEXT.howToBuy;
  if (matchAny(t, INTENT.payment)) return TEXT.payment;
  if (matchAny(t, INTENT.shipping)) return TEXT.shipping;

  return TEXT.fallback;
}

/** =========================
 * E) Webhook
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
  // ✅ 新好友 follow：立即回歡迎 + 安排 24h 追蹤推播
  if (event.type === "follow") {
    const userId = event.source && event.source.userId;
    if (userId) {
      const users = loadUsers();
      users[userId] = users[userId] || { followedAt: Date.now(), followupSent: false };
      users[userId].followedAt = users[userId].followedAt || Date.now();
      users[userId].followupSent = users[userId].followupSent || false;
      saveUsers(users);

      // 安排 24 小時後推播（只排一次）
      if (!users[userId].followupScheduledAt) {
        users[userId].followupScheduledAt = Date.now();
        saveUsers(users);
        schedule24hFollowup(userId);
      }
    }

    return client.replyMessage(event.replyToken, {
      type: "text",
      text: TEXT.welcome,
    });
  }

  // 取消追蹤：可選擇把 userId 移除
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

  const userText = event.message.text || "";
  const replyText = pickReply(userText);

  return client.replyMessage(event.replyToken, {
    type: "text",
    text: replyText,
  });
}

app.listen(PORT, () => {
  console.log(`LINE bot webhook listening on port ${PORT}`);
});
