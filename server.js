"use strict";



function formatVariantLine(x) {
  const specPart = x.spec ? `：${x.spec}` : "";
  const notePart = x.note ? `（${x.note}）` : "";
  return `• ${x.label}${specPart}${notePart}`;
}

/**
 * 仙加味・龜鹿 LINE Bot（最終完整版｜A 穩重老字號｜動態子選單只留當頁選項｜代碼全 ≤ 2 位數）
 *
 * ✅ 代碼規則（最新版｜你指定）
 * - 主選單：0 / 1 / 2 / 3 / 4 / 5 / 6 / 7
 * - 產品介紹選品：11~14
 * - 規格選品：31~34
 * - 價格選品：51~54（湯塊：54）
 * - 購買方式：91~94（宅配/店到店/雙北親送/到店自取）
 *
 * ✅ 湯塊價格：不分規格 → 54 一次顯示全部規格價格
 * ✅ 產品介紹正文已含成分 → 不需要「想看成分」提示
 * ✅ 子選單 Quick Reply：只顯示「當頁需要的按鈕」
 * ✅ 各產品「價格頁」快捷新增：4 購買方式
 * ✅ Rich Menu「傳送訊息」改發文字「選單」→ 本程式已支援：回「選單」= 主選單
 * ✅ 真人回覆：6 開啟；解除真人/取消真人/恢復自動 關閉（真人期間暫停自動）
 */

const express = require("express");
const line = require("@line/bot-sdk");
const fs = require("fs");
const path = require("path");
const cron = require("node-cron");

const {
  CHANNEL_ACCESS_TOKEN,
  CHANNEL_SECRET,
  LINE_CHANNEL_ACCESS_TOKEN,
  LINE_CHANNEL_SECRET,
  PORT = 3000,
} = process.env;

const _ACCESS_TOKEN = CHANNEL_ACCESS_TOKEN || LINE_CHANNEL_ACCESS_TOKEN;
const _CHANNEL_SECRET = CHANNEL_SECRET || LINE_CHANNEL_SECRET;
if (!_ACCESS_TOKEN || !_CHANNEL_SECRET) {
  console.error("缺少環境變數：CHANNEL_ACCESS_TOKEN/CHANNEL_SECRET 或 LINE_CHANNEL_ACCESS_TOKEN/LINE_CHANNEL_SECRET");
  process.exit(1);
}

const config = { channelAccessToken: _ACCESS_TOKEN, channelSecret: _CHANNEL_SECRET };
const app = express;
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
      key: "gel",
      name: "龜鹿膏",
      spec: "100g/罐",
      msrp: 2000,
      activityDiscount: 0.9,
      ingredients: ["鹿角", "全龜", "枸杞", "黃耆", "紅棗", "粉光蔘"],
      intro: [
        "以鹿角與全龜為基底，佐以枸杞、黃耆、紅棗、粉光蔘等熬製。",
        "口感溫潤濃稠，可直接食用或以溫水化開。",
        "適合想建立固定補養節奏的人，讓日常更容易持續。",
      ],
      usage: [
        "每日一次，一小匙（初次可從半匙開始）",
        "建議飯後或空腹前後皆可（以個人習慣為準）",
        "可溫水化開後飲用，或直接食用",
        "食用期間避免冰飲",
      ],
      note: "依每個人食用習慣不同，一罐約可食用 10 天～半個月。",
      priceCode: "51",
    },

    drink: {
      key: "drink",
      name: "龜鹿飲",
      spec: "180cc/包",
      msrp: 200,
      activityDiscount: 0.9,
      ingredients: ["水", "鹿角", "全龜", "枸杞", "黃耆", "紅棗", "粉光蔘"],
      intro: [
        "即飲型設計，方便日常補充與外出攜帶。",
        "屬於入門嚐鮮路線，喝法更接近日常飲用型，適合先從「好做到」開始。",
        "可溫熱飲用，口感順口，忙碌行程也比較容易安排。",
      ],
      usage: ["每日一包", "可隔水加熱或溫熱飲用", "建議白天飲用較舒適", "避免冰飲"],
      priceCode: "52",
    },

    antler: {
      key: "antler",
      name: "鹿茸粉",
      spec: "75g/罐",
      msrp: 2000,
      activityDiscount: 0.9,
      ingredients: ["鹿茸"],
      intro: [
        "粉末型設計，便於少量調配。",
        "可搭配溫水或飲品使用，讓補養融入日常飲食節奏。",
      ],
      usage: ["建議少量開始，搭配溫水或飲品", "若容易口乾或睡不好，建議減量或間隔食用"],
      priceCode: "53",
    },

    soup: {
      key: "soup",
      name: "龜鹿湯塊（膠）",
      aliasNames: ["龜鹿仙膠", "龜鹿二仙膠", "龜鹿膠", "二仙膠", "仙膠"],
      ingredients: ["鹿角萃取物", "全龜萃取物"],
      intro: [
        "選用鹿角萃取物與全龜萃取物製成，經傳統製程濃縮成塊，適合日常燉煮湯品使用。",
        "口感可依水量調整，適合搭配雞肉或其他食材燉煮。",
      ],
      usage: [
        "一塊入鍋，以水量調整濃淡；可搭配雞肉、排骨或其他食材燉煮",
        "建議熱食熱飲，風味更完整",
        "不建議久煮過度，避免口感過於濃稠",
      ],
      variants: [
  { label: "75g｜8入｜每塊約 9.375g", spec: "", msrp: 1000, activityDiscount: null, note: "盒子規劃中（目前以傳統包裝出貨）" },
  { label: "150g｜8入｜每塊約 18.75g", spec: "", msrp: 2000, activityDiscount: null, note: null },
  { label: "300g｜16入｜每塊約 18.75g", spec: "", msrp: 4000, activityDiscount: 0.9, note: null },
  { label: "600g｜32入｜每塊約 18.75g", spec: "", msrp: 8000, activityDiscount: 0.9, note: null },
],
      priceCode: "54",
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
    .trim;
}
function clampText(text) {
  const t = String(text || "");
  return t.length > 4900 ? t.slice(0, 4900) : t;
}
function safeDigits(raw) {
  return String(raw || "").replace(/[^\d]/g, "");
}
function includesAny(t, arr) {
  const s = String(t || "");
  return arr.some((k) => s.includes(k));
}

/** 湯塊別名統一（使用者打別名也導回「龜鹿湯塊（膠）」） */
function normalizeSoupAlias(raw) {
  let t = String(raw || "");
  if (includesAny(t, STORE.products.soup.aliasNames)) {
    t = t.replace(/龜鹿仙膠|龜鹿二仙膠|龜鹿膠|二仙膠|仙膠/g, "龜鹿湯塊（膠）");
  }
  return t;
}

/** 雙北判斷 */
const CITY_LIST = [
  "台北","台北市","新北","新北市","基隆","基隆市","桃園","桃園市","新竹","新竹市","新竹縣","苗栗","苗栗縣",
  "台中","台中市","彰化","彰化縣","南投","南投縣","雲林","雲林縣","嘉義","嘉義市","嘉義縣","台南","台南市",
  "高雄","高雄市","屏東","屏東縣","宜蘭","宜蘭縣","花蓮","花蓮縣","台東","台東縣","澎湖","澎湖縣","金門","金門縣","馬祖","連江縣",
];
function guessCityFromText(text) {
  const t = String(text || "");
  if (t.includes("台北市") || t.includes("台北")) return "台北市";
  if (t.includes("新北市") || t.includes("新北")) return "新北市";
  for (const c of CITY_LIST) if (t.includes(c)) return c;
  return null;
}
function isShuangbeiCity(addr) {
  const c = guessCityFromText(addr);
  return c === "台北市" || c === "新北市";
}

/** =========================
 * C) users.json（持久化）
 * ========================= */
const DATA_DIR = path.join(__dirname, "data");
const USERS_FILE = path.join(DATA_DIR, "users.json");
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

function loadUsers {
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
  const users = loadUsers;
  users[userId] = users[userId] || {};
  users[userId].state = users[userId].state || {
    lastMenu: "main",
    lastProductKey: null,
    rotate: {},
    humanMode: false,
    humanSince: null,
    lastSeenAt: Date.now,
  };
  users[userId].draft = users[userId].draft || {
    buying: { active: false, method: null, itemsText: null, name: null, phone: null, address: null },
  };
  users[userId].state.lastSeenAt = Date.now;
  saveUsers(users);
  return users[userId];
}
function updateUser(userId, patchFn) {
  const users = loadUsers;
  users[userId] = users[userId] || {};
  users[userId].state = users[userId].state || {};
  users[userId].draft = users[userId].draft || { buying: { active: false, method: null } };
  patchFn(users[userId]);
  users[userId].state.lastSeenAt = Date.now;
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
function rotatePick(userId, key, arr) {
  const idx = bumpRotate(userId, key, arr.length);
  return arr[idx];
}
function setHumanMode(userId, on) {
  updateUser(userId, (u) => {
    u.state.humanMode = !!on;
    u.state.humanSince = on ? Date.now : null;
  });
}

/** =========================
 * D) Quick Reply（動態｜只留當頁）
 * ========================= */
function qr(label, text) {
  return { type: "action", action: { type: "message", label, text } };
}
function qrUri(label, uri) {
  return { type: "action", action: { type: "uri", label, uri } };
}

function quickRepliesByMenu(menu, ctx = {}) {
  switch (menu) {
    case "main":
      return {
        items: [
          qr("1 產品介紹", "1"),
          qr("2 規格", "2"),
          qr("3 價格", "3"),
          qr("4 購買方式", "4"),
          qr("5 門市/來電", "5"),
          qr("6 真人回覆", "6"),
          qr("7 官網", "7"),
        ],
      };

    case "product_menu":
      return { items: [qr("11 龜鹿膏", "11"), qr("12 龜鹿飲", "12"), qr("13 鹿茸粉", "13"), qr("14 湯塊(膠)", "14"), qr("0 回主選單", "0")] };

    case "spec_menu":
      return { items: [qr("31 龜鹿膏", "31"), qr("32 龜鹿飲", "32"), qr("33 鹿茸粉", "33"), qr("34 湯塊(膠)", "34"), qr("0 回主選單", "0")] };

    case "price_menu":
      return { items: [qr("51 龜鹿膏", "51"), qr("52 龜鹿飲", "52"), qr("53 鹿茸粉", "53"), qr("54 湯塊(膠)", "54"), qr("4 購買方式", "4"), qr("0 回主選單", "0")] };

    case "buy_menu":
      return { items: [qr("91 宅配", "91"), qr("92 店到店", "92"), qr("93 雙北親送", "93"), qr("94 到店自取", "94"), qr("0 回主選單", "0")] };

    case "store_menu":
      return { items: [qr("0 回主選單", "0"), qrUri("地圖", STORE.mapUrl), qrUri("來電", `tel:${STORE.phoneTel}`), qrUri("官網", STORE.website)] };

    case "product_page": {
      const items = [];
      if (ctx.priceCode) items.push(qr(`${ctx.priceCode} 看價格`, String(ctx.priceCode)));
      items.push(qr("4 購買方式", "4"));
      items.push(qr("1 產品選單", "1"));
      items.push(qr("0 主選單", "0"));
      return { items };
    }

    case "price_page":
      return { items: [qr("4 購買方式", "4"), qr("3 價格選單", "3"), qr("0 回主選單", "0")] };

    default:
      return { items: [qr("0 回主選單", "0")] };
  }
}

function textMessage(text, menu = "main", ctx = {}) {
  return { type: "text", text: clampText(text), quickReply: quickRepliesByMenu(menu, ctx) };
}

/** =========================
 * E) 選單文字
 * ========================= */
function mainMenuText(userId) {
  const templates = [
    `您好，這裡是【${STORE.brandName}】🙂\n請回覆數字查詢：\n\n1) 產品介紹\n2) 容量／規格\n3) 價格（單品）\n4) 購買方式\n5) 門市資訊／來電\n6) 真人回覆\n7) 官網\n\n（隨時回 0 或回「選單」可回到主選單）`,
    `您好🙂【${STORE.brandName}】為您服務。\n回數字即可：\n\n1 產品介紹\n2 規格\n3 價格\n4 購買方式\n5 門市/電話\n6 真人\n7 官網\n\n（回 0 / 回「選單」= 主選單）`,
  ];
  return rotatePick(userId, "mainMenu", templates);
}
function productMenuText {
  return `【產品介紹】請回覆代碼：\n11) 龜鹿膏（100g/罐）\n12) 龜鹿飲（180cc/包）\n13) 鹿茸粉（75g/罐）\n14) 龜鹿湯塊（膠）\n\n0) 回主選單`;
}
function specMenuText {
  return `【容量／規格】請回覆代碼：\n31) 龜鹿膏\n32) 龜鹿飲\n33) 鹿茸粉\n34) 龜鹿湯塊（膠）\n\n0) 回主選單`;
}
function priceMenuText {
  return `【價格（單品）】請回覆代碼：\n51) 龜鹿膏\n52) 龜鹿飲\n53) 鹿茸粉\n54) 龜鹿湯塊（膠）\n\n4) 購買方式\n0) 回主選單`;
}
function buyMenuText(userId) {
  const templates = [
    `【購買方式】先選一種方式即可（回覆代碼）：\n91) 宅配\n92) 超商店到店\n93) 雙北親送\n94) 到店自取\n\n選完我再跟您確認「品項＋數量＋聯絡方式」，不會一直填表🙂\n\n0) 回主選單`,
    `您想用哪種方式買比較方便？回代碼：\n91 宅配\n92 店到店\n93 雙北親送\n94 到店自取\n\n（選完我再跟您確認品項/數量即可）\n\n0 回主選單`,
  ];
  return rotatePick(userId, "buyMenu", templates);
}
function storeInfoText {
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
    "（回 0 可回主選單）",
  ].join("\n");
}
function commonPriceFoot {
  return [STORE.priceNote1, STORE.priceNote2].join("\n");
}

/** =========================
 * F) 產品回覆（介紹/規格/價格）
 * ========================= */
function productIntroText(userId, key) {
  const p = STORE.products[key];
  if (!p) return "我先確認一下您想看的品項🙂（回 0 可回主選單）";

  if (key === "soup") {
    const vLines = p.variants
      .map((x) => formatVariantLine(x))
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
    const lines = p.variants.map((x) => formatVariantLine(x)).join("\n");
    return `【龜鹿湯塊（膠）規格】\n${lines}\n\n（回 0 可回主選單）`;
  }
  return `【${p.name} 規格】\n${p.spec}\n\n（回 0 可回主選單）`;
}

function productPriceText(key) {
  const p = STORE.products[key];
  if (!p) return "我先確認一下您想看的品項🙂（回 0 可回主選單）";

  const act = p.activityDiscount ? calcActivityPrice(p.msrp, p.activityDiscount) : null;
  return [
    `【${p.name} 價格】`,
    `建議售價：${money(p.msrp)}`,
    act ? `目前活動價：${money(act)}（9折）` : "",
    "",
    commonPriceFoot,
  ]
    .filter(Boolean)
    .join("\n");
}

function soupPriceAllText {
  const p = STORE.products.soup;
  const lines = [];
  lines.push("【龜鹿湯塊（膠）價格】");
  lines.push("");

  for (const v of p.variants) {
    const act = v.activityDiscount ? calcActivityPrice(v.msrp, v.activityDiscount) : null;
    lines.push(`${v.label}（${v.spec}）`);
    lines.push(`建議售價：${money(v.msrp)}`);
    if (act) lines.push(`目前活動價：${money(act)}（9折）`);
    if (v.note) lines.push(`備註：${v.note}`);
    lines.push("");
  }
  while (lines.length && lines[lines.length - 1] === "") lines.pop;

  lines.push("");
  lines.push(commonPriceFoot);
  return lines.join("\n");
}

/** =========================
 * G) 購買流程（自然收斂、不制式）
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
    };
    u.state.lastMenu = "buy_flow";
  });
}
function stopBuying(userId) {
  updateUser(userId, (u) => {
    u.draft.buying = { active: false, method: null, itemsText: null, name: null, phone: null, address: null };
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
    base.push("再留：聯絡姓名＋電話（方便保留並確認取貨時間）");
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

  const raw = String(rawText || "").trim;
  const n = normalizeSoupAlias(normalizeText(raw));

  if (n === "0" || n === "選單") {
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

  if (!b.itemsText && hasItemSignal) {
    updateUser(userId, (x) => {
      x.draft.buying.itemsText = normalizeSoupAlias(raw);
    });

    if (b.method === "pickup") return { reply: "收到🙂\n接著麻煩留：聯絡姓名＋電話（例：王小明 0912xxxxxx）", menu: "buy_menu" };
    if (b.method === "deliver") return { reply: "收到🙂\n接著麻煩貼：收件姓名＋電話＋地址\n我會先看地址是否在台北/新北；若不便親送會協助改宅配/店到店🙂", menu: "buy_menu" };
    if (b.method === "home") return { reply: "收到🙂\n接著麻煩貼：收件姓名＋電話＋地址", menu: "buy_menu" };
    if (b.method === "c2c") return { reply: "收到🙂\n接著麻煩貼：收件人姓名＋電話 + 取貨門市（店名/店號/地址）", menu: "buy_menu" };
  }

  const digits = safeDigits(raw);
  const hasPhone = digits.length >= 8 && digits.length <= 15;

  updateUser(userId, (x) => {
    const cur = x.draft.buying;

    if (hasPhone) cur.phone = digits;

    const looksLikeAddress =
      raw.length >= 6 && (raw.includes("路") || raw.includes("街") || raw.includes("巷") || raw.includes("號") || raw.includes("樓") || raw.includes("段") || raw.includes("弄"));

    if ((cur.method === "home" || cur.method === "deliver") && looksLikeAddress) cur.address = raw.trim;

    if (cur.method === "c2c" && includesAny(raw, ["門市", "店", "路", "街", "號", "全家", "7-11", "711", "萊爾富", "OK"])) {
      cur.address = raw.trim;
    }

    const nn = normalizeText(raw.replace(digits, ""));
    const nameCandidateOk =
      nn.length >= 2 &&
      nn.length <= 10 &&
      !includesAny(nn, ["路", "街", "巷", "號", "樓", "段", "弄", "台北", "新北", "市", "縣", "門市", "店"]);

    if (nameCandidateOk) cur.name = nn.trim;
  });

  const latest = ensureUser(userId).draft.buying;

  const need = [];
  if (!latest.itemsText) need.push("品項＋數量");

  if (latest.method === "pickup") {
    if (!latest.name) need.push("姓名");
    if (!latest.phone) need.push("電話");
    if (need.length) return { reply: `我有看到🙂 目前我還需要：${need.join("、")}`, menu: "buy_menu" };

    const summary = [
      "✅ 已收到到店自取資訊，我先幫您保留：",
      `品項：${latest.itemsText}`,
      `聯絡：${latest.name} ${latest.phone}`,
      "",
      `取貨時間：${STORE.hours.pickupLate}`,
      `週末：${STORE.hours.weekend}`,
      `地址：${STORE.address}`,
      "",
      "我這邊會再跟您確認可取貨的時間點🙂",
      "（回 0 可回主選單）",
    ].join("\n");

    stopBuying(userId);
    return { reply: summary, menu: "buy_menu" };
  }

  if (latest.method === "c2c") {
    if (!latest.name) need.push("姓名");
    if (!latest.phone) need.push("電話");
    if (!latest.address) need.push("取貨門市（店名/店號/地址）");
    if (need.length) return { reply: `收到🙂 目前我還需要：${need.join("、")}（可一次貼一段）`, menu: "buy_menu" };

    const summary = [
      "✅ 已收到店到店資訊：",
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

  if (!latest.name) need.push("姓名");
  if (!latest.phone) need.push("電話");
  if (!latest.address) need.push("地址");
  if (need.length) return { reply: `收到🙂 目前我還需要：${need.join("、")}（可一次貼一段）`, menu: "buy_menu" };

  if (latest.method === "deliver") {
    const ok = isShuangbeiCity(latest.address);
    const note = ok
      ? "✅ 地址看起來在雙北，我會再確認是否方便順路安排親送🙂"
      : "我看地址可能不在雙北/不便親送，我會優先用宅配或店到店幫您安排🙂";

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

/** =========================
 * H) 敏感問題導流（保護你）
 * ========================= */
const SENSITIVE = [
  "孕婦","懷孕","備孕","哺乳","餵母乳","慢性病","三高","高血壓","糖尿病","洗腎","肝","心臟","癌","癌症","化療","放療","手術","術後",
  "用藥","抗凝血","阿斯匹靈","warfarin","能不能吃","可以吃嗎","適不適合","副作用","禁忌",
];
function sensitiveText {
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
 * I) 24h 追蹤（保留）
 * ========================= */
async function scanAndSendFollowups {
  const users = loadUsers;
  const now = Date.now;
  const dueMs = 24 * 60 * 60 * 1000;
  let changed = false;

  for (const [userId, u] of Object.entries(users)) {
    if (!u || !u.followedAt) continue;
    if (u.followupSent) continue;
    if (now - u.followedAt < dueMs) continue;

    try {
      await client.pushMessage(userId, textMessage(`您好🙂 需要主選單請回：0 或回「選單」\n要真人協助請回：6`, "main"));
      users[userId].followupSent = true;
      users[userId].followupSentAt = Date.now;
      changed = true;
    } catch (err) {
      console.error("24h 推播失敗：", userId, err?.message || err);
    }
  }
  if (changed) saveUsers(users);
}
cron.schedule("*/10 * * * *",  => scanAndSendFollowups.catch( => {}));

/** =========================
 * J) Webhook
 * ========================= */
app.get("/", (req, res) => res.status(200).send("OK"));

app.post("/webhook", line.middleware(config), async (req, res) => {
  try {
    const events = req.body.events || [];
    await Promise.all(events.map(handleEvent));
    res.status(200).end;
  } catch (err) {
    console.error("Webhook error:", err);
    res.status(500).end;
  }
});

async function handleEvent(event) {
  if (event.type === "follow") {
    const userId = event.source && event.source.userId;
    if (userId) {
      const users = loadUsers;
      users[userId] = users[userId] || {};
      users[userId].followedAt = users[userId].followedAt || Date.now;
      users[userId].followupSent = users[userId].followupSent || false;
      users[userId].state = users[userId].state || {};
      users[userId].draft = users[userId].draft || {};
      saveUsers(users);
      ensureUser(userId);
      return client.replyMessage(event.replyToken, textMessage(mainMenuText(userId), "main"));
    }
    return client.replyMessage(event.replyToken, textMessage("您好🙂 請回 0 或回「選單」叫出主選單。", "main"));
  }

  if (event.type !== "message") return null;
  if (!event.message || event.message.type !== "text") return null;

  const userId = event.source && event.source.userId;
  const userTextRaw = event.message.text || "";
  if (!userId) return client.replyMessage(event.replyToken, textMessage("您好🙂 請回 0 或回「選單」叫出主選單。", "main"));

  const rawNorm = normalizeSoupAlias(normalizeText(userTextRaw));
  const user = ensureUser(userId);

  /** 0) 真人模式開關（最優先） */
  if (rawNorm === "解除真人" || rawNorm === "取消真人" || rawNorm === "恢復自動") {
    setHumanMode(userId, false);
    stopBuying(userId);
    updateUser(userId, (u) => {
      u.state.lastMenu = "main";
      u.state.lastProductKey = null;
    });
    return client.replyMessage(event.replyToken, textMessage(mainMenuText(userId), "main"));
  }
  if (rawNorm === "6" || rawNorm.includes("真人") || rawNorm.includes("人工") || rawNorm.includes("客服")) {
    setHumanMode(userId, true);
    stopBuying(userId);
    updateUser(userId, (u) => {
      u.state.lastMenu = "human";
    });
    return client.replyMessage(event.replyToken, textMessage(STORE.humanModeNote, "main"));
  }

  if (user.state.humanMode) {
    if (rawNorm === "0" || rawNorm === "選單") {
      setHumanMode(userId, false);
      stopBuying(userId);
      updateUser(userId, (u) => {
        u.state.lastMenu = "main";
        u.state.lastProductKey = null;
      });
      return client.replyMessage(event.replyToken, textMessage(mainMenuText(userId), "main"));
    }
    return client.replyMessage(event.replyToken, textMessage("我有收到🙂 已轉真人協助中。\n要回主選單回：0 或回「選單」\n要解除真人回：解除真人", "main"));
  }

  /** 1) 0 / 選單 回主選單（任何時候） */
  if (rawNorm === "0" || rawNorm === "主選單" || rawNorm === "選單" || rawNorm === "menu") {
    stopBuying(userId);
    updateUser(userId, (u) => {
      u.state.lastMenu = "main";
      u.state.lastProductKey = null;
    });
    return client.replyMessage(event.replyToken, textMessage(mainMenuText(userId), "main"));
  }

  /** 2) 購買流程中 → 先吃掉（避免雙回覆） */
  const buyingHandled = tryHandleBuyingFlow(userId, userTextRaw);
  if (buyingHandled) {
    return client.replyMessage(event.replyToken, textMessage(buyingHandled.reply, buyingHandled.menu || "buy_menu"));
  }

  /** 3) 敏感問題導流（保護你） */
  if (includesAny(rawNorm, SENSITIVE)) {
    return client.replyMessage(event.replyToken, textMessage(sensitiveText, "main"));
  }

  /** 4) 代碼選單（全部 ≤ 2 位數） */
  const code = rawNorm;

  if (["1", "2", "3", "4", "5", "7"].includes(code)) {
    if (code === "1") {
      updateUser(userId, (u) => { u.state.lastMenu = "product_menu"; });
      return client.replyMessage(event.replyToken, textMessage(productMenuText, "product_menu"));
    }
    if (code === "2") {
      updateUser(userId, (u) => { u.state.lastMenu = "spec_menu"; });
      return client.replyMessage(event.replyToken, textMessage(specMenuText, "spec_menu"));
    }
    if (code === "3") {
      updateUser(userId, (u) => { u.state.lastMenu = "price_menu"; });
      return client.replyMessage(event.replyToken, textMessage(priceMenuText, "price_menu"));
    }
    if (code === "4") {
      updateUser(userId, (u) => { u.state.lastMenu = "buy_menu"; });
      return client.replyMessage(event.replyToken, textMessage(buyMenuText(userId), "buy_menu"));
    }
    if (code === "5") {
      updateUser(userId, (u) => { u.state.lastMenu = "store_menu"; });
      return client.replyMessage(event.replyToken, textMessage(storeInfoText, "store_menu"));
    }
    if (code === "7") {
      updateUser(userId, (u) => { u.state.lastMenu = "main"; });
      return client.replyMessage(event.replyToken, textMessage(`官網（品牌介紹／產品資訊）：\n${STORE.website}\n\n（回 0 可回主選單）`, "main"));
    }
  }

  if (["11", "12", "13", "14"].includes(code)) {
    const map = { "11": "gel", "12": "drink", "13": "antler", "14": "soup" };
    const key = map[code];
    updateUser(userId, (u) => {
      u.state.lastMenu = "product_page";
      u.state.lastProductKey = key;
    });
    const priceCode = STORE.products[key].priceCode;
    return client.replyMessage(event.replyToken, textMessage(productIntroText(userId, key), "product_page", { priceCode }));
  }

  if (["31", "32", "33", "34"].includes(code)) {
    const map = { "31": "gel", "32": "drink", "33": "antler", "34": "soup" };
    const key = map[code];
    updateUser(userId, (u) => {
      u.state.lastMenu = "spec_menu";
      u.state.lastProductKey = key;
    });
    return client.replyMessage(event.replyToken, textMessage(productSpecText(key), "spec_menu"));
  }

  if (["51", "52", "53", "54"].includes(code)) {
    updateUser(userId, (u) => { u.state.lastMenu = "price_menu"; });

    if (code === "51") return client.replyMessage(event.replyToken, textMessage(productPriceText("gel"), "price_page"));
    if (code === "52") return client.replyMessage(event.replyToken, textMessage(productPriceText("drink"), "price_page"));
    if (code === "53") return client.replyMessage(event.replyToken, textMessage(productPriceText("antler"), "price_page"));
    if (code === "54") return client.replyMessage(event.replyToken, textMessage(soupPriceAllText, "price_page"));
  }

  if (["91", "92", "93", "94"].includes(code)) {
    const methodMap = { "91": "home", "92": "c2c", "93": "deliver", "94": "pickup" };
    const method = methodMap[code];
    startBuying(userId, method);
    return client.replyMessage(event.replyToken, textMessage(buyMethodExplain(method), "buy_menu"));
  }

  /** 5) 自然語句導引（不靠代碼也能用） */
  if (rawNorm.includes("官網") || rawNorm.includes("網址") || rawNorm.includes("網站")) {
    return client.replyMessage(event.replyToken, textMessage(`官網（品牌介紹／產品資訊）：\n${STORE.website}\n\n（回 0 可回主選單）`, "main"));
  }
  if (rawNorm.includes("門市") || rawNorm.includes("地址") || rawNorm.includes("電話") || rawNorm.includes("營業")) {
    return client.replyMessage(event.replyToken, textMessage(storeInfoText, "store_menu"));
  }
  if (rawNorm.includes("價格") || rawNorm.includes("價錢") || rawNorm.includes("售價") || rawNorm.includes("報價")) {
    return client.replyMessage(event.replyToken, textMessage(priceMenuText, "price_menu"));
  }
  if (rawNorm.includes("規格") || rawNorm.includes("容量") || rawNorm.includes("幾g") || rawNorm.includes("幾cc") || rawNorm.includes("重量")) {
    return client.replyMessage(event.replyToken, textMessage(specMenuText, "spec_menu"));
  }
  if (rawNorm.includes("購買") || rawNorm.includes("怎麼買") || rawNorm.includes("下單") || rawNorm.includes("訂購") || rawNorm.includes("宅配") || rawNorm.includes("店到店") || rawNorm.includes("自取") || rawNorm.includes("親送")) {
    return client.replyMessage(event.replyToken, textMessage(buyMenuText(userId), "buy_menu"));
  }

  /** 6) Fallback */
  const fallback = rotatePick(userId, "fallback", [
    "我有收到🙂\n要叫出主選單請回：0 或回「選單」\n也可以直接回：1 產品介紹、3 價格、4 購買方式",
    "收到🙂\n要查詢請回：0 或回「選單」\n或直接回：1 產品介紹／3 價格／4 購買方式，我會帶您走。",
  ]);

  updateUser(userId, (u) => { u.state.lastMenu = "main"; });
  return client.replyMessage(event.replyToken, textMessage(fallback, "main"));
}

app.listen(PORT,  => console.log(`LINE bot webhook listening on port ${PORT}`));
