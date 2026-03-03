/* eslint-disable no-console */
"use strict";

/**
 * 仙加味・龜鹿 LINE OA Bot（最終可部署版｜全卡片流程｜串接官網 products.json）
 *
 * ✅ 修正/加強：
 * - 加好友歡迎：支援 follow / join / memberJoined
 * - webhook 驗簽安全：使用 line.middleware(config)（不要在前面 app.use(express.json())）
 * - 不洗版：主選單只在使用者回「選單/0」時送出
 * - products.json：快取 + timeout
 */

const express = require("express");
const line = require("@line/bot-sdk");
const https = require("https");
const http = require("http");
const fs = require("fs");
const path = require("path");

/* =========================
   環境變數（相容兩套命名）
========================= */
const {
  LINE_CHANNEL_ACCESS_TOKEN,
  LINE_CHANNEL_SECRET,
  CHANNEL_ACCESS_TOKEN,
  CHANNEL_SECRET,
  PRODUCTS_URL,
  PORT,
} = process.env;

const ACCESS_TOKEN = LINE_CHANNEL_ACCESS_TOKEN || CHANNEL_ACCESS_TOKEN || "";
const CHANNEL_SEC = LINE_CHANNEL_SECRET || CHANNEL_SECRET || "";

const PRODUCTS_URL_FALLBACK = "https://ts15825868.github.io/TaiShing/products.json";
const PRODUCTS_ENDPOINT = PRODUCTS_URL || PRODUCTS_URL_FALLBACK;

if (!ACCESS_TOKEN || !CHANNEL_SEC) {
  console.warn(
    "[WARN] 缺少 LINE 金鑰：請設定 LINE_CHANNEL_ACCESS_TOKEN / LINE_CHANNEL_SECRET（或相容的 CHANNEL_ACCESS_TOKEN / CHANNEL_SECRET）。\n" +
      "服務仍會啟動（避免 Render Exit 1），但 /webhook 會回 500。"
  );
}

const config = {
  channelAccessToken: ACCESS_TOKEN,
  channelSecret: CHANNEL_SEC,
};

const client = new line.Client(config);

/* =========================
   基本資訊（你可自行微調）
========================= */
const STORE = {
  brandName: "仙加味・龜鹿",
  address: "台北市萬華區西昌街 52 號",
  phoneDisplay: "(02) 2381-2990",
  phoneTel: "0223812990",
  website: "https://ts15825868.github.io/TaiShing/",
  mapUrl:
    "https://www.google.com/maps/search/?api=1&query=%E5%8F%B0%E5%8C%97%E5%B8%82%E8%90%AC%E8%8F%AF%E5%8D%80%E8%A5%BF%E6%98%8C%E8%A1%97+52+%E8%99%9F",
  priceNote:
    "※ 不同通路因服務內容／搭配方案不同，價格可能略有差異🙂\n※ 到店另有不定期活動或搭配方案，依現場為準。",
  infoDisclaimer: "※ 產品資訊以實際包裝標示為準（不同批次可能略有差異）。",
  deliverNote:
    "※ 雙北親送：視路線/時間可安排；若不便親送會改以宅配或店到店協助。",
  foodDisclaimer:
    "※ 以上為飲食搭配/烹調參考；實際仍以個人口味與生活作息調整。",
};

/* =========================
   products.json 快取
========================= */
let cache = { at: 0, data: null };

function fetchJson(url, timeoutMs = 8000) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith("https") ? https : http;
    const req = lib.get(url, (res) => {
      let data = "";
      res.on("data", (c) => (data += c));
      res.on("end", () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    });
    req.on("error", reject);
    req.setTimeout(timeoutMs, () => req.destroy(new Error("fetch timeout")));
  });
}

async function getProducts() {
  const ttl = 5 * 60 * 1000;
  if (Date.now() - cache.at < ttl && cache.data) return cache.data;

  try {
    const data = await fetchJson(PRODUCTS_ENDPOINT);
    cache = { at: Date.now(), data };
    return data;
  } catch (e) {
    console.error("[products] 讀取失敗：", e?.message || e);
    return { categories: [] };
  }
}

function flattenProducts(data) {
  const list = [];
  for (const c of data.categories || []) {
    for (const item of c.items || []) {
      list.push({ ...item, _categoryId: c.id, _categoryName: c.name });
    }
  }
  return list;
}

/* =========================
   小工具
========================= */
function normalizeText(s) {
  return String(s || "")
    .replace(/\u3000/g, " ")
    .replace(/[，,、/／]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function safeText(s, max = 60) {
  const t = String(s || "");
  return t.length > max ? t.slice(0, max - 1) + "…" : t;
}

function money(n) {
  const x = Math.round(Number(n) || 0);
  return "$" + String(x).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function calcDiscount(msrp, d) {
  const m = Number(msrp);
  const dis = Number(d);
  if (!Number.isFinite(m) || !Number.isFinite(dis) || dis <= 0) return null;
  return Math.round(m * dis);
}

const SOUP_ALIASES = ["龜鹿湯塊", "湯塊", "龜鹿膠", "二仙膠", "仙膠", "龜鹿仙膠", "龜鹿二仙膠"];
function isSoupName(input) {
  const t = String(input || "");
  return (
    SOUP_ALIASES.some((k) => t.includes(k)) ||
    t.includes("龜鹿湯塊（膠）") ||
    t.includes("龜鹿湯塊(膠)")
  );
}

function matchProduct(flat, name) {
  const n = normalizeText(name);
  let p = flat.find((x) => n === x.name);
  if (p) return p;
  p = flat.find((x) => n.includes(x.name) || x.name.includes(n));
  if (p) return p;
  if (isSoupName(n)) return flat.find((x) => String(x.name).includes("湯塊")) || null;
  return null;
}

/* =========================
   使用者狀態（購買流程）
========================= */
const DATA_DIR = path.join(__dirname, "data");
const USERS_FILE = path.join(DATA_DIR, "users.json");
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

function loadUsers() {
  try {
    if (!fs.existsSync(USERS_FILE)) return {};
    const raw = fs.readFileSync(USERS_FILE, "utf8");
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveUsers(users) {
  try {
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), "utf8");
  } catch (e) {
    console.error("[users] 寫入失敗：", e?.message || e);
  }
}

function ensureUser(userId) {
  const users = loadUsers();
  users[userId] = users[userId] || { buying: null, meta: {} };
  users[userId].meta = users[userId].meta || {};
  saveUsers(users);
  return users[userId];
}

function getUser(userId) {
  return ensureUser(userId);
}

function updateUser(userId, fn) {
  const users = loadUsers();
  users[userId] = users[userId] || { buying: null, meta: {} };
  users[userId].meta = users[userId].meta || {};
  fn(users[userId]);
  saveUsers(users);
}

/* =========================
   主選單（兩張卡片一起送）
========================= */
function mainMenuCards() {
  const card1 = {
    type: "template",
    altText: "主選單",
    template: {
      type: "buttons",
      title: STORE.brandName,
      text: "想先看哪個？直接點就好🙂",
      actions: [
        { type: "message", label: "產品介紹", text: "產品介紹" },
        { type: "message", label: "看價格", text: "看價格" },
        { type: "message", label: "飲食專區", text: "飲食專區" },
        { type: "message", label: "怎麼購買", text: "怎麼購買" },
      ],
    },
  };

  const card2 = {
    type: "template",
    altText: "更多",
    template: {
      type: "buttons",
      title: "更多",
      text: "也可以看門市／官網🙂",
      actions: [
        { type: "message", label: "門市資訊", text: "門市資訊" },
        { type: "uri", label: "官網", uri: STORE.website },
        { type: "uri", label: "一鍵來電", uri: `tel:${STORE.phoneTel}` },
        { type: "uri", label: "地圖", uri: STORE.mapUrl },
      ],
    },
  };

  return [card1, card2];
}

/* =========================
   門市資訊
========================= */
function storeCard() {
  return {
    type: "template",
    altText: "門市資訊",
    template: {
      type: "buttons",
      title: "門市資訊",
      text: `${STORE.address}\n${STORE.phoneDisplay}\n\n需要主選單：回「選單」`,
      actions: [
        { type: "uri", label: "地圖", uri: STORE.mapUrl },
        { type: "uri", label: "一鍵來電", uri: `tel:${STORE.phoneTel}` },
        { type: "uri", label: "官網", uri: STORE.website },
        { type: "message", label: "回主選單", text: "選單" },
      ],
    },
  };
}

/* =========================
   飲食專區（統一入口）
========================= */
function foodMenuCard() {
  return {
    type: "template",
    altText: "飲食專區",
    template: {
      type: "buttons",
      title: "飲食專區",
      text: "搭配建議都在這裡（直接點）🙂",
      actions: [
        { type: "message", label: "補養建議（綜合版）", text: "補養建議" },
        { type: "message", label: "季節推薦", text: "季節推薦" },
        { type: "message", label: "燉煮建議", text: "燉煮建議" },
        { type: "message", label: "常見問題 FAQ", text: "FAQ" },
      ],
    },
  };
}

/* =========================
   補養建議（綜合版）
========================= */
function nourishMenuCarousel() {
  const cols = [
    { title: "日常版", text: "穩穩補、好持續（不追求很猛）", key: "日常" },
    { title: "加強版", text: "想拉高補養密度／想更有感", key: "加強" },
    { title: "忙碌族", text: "省時間、好攜帶、規律補", key: "忙碌族" },
    { title: "長輩版", text: "溫和、好入口、好記", key: "長輩" },
  ].map((x) => ({
    title: safeText(x.title, 40),
    text: safeText(x.text, 60),
    actions: [
      { type: "message", label: "看內容", text: `補養 ${x.key}` },
      { type: "message", label: "回飲食專區", text: "飲食專區" },
      { type: "message", label: "回主選單", text: "選單" },
    ],
  }));

  return { type: "template", altText: "補養建議", template: { type: "carousel", columns: cols } };
}

function nourishText(kind) {
  const k = String(kind || "");
  const head = `【補養建議｜${k}】`;

  if (k.includes("日常")) {
    return [
      head,
      "• 方向：穩穩補、好持續（不追求很猛）",
      "• 建議：龜鹿膏 或 龜鹿飲（二選一為主）",
      "• 節奏：一天一次，依作息自由安排（早/晚都可以）",
      "• 小提醒：溫食更順，少配冰飲",
      "",
      STORE.foodDisclaimer,
    ].join("\n");
  }
  if (k.includes("加強")) {
    return [
      head,
      "• 方向：想拉高補養密度、想更扎實",
      "• 建議：龜鹿膏 + 龜鹿飲（分時段安排）",
      "• 有煮湯習慣：可加上龜鹿湯塊（膠）做燉煮",
      "• 節奏：先從少量/低頻開始，覺得順再慢慢加",
      "",
      STORE.foodDisclaimer,
    ].join("\n");
  }
  if (k.includes("忙碌")) {
    return [
      head,
      "• 方向：省時間、好攜帶、規律補",
      "• 建議：龜鹿飲（即飲）為主；想更扎實再加龜鹿膏",
      "• 節奏：出門前/下午空檔/運動後，都能安排",
      "• 小提醒：能溫熱更順口",
      "",
      STORE.foodDisclaimer,
    ].join("\n");
  }
  return [
    head,
    "• 方向：溫和、好入口、好記",
    "• 建議：龜鹿膏（小匙）或龜鹿飲（即飲）",
    "• 節奏：固定一天一次即可；想加強再看狀況加",
    "• 小提醒：溫食為主；腸胃較敏感者先少量",
    "",
    STORE.foodDisclaimer,
  ].join("\n");
}

function afterFoodNavCard() {
  return {
    type: "template",
    altText: "下一步",
    template: {
      type: "buttons",
      title: STORE.brandName,
      text: "接下來想看什麼？🙂",
      actions: [
        { type: "message", label: "產品介紹", text: "產品介紹" },
        { type: "message", label: "看價格", text: "看價格" },
        { type: "message", label: "回飲食專區", text: "飲食專區" },
        { type: "message", label: "回主選單", text: "選單" },
      ],
    },
  };
}

/* =========================
   季節推薦
========================= */
function seasonMenuCarousel() {
  const cols = [
    { title: "春季", text: "天氣變化大 → 以溫和、好消化為主", key: "春" },
    { title: "夏季", text: "悶熱易沒胃口 → 走清爽、少油、溫熱喝", key: "夏" },
    { title: "秋季", text: "轉涼乾燥 → 湯品更合適、搭配潤口食材", key: "秋" },
    { title: "冬季", text: "冷天想暖身 → 濃湯/燉煮更順口", key: "冬" },
  ].map((x) => ({
    title: safeText(x.title, 40),
    text: safeText(x.text, 60),
    actions: [
      { type: "message", label: "看建議", text: `季節 ${x.key}` },
      { type: "message", label: "回飲食專區", text: "飲食專區" },
      { type: "message", label: "回主選單", text: "選單" },
    ],
  }));

  return { type: "template", altText: "季節推薦", template: { type: "carousel", columns: cols } };
}

function seasonText(key) {
  switch (key) {
    case "春":
      return [
        "【季節推薦｜春】",
        "• 飲食方向：溫和、規律、少冰冷",
        "• 推薦搭配：龜鹿飲（溫熱喝）／龜鹿膏（溫水化開）",
        "• 湯品：清雞湯/排骨湯 + 山藥/菇類（依喜好）",
        "",
        STORE.foodDisclaimer,
      ].join("\n");
    case "夏":
      return [
        "【季節推薦｜夏】",
        "• 飲食方向：清爽、不厚重、別配冰飲",
        "• 推薦搭配：龜鹿飲（隔水溫熱）／想更扎實再加龜鹿膏小匙",
        "• 湯品：菇類雞湯/蛤蜊雞湯（清爽路線）",
        "",
        STORE.foodDisclaimer,
      ].join("\n");
    case "秋":
      return [
        "【季節推薦｜秋】",
        "• 飲食方向：湯品更合適、口感可更溫潤",
        "• 推薦搭配：龜鹿湯塊（膠）燉煮／龜鹿膏溫水化開",
        "• 湯品：山藥排骨/香菇雞湯 + 紅棗/枸杞（依喜好）",
        "",
        STORE.foodDisclaimer,
      ].join("\n");
    case "冬":
      return [
        "【季節推薦｜冬】",
        "• 飲食方向：熱食熱飲、燉煮更順口",
        "• 推薦搭配：龜鹿湯塊（膠）濃淡可調／龜鹿膏日常小匙",
        "• 湯品：薑片雞湯/清燉羊肉（依口味）",
        "",
        STORE.foodDisclaimer,
      ].join("\n");
    default:
      return null;
  }
}

/* =========================
   燉煮建議
========================= */
function cookMenuCarousel() {
  const cols = [
    { title: "經典雞湯", text: "雞腿/半雞 + 湯塊（膠）", key: "雞湯" },
    { title: "排骨燉煮", text: "排骨 + 玉米/白蘿蔔", key: "排骨" },
    { title: "山藥搭配", text: "山藥 + 香菇 + 雞肉", key: "山藥" },
    { title: "菇類素食", text: "杏鮑菇/香菇/金針菇", key: "菇類" },
    { title: "海鮮清爽", text: "蛤蜊/魚片（清湯）", key: "海鮮" },
    { title: "電鍋懶人", text: "一鍵電鍋，適合忙碌族", key: "電鍋" },
    { title: "蔬菜清甜", text: "高麗菜/洋蔥/紅蘿蔔", key: "蔬菜" },
    { title: "四神風味", text: "薏仁/蓮子/芡實（依喜好）", key: "四神" },
    { title: "麻油少量", text: "少量麻油＋薑片（冬天）", key: "麻油" },
    { title: "清燉牛腱", text: "牛腱清燉（少油）", key: "牛腱" },
  ].map((x) => ({
    title: safeText(x.title, 40),
    text: safeText(x.text, 60),
    actions: [
      { type: "message", label: "看做法", text: `燉煮 ${x.key}` },
      { type: "message", label: "回飲食專區", text: "飲食專區" },
      { type: "message", label: "回主選單", text: "選單" },
    ],
  }));

  return { type: "template", altText: "燉煮建議", template: { type: "carousel", columns: cols } };
}

function cookText(key) {
  const baseHint = "湯塊（膠）建議：先用清水小火化開，再放食材；濃淡可用水量調整。";

  const map = {
    雞湯: [
      "【燉煮｜經典雞湯】",
      "食材：雞腿/半雞、湯塊（膠）、薑片（可選）",
      "作法：1) 雞肉汆燙去浮沫（可選） 2) 水＋湯塊（膠）小火化開 3) 下雞肉小火 30–60 分鐘 4) 起鍋前加鹽調味",
      "",
      baseHint,
    ],
    排骨: [
      "【燉煮｜排骨燉煮】",
      "食材：排骨、玉米/白蘿蔔、湯塊（膠）",
      "作法：1) 排骨汆燙 2) 水＋湯塊（膠）化開後下排骨與配料 3) 小火 45–90 分鐘",
      "",
      baseHint,
    ],
    山藥: [
      "【燉煮｜山藥搭配】",
      "食材：山藥、香菇、雞肉/排骨、湯塊（膠）",
      "作法：1) 湯塊化開後先下肉類煮 30–40 分鐘 2) 再下山藥與香菇煮 15–20 分鐘 3) 調味",
      "",
      baseHint,
    ],
    菇類: [
      "【燉煮｜菇類素食版】",
      "食材：杏鮑菇/香菇/金針菇、豆腐（可選）、湯塊（膠）",
      "作法：1) 水＋湯塊化開 2) 下菇類小火 15–25 分鐘 3) 調味",
      "",
      baseHint,
    ],
    海鮮: [
      "【燉煮｜海鮮清爽版】",
      "食材：蛤蜊/魚片、薑絲（可選）、湯塊（膠）",
      "作法：1) 湯塊先化開 2) 下海鮮，時間別煮太久（開口/變白即可） 3) 調味",
      "",
      baseHint,
    ],
    電鍋: [
      "【燉煮｜電鍋懶人版】",
      "作法：1) 內鍋水＋湯塊＋食材 2) 外鍋 2 杯水（想更軟爛可 3 杯）3) 跳起後悶 10 分鐘",
      "",
      baseHint,
    ],
    蔬菜: [
      "【燉煮｜蔬菜清甜版】",
      "食材：高麗菜/洋蔥/紅蘿蔔、湯塊（膠）",
      "作法：1) 湯塊化開 2) 下蔬菜小火 20–30 分鐘 3) 調味",
      "",
      baseHint,
    ],
    四神: [
      "【燉煮｜四神風味】",
      "食材：薏仁/蓮子/芡實（依喜好）、排骨（可選）、湯塊（膠）",
      "作法：1) 乾料先泡（可選）2) 湯塊化開後加入乾料與肉類 3) 小火 60–120 分鐘",
      "",
      baseHint,
    ],
    麻油: [
      "【燉煮｜麻油少量（冬天）】",
      "作法：1) 麻油少量爆香薑片（不要過焦）2) 加水與湯塊化開 3) 下肉類燉煮，調味",
      "提醒：走清爽路線，麻油用量不要太多。",
      "",
      baseHint,
    ],
    牛腱: [
      "【燉煮｜清燉牛腱】",
      "作法：1) 牛腱汆燙 2) 湯塊化開後下牛腱小火 90–150 分鐘 3) 加配料再煮 20–30 分鐘",
      "",
      baseHint,
    ],
  };

  const arr = map[String(key || "").trim()];
  return arr ? arr.join("\n") : null;
}

/* =========================
   FAQ（不涉醫療諮詢）
========================= */
function faqMenuCard() {
  return {
    type: "template",
    altText: "FAQ",
    template: {
      type: "buttons",
      title: "常見問題（FAQ）",
      text: "想看哪一題？🙂",
      actions: [
        { type: "message", label: "可以天天吃嗎？", text: "FAQ 天天" },
        { type: "message", label: "怎麼保存？", text: "FAQ 保存" },
        { type: "message", label: "怎麼搭配比較順？", text: "FAQ 搭配" },
        { type: "message", label: "回飲食專區", text: "飲食專區" },
      ],
    },
  };
}

function faqText(key) {
  switch (String(key || "").trim()) {
    case "天天":
      return [
        "【FAQ｜可以天天吃嗎？】",
        "• 很多客人會把它當日常飲食的一部分（看自己作息）",
        "• 建議：先從少量/低頻開始，覺得順再固定節奏",
        "• 不必硬分早晚：依個人習慣安排就好",
        "",
        STORE.foodDisclaimer,
      ].join("\n");
    case "保存":
      return [
        "【FAQ｜怎麼保存？】",
        "• 以產品包裝標示為準",
        "• 開封後建議密封、避免高溫與日照",
        "• 開封後請盡快食用完畢（依產品型態）",
      ].join("\n");
    case "搭配":
      return [
        "【FAQ｜怎麼搭配比較順？】",
        "• 盡量走溫食路線（溫水/溫湯）",
        "• 不要強迫分時段：照你的生活節奏最容易持續",
        "• 有煮湯習慣：湯塊（膠）＋雞/排骨/菇類都很合",
        "",
        STORE.foodDisclaimer,
      ].join("\n");
    default:
      return null;
  }
}

/* =========================
   產品：列表 / 介紹 / 價格
========================= */
async function productsCarousel() {
  const flat = flattenProducts(await getProducts());
  const columns = flat.slice(0, 10).map((p) => ({
    title: safeText(p.name, 40),
    text: safeText((p.intro && p.intro[0]) || "點擊查看介紹", 60),
    actions: [
      { type: "message", label: "看介紹", text: `介紹 ${p.name}` },
      { type: "message", label: "看價格", text: `價格 ${p.name}` },
      { type: "message", label: "我要購買", text: `購買 ${p.name}` },
    ],
  }));

  return { type: "template", altText: "產品介紹", template: { type: "carousel", columns } };
}

function productIntroFullText(p) {
  if (!p) return "找不到產品🙂";

  if (p.variants && p.variants.length) {
    const specLines = p.variants
      .map((v) => `• ${String(v.label || "").trim()}（${v.spec}）${v.note ? `｜${v.note}` : ""}`)
      .join("\n");

    return [
      `【${p.name}】`,
      ...(p.intro || []).map((x) => `• ${x}`),
      "",
      "規格：",
      specLines,
      "",
      "成分：",
      ...(p.ingredients || []).map((x) => `• ${x}`),
      "",
      "使用建議：",
      ...(p.usage || []).map((x) => `• ${x}`),
      "",
      STORE.infoDisclaimer,
    ].join("\n");
  }

  return [
    `【${p.name}】`,
    ...(p.intro || []).map((x) => `• ${x}`),
    "",
    `規格：${p.spec || "—"}`,
    "",
    "成分：",
    ...(p.ingredients || []).map((x) => `• ${x}`),
    "",
    "使用建議：",
    ...(p.usage || []).map((x) => `• ${x}`),
    "",
    STORE.infoDisclaimer,
  ].join("\n");
}

function productActionCard(productName) {
  return {
    type: "template",
    altText: "產品功能",
    template: {
      type: "buttons",
      title: safeText(productName, 40),
      text: "接下來想看什麼？🙂",
      actions: [
        { type: "message", label: "看價格", text: `價格 ${productName}` },
        { type: "message", label: "我要購買", text: `購買 ${productName}` },
        { type: "message", label: "其他產品", text: "產品介紹" },
        { type: "message", label: "回主選單", text: "選單" },
      ],
    },
  };
}

async function priceAllCarousel() {
  const flat = flattenProducts(await getProducts());
  const columns = [];

  for (const p of flat) {
    if (p.variants && p.variants.length) {
      for (const v of p.variants) {
        const msrp = Number(v.msrp);
        const act = calcDiscount(msrp, v.discount);
        const lines = [
          `${String(v.label || "").trim()}（${v.spec}）`,
          `建議售價：${money(msrp)}`,
          act ? `活動價：${money(act)}（9折）` : "",
          v.note ? `備註：${v.note}` : "",
        ].filter(Boolean);

        columns.push({
          title: safeText(p.name, 40),
          text: safeText(lines.join("\n"), 60),
          actions: [
            { type: "message", label: "我要購買", text: `購買 ${p.name}` },
            { type: "message", label: "回主選單", text: "選單" },
          ],
        });
      }
      continue;
    }

    const msrp = Number(p.msrp);
    const act = calcDiscount(msrp, p.discount);
    const lines = [
      `建議售價：${money(msrp)}`,
      act ? `活動價：${money(act)}（9折）` : "",
    ].filter(Boolean);

    columns.push({
      title: safeText(p.name, 40),
      text: safeText(lines.join("\n"), 60),
      actions: [
        { type: "message", label: "我要購買", text: `購買 ${p.name}` },
        { type: "message", label: "回主選單", text: "選單" },
      ],
    });
  }

  return { type: "template", altText: "產品價格", template: { type: "carousel", columns: columns.slice(0, 10) } };
}

async function priceForProduct(name) {
  const flat = flattenProducts(await getProducts());
  const p = matchProduct(flat, name);

  if (!p) return [{ type: "text", text: "找不到這個品項🙂（回：選單）" }];

  if (p.variants && p.variants.length) {
    const columns = p.variants.map((v) => {
      const msrp = Number(v.msrp);
      const act = calcDiscount(msrp, v.discount);
      const lines = [
        `${String(v.label || "").trim()}（${v.spec}）`,
        `建議售價：${money(msrp)}`,
        act ? `活動價：${money(act)}（9折）` : "",
        v.note ? `備註：${v.note}` : "",
      ].filter(Boolean);

      return {
        title: safeText(p.name, 40),
        text: safeText(lines.join("\n"), 60),
        actions: [
          { type: "message", label: "我要購買", text: `購買 ${p.name}` },
          { type: "message", label: "回主選單", text: "選單" },
        ],
      };
    });

    return [
      { type: "template", altText: `${p.name} 價格`, template: { type: "carousel", columns: columns.slice(0, 10) } },
      { type: "text", text: STORE.priceNote },
    ];
  }

  const msrp = Number(p.msrp);
  const act = calcDiscount(msrp, p.discount);
  const text = [
    `【${p.name}｜價格】`,
    `建議售價：${money(msrp)}`,
    act ? `活動價：${money(act)}（9折）` : "",
    "",
    STORE.priceNote,
  ].filter(Boolean).join("\n");

  return [{ type: "text", text }, productActionCard(p.name)];
}

/* =========================
   怎麼購買：方式選擇 + 流程
========================= */
function buyMenuCard() {
  return {
    type: "template",
    altText: "怎麼購買",
    template: {
      type: "buttons",
      title: "怎麼購買",
      text: "選一種方式，我再引導你填資料🙂",
      actions: [
        { type: "message", label: "宅配", text: "購買方式 宅配" },
        { type: "message", label: "超商店到店", text: "購買方式 店到店" },
        { type: "message", label: "雙北親送", text: "購買方式 雙北親送" },
        { type: "message", label: "到店自取", text: "購買方式 自取" },
      ],
    },
  };
}

function startBuying(userId, method) {
  updateUser(userId, (u) => {
    u.buying = { active: true, method, itemsText: null, name: null, phone: null, address: null, total: null };
  });
}

function stopBuying(userId) {
  updateUser(userId, (u) => { u.buying = null; });
}

function buyExplain(method) {
  if (method === "宅配") {
    return "好的🙂【宅配】\n請直接貼：\n1) 品項＋數量\n2) 收件姓名＋電話\n3) 地址\n\n需要主選單：回「選單」";
  }
  if (method === "店到店") {
    return "好的🙂【超商店到店】\n請直接貼：\n1) 品項＋數量\n2) 收件姓名＋電話\n3) 取貨門市（店名/店號/地址）\n\n需要主選單：回「選單」";
  }
  if (method === "雙北親送") {
    return `好的🙂【雙北親送】\n${STORE.deliverNote}\n\n請直接貼：\n1) 品項＋數量\n2) 收件姓名＋電話\n3) 地址（台北/新北）\n\n需要主選單：回「選單」`;
  }
  return "好的🙂【到店自取】\n請直接貼：\n1) 品項＋數量\n2) 聯絡姓名＋電話（方便保留並確認取貨時間）\n\n需要主選單：回「選單」";
}

async function tryParseItemsToTotal(itemsText) {
  const flat = flattenProducts(await getProducts());
  const t = normalizeText(itemsText);
  if (!t) return { lines: [], total: null };

  const lines = [];
  let total = 0;

  function qtyFor(fragment) {
    const m = fragment.match(/(\d{1,3})\s*(罐|包|盒|組|份|個|瓶|袋)?/);
    if (!m) return 1;
    const q = Number(m[1]);
    return Number.isFinite(q) && q > 0 ? q : 1;
  }

  const singles = flat.filter((x) => !(x.variants && x.variants.length));
  for (const p of singles) {
    if (!t.includes(p.name)) continue;
    const idx = t.indexOf(p.name);
    const frag = t.slice(idx, idx + p.name.length + 8);
    const q = qtyFor(frag);

    const msrp = Number(p.msrp);
    const act = calcDiscount(msrp, p.discount) || msrp;
    const sub = act * q;
    lines.push(`${p.name} × ${q} ＝ ${money(sub)}`);
    total += sub;
  }

  const soup = flat.find((x) => x.variants && x.variants.length);
  const soupVariants = (soup && soup.variants) || [];
  if (isSoupName(t)) {
    for (const v of soupVariants) {
      const shortKey = String(v.label || "").trim();
      const hit = shortKey && t.includes(shortKey);
      const hitSpec = v.spec && t.includes(String(v.spec));
      if (!hit && !hitSpec) continue;

      const idx = hit ? t.indexOf(shortKey) : -1;
      const frag = idx >= 0 ? t.slice(idx, idx + shortKey.length + 8) : t;
      const q = qtyFor(frag);

      const msrp = Number(v.msrp);
      const act = calcDiscount(msrp, v.discount) || msrp;
      const sub = act * q;
      lines.push(`湯塊 ${shortKey} × ${q} ＝ ${money(sub)}`);
      total += sub;
    }
  }

  if (!lines.length) return { lines: [], total: null };
  return { lines, total };
}

function looksLikePhone(raw) {
  const digits = String(raw || "").replace(/\D/g, "");
  if (digits.length < 8 || digits.length > 15) return null;
  return digits;
}

function looksLikeAddress(raw) {
  const s = String(raw || "");
  return s.length >= 6 && /路|街|巷|弄|號|段|樓|門市|店/.test(s);
}

async function tryBuyingFlow(userId, rawText) {
  const u = getUser(userId);
  const b = u.buying;
  if (!b || !b.active) return null;

  const text = String(rawText || "").trim();
  const norm = normalizeText(text);
  if (norm === "選單" || norm === "0") {
    stopBuying(userId);
    return mainMenuCards();
  }

  const phone = looksLikePhone(text);

  updateUser(userId, (x) => {
    const cur = x.buying;
    if (!cur) return;

    if (
      !cur.itemsText &&
      (text.includes("龜鹿") ||
        text.includes("鹿茸") ||
        text.includes("湯塊") ||
        /\d+\s*(罐|包|盒|組|份|個|瓶|袋)/.test(text))
    ) {
      cur.itemsText = text;
    }

    if (phone) cur.phone = phone;

    if (!cur.address && looksLikeAddress(text) && cur.method !== "自取") cur.address = text;

    if (!cur.name) {
      const candidate = normalizeText(text.replace(String(phone || ""), ""));
      if (candidate.length >= 2 && candidate.length <= 12 && !looksLikeAddress(candidate)) cur.name = candidate;
    }
  });

  const latest = getUser(userId).buying;

  if (latest.itemsText && latest.total == null) {
    const { lines, total } = await tryParseItemsToTotal(latest.itemsText);
    updateUser(userId, (x) => { if (x.buying) x.buying.total = total; });

    if (lines.length) {
      return [{
        type: "text",
        text: [
          "我先幫你把品項換算一下🙂",
          ...lines.map((l) => `• ${l}`),
          "",
          `小計：約 ${money(total)}`,
          "（若有活動/組合/運費等，最後以我們確認為準）",
        ].join("\n"),
      }];
    }
  }

  const need = [];
  if (!latest.itemsText) need.push("品項＋數量");
  if (!latest.name) need.push("姓名");
  if (!latest.phone) need.push("電話");
  if (latest.method !== "自取" && !latest.address) need.push(latest.method === "店到店" ? "取貨門市" : "地址");

  if (need.length) return [{ type: "text", text: `我有看到🙂 目前我還需要：${need.join("、")}（可一次貼一段）` }];

  if (latest.method === "雙北親送") {
    const addr = String(latest.address || "");
    if (!(addr.includes("台北") || addr.includes("臺北") || addr.includes("新北"))) {
      return [{ type: "text", text: "我看到地址好像不是台北/新北🙂\n雙北親送需要台北或新北地址；若要改成宅配/店到店也可以（回：怎麼購買）。" }];
    }
  }

  const summary = [
    "✅ 已收到購買資料：",
    `方式：${latest.method}`,
    `品項：${latest.itemsText}`,
    latest.total != null ? `估算小計：約 ${money(latest.total)}` : "",
    `聯絡：${latest.name} ${latest.phone}`,
    latest.method !== "自取" ? `地址/門市：${latest.address}` : "",
    "",
    "我接著會再跟你確認金額與出貨安排🙂",
    "需要主選單：回「選單」",
  ].filter(Boolean).join("\n");

  stopBuying(userId);
  return [{ type: "text", text: summary }, ...mainMenuCards()];
}

/* =========================
   對話控制（不洗版）
========================= */
async function handleText(userId, text) {
  const t = normalizeText(text);

  if (!t || t === "選單" || t === "0" || t === "主選單") {
    stopBuying(userId);
    return mainMenuCards();
  }

  const flow = await tryBuyingFlow(userId, text);
  if (flow) return flow;

  if (t === "產品介紹" || t === "產品" || t === "商品" || t === "產品列表") return [await productsCarousel()];
  if (t === "看價格" || t === "價格") return [await priceAllCarousel(), { type: "text", text: STORE.priceNote }];
  if (t === "飲食專區") return [foodMenuCard()];
  if (t === "怎麼購買" || t === "購買" || t === "我要買") return [buyMenuCard()];
  if (t === "門市資訊" || t === "門市" || t === "地址" || t.includes("怎麼去")) return [storeCard()];

  if (t === "補養建議" || t === "補養建議（綜合版）") return [nourishMenuCarousel()];
  if (t.startsWith("補養 ")) return [{ type: "text", text: nourishText(t.replace("補養", "").trim()) }, afterFoodNavCard()];

  if (t === "季節推薦") return [seasonMenuCarousel()];
  if (t.startsWith("季節 ")) {
    const msg = seasonText(t.replace("季節", "").trim());
    return msg ? [{ type: "text", text: msg }, afterFoodNavCard()] : [seasonMenuCarousel()];
  }

  if (t === "燉煮建議") return [cookMenuCarousel()];
  if (t.startsWith("燉煮 ")) {
    const msg = cookText(t.replace("燉煮", "").trim());
    return msg ? [{ type: "text", text: msg }, afterFoodNavCard()] : [cookMenuCarousel()];
  }

  if (t === "FAQ" || t === "常見問題") return [faqMenuCard()];
  if (t.startsWith("FAQ ")) {
    const msg = faqText(t.replace("FAQ", "").trim());
    return msg ? [{ type: "text", text: msg }, afterFoodNavCard()] : [faqMenuCard()];
  }

  if (t.startsWith("購買方式")) {
    const method = t.replace("購買方式", "").trim();
    if (method.includes("宅配")) { startBuying(userId, "宅配"); return [{ type: "text", text: buyExplain("宅配") }]; }
    if (method.includes("店到店")) { startBuying(userId, "店到店"); return [{ type: "text", text: buyExplain("店到店") }]; }
    if (method.includes("雙北")) { startBuying(userId, "雙北親送"); return [{ type: "text", text: buyExplain("雙北親送") }]; }
    if (method.includes("自取")) { startBuying(userId, "自取"); return [{ type: "text", text: buyExplain("自取") }]; }
  }

  if (t.startsWith("介紹 ")) {
    const name = t.replace("介紹", "").trim();
    const flat = flattenProducts(await getProducts());
    const p = matchProduct(flat, name);
    if (!p) return [{ type: "text", text: "找不到這個品項🙂（回：選單）" }];
    return [{ type: "text", text: productIntroFullText(p) }, productActionCard(p.name)];
  }

  if (t.startsWith("價格 ")) {
    const name = t.replace("價格", "").trim();
    return await priceForProduct(name);
  }

  if (t.startsWith("購買 ")) {
    return [{ type: "text", text: "好的🙂 你想用哪一種方式購買？（直接點）" }, buyMenuCard()];
  }

  return [{ type: "text", text: "我有收到🙂\n你可以直接點『選單』開始～" }, ...mainMenuCards()];
}

/* =========================
   Event Handler（關鍵：follow 歡迎）
========================= */
async function handleEvent(event) {
  const userId = event.source && event.source.userId;

  // 1) 加好友：送歡迎＋主選單（不洗版，只有這裡主動送）
  if (event.type === "follow") {
    if (userId) {
      ensureUser(userId);
      updateUser(userId, (u) => { u.meta.followedAt = Date.now(); });
    }
    const welcomeText = `您好🙂 歡迎加入【${STORE.brandName}】\n直接點下方卡片就能看產品/價格/飲食搭配。\n需要主選單也可以回：選單`;
    return client.replyMessage(event.replyToken, [{ type: "text", text: welcomeText }, ...mainMenuCards()]);
  }

  // 2) 取消追蹤：不回覆，但可記錄
  if (event.type === "unfollow") {
    if (userId) {
      updateUser(userId, (u) => { u.meta.unfollowedAt = Date.now(); });
    }
    return null;
  }

  // 3) 被拉進群組/多人聊天室
  if (event.type === "join" || event.type === "memberJoined") {
    const msg = `您好🙂 我是【${STORE.brandName}】小幫手～\n需要主選單請回：選單`;
    return client.replyMessage(event.replyToken, [{ type: "text", text: msg }, ...mainMenuCards()]);
  }

  // 4) 一般文字訊息
  if (event.type === "message" && event.message && event.message.type === "text") {
    if (!userId) return null;
    ensureUser(userId);
    const msgs = await handleText(userId, event.message.text);
    return client.replyMessage(event.replyToken, msgs);
  }

  return null;
}

/* =========================
   Webhook / Server
========================= */
const app = express();

app.get("/health", (req, res) => res.status(200).send("ok"));
app.get("/", (req, res) => res.status(200).send("ok"));

// 注意：不要在這裡 app.use(express.json())，會影響 LINE middleware 驗簽
app.post(
  "/webhook",
  (req, res, next) => {
    if (!config.channelAccessToken || !config.channelSecret) return res.status(500).send("LINE credentials missing");
    return line.middleware(config)(req, res, next);
  },
  async (req, res) => {
    try {
      const events = req.body.events || [];
      await Promise.all(events.map(handleEvent));
      res.sendStatus(200);
    } catch (e) {
      console.error("webhook error:", e?.message || e);
      res.sendStatus(500);
    }
  }
);

app.listen(PORT || 3000, "0.0.0.0", () => {
  console.log("LINE Bot Running on port", PORT || 3000);
  console.log("PRODUCTS_URL:", PRODUCTS_ENDPOINT);
});
