"use strict";

/**
 * 仙加味・龜鹿 LINE OA Bot（最終可部署版）
 * - 代碼規則：主選單 0/1/2/3/4/5/6/7；產品 11~14；規格 31~34；價格 51~54；購買 91~94
 * - 湯塊規格：純 g（精準）
 * - 去除空括號
 * - Render：缺少金鑰不 Exit 1（服務照啟動；/webhook 會回 500 提示）
 */

const express = require("express");
const line = require("@line/bot-sdk");
const cron = require("node-cron");
const fs = require("fs");
const path = require("path");

/** =========================
 * 0) 環境變數（相容兩套命名）
 * ========================= */
const {
  CHANNEL_ACCESS_TOKEN,
  CHANNEL_SECRET,
  LINE_CHANNEL_ACCESS_TOKEN,
  LINE_CHANNEL_SECRET,
  PORT = 3000,
} = process.env;

const ACCESS_TOKEN = CHANNEL_ACCESS_TOKEN || LINE_CHANNEL_ACCESS_TOKEN || "";
const CHANNEL_SEC = CHANNEL_SECRET || LINE_CHANNEL_SECRET || "";

if (!ACCESS_TOKEN || !CHANNEL_SEC) {
  console.warn(
    "[WARN] 缺少 LINE 金鑰：請設定 LINE_CHANNEL_ACCESS_TOKEN/LINE_CHANNEL_SECRET 或 CHANNEL_ACCESS_TOKEN/CHANNEL_SECRET。\n" +
      "服務仍會啟動（避免 Render Exit 1），但 webhook 會回 500。"
  );
}

const config = { channelAccessToken: ACCESS_TOKEN, channelSecret: CHANNEL_SEC };
const client = new line.Client(config);

/** =========================
 * A) 基本資料（與官網一致）
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
  humanModeNote:
    "我已先幫您轉真人協助🙂\n\n※ 真人回覆期間，系統會先暫停自動回覆，避免訊息打架。\n要回到主選單可回：0\n若要解除真人模式可回：解除真人",
  products: {
    gel: {
      name: "龜鹿膏",
      spec: "100g／罐",
      msrp: 2000,
      activityDiscount: 0.9,
      ingredients: ["龜板萃取物", "鹿角萃取物", "粉光蔘", "枸杞", "紅棗", "黃耆"],
      intro: [
        "承襲傳統熬製工序，長時間慢火濃縮製成。",
        "口感溫潤濃稠，可直接食用或以溫水化開。",
        "適合想建立固定補養節奏的人，讓日常更容易持續。",
      ],
      usage: ["每日一次，一小匙（初次可從半匙開始）", "建議溫食，避免搭配冰飲"],
      note: "依每個人食用習慣不同，一罐約可食用 10 天～半個月。",
      priceCode: "51",
    },
    drink: {
      name: "龜鹿飲",
      spec: "180cc／包",
      msrp: 200,
      activityDiscount: 0.9,
      ingredients: ["水", "龜板萃取物", "鹿角萃取物", "粉光蔘", "枸杞", "紅棗", "黃耆"],
      intro: ["即飲型設計，方便日常補充與外出攜帶。", "可溫熱飲用，口感順口，行程也好安排。"],
      usage: ["每日一包", "可隔水加熱或溫熱飲用", "避免冰飲"],
      priceCode: "52",
    },
    antler: {
      name: "鹿茸粉",
      spec: "75g／罐",
      msrp: 2000,
      activityDiscount: 0.9,
      ingredients: ["鹿茸粉"],
      intro: ["粉末型設計，便於少量調配。", "可搭配溫水或飲品，融入日常飲食節奏。"],
      usage: ["建議少量開始，搭配溫水或飲品", "若容易口乾或睡不好，建議減量或間隔食用"],
      priceCode: "53",
    },
    soup: {
      name: "龜鹿湯塊（膠）",
      aliasNames: ["龜鹿仙膠", "龜鹿二仙膠", "龜鹿膠", "二仙膠", "仙膠"],
      ingredients: ["鹿角萃取物", "全龜萃取物"],
      intro: [
        "選用鹿角萃取物與全龜萃取物製成，經傳統製程濃縮成塊，適合日常燉煮湯品使用。",
        "口感可依水量調整，適合搭配雞肉或其他食材燉煮。",
      ],
      usage: ["一塊入鍋，以水量調整濃淡；可搭配雞肉、排骨或其他食材燉煮", "建議熱食熱飲，風味更完整", "不建議久煮過度，避免口感過於濃稠"],
      variants: [
        { label: "75g｜8入｜每塊約 9.375g", msrp: 1000, discount: null, note: "盒子規劃中（目前以傳統包裝出貨）" },
        { label: "150g｜8入｜每塊約 18.75g", msrp: 2000, discount: null, note: null },
        { label: "300g｜16入｜每塊約 18.75g", msrp: 4000, discount: 0.9, note: null },
        { label: "600g｜32入｜每塊約 18.75g", msrp: 8000, discount: 0.9, note: null },
      ],
      priceCode: "54",
    },
  },
};

/** =========================
 * B) 小工具
 * ========================= */
function money(n) {
  const x = Math.round(Number(n) || 0);
  return "$" + String(x).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}
function calcDiscount(msrp, d) {
  if (!msrp || !d) return null;
  return Math.round(msrp * d);
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
function normalizeSoupAlias(raw) {
  let t = String(raw || "");
  if (includesAny(t, STORE.products.soup.aliasNames)) {
    t = t.replace(/龜鹿仙膠|龜鹿二仙膠|龜鹿膠|二仙膠|仙膠/g, "龜鹿湯塊（膠）");
  }
  return t;
}
function clampText(text) {
  const t = String(text || "");
  return t.length > 4900 ? t.slice(0, 4900) : t;
}

/** =========================
 * C) users.json（簡易狀態）
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
  users[userId].state = users[userId].state || { humanMode: false, followedAt: null, followupSent: false };
  users[userId].draft = users[userId].draft || { buying: { active: false, method: null, items: null, name: null, phone: null, address: null } };
  saveUsers(users);
  return users[userId];
}
function updateUser(userId, fn) {
  const users = loadUsers();
  users[userId] = users[userId] || {};
  users[userId].state = users[userId].state || {};
  users[userId].draft = users[userId].draft || { buying: { active: false, method: null } };
  fn(users[userId]);
  saveUsers(users);
}

/** =========================
 * D) Quick Reply（只留當頁）
 * ========================= */
function qr(label, text) {
  return { type: "action", action: { type: "message", label, text } };
}
function qrUri(label, uri) {
  return { type: "action", action: { type: "uri", label, uri } };
}
function quickReplies(menu, ctx = {}) {
  switch (menu) {
    case "main":
      return { items: [qr("1 產品介紹","1"), qr("2 規格","2"), qr("3 價格","3"), qr("4 購買方式","4"), qr("5 門市/來電","5"), qr("6 真人回覆","6"), qr("7 官網","7")] };
    case "product_menu":
      return { items: [qr("11 龜鹿膏","11"), qr("12 龜鹿飲","12"), qr("13 鹿茸粉","13"), qr("14 湯塊(膠)","14"), qr("0 主選單","0")] };
    case "spec_menu":
      return { items: [qr("31 龜鹿膏","31"), qr("32 龜鹿飲","32"), qr("33 鹿茸粉","33"), qr("34 湯塊(膠)","34"), qr("0 主選單","0")] };
    case "price_menu":
      return { items: [qr("51 龜鹿膏","51"), qr("52 龜鹿飲","52"), qr("53 鹿茸粉","53"), qr("54 湯塊(膠)","54"), qr("4 購買方式","4"), qr("0 主選單","0")] };
    case "buy_menu":
      return { items: [qr("91 宅配","91"), qr("92 店到店","92"), qr("93 雙北親送","93"), qr("94 到店自取","94"), qr("0 主選單","0")] };
    case "store_menu":
      return { items: [qr("0 主選單","0"), qrUri("地圖", STORE.mapUrl), qrUri("來電", `tel:${STORE.phoneTel}`), qrUri("官網", STORE.website)] };
    case "product_page":
      return { items: [qr(`${ctx.priceCode} 看價格`, ctx.priceCode), qr("4 購買方式","4"), qr("1 產品選單","1"), qr("0 主選單","0")] };
    default:
      return { items: [qr("0 主選單","0")] };
  }
}
function textMessage(text, menu = "main", ctx = {}) {
  return { type: "text", text: clampText(text), quickReply: quickReplies(menu, ctx) };
}

/** =========================
 * E) 回覆模板
 * ========================= */
function mainMenuText() {
  return `您好🙂 這裡是【${STORE.brandName}】\n請回覆數字：\n\n1) 產品介紹\n2) 容量／規格\n3) 價格（單品）\n4) 購買方式\n5) 門市資訊／來電\n6) 真人回覆\n7) 官網\n\n（隨時回 0 或回「選單」可回到主選單）`;
}
function productMenuText() {
  return `【產品介紹】回覆代碼：\n11) 龜鹿膏\n12) 龜鹿飲\n13) 鹿茸粉\n14) 龜鹿湯塊（膠）\n\n0) 回主選單`;
}
function specMenuText() {
  return `【容量／規格】回覆代碼：\n31) 龜鹿膏\n32) 龜鹿飲\n33) 鹿茸粉\n34) 龜鹿湯塊（膠）\n\n0) 回主選單`;
}
function priceMenuText() {
  return `【價格（單品）】回覆代碼：\n51) 龜鹿膏\n52) 龜鹿飲\n53) 鹿茸粉\n54) 龜鹿湯塊（膠）\n\n4) 購買方式\n0) 回主選單`;
}
function buyMenuText() {
  return `【購買方式】回覆代碼：\n91) 宅配\n92) 超商店到店\n93) 雙北親送\n94) 到店自取\n\n選完我再跟您確認「品項＋數量＋聯絡方式」🙂\n\n0) 回主選單`;
}
function storeInfoText() {
  return `【門市資訊｜${STORE.brandName}】\n地址：${STORE.address}\n電話：${STORE.phoneDisplay}\n\n營業：${STORE.hours.weekday}\n自取：${STORE.hours.pickupLate}\n週末：${STORE.hours.weekend}\n回覆：${STORE.hours.reply}\n\n（回 0 可回主選單）`;
}
function commonPriceFoot() {
  return `${STORE.priceNote1}\n${STORE.priceNote2}`;
}

function productIntroText(key) {
  const p = STORE.products[key];
  if (!p) return "我先確認一下您想看的品項🙂（回 0 可回主選單）";

  if (key === "soup") {
    const vLines = p.variants
      .map((v) => `• ${v.label}${v.note ? `（${v.note}）` : ""}`)
      .join("\n");
    return [
      `【${p.name}】`,
      `• ${p.intro.join("\n• ")}`,
      "",
      "規格：",
      vLines,
      "",
      "成分：",
      `• ${p.ingredients.join("\n• ")}`,
      "",
      "使用方式：",
      `• ${p.usage.join("\n• ")}`,
      "",
      `想看價格：回 ${p.priceCode}`,
      "",
      STORE.infoDisclaimer,
    ].join("\n");
  }

  return [
    `【${p.name}】`,
    `• ${p.intro.join("\n• ")}`,
    "",
    `規格：${p.spec}`,
    "",
    "成分：",
    `• ${p.ingredients.join("\n• ")}`,
    "",
    "食用建議：",
    `• ${p.usage.join("\n• ")}`,
    p.note ? `\n補充：${p.note}` : "",
    "",
    `想看價格：回 ${p.priceCode}`,
    "",
    STORE.infoDisclaimer,
  ]
    .filter(Boolean)
    .join("\n");
}

function productSpecText(key) {
  const p = STORE.products[key];
  if (!p) return "我先確認一下您想看的品項🙂（回 0 可回主選單）";
  if (key === "soup") {
    const lines = p.variants.map((v) => `• ${v.label}${v.note ? `（${v.note}）` : ""}`).join("\n");
    return `【龜鹿湯塊（膠）規格】\n${lines}\n\n（回 0 可回主選單）`;
  }
  return `【${p.name} 規格】\n${p.spec}\n\n（回 0 可回主選單）`;
}

function productPriceText(key) {
  const p = STORE.products[key];
  if (!p) return "我先確認一下您想看的品項🙂（回 0 可回主選單）";
  const act = p.activityDiscount ? calcDiscount(p.msrp, p.activityDiscount) : null;
  return [
    `【${p.name} 價格】`,
    `建議售價：${money(p.msrp)}`,
    act ? `目前活動價：${money(act)}（9折）` : "",
    "",
    commonPriceFoot(),
  ]
    .filter(Boolean)
    .join("\n");
}

function soupPriceAllText() {
  const p = STORE.products.soup;
  const out = ["【龜鹿湯塊（膠）價格】", ""];
  p.variants.forEach((v) => {
    const act = v.discount ? calcDiscount(v.msrp, v.discount) : null;
    out.push(`${v.label}`);
    out.push(`建議售價：${money(v.msrp)}`);
    if (act) out.push(`目前活動價：${money(act)}（9折）`);
    if (v.note) out.push(`備註：${v.note}`);
    out.push("");
  });
  while (out.length && out[out.length - 1] === "") out.pop();
  out.push("");
  out.push(commonPriceFoot());
  return out.join("\n");
}

/** =========================
 * F) 購買流程（簡化）
 * ========================= */
function startBuying(userId, method) {
  updateUser(userId, (u) => {
    u.draft.buying = { active: true, method, items: null, name: null, phone: null, address: null };
  });
}
function stopBuying(userId) {
  updateUser(userId, (u) => {
    u.draft.buying = { active: false, method: null, items: null, name: null, phone: null, address: null };
  });
}
function buyExplain(method) {
  const base = ["好的🙂 我先用這個方式協助您："];
  if (method === "home") base.push("【宅配】\n先回：品項＋數量\n再貼：收件姓名＋電話＋地址");
  if (method === "c2c") base.push("【超商店到店】\n先回：品項＋數量\n再貼：收件姓名＋電話＋取貨門市（店名/店號/地址）");
  if (method === "deliver") base.push("【雙北親送】\n先回：品項＋數量\n再貼：收件姓名＋電話＋地址\n" + STORE.deliverNote);
  if (method === "pickup") base.push("【到店自取】\n先回：品項＋數量\n再留：聯絡姓名＋電話（方便保留並確認取貨時間）");
  base.push("\n（回 0 可回主選單）");
  return base.join("\n");
}

function tryBuying(userId, raw) {
  const u = ensureUser(userId);
  const b = u.draft.buying;
  if (!b || !b.active) return null;

  const t = normalizeSoupAlias(String(raw || "").trim());
  const n = normalizeText(t);

  if (n === "0" || n === "選單") {
    stopBuying(userId);
    return { reply: mainMenuText(), menu: "main" };
  }

  const hasItemSignal =
    includesAny(n, ["龜鹿膏", "龜鹿飲", "鹿茸粉", "湯塊", "龜鹿湯塊", "龜鹿湯塊（膠）"]) ||
    /([0-9]{1,3})\s*(罐|包|盒|組|份|個)/.test(n);

  if (!b.items && hasItemSignal) {
    updateUser(userId, (x) => { x.draft.buying.items = t; });
    if (b.method === "pickup") return { reply: "收到🙂\n接著麻煩留：聯絡姓名＋電話（例：王小明 0912xxxxxx）", menu: "buy_menu" };
    if (b.method === "c2c") return { reply: "收到🙂\n接著麻煩貼：收件姓名＋電話＋取貨門市（店名/店號/地址）", menu: "buy_menu" };
    return { reply: "收到🙂\n接著麻煩貼：收件姓名＋電話＋地址", menu: "buy_menu" };
  }

  const digits = String(raw || "").replace(/\D/g, "");
  const hasPhone = digits.length >= 8 && digits.length <= 15;

  updateUser(userId, (x) => {
    const cur = x.draft.buying;
    if (hasPhone) cur.phone = digits;

    const looksLikeAddr =
      raw.length >= 6 && (raw.includes("路") || raw.includes("街") || raw.includes("巷") || raw.includes("號") || raw.includes("樓") || raw.includes("段") || raw.includes("弄") || raw.includes("門市") || raw.includes("店"));

    if (looksLikeAddr) cur.address = String(raw).trim();

    const nameCandidate = normalizeText(String(raw).replace(digits, ""));
    if (nameCandidate.length >= 2 && nameCandidate.length <= 10 && !includesAny(nameCandidate, ["路","街","巷","號","樓","段","弄","門市","店"])) {
      cur.name = nameCandidate;
    }
  });

  const latest = ensureUser(userId).draft.buying;
  const need = [];
  if (!latest.items) need.push("品項＋數量");
  if (!latest.name) need.push("姓名");
  if (!latest.phone) need.push("電話");
  if (latest.method !== "pickup" && !latest.address) need.push(latest.method === "c2c" ? "取貨門市" : "地址");

  if (need.length) return { reply: `我有看到🙂 目前我還需要：${need.join("、")}（可一次貼一段）`, menu: "buy_menu" };

  const methodName = latest.method === "home" ? "宅配" : latest.method === "c2c" ? "店到店" : latest.method === "deliver" ? "雙北親送" : "到店自取";
  const summary = [
    "✅ 已收到購買資訊：",
    `方式：${methodName}`,
    `品項：${latest.items}`,
    `聯絡：${latest.name} ${latest.phone}`,
    latest.method !== "pickup" ? `地址/門市：${latest.address}` : "",
    "",
    STORE.orderNote,
    "",
    "我接著會回覆：出貨安排與付款資訊🙂",
    "（回 0 可回主選單）",
  ].filter(Boolean).join("\n");

  stopBuying(userId);
  return { reply: summary, menu: "buy_menu" };
}

/** =========================
 * G) 敏感問題導流（保護你）
 * ========================= */
const SENSITIVE = ["孕婦","懷孕","備孕","哺乳","餵母乳","慢性病","三高","高血壓","糖尿病","洗腎","肝","心臟","癌","癌症","化療","放療","手術","術後","用藥","抗凝血","阿斯匹靈","warfarin","能不能吃","可以吃嗎","適不適合","副作用","禁忌"];
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
 * H) 24h 追蹤推播（保留）
 * ========================= */
async function scanAndSendFollowups() {
  if (!config.channelAccessToken || !config.channelSecret) return;
  const users = loadUsers();
  const now = Date.now();
  const dueMs = 24 * 60 * 60 * 1000;
  let changed = false;

  for (const [userId, u] of Object.entries(users)) {
    if (!u || !u.state) continue;
    const followedAt = u.state.followedAt || null;
    if (!followedAt) continue;
    if (u.state.followupSent) continue;
    if (now - followedAt < dueMs) continue;

    try {
      await client.pushMessage(userId, textMessage("您好🙂 需要主選單請回：0 或回「選單」\n要真人協助請回：6", "main"));
      u.state.followupSent = true;
      changed = true;
    } catch (err) {
      console.error("24h 推播失敗：", userId, err?.message || err);
    }
  }
  if (changed) saveUsers(users);
}
cron.schedule("*/10 * * * *", () => scanAndSendFollowups().catch(() => {}));

/** =========================
 * I) Webhook / Server
 * ========================= */
const app = express();
app.use(express.json());

// Health check（Render/瀏覽器快速確認服務是否活著）
app.get("/health", (req, res) => res.status(200).send("ok"));
app.get("/", (req, res, next) => {
  // 若用瀏覽器打開根目錄，回健康訊息（不影響 webhook 的 POST /）
  if (req.method === "GET") return res.status(200).send("ok");
  return next();
});

app.get("/", (req, res) => res.status(200).send("OK"));
app.get("/health", (req, res) => res.status(200).send("ok"));

// middleware 分開：缺金鑰就回 500（避免 crash）
function mountWebhook(pathname){
  // 先做簽章驗證（LINE 官方建議）
  app.post(pathname, (req, res, next) => {
    if (!config.channelAccessToken || !config.channelSecret) {
      return res.status(500).send("LINE credentials missing");
    }
    return line.middleware(config)(req, res, next);
  });

  // 真正處理事件
  app.post(pathname, async (req, res) => {
    try {
      const events = req.body.events || [];
      await Promise.all(events.map(handleEvent));
      res.status(200).end();
    } catch (err) {
      console.error("Webhook error:", err);
      res.status(500).end();
    }
  });
}

// ✅ 同時支援 /webhook 與 /（避免你在 LINE 後台填錯路徑時「可部署但沒回覆」）
mountWebhook("/webhook");
mountWebhook("/");

async function handleEvent(event) {
  if (event.type === "follow") {
    const userId = event.source && event.source.userId;
    if (userId) {
      ensureUser(userId);
      updateUser(userId, (u) => {
        u.state.followedAt = u.state.followedAt || Date.now();
        u.state.followupSent = u.state.followupSent || false;
      });
      return client.replyMessage(event.replyToken, textMessage(mainMenuText(), "main"));
    }
    return null;
  }

  if (event.type !== "message" || !event.message || event.message.type !== "text") return null;

  const userId = event.source && event.source.userId;
  const raw = event.message.text || "";
  if (!userId) return client.replyMessage(event.replyToken, textMessage(mainMenuText(), "main"));

  ensureUser(userId);

  const rawNorm = normalizeSoupAlias(normalizeText(raw));

  // 解除真人
  if (rawNorm === "解除真人" || rawNorm === "取消真人" || rawNorm === "恢復自動") {
    updateUser(userId, (u) => { u.state.humanMode = false; });
    stopBuying(userId);
    return client.replyMessage(event.replyToken, textMessage(mainMenuText(), "main"));
  }

  // 開啟真人
  if (rawNorm === "6" || rawNorm.includes("真人") || rawNorm.includes("人工") || rawNorm.includes("客服")) {
    updateUser(userId, (u) => { u.state.humanMode = true; });
    stopBuying(userId);
    return client.replyMessage(event.replyToken, textMessage(STORE.humanModeNote, "main"));
  }

  // 真人模式中
  const u = ensureUser(userId);
  if (u.state && u.state.humanMode) {
    if (rawNorm === "0" || rawNorm === "選單") {
      updateUser(userId, (x) => { x.state.humanMode = false; });
      stopBuying(userId);
      return client.replyMessage(event.replyToken, textMessage(mainMenuText(), "main"));
    }
    return client.replyMessage(event.replyToken, textMessage("我有收到🙂 已轉真人協助中。\n要回主選單回：0 或回「選單」\n要解除真人回：解除真人", "main"));
  }

  // 回主選單
  if (rawNorm === "0" || rawNorm === "選單" || rawNorm === "主選單") {
    stopBuying(userId);
    return client.replyMessage(event.replyToken, textMessage(mainMenuText(), "main"));
  }

  // 購買流程優先
  const buying = tryBuying(userId, raw);
  if (buying) return client.replyMessage(event.replyToken, textMessage(buying.reply, buying.menu || "buy_menu"));

  // 敏感導流
  if (includesAny(rawNorm, SENSITIVE)) {
    return client.replyMessage(event.replyToken, textMessage(sensitiveText(), "main"));
  }

  // 主選單
  if (rawNorm === "1") return client.replyMessage(event.replyToken, textMessage(productMenuText(), "product_menu"));
  if (rawNorm === "2") return client.replyMessage(event.replyToken, textMessage(specMenuText(), "spec_menu"));
  if (rawNorm === "3") return client.replyMessage(event.replyToken, textMessage(priceMenuText(), "price_menu"));
  if (rawNorm === "4") return client.replyMessage(event.replyToken, textMessage(buyMenuText(), "buy_menu"));
  if (rawNorm === "5") return client.replyMessage(event.replyToken, textMessage(storeInfoText(), "store_menu"));
  if (rawNorm === "7") return client.replyMessage(event.replyToken, textMessage(`官網（品牌介紹／產品資訊）：\n${STORE.website}\n\n（回 0 可回主選單）`, "main"));

  // 產品介紹
  if (rawNorm === "11") return client.replyMessage(event.replyToken, textMessage(productIntroText("gel"), "product_page", { priceCode: "51" }));
  if (rawNorm === "12") return client.replyMessage(event.replyToken, textMessage(productIntroText("drink"), "product_page", { priceCode: "52" }));
  if (rawNorm === "13") return client.replyMessage(event.replyToken, textMessage(productIntroText("antler"), "product_page", { priceCode: "53" }));
  if (rawNorm === "14") return client.replyMessage(event.replyToken, textMessage(productIntroText("soup"), "product_page", { priceCode: "54" }));

  // 規格
  if (rawNorm === "31") return client.replyMessage(event.replyToken, textMessage(productSpecText("gel"), "spec_menu"));
  if (rawNorm === "32") return client.replyMessage(event.replyToken, textMessage(productSpecText("drink"), "spec_menu"));
  if (rawNorm === "33") return client.replyMessage(event.replyToken, textMessage(productSpecText("antler"), "spec_menu"));
  if (rawNorm === "34") return client.replyMessage(event.replyToken, textMessage(productSpecText("soup"), "spec_menu"));

  // 價格（湯塊一次顯示全部）
  if (rawNorm === "51") return client.replyMessage(event.replyToken, textMessage(productPriceText("gel"), "price_menu"));
  if (rawNorm === "52") return client.replyMessage(event.replyToken, textMessage(productPriceText("drink"), "price_menu"));
  if (rawNorm === "53") return client.replyMessage(event.replyToken, textMessage(productPriceText("antler"), "price_menu"));
  if (rawNorm === "54") return client.replyMessage(event.replyToken, textMessage(soupPriceAllText(), "price_menu"));

  // 購買方式
  if (rawNorm === "91") { startBuying(userId, "home"); return client.replyMessage(event.replyToken, textMessage(buyExplain("home"), "buy_menu")); }
  if (rawNorm === "92") { startBuying(userId, "c2c"); return client.replyMessage(event.replyToken, textMessage(buyExplain("c2c"), "buy_menu")); }
  if (rawNorm === "93") { startBuying(userId, "deliver"); return client.replyMessage(event.replyToken, textMessage(buyExplain("deliver"), "buy_menu")); }
  if (rawNorm === "94") { startBuying(userId, "pickup"); return client.replyMessage(event.replyToken, textMessage(buyExplain("pickup"), "buy_menu")); }

  // fallback
  return client.replyMessage(event.replyToken, textMessage("我有收到🙂\n要叫出主選單請回：0 或回「選單」\n也可以直接回：1 產品介紹、3 價格、4 購買方式", "main"));
}

app.listen(PORT, "0.0.0.0", () => {
  console.log(`LINE bot listening on port ${PORT}`);
});
