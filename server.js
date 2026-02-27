"use strict";

/**
 * 仙加味・龜鹿 LINE Bot（整包替換版 v2）
 *
 * ✅ 本版重點
 * 1) 客人問「龜鹿仙膠/龜鹿二仙膠/龜鹿膠」→ 統一視為「龜鹿湯塊（膠）」
 * 2) 加「雙北親送」地址判斷：非台北/新北 → 引導改宅配/店到店
 * 3) 購買流程改成：先選「購買方式」→ 再問「品項+數量」→ 再問聯絡/寄送資訊（更像真人）
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
 * A) 店家/產品資料（售價 + 9折活動價）
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

  promoRate: 0.9,
  promoLabel: "目前活動價（售價9折）",

  localDeliveryLabel: "雙北親送",
  localDeliveryAreasHint: "限台北市／新北市（依距離與時段安排，運費另計）",

  products: {
    gel: {
      name: "龜鹿膏",
      spec: "100g/罐",
      priceList: 1800,
      promoEnabled: true,
      noteDays: "依每個人食用習慣不同，一罐大約可吃10天～半個月左右。",
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
      priceList: 200,
      promoEnabled: true,
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
      priceList: 2000,
      promoEnabled: true,
      usage: [
        "一般建議：先從小量開始，搭配溫水或飲品",
        "若容易上火、睡不好或口乾，建議減量或間隔食用",
      ],
    },

    soup: {
      // ✅ 統一名稱：湯塊（膠）
      name: "龜鹿湯塊（膠）",
      variants: [
        { key: "soup600", label: "一斤", spec: "600g", priceList: 8000, promoEnabled: true },
        { key: "soup300", label: "半斤", spec: "300g", priceList: 4000, promoEnabled: true },
        { key: "soup150", label: "4兩", spec: "150g", priceList: 2000, promoEnabled: false }, // 取消活動價
        { key: "soup75",  label: "2兩", spec: "75g",  priceList: 1000, promoEnabled: false },  // 新增
      ],
      usage: [
        "依個人口味加水煮滾，可搭配肉類/食材燉煮",
        "建議熱飲熱食，避免冰冷搭配",
      ],
      packNote: "目前為傳統盒裝（依現場/出貨包裝為準）。",
    },
  },

  testingNote:
    "目前我們可提供八大營養素等基本資訊（依批次/包裝標示為準）。如需更詳細資料，歡迎留言，我們整理後回覆您。",
  paymentNote:
    "付款方式可依訂單安排（如：轉帳等）。我整理好訂單後會一併提供付款資訊。",
  shippingNote:
    "可安排宅配／超商店到店／雙北親送／到店購買（依地區與品項而定）。我收到購買方式後會接著協助您完成🙂",
};

/** =========================
 * B) 工具
 * ========================= */
function money(n) {
  const s = String(Number(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `NT$${s}`;
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
function roundMoney(n) {
  return Math.round(Number(n));
}
function promoPrice(listPrice) {
  return roundMoney(listPrice * STORE.promoRate);
}
function looksLikePhone(rawText) {
  const digits = String(rawText || "").replace(/[^\d]/g, "");
  return digits.length >= 8 && digits.length <= 15;
}
function normalizePhone(rawText) {
  return String(rawText || "").replace(/[^\d]/g, "");
}

/** 地址判斷（雙北親送用） */
function isTaipeiOrNewTaipei(addr) {
  const t = String(addr || "").replace(/\s+/g, "");
  // 常見寫法：台北/臺北/新北/臺北市/新北市
  return /(台北|臺北|新北)/.test(t);
}

/** =========================
 * C) Quick Replies（改成「購買方式」）
 * ========================= */
function quickRepliesCommon() {
  return {
    items: [
      { type: "action", action: { type: "message", label: "諮詢", text: "諮詢" } },
      { type: "action", action: { type: "message", label: "產品名", text: "產品名" } },
      { type: "action", action: { type: "message", label: "價格", text: "價格" } },
      { type: "action", action: { type: "message", label: "容量", text: "容量" } },
      { type: "action", action: { type: "message", label: "湯塊價格", text: "湯塊價格" } },
      { type: "action", action: { type: "message", label: "購買方式", text: "購買方式" } },
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
    templateCounter: {},
  };

  // ✅ 新流程：購買方式先選
  users[userId].order = users[userId].order || {
    active: false,
    step: null,          // "method" | "items" | "name" | "phone" | "shipInfo" | "done"
    method: null,        // "home" | "store" | "local" | "pickup"
    items: [],
    name: null,
    phone: null,
    shipInfo: null,      // 地址 or 門市資訊
    shipNote: null,      // 選填：希望到貨時段/備註
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
  users[userId].state = users[userId].state || { lastProductKey: null, lastSeenAt: Date.now(), templateCounter: {} };
  users[userId].order = users[userId].order || {
    active: false, step: null, method: null, items: [], name: null, phone: null, shipInfo: null, shipNote: null, updatedAt: Date.now()
  };
  patchFn(users[userId]);
  users[userId].state.lastSeenAt = Date.now();
  users[userId].order.updatedAt = Date.now();
  saveUsers(users);
}
function resetOrder(userId) {
  updateUser(userId, (u) => {
    u.order = { active: false, step: null, method: null, items: [], name: null, phone: null, shipInfo: null, shipNote: null, updatedAt: Date.now() };
  });
}

/** =========================
 * E) 模板輪替工具
 * ========================= */
function pickVariant(userState, key, variants) {
  const c = userState.templateCounter?.[key] ?? 0;
  return variants[c % variants.length];
}
function bumpVariant(userId, key) {
  updateUser(userId, (u) => {
    u.state.templateCounter = u.state.templateCounter || {};
    u.state.templateCounter[key] = (u.state.templateCounter[key] || 0) + 1;
  });
}

/** =========================
 * F) 文案：價格/規格/清單（官網不放價格 OK）
 * ========================= */
function formatPriceLine(name, spec, listPrice, promoEnabled) {
  const lines = [];
  lines.push(`${name}｜${spec}`);
  lines.push(`售價 ${money(listPrice)}`);
  if (promoEnabled) lines.push(`${STORE.promoLabel} ${money(promoPrice(listPrice))}`);
  return lines.join("\n");
}

function pricingAll() {
  const p = STORE.products;
  return [
    "【價格資訊】",
    "",
    formatPriceLine("龜鹿膏", p.gel.spec, p.gel.priceList, p.gel.promoEnabled),
    "",
    formatPriceLine("龜鹿飲", p.drink.spec, p.drink.priceList, p.drink.promoEnabled),
    "",
    formatPriceLine("鹿茸粉", p.antler.spec, p.antler.priceList, p.antler.promoEnabled),
    "",
    `龜鹿湯塊（膠）：輸入「湯塊價格」可看所有規格`,
    "",
    "若要我直接協助購買：回覆「購買方式」🙂",
  ].join("\n");
}

function specsAll() {
  const p = STORE.products;
  return [
    "【容量／規格】",
    `▪️ 龜鹿膏：${p.gel.spec}`,
    `▪️ 龜鹿飲：${p.drink.spec}`,
    `▪️ 鹿茸粉：${p.antler.spec}`,
    "▪️ 龜鹿湯塊（膠）：一斤600g／半斤300g／4兩150g／2兩75g",
  ].join("\n");
}

function productListText() {
  const p = STORE.products;
  return [
    "【產品清單】",
    `▪️ 龜鹿膏（${p.gel.spec}）`,
    `▪️ 龜鹿飲（${p.drink.spec}）`,
    `▪️ 鹿茸粉（75g/罐）`,
    "▪️ 龜鹿湯塊（膠）（一斤600g／半斤300g／4兩150g／2兩75g）",
    "",
    "想看：價格 → 回「價格」",
    "想購買：回「購買方式」🙂",
  ].join("\n");
}

function soupPriceAll() {
  const p = STORE.products.soup;
  const lines = ["【龜鹿湯塊（膠）｜規格與價格】", p.packNote, ""];
  for (const v of p.variants) {
    lines.push(`▪ ${v.label}（${v.spec}）`);
    lines.push(`售價 ${money(v.priceList)}`);
    if (v.promoEnabled) lines.push(`${STORE.promoLabel} ${money(promoPrice(v.priceList))}`);
    lines.push("");
  }
  while (lines.length && lines[lines.length - 1] === "") lines.pop();
  return lines.join("\n");
}

function soupUsageText() {
  const p = STORE.products.soup;
  return [
    "【龜鹿湯塊（膠）｜使用建議】",
    ...p.usage.map((x) => `• ${x}`),
    "",
    "想看規格價格：回「湯塊價格」",
    "想直接購買：回「購買方式」🙂",
  ].join("\n");
}

function gelFullText() {
  const p = STORE.products.gel;
  return [
    `【龜鹿膏｜${p.spec}】`,
    "",
    `售價 ${money(p.priceList)}`,
    `${STORE.promoLabel} ${money(promoPrice(p.priceList))}`,
    "",
    p.noteDays,
    "",
    "食用建議：",
    ...p.usage.map((x) => `• ${x}`),
    "",
    "想直接購買：回「購買方式」🙂",
  ].join("\n");
}

function drinkText() {
  const p = STORE.products.drink;
  return [
    `【龜鹿飲｜${p.spec}】`,
    "",
    `售價 ${money(p.priceList)}`,
    `${STORE.promoLabel} ${money(promoPrice(p.priceList))}`,
    "",
    "飲用方式：",
    ...p.usage.map((x) => `• ${x}`),
    "",
    "想直接購買：回「購買方式」🙂",
  ].join("\n");
}

function antlerText() {
  const p = STORE.products.antler;
  return [
    `【鹿茸粉｜${p.spec}】`,
    "",
    `售價 ${money(p.priceList)}`,
    `${STORE.promoLabel} ${money(promoPrice(p.priceList))}`,
    "",
    "食用建議：",
    ...p.usage.map((x) => `• ${x}`),
    "",
    "想直接購買：回「購買方式」🙂",
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

/** =========================
 * G) 「龜鹿仙膠/龜鹿二仙膠/龜鹿膠」統一回覆
 * ========================= */
function soupAliasUnifiedReply() {
  return [
    "您說的「龜鹿仙膠／龜鹿二仙膠／龜鹿膠」",
    "我們這邊統一就是「龜鹿湯塊（膠）」😊",
    "",
    "想看規格價格：回「湯塊價格」",
    "想直接購買：回「購買方式」🙂",
  ].join("\n");
}

/** =========================
 * H) 不機械化：購買方式引導
 * ========================= */
function purchaseMethodText() {
  return [
    "可以的😊 我先確認您比較方便哪一種「購買方式」：",
    "",
    "回覆 1～4 即可👇",
    "1) 宅配到府",
    "2) 超商店到店",
    `3) ${STORE.localDeliveryLabel}（${STORE.localDeliveryAreasHint}）`,
    "4) 到店購買",
    "",
    "（您也可以直接回：宅配 / 店到店 / 親送 / 到店）",
  ].join("\n");
}

function purchaseAskItemsText(method) {
  const methodName =
    method === "home" ? "宅配到府" :
    method === "store" ? "超商店到店" :
    method === "local" ? STORE.localDeliveryLabel :
    "到店購買";

  return [
    `好～了解您要「${methodName}」😊`,
    "",
    "那您想買哪些品項跟數量呢？",
    "可以直接這樣打：",
    "例：龜鹿膏2罐 / 龜鹿飲10包 / 湯塊半斤1份",
    "",
    "（湯塊若沒寫規格，我也會再跟您確認）",
  ].join("\n");
}

function purchaseAskNameText() {
  return "方便留一下收件人姓名嗎？🙂";
}
function purchaseAskPhoneText() {
  return "再麻煩留一支聯絡電話（方便出貨/配送聯繫）🙂";
}
function purchaseAskShipInfoText(method) {
  if (method === "home") return "好的～請貼上收件地址（含縣市區路段門牌）🙂";
  if (method === "store") return "好的～請回覆超商品牌＋門市名稱（或店號）🙂\n例：7-11 西昌門市 / 全家 萬大店";
  if (method === "local") {
    return [
      `好的～${STORE.localDeliveryLabel}請貼上「收件地址」（台北/新北）🙂`,
      "也可以加一行備註希望到貨時段（例如：晚上6點後/下午1-5）",
    ].join("\n");
  }
  // pickup
  return [
    "好的～那您預計什麼時間方便來店裡呢？（大概時間即可）🙂",
    "也可以直接來之前先來電確認：",
    `tel:${STORE.phoneTel}`,
  ].join("\n");
}

function orderSummaryText(order) {
  const lines = [];
  const items = order.items || [];
  if (items.length === 0) return "";

  lines.push("我先幫您整理目前想購買的內容（有誤可直接更正）👇");
  lines.push("");

  for (const it of items) {
    if (it.key === "soupGeneric") {
      lines.push(`▪️ 龜鹿湯塊（膠）× ${it.qty} ${it.unit}（待確認規格：2兩/4兩/半斤/一斤）`);
      continue;
    }
    if (typeof it.unitPrice === "number") {
      lines.push(`▪️ ${it.name} × ${it.qty} ${it.unit}（單價 ${money(it.unitPrice)}/${it.unit}）`);
    } else {
      lines.push(`▪️ ${it.name} × ${it.qty} ${it.unit}`);
    }
  }

  const subtotal = items.reduce((sum, it) => sum + (typeof it.unitPrice === "number" ? it.unitPrice * it.qty : 0), 0);
  if (subtotal > 0) {
    lines.push("");
    lines.push(`小計（未含運）：${money(subtotal)}`);
  }
  return lines.join("\n");
}

/** =========================
 * I) 意圖詞庫（新增：購買方式、到店購買）
 * ========================= */
const INTENT = {
  consult: ["諮詢","客服","真人","專人","有人嗎","請協助","幫我"],
  pricing: ["價格","價錢","售價","多少錢","幾錢","活動","折扣","報價","批發"],
  specs: ["容量","規格","幾克","幾g","g","公克","克","幾cc","cc","毫升","ml","多少量","重量"],
  productList: ["產品名","有哪些產品","有什麼產品","產品","商品","品項","商品清單","品項清單"],

  // ✅ 改名：購買方式（仍支援怎麼買/下單）
  purchase: ["購買方式","怎麼買","怎麼購買","下單","訂購","購買","我要買","訂單","訂購方式","怎麼訂"],

  shipping: ["運送","寄送","運費","到貨","配送","宅配","超商","店到店","多久到","幾天到","親送","雙北","到店購買"],
  payment: ["付款","怎麼付","轉帳","匯款","刷卡","貨到付款","付款方式"],
  testing: ["檢驗","報告","檢測","八大營養素","合格","安全","驗證"],
  store: ["門市","店面","地址","在哪","位置","怎麼去","地圖","電話","聯絡","營業時間"],
  website: ["官網","網站","網址","連結"],

  soupPrice: ["湯塊價格","湯塊售價","湯塊多少錢","湯塊價錢","湯塊"],
  whatIs: ["什麼是","是什麼","介紹","內容","什麼叫"],

  gel: ["龜鹿膏"],
  drink: ["龜鹿飲"],
  antler: ["鹿茸粉"],

  // ✅ 統一歸類湯塊（膠）：客人問仙膠/二仙膠/龜鹿膠都進來
  soupAliases: ["龜鹿湯塊","湯塊","龜鹿膠","龜鹿仙膠","龜鹿二仙膠","二仙膠","仙膠"],

  sensitive: [
    "孕婦","懷孕","備孕","哺乳","餵母乳",
    "慢性病","三高","高血壓","糖尿病","洗腎","肝","心臟",
    "癌","癌症","化療","放療","手術","術後",
    "用藥","抗凝血","阿斯匹靈","warfarin",
    "能不能吃","可以吃嗎","適不適合","副作用","禁忌"
  ],
  cancel: ["取消","不用了","先不要","改天","取消下單","取消訂單"],

  methodHome: ["1","宅配","到府","寄到家","送到家"],
  methodStore: ["2","店到店","超商","便利商店","7-11","全家","萊爾富","OK"],
  methodLocal: ["3","親送","雙北親送","雙北","台北親送","新北親送"],
  methodPickup: ["4","到店","到店購買","門市自取","自取","現場"],

  soupSize600: ["一斤","600g","600公克"],
  soupSize300: ["半斤","300g","300公克"],
  soupSize150: ["4兩","四兩","150g","150公克"],
  soupSize75:  ["2兩","二兩","75g","75公克"],
};

function detectIntents(raw) {
  const intents = new Set();

  if (includesAny(raw, INTENT.sensitive)) intents.add("sensitive");
  if (includesAny(raw, INTENT.cancel)) intents.add("cancel");

  // ✅ 只要提到仙膠/龜鹿膠等，視為湯塊
  if (includesAny(raw, INTENT.soupAliases)) intents.add("soup");

  // 什麼是 + 仙膠/龜鹿膠/湯塊 → 統一說湯塊（膠）
  if (includesAny(raw, INTENT.whatIs) && includesAny(raw, INTENT.soupAliases)) intents.add("whatIsSoupUnified");

  if (includesAny(raw, INTENT.consult)) intents.add("consult");
  if (includesAny(raw, INTENT.productList)) intents.add("productList");
  if (includesAny(raw, INTENT.pricing)) intents.add("pricing");
  if (includesAny(raw, INTENT.specs)) intents.add("specs");
  if (includesAny(raw, INTENT.purchase)) intents.add("purchase");
  if (includesAny(raw, INTENT.shipping)) intents.add("shipping");
  if (includesAny(raw, INTENT.payment)) intents.add("payment");
  if (includesAny(raw, INTENT.testing)) intents.add("testing");
  if (includesAny(raw, INTENT.store)) intents.add("store");
  if (includesAny(raw, INTENT.website)) intents.add("website");
  if (includesAny(raw, INTENT.soupPrice)) intents.add("soupPrice");

  // 個別產品（用於「只打產品名」）
  if (includesAny(raw, INTENT.gel)) intents.add("gel");
  if (includesAny(raw, INTENT.drink)) intents.add("drink");
  if (includesAny(raw, INTENT.antler)) intents.add("antler");

  return Array.from(intents);
}

function sortIntents(intents) {
  const priority = [
    "sensitive",
    "cancel",
    "whatIsSoupUnified",
    "purchase",
    "consult",
    "soupPrice",
    "pricing",
    "specs",
    "productList",
    "shipping",
    "payment",
    "testing",
    "store",
    "website",
    "gel",
    "drink",
    "antler",
    "soup",
  ];
  const rank = new Map(priority.map((k, i) => [k, i]));
  return [...intents].sort((a, b) => (rank.get(a) ?? 999) - (rank.get(b) ?? 999));
}

/** =========================
 * J) 訂單解析（品項＋數量）
 * - 新流程：先選 method，再 parse items
 * ========================= */
function extractQtyUnit(text) {
  const m = String(text || "").match(/([0-9]{1,3}|一|二|兩|三|四|五|六|七|八|九|十)\s*(罐|包|盒|組|份|個)/);
  if (!m) return null;
  const rawNum = m[1];
  const unit = m[2];
  const qty = /^[0-9]+$/.test(rawNum) ? safeInt(rawNum) : cnNumToInt(rawNum);
  if (!qty || qty <= 0) return null;
  return { qty, unit };
}

function defaultUnitByKey(key) {
  if (key === "gel") return "罐";
  if (key === "drink") return "包";
  if (key === "antler") return "罐";
  if (String(key).startsWith("soup")) return "份";
  return "份";
}

function unitPriceByKey(key) {
  const p = STORE.products;
  if (key === "gel") return p.gel.promoEnabled ? promoPrice(p.gel.priceList) : p.gel.priceList;
  if (key === "drink") return p.drink.promoEnabled ? promoPrice(p.drink.priceList) : p.drink.priceList;
  if (key === "antler") return p.antler.promoEnabled ? promoPrice(p.antler.priceList) : p.antler.priceList;

  const v = p.soup.variants.find((x) => x.key === key);
  if (!v) return null;
  return v.promoEnabled ? promoPrice(v.priceList) : v.priceList;
}

function detectSoupVariantKey(rawText) {
  if (includesAny(rawText, INTENT.soupSize600)) return "soup600";
  if (includesAny(rawText, INTENT.soupSize300)) return "soup300";
  if (includesAny(rawText, INTENT.soupSize150)) return "soup150";
  if (includesAny(rawText, INTENT.soupSize75))  return "soup75";
  return null;
}

function parseItemsFromText(rawText) {
  const text = normalizeText(rawText);
  const items = [];
  const hit = (k) => rawText.includes(k);

  // gel
  if (hit("龜鹿膏")) {
    const q = extractQtyUnit(text);
    items.push({
      key: "gel",
      name: "龜鹿膏",
      qty: q?.qty ?? 1,
      unit: q?.unit ?? defaultUnitByKey("gel"),
      unitPrice: unitPriceByKey("gel"),
    });
  }

  // drink
  if (hit("龜鹿飲")) {
    const q = extractQtyUnit(text);
    items.push({
      key: "drink",
      name: "龜鹿飲",
      qty: q?.qty ?? 1,
      unit: q?.unit ?? defaultUnitByKey("drink"),
      unitPrice: unitPriceByKey("drink"),
    });
  }

  // antler
  if (hit("鹿茸粉")) {
    const q = extractQtyUnit(text);
    items.push({
      key: "antler",
      name: "鹿茸粉",
      qty: q?.qty ?? 1,
      unit: q?.unit ?? defaultUnitByKey("antler"),
      unitPrice: unitPriceByKey("antler"),
    });
  }

  // soup aliases（湯塊/仙膠/龜鹿膠/二仙膠）
  if (includesAny(rawText, INTENT.soupAliases)) {
    const variant = detectSoupVariantKey(rawText);
    const q = extractQtyUnit(text);
    const qty = q?.qty ?? 1;
    const unit = q?.unit ?? "份";

    if (variant) {
      const v = STORE.products.soup.variants.find((x) => x.key === variant);
      items.push({
        key: variant,
        name: `龜鹿湯塊（膠）｜${v?.label ?? ""}（${v?.spec ?? ""}）`.trim(),
        qty,
        unit,
        unitPrice: unitPriceByKey(variant),
      });
    } else {
      // 沒寫規格 → 先放 soupGeneric，下一步追問
      items.push({
        key: "soupGeneric",
        name: "龜鹿湯塊（膠）（待確認規格）",
        qty,
        unit,
        unitPrice: null,
      });
    }
  }

  // 合併同 key
  const map = new Map();
  for (const it of items) {
    if (!map.has(it.key)) map.set(it.key, it);
    else {
      const prev = map.get(it.key);
      prev.qty += it.qty;
      map.set(it.key, prev);
    }
  }
  return Array.from(map.values());
}

function hasSoupGeneric(order) {
  return (order.items || []).some((x) => x.key === "soupGeneric");
}

function replaceSoupGeneric(order, targetKey) {
  const qty = order.items.find((x) => x.key === "soupGeneric")?.qty ?? 1;
  const unit = order.items.find((x) => x.key === "soupGeneric")?.unit ?? "份";
  const v = STORE.products.soup.variants.find((x) => x.key === targetKey);
  order.items = (order.items || []).filter((x) => x.key !== "soupGeneric");
  order.items.push({
    key: targetKey,
    name: `龜鹿湯塊（膠）｜${v?.label ?? ""}（${v?.spec ?? ""}）`.trim(),
    qty,
    unit,
    unitPrice: unitPriceByKey(targetKey),
  });
}

/** =========================
 * K) 訂單流程（新）
 * step: method → items → soupSpec? → name → phone → shipInfo → done
 * ========================= */
function computeNextStep(order) {
  if (!order.active) return null;
  if (!order.method) return "method";
  if (!order.items || order.items.length === 0) return "items";
  if (hasSoupGeneric(order)) return "soupSpec";
  if (!order.name) return "name";
  if (!order.phone) return "phone";
  if (order.method !== "pickup" && !order.shipInfo) return "shipInfo";
  if (order.method === "pickup" && !order.shipInfo) return "shipInfo"; // 到店購買：shipInfo 用「預計到店時間」
  return "done";
}

function startPurchaseFlow(userId) {
  updateUser(userId, (u) => {
    u.order.active = true;
    u.order.step = "method";
  });
}

function applyMethodFromText(rawText) {
  const t = String(rawText || "").trim();
  if (t === "1" || includesAny(rawText, ["宅配", "到府", "寄到家", "送到家"])) return "home";
  if (t === "2" || includesAny(rawText, ["店到店", "超商", "7-11", "全家", "萊爾富", "OK"])) return "store";
  if (t === "3" || includesAny(rawText, ["親送", "雙北"])) return "local";
  if (t === "4" || includesAny(rawText, ["到店", "到店購買", "自取", "現場", "門市"])) return "pickup";
  return null;
}

function handleOrderFlow(userId, rawText) {
  const user = ensureUser(userId);
  const order = user.order;
  if (!order.active) return { handled: false, reply: null };

  const step = computeNextStep(order);

  // 取消
  if (includesAny(rawText, INTENT.cancel)) {
    resetOrder(userId);
    return { handled: true, reply: "好的～已先幫您把本次購買流程暫停🙂\n之後想買再回「購買方式」就可以。" };
  }

  // step: method
  if (step === "method") {
    const method = applyMethodFromText(rawText);
    if (!method) return { handled: true, reply: purchaseMethodText() };

    updateUser(userId, (u) => {
      u.order.method = method;
      u.order.step = "items";
    });

    return { handled: true, reply: purchaseAskItemsText(method) };
  }

  // step: items
  if (step === "items") {
    const items = parseItemsFromText(rawText);
    if (!items || items.length === 0) {
      return {
        handled: true,
        reply: [
          "我有收到～🙂",
          "您可以直接打「品項＋數量」，我比較好幫您整理。",
          "例：龜鹿膏2罐 / 龜鹿飲10包 / 湯塊半斤1份",
          "",
          "想看有哪些產品也可回：產品名",
        ].join("\n"),
      };
    }

    updateUser(userId, (u) => {
      // 合併到 order.items
      const map = new Map((u.order.items || []).map((x) => [x.key, x]));
      for (const it of items) {
        if (!map.has(it.key)) map.set(it.key, it);
        else {
          const prev = map.get(it.key);
          prev.qty += it.qty;
          map.set(it.key, prev);
        }
      }
      u.order.items = Array.from(map.values());
      u.order.step = computeNextStep(u.order);
    });

    const updated = ensureUser(userId).order;
    const summary = orderSummaryText(updated);

    // 下一步如果要問湯塊規格
    if (computeNextStep(updated) === "soupSpec") {
      return {
        handled: true,
        reply: [
          summary,
          "",
          "再跟我確認一下湯塊規格就好🙂 回覆 1～4：",
          "1) 2兩（75g）",
          "2) 4兩（150g）",
          "3) 半斤（300g）",
          "4) 一斤（600g）",
        ].join("\n"),
      };
    }

    return { handled: true, reply: [summary, "", purchaseAskNameText()].join("\n") };
  }

  // step: soupSpec
  if (step === "soupSpec") {
    const t = String(rawText || "").trim();
    let key = null;
    if (t === "1" || includesAny(rawText, INTENT.soupSize75)) key = "soup75";
    else if (t === "2" || includesAny(rawText, INTENT.soupSize150)) key = "soup150";
    else if (t === "3" || includesAny(rawText, INTENT.soupSize300)) key = "soup300";
    else if (t === "4" || includesAny(rawText, INTENT.soupSize600)) key = "soup600";

    if (!key) {
      return {
        handled: true,
        reply: "我再跟您確認一次🙂 湯塊要哪個規格？回覆 1～4：\n1)2兩  2)4兩  3)半斤  4)一斤",
      };
    }

    updateUser(userId, (u) => {
      replaceSoupGeneric(u.order, key);
      u.order.step = computeNextStep(u.order);
    });

    const updated = ensureUser(userId).order;
    return { handled: true, reply: [orderSummaryText(updated), "", purchaseAskNameText()].join("\n") };
  }

  // step: name
  if (step === "name") {
    const name = String(rawText || "").trim();
    if (name.length < 2 || name.length > 20 || looksLikePhone(name)) {
      return { handled: true, reply: "方便留一下收件人姓名（2～20字）🙂" };
    }
    updateUser(userId, (u) => {
      u.order.name = name;
      u.order.step = computeNextStep(u.order);
    });
    return { handled: true, reply: purchaseAskPhoneText() };
  }

  // step: phone
  if (step === "phone") {
    if (!looksLikePhone(rawText)) {
      return { handled: true, reply: "我這邊需要一支可聯絡電話🙂（例如：09xx-xxx-xxx）" };
    }
    updateUser(userId, (u) => {
      u.order.phone = normalizePhone(rawText);
      u.order.step = computeNextStep(u.order);
    });

    const updated = ensureUser(userId).order;
    const next = computeNextStep(updated);

    // 到店購買：直接問到店時間（當作 shipInfo）
    if (updated.method === "pickup") {
      return { handled: true, reply: purchaseAskShipInfoText("pickup") };
    }

    return { handled: true, reply: purchaseAskShipInfoText(updated.method) };
  }

  // step: shipInfo
  if (step === "shipInfo") {
    const updated = ensureUser(userId).order;

    // ✅ 雙北親送地址判斷：非台北/新北 → 改選方式
    if (updated.method === "local") {
      const lines = String(rawText || "").split("\n").map((x) => x.trim()).filter(Boolean);
      const addr = lines[0] || "";
      const note = lines.slice(1).join(" / ");

      if (!isTaipeiOrNewTaipei(addr)) {
        return {
          handled: true,
          reply: [
            "我有收到地址🙂",
            `不過「${STORE.localDeliveryLabel}」目前只提供台北/新北～`,
            "",
            "您想改成哪一種比較方便？回覆 1～2：",
            "1) 宅配到府",
            "2) 超商店到店",
          ].join("\n"),
        };
      }

      updateUser(userId, (u) => {
        u.order.shipInfo = addr;
        u.order.shipNote = note || u.order.shipNote;
        u.order.step = computeNextStep(u.order);
      });
    } else {
      // 宅配/店到店/到店購買（到店購買：填到店時間）
      updateUser(userId, (u) => {
        u.order.shipInfo = String(rawText || "").trim();
        u.order.step = computeNextStep(u.order);
      });
    }

    const final = ensureUser(userId).order;
    const summary = orderSummaryText(final);

    const methodName =
      final.method === "home" ? "宅配到府" :
      final.method === "store" ? "超商店到店" :
      final.method === "local" ? STORE.localDeliveryLabel :
      "到店購買";

    const detailLines = [
      summary,
      "",
      "✅ 我確認一下您這邊的資訊：",
      `購買方式：${methodName}`,
      `姓名：${final.name}`,
      `電話：${final.phone}`,
    ];

    if (final.method === "pickup") {
      detailLines.push(`預計到店：${final.shipInfo}`);
      detailLines.push("");
      detailLines.push("我接著回覆：是否可現貨、保留方式與店內取貨提醒🙂");
    } else {
      detailLines.push(`寄送資訊：${final.shipInfo}`);
      if (final.shipNote) detailLines.push(`備註：${final.shipNote}`);
      detailLines.push("");
      detailLines.push("我接著回覆：運費、到貨方式與付款資訊🙂");
    }

    updateUser(userId, (u) => (u.order.step = "done"));
    return { handled: true, reply: detailLines.join("\n") };
  }

  // step: done
  if (step === "done") {
    return {
      handled: true,
      reply: "收到🙂 如果您要加購/改數量也可以直接跟我說，我再幫您更新。",
    };
  }

  return { handled: false, reply: null };
}

/** =========================
 * L) 一般回覆（不制式 + 連動）
 * ========================= */
const TEXT = {
  testing: ["【檢驗／報告】", "", STORE.testingNote].join("\n"),
  payment: ["【付款方式】", "", STORE.paymentNote].join("\n"),
  shipping: ["【運送／到貨】", "", STORE.shippingNote].join("\n"),
  sensitive: [
    "這部分會因每個人的身體狀況不同，",
    "為了讓您得到更準確的說明與建議，",
    "建議先由合作的中醫師了解您的情況🙂",
    "",
    `➤ Line ID：${STORE.doctorLineId}`,
    "➤ 章無忌中醫師諮詢連結：",
    STORE.doctorLink,
  ].join("\n"),
};

function welcomeText() {
  return [
    `您好，歡迎加入【${STORE.brandName}】😊`,
    "",
    "您可以直接輸入👇",
    "▪️ 諮詢（快速導引）",
    "▪️ 產品名（看有哪些產品）",
    "▪️ 價格 / 售價",
    "▪️ 容量 / 規格",
    "▪️ 湯塊價格",
    "▪️ 購買方式（宅配/店到店/雙北親送/到店購買）",
    "",
    "如果您已經想買，也可以直接回：購買方式🙂",
  ].join("\n");
}

function consultEntryVariants() {
  return [
    [
      `您好😊 這裡是【${STORE.brandName}】`,
      "您想先了解哪一個？",
      "① 龜鹿膏 ② 龜鹿飲 ③ 鹿茸粉 ④ 湯塊（膠）",
      "",
      "想直接買也可以回：購買方式🙂",
    ].join("\n"),
    [
      "您好～我在🙂",
      "您是想看產品/規格/價格，還是要我直接協助購買？",
      "（要買直接回：購買方式）",
    ].join("\n"),
  ];
}

function fallbackVariants() {
  return [
    [
      "我在🙂 你可以直接回：",
      "▪️ 產品名 / 價格 / 容量 / 湯塊價格 / 購買方式",
      "",
      "或直接說：你想了解哪個產品～",
    ].join("\n"),
    [
      "收到～我可以幫您😊",
      "您比較想先看：產品清單、價格、規格，還是購買方式呢？",
    ].join("\n"),
  ];
}

/** =========================
 * M) 24h 追蹤（可保留）
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
        textMessage(`您好😊 這裡是【${STORE.brandName}】\n\n想直接購買可回：購買方式\n想看清單可回：產品名`)
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
 * N) Webhook
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
  if (event.type === "follow") {
    const userId = event.source && event.source.userId;
    if (userId) {
      const users = loadUsers();
      users[userId] = users[userId] || {};
      users[userId].followedAt = users[userId].followedAt || Date.now();
      users[userId].followupSent = users[userId].followupSent || false;
      users[userId].state = users[userId].state || { lastProductKey: null, lastSeenAt: Date.now(), templateCounter: {} };
      users[userId].order = users[userId].order || {
        active: false, step: null, method: null, items: [], name: null, phone: null, shipInfo: null, shipNote: null, updatedAt: Date.now()
      };
      saveUsers(users);
    }
    return client.replyMessage(event.replyToken, textMessage(welcomeText()));
  }

  if (event.type !== "message") return null;
  if (!event.message || event.message.type !== "text") return null;

  const userId = event.source && event.source.userId;
  const userTextRaw = event.message.text || "";
  const raw = normalizeText(userTextRaw);

  if (!userId) {
    return client.replyMessage(event.replyToken, textMessage(fallbackVariants()[0]));
  }

  // 先確保 user
  const user = ensureUser(userId);

  // 1) 若正在購買流程 → 優先處理
  if (user.order && user.order.active) {
    // 特殊：雙北親送地址不符時，客人回 1/2 要直接改 method
    if (user.order.step === "shipInfo" && user.order.method === "local") {
      const t = String(userTextRaw || "").trim();
      if (t === "1") {
        updateUser(userId, (u) => {
          u.order.method = "home";
          u.order.shipInfo = null;
          u.order.shipNote = null;
          u.order.step = "shipInfo";
        });
        return client.replyMessage(event.replyToken, textMessage("好的～那我們改成「宅配到府」🙂\n請貼上收件地址（含縣市區路段門牌）"));
      }
      if (t === "2") {
        updateUser(userId, (u) => {
          u.order.method = "store";
          u.order.shipInfo = null;
          u.order.shipNote = null;
          u.order.step = "shipInfo";
        });
        return client.replyMessage(event.replyToken, textMessage("好的～那我們改成「超商店到店」🙂\n請回覆超商品牌＋門市名稱（或店號）\n例：7-11 西昌門市 / 全家 萬大店"));
      }
    }

    const flow = handleOrderFlow(userId, userTextRaw);
    if (flow.handled) return client.replyMessage(event.replyToken, textMessage(flow.reply));
  }

  // 2) 解析意圖（非流程中）
  let intents = sortIntents(detectIntents(raw));

  // 高敏感
  if (intents.includes("sensitive")) {
    return client.replyMessage(event.replyToken, textMessage(TEXT.sensitive));
  }

  // 取消
  if (intents.includes("cancel")) {
    resetOrder(userId);
    return client.replyMessage(event.replyToken, textMessage("好的～沒問題🙂 需要再跟我說就好。"));
  }

  // ✅ 統一：什麼是龜鹿仙膠/二仙膠/龜鹿膠 → 湯塊（膠）
  if (intents.includes("whatIsSoupUnified")) {
    return client.replyMessage(event.replyToken, textMessage(soupAliasUnifiedReply()));
  }

  // ✅ 客人只打「仙膠/龜鹿膠/二仙膠」不問什麼是 → 也統一回湯塊（膠）導購
  if (intents.includes("soup") && !intents.includes("soupPrice") && !intents.includes("pricing") && !intents.includes("specs")) {
    // 若同時是單純產品聊天，回簡短導購
    if (includesAny(raw, ["龜鹿仙膠","龜鹿二仙膠","龜鹿膠","二仙膠","仙膠"])) {
      return client.replyMessage(event.replyToken, textMessage(soupAliasUnifiedReply()));
    }
  }

  // 直接：購買方式
  if (intents.includes("purchase")) {
    startPurchaseFlow(userId);
    return client.replyMessage(event.replyToken, textMessage(purchaseMethodText()));
  }

  // 產品名 / 價格 / 規格 / 湯塊價格 / 門市 / 官網
  if (intents.includes("productList")) return client.replyMessage(event.replyToken, textMessage(productListText()));
  if (intents.includes("soupPrice")) return client.replyMessage(event.replyToken, textMessage(soupPriceAll()));
  if (intents.includes("pricing")) return client.replyMessage(event.replyToken, textMessage(pricingAll()));
  if (intents.includes("specs")) return client.replyMessage(event.replyToken, textMessage(specsAll()));
  if (intents.includes("store")) return client.replyMessage(event.replyToken, textMessage(storeInfo()));
  if (intents.includes("website")) return client.replyMessage(event.replyToken, textMessage(`官網連結：${STORE.website}`));
  if (intents.includes("testing")) return client.replyMessage(event.replyToken, textMessage(TEXT.testing));
  if (intents.includes("payment")) return client.replyMessage(event.replyToken, textMessage(TEXT.payment));
  if (intents.includes("shipping")) return client.replyMessage(event.replyToken, textMessage(TEXT.shipping));

  // 單品內容（客人只打產品名）
  if (intents.includes("gel") && intents.length === 1) return client.replyMessage(event.replyToken, textMessage(gelFullText()));
  if (intents.includes("drink") && intents.length === 1) return client.replyMessage(event.replyToken, textMessage(drinkText()));
  if (intents.includes("antler") && intents.length === 1) return client.replyMessage(event.replyToken, textMessage(antlerText()));
  if (intents.includes("soup") && intents.length === 1) return client.replyMessage(event.replyToken, textMessage(soupUsageText()));

  // 諮詢（輪替）
  if (intents.includes("consult")) {
    const msg = pickVariant(user.state, "consultEntry", consultEntryVariants());
    bumpVariant(userId, "consultEntry");
    return client.replyMessage(event.replyToken, textMessage(msg));
  }

  // fallback
  const msg = pickVariant(user.state, "fallback", fallbackVariants());
  bumpVariant(userId, "fallback");
  return client.replyMessage(event.replyToken, textMessage(msg));
}

app.listen(PORT, () => console.log(`LINE bot webhook listening on port ${PORT}`));
