"use strict";

/**
 * 仙加味・龜鹿 LINE OA Bot（最終可部署版｜卡片按鈕版）
 * - 不用 Quick Reply（避免底部一排按鈕）
 * - 主要互動改 Flex 卡片按鈕（老人家更好用）
 * - 仍相容數字代碼（不顯示，但可輸入）
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
 * A) 基本資料（與官網一致｜LINE 可顯示價格）
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
    "我已先幫您轉真人協助🙂\n\n※ 真人回覆期間，系統會先暫停自動回覆，避免訊息打架。\n要回到主選單可回：選單\n若要解除真人模式可回：解除真人",
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
  return "NT$" + String(x).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
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
 * D) Flex 卡片（老人家大按鈕）
 * ========================= */
function btn(label, text) {
  // ✅ 一律用 message action，避免你之前按「看價格」沒反應（postback 沒接到會掛）
  return {
    type: "button",
    style: "primary",
    action: { type: "message", label, text },
  };
}
function btnLink(label, uri) {
  return {
    type: "button",
    style: "secondary",
    action: { type: "uri", label, uri },
  };
}

function flexBubble(title, bodyLines, buttons) {
  return {
    type: "flex",
    altText: title,
    contents: {
      type: "bubble",
      size: "mega",
      body: {
        type: "box",
        layout: "vertical",
        spacing: "md",
        contents: [
          { type: "text", text: title, weight: "bold", size: "xl", wrap: true },
          ...(bodyLines || []).map((t) => ({ type: "text", text: t, size: "md", wrap: true })),
        ],
      },
      footer: {
        type: "box",
        layout: "vertical",
        spacing: "sm",
        contents: buttons || [],
      },
    },
  };
}

function flexMainMenu() {
  return flexBubble(
    `您好🙂 這裡是【${STORE.brandName}】`,
    ["請直接點選需要的項目（也可以直接打：產品 / 價格 / 規格 / 怎麼買 / 門市 / 真人 / 官網）"],
    [
      btn("產品介紹", "產品介紹"),
      btn("規格 / 容量", "規格"),
      btn("看價格", "價格"),
      btn("怎麼買", "怎麼買"),
      btn("門市 / 來電", "門市"),
      btn("真人回覆", "真人"),
      btn("前往官網", "官網"),
    ]
  );
}

function flexProductMenu() {
  return flexBubble(
    "想看哪一個產品？",
    ["直接點選品項即可🙂"],
    [
      btn("龜鹿膏", "龜鹿膏"),
      btn("龜鹿飲", "龜鹿飲"),
      btn("鹿茸粉", "鹿茸粉"),
      btn("龜鹿湯塊（膠）", "龜鹿湯塊（膠）"),
      btn("回主選單", "選單"),
    ]
  );
}

function flexSpecMenu() {
  return flexBubble(
    "規格 / 容量",
    ["想看哪個品項的規格？"],
    [
      btn("龜鹿膏規格", "龜鹿膏規格"),
      btn("龜鹿飲規格", "龜鹿飲規格"),
      btn("鹿茸粉規格", "鹿茸粉規格"),
      btn("湯塊規格", "龜鹿湯塊規格"),
      btn("回主選單", "選單"),
    ]
  );
}

function flexPriceMenu() {
  return flexBubble(
    "價格（LINE 內顯示）",
    ["想看哪個品項的價格？"],
    [
      btn("龜鹿膏價格", "龜鹿膏價格"),
      btn("龜鹿飲價格", "龜鹿飲價格"),
      btn("鹿茸粉價格", "鹿茸粉價格"),
      btn("湯塊價格", "龜鹿湯塊價格"),
      btn("怎麼買", "怎麼買"),
      btn("回主選單", "選單"),
    ]
  );
}

function flexBuyMenu() {
  return flexBubble(
    "怎麼買？",
    ["請點選出貨方式，我再跟您確認：品項＋數量＋聯絡方式🙂"],
    [
      btn("宅配", "宅配"),
      btn("超商店到店", "店到店"),
      btn("雙北親送", "雙北親送"),
      btn("到店自取", "到店自取"),
      btn("回主選單", "選單"),
    ]
  );
}

function flexStoreMenu() {
  return flexBubble(
    "門市資訊",
    [
      `地址：${STORE.address}`,
      `電話：${STORE.phoneDisplay}`,
      `營業：${STORE.hours.weekday}`,
      `自取：${STORE.hours.pickupLate}`,
      `週末：${STORE.hours.weekend}`,
    ],
    [
      btnLink("地圖導航", STORE.mapUrl),
      btnLink("一鍵來電", `tel:${STORE.phoneTel}`),
      btnLink("前往官網", STORE.website),
      btn("回主選單", "選單"),
    ]
  );
}

/** =========================
 * E) 文字訊息（少量保留）
 * ========================= */
function textMessage(text) {
  return { type: "text", text: clampText(text) };
}
function commonPriceFoot() {
  return `${STORE.priceNote1}\n${STORE.priceNote2}`;
}

function productIntroText(key) {
  const p = STORE.products[key];
  if (!p) return "我先確認一下您想看的品項🙂（回：選單）";

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
      `要看價格：直接回「湯塊價格」或點「看價格」`,
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
    `要看價格：直接回「${p.name}價格」或點「看價格」`,
    "",
    STORE.infoDisclaimer,
  ]
    .filter(Boolean)
    .join("\n");
}

function productSpecText(key) {
  const p = STORE.products[key];
  if (!p) return "我先確認一下您想看的品項🙂（回：選單）";
  if (key === "soup") {
    const lines = p.variants.map((v) => `• ${v.label}${v.note ? `（${v.note}）` : ""}`).join("\n");
    return `【龜鹿湯塊（膠）規格】\n${lines}\n\n（回：選單）`;
  }
  return `【${p.name} 規格】\n${p.spec}\n\n（回：選單）`;
}

function productPriceText(key) {
  const p = STORE.products[key];
  if (!p) return "我先確認一下您想看的品項🙂（回：選單）";
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
  base.push("\n（回：選單 可回主選單）");
  return base.join("\n");
}

function tryBuying(userId, raw) {
  const u = ensureUser(userId);
  const b = u.draft.buying;
  if (!b || !b.active) return null;

  const t = normalizeSoupAlias(String(raw || "").trim());
  const n = normalizeText(t);

  if (n === "選單" || n === "主選單") {
    stopBuying(userId);
    return { type: "flex", message: flexMainMenu() };
  }

  const hasItemSignal =
    includesAny(n, ["龜鹿膏", "龜鹿飲", "鹿茸粉", "湯塊", "龜鹿湯塊", "龜鹿湯塊（膠）"]) ||
    /([0-9]{1,3})\s*(罐|包|盒|組|份|個)/.test(n);

  if (!b.items && hasItemSignal) {
    updateUser(userId, (x) => { x.draft.buying.items = t; });
    if (b.method === "pickup") return { type: "text", message: textMessage("收到🙂\n接著麻煩留：聯絡姓名＋電話（例：王小明 0912xxxxxx）") };
    if (b.method === "c2c") return { type: "text", message: textMessage("收到🙂\n接著麻煩貼：收件姓名＋電話＋取貨門市（店名/店號/地址）") };
    return { type: "text", message: textMessage("收到🙂\n接著麻煩貼：收件姓名＋電話＋地址") };
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

  if (need.length) return { type: "text", message: textMessage(`我有看到🙂 目前我還需要：${need.join("、")}（可一次貼一段）`) };

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
    "（回：選單 可回主選單）",
  ].filter(Boolean).join("\n");

  stopBuying(userId);
  return { type: "text", message: textMessage(summary) };
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
    "（回：選單 可回主選單）",
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
      await client.pushMessage(userId, flexMainMenu());
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
app.get("/", (req, res) => res.status(200).send("ok"));
app.get("/health", (req, res) => res.status(200).send("ok"));

function mountWebhook(pathname) {
  // 簽章驗證
  app.post(pathname, (req, res, next) => {
    if (!config.channelAccessToken || !config.channelSecret) {
      return res.status(500).send("LINE credentials missing");
    }
    return line.middleware(config)(req, res, next);
  });

  // 處理事件
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

mountWebhook("/webhook"); // ✅ 你 LINE 後台填這個就好（https://xxx.onrender.com/webhook）

async function reply(event, message) {
  return client.replyMessage(event.replyToken, message);
}

function isPriceIntent(t) {
  const s = String(t || "");
  return s.includes("價格") || s.includes("多少") || s.includes("幾錢") || s.includes("幾多") || s.includes("報價");
}

function pickProductByText(t) {
  const s = String(t || "");
  if (s.includes("龜鹿膏")) return "gel";
  if (s.includes("龜鹿飲")) return "drink";
  if (s.includes("鹿茸")) return "antler";
  if (s.includes("湯塊") || s.includes("龜鹿湯塊") || s.includes("龜鹿湯塊（膠）")) return "soup";
  return null;
}

async function handleEvent(event) {
  // follow
  if (event.type === "follow") {
    const userId = event.source && event.source.userId;
    if (userId) {
      ensureUser(userId);
      updateUser(userId, (u) => {
        u.state.followedAt = u.state.followedAt || Date.now();
        u.state.followupSent = u.state.followupSent || false;
      });
    }
    return reply(event, flexMainMenu());
  }

  // only text
  if (event.type !== "message" || !event.message || event.message.type !== "text") return null;

  const userId = event.source && event.source.userId;
  const raw = event.message.text || "";
  if (!userId) return reply(event, flexMainMenu());

  ensureUser(userId);

  const rawNorm = normalizeSoupAlias(normalizeText(raw));

  // 解除真人
  if (rawNorm === "解除真人" || rawNorm === "取消真人" || rawNorm === "恢復自動") {
    updateUser(userId, (u) => { u.state.humanMode = false; });
    stopBuying(userId);
    return reply(event, flexMainMenu());
  }

  // 真人
  if (rawNorm === "真人" || rawNorm.includes("人工") || rawNorm.includes("客服") || rawNorm === "6") {
    updateUser(userId, (u) => { u.state.humanMode = true; });
    stopBuying(userId);
    return reply(event, textMessage(STORE.humanModeNote));
  }

  // 真人模式中
  const u = ensureUser(userId);
  if (u.state && u.state.humanMode) {
    if (rawNorm === "選單" || rawNorm === "主選單" || rawNorm === "0") {
      updateUser(userId, (x) => { x.state.humanMode = false; });
      stopBuying(userId);
      return reply(event, flexMainMenu());
    }
    return reply(event, textMessage("我有收到🙂 已轉真人協助中。\n要回主選單回：選單\n要解除真人回：解除真人"));
  }

  // 購買流程優先
  const buying = tryBuying(userId, raw);
  if (buying) return reply(event, buying.message);

  // 敏感導流
  if (includesAny(rawNorm, SENSITIVE)) {
    return reply(event, textMessage(sensitiveText()));
  }

  // 主選單/入口（不用數字也行）
  if (rawNorm === "選單" || rawNorm === "主選單" || rawNorm === "0") return reply(event, flexMainMenu());
  if (rawNorm === "產品" || rawNorm === "產品介紹" || rawNorm === "1") return reply(event, flexProductMenu());
  if (rawNorm === "規格" || rawNorm.includes("容量") || rawNorm === "2") return reply(event, flexSpecMenu());
  if (rawNorm === "價格" || isPriceIntent(rawNorm) || rawNorm === "3") return reply(event, flexPriceMenu());
  if (rawNorm === "怎麼買" || rawNorm === "購買" || rawNorm === "購買方式" || rawNorm === "4") return reply(event, flexBuyMenu());
  if (rawNorm === "門市" || rawNorm.includes("地址") || rawNorm.includes("電話") || rawNorm === "5") return reply(event, flexStoreMenu());
  if (rawNorm === "官網" || rawNorm === "7") return reply(event, textMessage(`官網（品牌介紹／產品資訊）：\n${STORE.website}\n\n（回：選單 可回主選單）`));

  // 直接打品名（產品介紹）
  const pk = pickProductByText(rawNorm);
  if (pk && !isPriceIntent(rawNorm) && !rawNorm.includes("規格")) {
    if (pk === "gel") return reply(event, flexBubble("龜鹿膏", ["已為您整理好重點🙂"], [btn("看介紹", "龜鹿膏介紹"), btn("看價格", "龜鹿膏價格"), btn("怎麼買", "怎麼買"), btn("回主選單", "選單")]));
    if (pk === "drink") return reply(event, flexBubble("龜鹿飲", ["已為您整理好重點🙂"], [btn("看介紹", "龜鹿飲介紹"), btn("看價格", "龜鹿飲價格"), btn("怎麼買", "怎麼買"), btn("回主選單", "選單")]));
    if (pk === "antler") return reply(event, flexBubble("鹿茸粉", ["已為您整理好重點🙂"], [btn("看介紹", "鹿茸粉介紹"), btn("看價格", "鹿茸粉價格"), btn("怎麼買", "怎麼買"), btn("回主選單", "選單")]));
    if (pk === "soup") return reply(event, flexBubble("龜鹿湯塊（膠）", ["已為您整理好重點🙂"], [btn("看介紹", "龜鹿湯塊介紹"), btn("看價格", "龜鹿湯塊價格"), btn("怎麼買", "怎麼買"), btn("回主選單", "選單")]));
  }

  // 介紹/規格/價格（文字觸發，確保「看價格」一定有反應）
  if (rawNorm === "龜鹿膏介紹") return reply(event, textMessage(productIntroText("gel")));
  if (rawNorm === "龜鹿飲介紹") return reply(event, textMessage(productIntroText("drink")));
  if (rawNorm === "鹿茸粉介紹") return reply(event, textMessage(productIntroText("antler")));
  if (rawNorm === "龜鹿湯塊介紹" || rawNorm === "龜鹿湯塊（膠）介紹") return reply(event, textMessage(productIntroText("soup")));

  if (rawNorm === "龜鹿膏規格" || rawNorm === "31") return reply(event, textMessage(productSpecText("gel")));
  if (rawNorm === "龜鹿飲規格" || rawNorm === "32") return reply(event, textMessage(productSpecText("drink")));
  if (rawNorm === "鹿茸粉規格" || rawNorm === "33") return reply(event, textMessage(productSpecText("antler")));
  if (rawNorm === "龜鹿湯塊規格" || rawNorm === "34") return reply(event, textMessage(productSpecText("soup")));

  // ✅ 價格（支援多種問法）
  if (rawNorm === "龜鹿膏價格" || rawNorm === "51") return reply(event, textMessage(productPriceText("gel")));
  if (rawNorm === "龜鹿飲價格" || rawNorm === "52") return reply(event, textMessage(productPriceText("drink")));
  if (rawNorm === "鹿茸粉價格" || rawNorm === "53") return reply(event, textMessage(productPriceText("antler")));
  if (rawNorm === "龜鹿湯塊價格" || rawNorm === "湯塊價格" || rawNorm === "54") return reply(event, textMessage(soupPriceAllText()));

  // 買（按鈕）
  if (rawNorm === "宅配" || rawNorm === "91") { startBuying(userId, "home"); return reply(event, textMessage(buyExplain("home"))); }
  if (rawNorm === "店到店" || rawNorm === "超商" || rawNorm === "92") { startBuying(userId, "c2c"); return reply(event, textMessage(buyExplain("c2c"))); }
  if (rawNorm === "雙北親送" || rawNorm === "親送" || rawNorm === "93") { startBuying(userId, "deliver"); return reply(event, textMessage(buyExplain("deliver"))); }
  if (rawNorm === "到店自取" || rawNorm === "自取" || rawNorm === "94") { startBuying(userId, "pickup"); return reply(event, textMessage(buyExplain("pickup"))); }

  // fallback
  return reply(event, flexBubble("我有收到🙂", ["要快速操作請點下方："], [btn("主選單", "選單"), btn("產品介紹", "產品介紹"), btn("看價格", "價格"), btn("怎麼買", "怎麼買"), btn("門市", "門市")]));
}

app.listen(PORT, "0.0.0.0", () => {
  console.log(`LINE bot listening on port ${PORT}`);
});
