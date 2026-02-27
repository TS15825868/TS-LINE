"use strict";

/**
 * 仙加味・龜鹿 LINE Bot（整包替換版｜方案C：不制式購買＋草稿30分鐘）
 *
 * ✅ 核心改造
 * - 資訊指令優先：產品名/容量/門市/官網/湯塊價格... 永遠不會被購買流程卡住
 * - 購買改成「草稿」：不硬問姓名電話地址，不鎖 step，一次只問一個最關鍵缺的資訊
 * - 草稿 30 分鐘沒更新自動過期（避免隔天卡住）
 * - 購買方式：宅配 / 店到店 / 雙北親送 / 到店購買
 * - 地址判斷：雙北親送只接受台北/新北
 * - 真人回覆選項：Quick Reply + 同義詞
 * - 龜鹿仙膠/龜鹿二仙膠/龜鹿膠 → 統一回「龜鹿湯塊(膠)」
 * - 價格用詞統一：售價 + 目前活動價（售價9折）
 * - 湯塊4兩取消活動價（只顯示售價）
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
 * A) 店家/產品資料（你可在這裡改）
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

  // 你官網沒放價格 => 這裡照你實際售價/活動價回覆（官網則引導看介紹/食用方式）
  products: {
    gel: {
      name: "龜鹿膏",
      spec: "100g/罐",
      priceList: 1800, // 售價
      activityDiscount: 0.9, // 9折
      usage: [
        "建議早上或空腹前後食用",
        "一天一次，一小匙（初次可先半匙）",
        "可用熱水化開後搭配溫水，或直接食用",
        "食用期間避免冰飲",
      ],
      noteDays: "依每個人食用習慣不同，一罐大約可吃10天～半個月左右。",
    },

    drink: {
      name: "龜鹿飲",
      spec: "180cc/包",
      priceList: 200,
      activityDiscount: 0.9,
      usage: [
        "每日一包",
        "可隔水加熱或溫熱飲用",
        "建議早上或白天飲用",
        "飲用期間避免冰飲",
      ],
    },

    antler: {
      name: "鹿茸粉",
      spec: "75g/罐",
      priceList: 2000,
      activityDiscount: 0.9,
      usage: [
        "一般建議：先從小量開始，搭配溫水或飲品",
        "若容易上火、睡不好或口乾，建議減量或間隔食用",
      ],
    },

    soup: {
      name: "龜鹿湯塊(膠)",
      // 你要求：4兩取消活動價（只顯示售價）
      variants: [
        { key: "soup600", label: "一斤", spec: "600g", priceList: 8000, activityDiscount: 0.9 },
        { key: "soup300", label: "半斤", spec: "300g", priceList: 4000, activityDiscount: 0.9 },
        { key: "soup150", label: "4兩", spec: "150g", priceList: 2000, activityDiscount: null }, // ✅ 不打折
        // 2兩(75g) 1000：你說盒子規劃中，先不放到正式價格清單；若你要上線再打開下面
        // { key: "soup75", label: "2兩（規劃中）", spec: "75g", priceList: 1000, activityDiscount: null, planned: true },
      ],
      usage: [
        "依個人口味加水煮滾，可搭配肉類/食材燉煮",
        "建議熱飲熱食，避免冰冷搭配",
      ],
      packagingNote:
        "目前為傳統盒裝（新包裝仍在規劃中）。",
    },
  },

  // 運送/付款（你可改成更精確）
  shippingNote:
    "可安排宅配／超商店到店／雙北親送（台北/新北）／到店購買。運費與到貨時間會依地區與方式確認後回覆您。",
  paymentNote:
    "付款方式會依訂單確認後提供（例如轉帳等）。我整理好後會一次回覆給您🙂",
  testingNote:
    "可提供基本資訊（依批次/包裝標示為準）。如需更完整資料，歡迎留言，我整理後回覆您。",
};

// 行為設定
const SETTINGS = {
  draftTtlMs: 30 * 60 * 1000, // ✅ 草稿30分鐘過期
  replyDedupMs: 12 * 1000,    // 短時間避免跳針
  detailsStyle: "hybrid",     // "hybrid"：短介紹＋官網連結；"linkOnly"：只丟官網
};

/** =========================
 * B) 工具
 * ========================= */
function money(n) {
  const s = String(Math.round(Number(n))).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
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
function clampText(s, max = 4000) {
  const t = String(s || "");
  return t.length <= max ? t : t.slice(0, max - 3) + "...";
}
function nowMs() {
  return Date.now();
}
function isLikelyAddress(text) {
  const t = String(text || "");
  // 粗判：有縣市區路街巷弄號/樓/段 等
  return /(台北|臺北|新北|台中|臺中|台南|臺南|高雄|桃園|新竹|基隆|苗栗|彰化|南投|雲林|嘉義|屏東|宜蘭|花蓮|台東|臺東|澎湖|金門|馬祖).*(區|鄉|鎮|市)/.test(t)
    || /(路|街|巷|弄|段).*(號)/.test(t)
    || /(號).*(樓|F|f)/.test(t);
}
function getCityFromAddressLoose(text) {
  const raw = String(text || "");
  if (raw.includes("台北") || raw.includes("臺北")) return "台北";
  if (raw.includes("新北")) return "新北";
  if (raw.includes("台中") || raw.includes("臺中")) return "台中";
  if (raw.includes("台南") || raw.includes("臺南")) return "台南";
  if (raw.includes("高雄")) return "高雄";
  if (raw.includes("桃園")) return "桃園";
  if (raw.includes("新竹")) return "新竹";
  if (raw.includes("基隆")) return "基隆";
  if (raw.includes("苗栗")) return "苗栗";
  if (raw.includes("彰化")) return "彰化";
  if (raw.includes("南投")) return "南投";
  if (raw.includes("雲林")) return "雲林";
  if (raw.includes("嘉義")) return "嘉義";
  if (raw.includes("屏東")) return "屏東";
  if (raw.includes("宜蘭")) return "宜蘭";
  if (raw.includes("花蓮")) return "花蓮";
  if (raw.includes("台東") || raw.includes("臺東")) return "台東";
  if (raw.includes("澎湖")) return "澎湖";
  if (raw.includes("金門")) return "金門";
  if (raw.includes("馬祖")) return "馬祖";
  return null;
}
function calcActivityPrice(priceList, discount) {
  if (!discount || typeof discount !== "number") return null;
  return Math.round(priceList * discount);
}
function uniqNonEmpty(arr) {
  const seen = new Set();
  const out = [];
  for (const x of arr || []) {
    const t = String(x || "").trim();
    if (!t) continue;
    if (seen.has(t)) continue;
    seen.add(t);
    out.push(t);
  }
  return out;
}
function stableJoinParts(parts) {
  // 排序器：固定順序 + 去重，避免湯塊價格重複那種情況
  const clean = uniqNonEmpty(parts).map(p => String(p).trim());
  return clean.join("\n\n——\n\n");
}

/** =========================
 * C) Quick Replies
 * ========================= */
function quickRepliesCommon() {
  return {
    items: [
      { type: "action", action: { type: "message", label: "諮詢", text: "諮詢" } },
      { type: "action", action: { type: "message", label: "產品名", text: "產品名" } },
      { type: "action", action: { type: "message", label: "容量", text: "容量" } },
      { type: "action", action: { type: "message", label: "湯塊價格", text: "湯塊價格" } },
      { type: "action", action: { type: "message", label: "購買方式", text: "購買方式" } },
      { type: "action", action: { type: "message", label: "真人回覆", text: "真人回覆" } },
      { type: "action", action: { type: "message", label: "門市", text: "門市資訊" } },
      { type: "action", action: { type: "uri", label: "官網", uri: STORE.website } },
      { type: "action", action: { type: "uri", label: "來電", uri: `tel:${STORE.phoneTel}` } },
    ],
  };
}
function textMessage(text) {
  return { type: "text", text: clampText(text), quickReply: quickRepliesCommon() };
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
    lastSeenAt: nowMs(),
    // 避免短時間跳針
    lastReplyHash: null,
    lastReplyAt: 0,
    // 變體輪替
    variantIdx: {},
  };
  users[userId].draft = users[userId].draft || {
    active: false,
    method: null,      // "home" | "c2c" | "d2d" | "store"
    items: [],         // [{key,name,qty,unit,priceList,activityPrice}]
    contact: { name: null, phone: null },
    ship: { address: null, store: null }, // address for home/d2d ; store for c2c
    notes: null,
    updatedAt: 0,
  };
  users[userId].handoff = users[userId].handoff || {
    requested: false,
    requestedAt: 0,
    note: null,
  };
  users[userId].state.lastSeenAt = nowMs();
  saveUsers(users);
  return users[userId];
}
function updateUser(userId, patchFn) {
  const users = loadUsers();
  users[userId] = users[userId] || {};
  users[userId].state = users[userId].state || {};
  users[userId].draft = users[userId].draft || {};
  users[userId].handoff = users[userId].handoff || {};
  patchFn(users[userId]);
  if (!users[userId].state) users[userId].state = {};
  users[userId].state.lastSeenAt = nowMs();
  saveUsers(users);
}
function resetDraft(userId) {
  updateUser(userId, (u) => {
    u.draft = {
      active: false,
      method: null,
      items: [],
      contact: { name: null, phone: null },
      ship: { address: null, store: null },
      notes: null,
      updatedAt: 0,
    };
  });
}
function touchDraft(userId) {
  updateUser(userId, (u) => {
    if (!u.draft) u.draft = {};
    u.draft.active = true;
    u.draft.updatedAt = nowMs();
  });
}
function isDraftExpired(draft) {
  if (!draft || !draft.active) return false;
  const t = draft.updatedAt || 0;
  return nowMs() - t > SETTINGS.draftTtlMs;
}

/** =========================
 * E) 文案模板（輪替用）
 * ========================= */
function pickVariant(u, key, variants) {
  const arr = Array.isArray(variants) ? variants : [String(variants)];
  if (!u.state.variantIdx) u.state.variantIdx = {};
  const idx = u.state.variantIdx[key] || 0;
  const pick = arr[idx % arr.length];
  u.state.variantIdx[key] = (idx + 1) % arr.length;
  return pick;
}
function hashReply(text) {
  // 簡單hash避免跳針
  const s = String(text || "");
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return String(h);
}
function maybeDedupReply(user, reply) {
  const h = hashReply(reply);
  const lastH = user.state.lastReplyHash;
  const lastAt = user.state.lastReplyAt || 0;
  if (lastH === h && nowMs() - lastAt < SETTINGS.replyDedupMs) {
    // 換一個比較短的替代回覆，避免整段重複
    return "我有收到～🙂 也可以直接說您想了解哪個品項／或回「購買方式」，我幫您整理。";
  }
  return reply;
}

/** =========================
 * F) 產品/價格/規格（統一：售價 + 目前活動價9折）
 * ========================= */
function pricingLine(name, spec, priceList, activityPrice) {
  if (activityPrice && activityPrice !== priceList) {
    return `▪️ ${name}（${spec}）：目前活動價 ${money(activityPrice)}（售價 ${money(priceList)}）`;
  }
  return `▪️ ${name}（${spec}）：售價 ${money(priceList)}`;
}
function pricingAll() {
  const p = STORE.products;
  const gelA = calcActivityPrice(p.gel.priceList, p.gel.activityDiscount);
  const drinkA = calcActivityPrice(p.drink.priceList, p.drink.activityDiscount);
  const antlerA = calcActivityPrice(p.antler.priceList, p.antler.activityDiscount);

  return [
    "【價格】",
    pricingLine(p.gel.name, p.gel.spec, p.gel.priceList, gelA),
    pricingLine(p.drink.name, p.drink.spec, p.drink.priceList, drinkA),
    pricingLine(p.antler.name, p.antler.spec, p.antler.priceList, antlerA),
    "▪️ 龜鹿湯塊(膠)：回「湯塊價格」可看規格",
    "",
    "如果您方便，也可以直接打：",
    "「龜鹿膏2罐＋龜鹿飲10包」或「湯塊半斤1份」",
  ].join("\n");
}
function specsAll() {
  const p = STORE.products;
  return [
    "【容量／規格】",
    `▪️ ${p.gel.name}：${p.gel.spec}`,
    `▪️ ${p.drink.name}：${p.drink.spec}`,
    `▪️ ${p.antler.name}：${p.antler.spec}`,
    "▪️ 龜鹿湯塊(膠)：一斤600g／半斤300g／4兩150g",
  ].join("\n");
}
function productListText() {
  const p = STORE.products;
  return [
    "【產品清單】",
    `▪️ ${p.gel.name}（${p.gel.spec}）`,
    `▪️ ${p.drink.name}（${p.drink.spec}）`,
    `▪️ ${p.antler.name}（${p.antler.spec}）`,
    "▪️ 龜鹿湯塊(膠)（一斤600g／半斤300g／4兩150g）",
    "",
    "想看湯塊規格與價格：回「湯塊價格」",
  ].join("\n");
}
function soupPriceAll() {
  const p = STORE.products.soup;
  const lines = ["【龜鹿湯塊(膠)｜規格與價格】", p.packagingNote ? `（${p.packagingNote}）` : "", ""].filter(Boolean);

  for (const v of p.variants) {
    // planned 的先不顯示（你要上線再打開）
    if (v.planned) continue;

    const act = calcActivityPrice(v.priceList, v.activityDiscount);
    lines.push(`${v.label}（${v.spec}）`);
    if (act && act !== v.priceList) lines.push(`目前活動價 ${money(act)}（售價 ${money(v.priceList)}）`);
    else lines.push(`售價 ${money(v.priceList)}`);
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
function detailsLinkLine() {
  return `更多產品介紹／成分／食用方式：${STORE.website}`;
}
function productIntroReply(productKey) {
  const p = STORE.products;
  const lines = [];

  if (SETTINGS.detailsStyle === "linkOnly") {
    lines.push(detailsLinkLine());
    return lines.join("\n");
  }

  // hybrid：先給 2~4 行重點 + 官網
  if (productKey === "gel") {
    const act = calcActivityPrice(p.gel.priceList, p.gel.activityDiscount);
    lines.push(`【${p.gel.name}】`);
    lines.push(pricingLine(p.gel.name, p.gel.spec, p.gel.priceList, act));
    lines.push(p.gel.noteDays);
    lines.push("食用建議：");
    lines.push(`• ${p.gel.usage[0]}`);
    lines.push(`• ${p.gel.usage[1]}`);
    lines.push("");
    lines.push(detailsLinkLine());
  } else if (productKey === "drink") {
    const act = calcActivityPrice(p.drink.priceList, p.drink.activityDiscount);
    lines.push(`【${p.drink.name}】`);
    lines.push(pricingLine(p.drink.name, p.drink.spec, p.drink.priceList, act));
    lines.push("飲用建議：");
    lines.push(`• ${p.drink.usage[0]}`);
    lines.push(`• ${p.drink.usage[1]}`);
    lines.push("");
    lines.push(detailsLinkLine());
  } else if (productKey === "antler") {
    const act = calcActivityPrice(p.antler.priceList, p.antler.activityDiscount);
    lines.push(`【${p.antler.name}】`);
    lines.push(pricingLine(p.antler.name, p.antler.spec, p.antler.priceList, act));
    lines.push("食用建議：");
    lines.push(`• ${p.antler.usage[0]}`);
    lines.push(`• ${p.antler.usage[1]}`);
    lines.push("");
    lines.push(detailsLinkLine());
  } else if (productKey === "soup") {
    lines.push(soupPriceAll());
    lines.push("");
    lines.push("食用建議：");
    for (const x of p.soup.usage) lines.push(`• ${x}`);
    lines.push("");
    lines.push(detailsLinkLine());
  } else {
    lines.push(detailsLinkLine());
  }
  return lines.join("\n");
}

/** =========================
 * G) 固定訊息
 * ========================= */
const TEXT = {
  welcome: [
    `您好，歡迎加入【${STORE.brandName}】🙂`,
    "",
    "我可以幫您：",
    "▪️ 看產品：回「產品名」",
    "▪️ 看規格：回「容量」",
    "▪️ 看湯塊規格：回「湯塊價格」",
    "▪️ 了解購買方式：回「購買方式」",
    "▪️ 需要真人：回「真人回覆」",
    "",
    "也可以直接打一段話：",
    "例：龜鹿膏2罐＋龜鹿飲10包 / 湯塊半斤1份",
  ].join("\n"),

  consultEntryVariants: [
    [
      `您好🙂 這裡是【${STORE.brandName}】`,
      "想先了解產品，或要我協助購買都可以～",
      "",
      "您可以回：產品名／容量／湯塊價格／購買方式",
      "如果想真人處理：回「真人回覆」",
    ].join("\n"),
    [
      `嗨～我是【${STORE.brandName}】小幫手🙂`,
      "您想看產品資訊，還是想直接買比較方便？",
      "",
      "回「產品名」看清單｜回「購買方式」看怎麼買｜要真人回「真人回覆」",
    ].join("\n"),
  ],

  purchaseMethods: [
    "【購買方式】您想用哪種比較方便？🙂",
    "1) 宅配到府",
    "2) 超商店到店",
    "3) 雙北親送（台北/新北）",
    "4) 到店購買",
    "",
    "也可以直接打：龜鹿膏2罐＋龜鹿飲10包 / 湯塊半斤1份",
  ].join("\n"),

  shipping: ["【運送】", STORE.shippingNote].join("\n"),
  payment: ["【付款】", STORE.paymentNote].join("\n"),
  testing: ["【檢驗／資料】", STORE.testingNote].join("\n"),

  sensitive: [
    "這部分會因每個人的狀況不同，為了更精準，建議由合作中醫師協助您🙂",
    "",
    `➤ Line ID：${STORE.doctorLineId}`,
    "➤ 諮詢連結：",
    STORE.doctorLink,
  ].join("\n"),

  handoff: [
    "好的🙂 我先幫您轉給真人同事處理。",
    "您方便留：想買的品項＋數量（或直接說想了解什麼）",
    "如果也願意留電話／方便聯絡時間，我們會更快回覆您。",
  ].join("\n"),

  fallback: [
    "我有收到～🙂",
    "您想先看哪一個？",
    "▪️ 產品名｜容量｜湯塊價格｜購買方式｜真人回覆｜門市資訊",
  ].join("\n"),
};

/** =========================
 * H) 意圖
 * ========================= */
const INTENT = {
  consult: ["諮詢","客服","專人","有人嗎","請協助","幫我","詢問"],
  // 真人回覆
  handoff: ["真人回覆","真人","轉真人","人工","人工客服","請真人","專人回覆","有人回覆","人工回覆","找人"],
  pricing: ["價格","價錢","售價","多少錢","幾錢","活動價","目前活動","折扣","報價","批發"],
  specs: ["容量","規格","幾克","幾g","g","公克","克","幾cc","cc","毫升","ml","多大","多少量","重量"],
  productList: ["產品名","有哪些產品","有什麼產品","產品","商品","品項","清單","有哪些"],
  // 你要改名：怎麼買/下單 => 購買方式
  buy: ["怎麼買","怎麼購買","下單","訂購","購買","我要買","我要","訂單","訂購方式","怎麼訂","購買方式","買法"],
  shipping: ["運送","寄送","運費","到貨","配送","宅配","超商","店到店","多久到","幾天到","親送"],
  payment: ["付款","怎麼付","轉帳","匯款","刷卡","貨到付款","付款方式"],
  testing: ["檢驗","報告","檢測","八大營養素","合格","安全","驗證"],
  store: ["門市","店面","地址","在哪","位置","怎麼去","地圖","電話","聯絡","營業時間"],
  website: ["官網","網站","網址","連結"],
  soupPrice: ["湯塊價格","湯塊售價","湯塊多少錢","湯塊價錢","湯塊","龜鹿湯塊","龜鹿膠","龜鹿仙膠","龜鹿二仙膠","二仙膠","龜鹿膠塊","龜鹿仙膠塊"],

  gel: ["龜鹿膏"],
  drink: ["龜鹿飲"],
  antler: ["鹿茸粉"],
  // 「龜鹿仙膠」等都當湯塊(膠)
  soup: ["龜鹿湯塊","湯塊","龜鹿膠","龜鹿仙膠","龜鹿二仙膠","二仙膠"],

  soup600: ["湯塊一斤","一斤湯塊","600公克","600g","一斤"],
  soup300: ["湯塊半斤","半斤湯塊","300公克","300g","半斤"],
  soup150: ["湯塊4兩","4兩湯塊","湯塊四兩","四兩湯塊","150公克","150g","4兩","四兩"],

  // 購買方式選項
  methodHome: ["宅配","宅配到府","寄到府","到府","家裡收","送到家"],
  methodC2C: ["店到店","超商","超商取貨","7-11","711","全家","萊爾富","OK","ok"],
  methodD2D: ["親送","雙北親送","台北親送","新北親送","雙北送"],
  methodStore: ["到店","門市自取","自取","現場買","到店購買"],

  cancel: ["取消","不用了","先不要","改天","算了"],
  sensitive: [
    "孕婦","懷孕","備孕","哺乳","餵母乳",
    "慢性病","三高","高血壓","糖尿病","洗腎","肝","心臟",
    "癌","癌症","化療","放療","手術","術後",
    "用藥","抗凝血","阿斯匹靈","warfarin",
    "能不能吃","可以吃嗎","適不適合","副作用","禁忌"
  ],
};

function detectProductKey(raw) {
  if (includesAny(raw, INTENT.soup600)) return "soup600";
  if (includesAny(raw, INTENT.soup300)) return "soup300";
  if (includesAny(raw, INTENT.soup150)) return "soup150";
  if (includesAny(raw, INTENT.gel)) return "gel";
  if (includesAny(raw, INTENT.drink)) return "drink";
  if (includesAny(raw, INTENT.antler)) return "antler";
  if (includesAny(raw, INTENT.soup)) return "soup"; // ✅ 含「龜鹿仙膠」等
  return null;
}

function detectIntents(raw) {
  const intents = new Set();

  // 高優先：敏感、真人、取消
  if (includesAny(raw, INTENT.sensitive)) intents.add("sensitive");
  if (includesAny(raw, INTENT.handoff)) intents.add("handoff");
  if (includesAny(raw, INTENT.cancel)) intents.add("cancel");

  if (includesAny(raw, INTENT.consult)) intents.add("consult");
  if (includesAny(raw, INTENT.productList)) intents.add("productList");
  if (includesAny(raw, INTENT.pricing)) intents.add("pricing");
  if (includesAny(raw, INTENT.specs)) intents.add("specs");
  if (includesAny(raw, INTENT.buy)) intents.add("buy"); // 購買方式
  if (includesAny(raw, INTENT.shipping)) intents.add("shipping");
  if (includesAny(raw, INTENT.payment)) intents.add("payment");
  if (includesAny(raw, INTENT.testing)) intents.add("testing");
  if (includesAny(raw, INTENT.store)) intents.add("store");
  if (includesAny(raw, INTENT.website)) intents.add("website");
  if (includesAny(raw, INTENT.soupPrice)) intents.add("soupPrice");

  // 方法意圖
  if (includesAny(raw, INTENT.methodHome)) intents.add("methodHome");
  if (includesAny(raw, INTENT.methodC2C)) intents.add("methodC2C");
  if (includesAny(raw, INTENT.methodD2D)) intents.add("methodD2D");
  if (includesAny(raw, INTENT.methodStore)) intents.add("methodStore");

  return Array.from(intents);
}

/** =========================
 * I) 下單解析（只抓品項+數量，不硬推流程）
 * ========================= */
const ORDER_INTENT_WORDS = ["我要", "我想買", "想買", "訂購", "下單", "購買", "要買", "訂", "買"];

function looksLikeOrder(rawText) {
  return /([0-9]{1,3}|一|二|兩|三|四|五|六|七|八|九|十)\s*(罐|包|盒|組|份|個)/.test(rawText)
    || ORDER_INTENT_WORDS.some(w => rawText.includes(w));
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

function activityPriceByKey(key) {
  const p = STORE.products;
  if (key === "gel") return calcActivityPrice(p.gel.priceList, p.gel.activityDiscount);
  if (key === "drink") return calcActivityPrice(p.drink.priceList, p.drink.activityDiscount);
  if (key === "antler") return calcActivityPrice(p.antler.priceList, p.antler.activityDiscount);

  if (key === "soup600") {
    const v = p.soup.variants.find(x => x.key === "soup600");
    return v ? calcActivityPrice(v.priceList, v.activityDiscount) : null;
  }
  if (key === "soup300") {
    const v = p.soup.variants.find(x => x.key === "soup300");
    return v ? calcActivityPrice(v.priceList, v.activityDiscount) : null;
  }
  if (key === "soup150") {
    const v = p.soup.variants.find(x => x.key === "soup150");
    return v ? calcActivityPrice(v.priceList, v.activityDiscount) : null; // null => 不顯示活動價
  }
  return null;
}
function priceListByKey(key) {
  const p = STORE.products;
  if (key === "gel") return p.gel.priceList;
  if (key === "drink") return p.drink.priceList;
  if (key === "antler") return p.antler.priceList;
  if (key === "soup600") return p.soup.variants.find(x => x.key === "soup600")?.priceList ?? null;
  if (key === "soup300") return p.soup.variants.find(x => x.key === "soup300")?.priceList ?? null;
  if (key === "soup150") return p.soup.variants.find(x => x.key === "soup150")?.priceList ?? null;
  return null;
}
function defaultUnitByKey(key) {
  if (key === "gel") return "罐";
  if (key === "drink") return "包";
  if (key === "antler") return "罐";
  if (String(key).startsWith("soup")) return "份";
  return "份";
}

const PRODUCT_ALIASES = [
  { key: "gel", name: STORE.products.gel.name, aliases: ["龜鹿膏"] },
  { key: "drink", name: STORE.products.drink.name, aliases: ["龜鹿飲"] },
  { key: "antler", name: STORE.products.antler.name, aliases: ["鹿茸粉"] },

  // 湯塊(膠)：含「龜鹿仙膠」等
  { key: "soup600", name: "龜鹿湯塊(膠)一斤", aliases: ["湯塊一斤","一斤湯塊","600公克湯塊","600g湯塊","一斤"] },
  { key: "soup300", name: "龜鹿湯塊(膠)半斤", aliases: ["湯塊半斤","半斤湯塊","300公克湯塊","300g湯塊","半斤"] },
  { key: "soup150", name: "龜鹿湯塊(膠)4兩", aliases: ["湯塊4兩","4兩湯塊","湯塊四兩","四兩湯塊","150公克湯塊","150g湯塊","4兩","四兩"] },

  // 泛稱：只抓到「龜鹿仙膠/龜鹿膠」時，先當 soup300（你也可改成詢問）
  { key: "soup", name: STORE.products.soup.name, aliases: ["龜鹿湯塊","湯塊","龜鹿膠","龜鹿仙膠","龜鹿二仙膠","二仙膠"] },
];

function normalizeSoupGenericToDefaultKey(items) {
  // 如果只有「soup」泛稱，幫他先問規格，不要自動當某一個重量
  // 這裡不轉換，交給回覆問「要一斤/半斤/4兩？」
  return items;
}

function parseItems(rawText) {
  const text = normalizeText(rawText);
  const shouldTry = looksLikeOrder(rawText) || includesAny(rawText, ["龜鹿膏","龜鹿飲","鹿茸粉","湯塊","龜鹿膠","龜鹿仙膠","二仙膠"]);
  if (!shouldTry) return [];

  const itemsMap = new Map();

  for (const p of PRODUCT_ALIASES) {
    const matchedAlias = p.aliases
      .filter(a => rawText.includes(a))
      .sort((a, b) => b.length - a.length)[0];
    if (!matchedAlias) continue;

    const before = extractQtyBeforeProduct(text, matchedAlias);
    const after = extractQtyAfterProduct(text, matchedAlias);
    const near = before || after;

    let qty = near?.qty ?? null;
    let unit = (near?.unit ?? null) || defaultUnitByKey(p.key);

    if (!qty) {
      // 單品或斷行：用全局數量補
      const q = extractQtyUnitAnywhere(text);
      qty = q?.qty ?? 1;
      unit = q?.unit || unit;
    }

    // 價格：湯塊泛稱 soup 不顯示單價（需選規格）
    const list = priceListByKey(p.key);
    const act = activityPriceByKey(p.key);

    itemsMap.set(p.key, {
      key: p.key,
      name: p.name,
      qty,
      unit,
      priceList: typeof list === "number" ? list : null,
      activityPrice: typeof act === "number" ? act : null,
    });
  }

  return normalizeSoupGenericToDefaultKey(Array.from(itemsMap.values()));
}

function mergeItems(baseItems, newItems) {
  const map = new Map((baseItems || []).map(x => [x.key, x]));
  for (const it of newItems || []) {
    if (!map.has(it.key)) map.set(it.key, it);
    else {
      const prev = map.get(it.key);
      prev.qty += it.qty;
      map.set(it.key, prev);
    }
  }
  return Array.from(map.values());
}

function subtotal(items) {
  let sum = 0;
  for (const it of items || []) {
    // soup 泛稱不計價
    const price = (typeof it.activityPrice === "number" ? it.activityPrice : it.priceList);
    if (typeof price === "number") sum += price * (it.qty || 0);
  }
  return sum;
}

function summarizeItems(items) {
  const lines = [];
  for (const it of items || []) {
    if (it.key === "soup") {
      lines.push(`▪️ ${STORE.products.soup.name} × ${it.qty || 1}（請問要一斤/半斤/4兩？）`);
      continue;
    }
    const list = it.priceList;
    const act = it.activityPrice;
    const unit = it.unit || "份";
    if (typeof list === "number" && typeof act === "number" && act !== list) {
      lines.push(`▪️ ${it.name} × ${it.qty} ${unit}｜目前活動價 ${money(act)}/${unit}（售價 ${money(list)}/${unit}）`);
    } else if (typeof list === "number") {
      lines.push(`▪️ ${it.name} × ${it.qty} ${unit}｜售價 ${money(list)}/${unit}`);
    } else {
      lines.push(`▪️ ${it.name} × ${it.qty} ${unit}`);
    }
  }

  const s = subtotal(items);
  if (s > 0) lines.push(`小計（未含運）：${money(s)}`);
  return lines;
}

/** =========================
 * J) 購買草稿：填補缺資料（一次問一個，不鎖流程）
 * ========================= */
function detectMethodFromText(raw) {
  if (includesAny(raw, INTENT.methodHome)) return "home";
  if (includesAny(raw, INTENT.methodC2C)) return "c2c";
  if (includesAny(raw, INTENT.methodD2D)) return "d2d";
  if (includesAny(raw, INTENT.methodStore)) return "store";

  // 客人回 1/2/3/4
  if (/^\s*1\s*$/.test(raw)) return "home";
  if (/^\s*2\s*$/.test(raw)) return "c2c";
  if (/^\s*3\s*$/.test(raw)) return "d2d";
  if (/^\s*4\s*$/.test(raw)) return "store";

  return null;
}

function fillContactFromText(userId, rawText) {
  const raw = String(rawText || "");
  const digits = raw.replace(/[^\d]/g, "");
  if (digits.length >= 8 && digits.length <= 15) {
    updateUser(userId, (u) => {
      u.draft.contact = u.draft.contact || { name: null, phone: null };
      u.draft.contact.phone = digits;
    });
    touchDraft(userId);
    return true;
  }
  // 名字：2~10字，且不是指令字
  const t = normalizeText(rawText);
  if (t.length >= 2 && t.length <= 10 && !includesAny(t, ["產品名","容量","價格","湯塊價格","官網","門市","購買方式","諮詢","真人"])) {
    updateUser(userId, (u) => {
      u.draft.contact = u.draft.contact || { name: null, phone: null };
      u.draft.contact.name = t;
    });
    touchDraft(userId);
    return true;
  }
  return false;
}

function fillShipFromText(userId, rawText) {
  const user = ensureUser(userId);
  const d = user.draft || {};
  const method = d.method;

  if (method === "home" || method === "d2d") {
    if (isLikelyAddress(rawText)) {
      updateUser(userId, (u) => {
        u.draft.ship = u.draft.ship || {};
        u.draft.ship.address = String(rawText || "").trim();
      });
      touchDraft(userId);
      return true;
    }
  }
  if (method === "c2c") {
    // 店到店：抓常見關鍵字 or 長度
    const t = String(rawText || "").trim();
    if (t.length >= 4) {
      updateUser(userId, (u) => {
        u.draft.ship = u.draft.ship || {};
        u.draft.ship.store = t;
      });
      touchDraft(userId);
      return true;
    }
  }
  return false;
}

function draftNeeds(draft) {
  // 回傳下一個「最關鍵缺的」欄位（一次問一個）
  if (!draft || !draft.active) return { need: null };

  if (!draft.items || draft.items.length === 0) return { need: "items" };
  // 如果有 soup 泛稱 => 先問規格
  if ((draft.items || []).some(it => it.key === "soup")) return { need: "soupSpec" };

  if (!draft.method) return { need: "method" };

  if (draft.method === "home") {
    if (!draft.ship?.address) return { need: "address" };
    if (!draft.contact?.name) return { need: "name" };
    if (!draft.contact?.phone) return { need: "phone" };
    return { need: null };
  }
  if (draft.method === "c2c") {
    if (!draft.ship?.store) return { need: "store" };
    if (!draft.contact?.name) return { need: "name" };
    if (!draft.contact?.phone) return { need: "phone" };
    return { need: null };
  }
  if (draft.method === "d2d") {
    // ✅ 雙北判斷：地址不在雙北就引導改方式
    if (!draft.ship?.address) return { need: "address" };
    const city = getCityFromAddressLoose(draft.ship.address);
    if (city && city !== "台北" && city !== "新北") return { need: "d2dNotInRange", city };
    if (!draft.contact?.name) return { need: "name" };
    if (!draft.contact?.phone) return { need: "phone" };
    return { need: null };
  }
  if (draft.method === "store") {
    // 到店購買：只需要留名字/電話（可選），不要硬填
    if (!draft.contact?.name && !draft.contact?.phone) return { need: "storeContactOptional" };
    return { need: null };
  }

  return { need: null };
}

function methodLabel(m) {
  if (m === "home") return "宅配到府";
  if (m === "c2c") return "超商店到店";
  if (m === "d2d") return "雙北親送";
  if (m === "store") return "到店購買";
  return "";
}

function buildDraftReply(userId) {
  const user = ensureUser(userId);
  const d = user.draft;

  const head = [];
  const itemLines = summarizeItems(d.items || []);
  if (itemLines.length) {
    head.push("我先幫您整理目前這筆（有需要都可以直接更正）👇");
    head.push("");
    head.push(...itemLines);
  }

  const need = draftNeeds(d);

  // ✅ 草稿完成：不要說「資料已齊全」太機械，改像真人
  if (!need.need) {
    const parts = [];
    if (head.length) parts.push(head.join("\n"));

    if (d.method === "store") {
      parts.push([
        `好的～我了解您要「${methodLabel(d.method)}」🙂`,
        "到店地址在這裡：",
        STORE.address,
        "",
        "如果您願意留個姓名或電話，我到時也比較好幫您保留／確認～",
      ].join("\n"));
    } else {
      parts.push([
        `好的～我了解您要「${methodLabel(d.method)}」🙂`,
        "我接著會把：運費／到貨方式／付款資訊一次整理回覆您。",
      ].join("\n"));
    }
    return stableJoinParts(parts);
  }

  // ✅ 缺什麼問什麼（一次問一個）
  if (need.need === "items") {
    return stableJoinParts([
      head.join("\n"),
      pickVariant(user, "askItems", [
        "好的🙂 您想買哪個品項、幾份呢？（例：龜鹿膏2罐／龜鹿飲10包／湯塊半斤1份）",
        "沒問題～您先跟我說「品項＋數量」就好🙂（例：龜鹿膏2罐、湯塊一斤1份）",
      ]),
    ]);
  }

  if (need.need === "soupSpec") {
    return stableJoinParts([
      head.join("\n"),
      "想確認一下您說的「龜鹿湯塊(膠)」要哪個規格呢？🙂",
      "回：一斤 / 半斤 / 4兩（或直接回「湯塊價格」看規格）",
    ]);
  }

  if (need.need === "method") {
    return stableJoinParts([
      head.join("\n"),
      TEXT.purchaseMethods,
    ]);
  }

  if (need.need === "address") {
    if (d.method === "home") {
      return stableJoinParts([
        head.join("\n"),
        "好的～麻煩您直接貼「收件地址」🙂（若方便也可一起留姓名＋電話）",
      ]);
    }
    if (d.method === "d2d") {
      return stableJoinParts([
        head.join("\n"),
        "好的～雙北親送🙂 麻煩貼一下地址，我確認是否在配送範圍～",
      ]);
    }
  }

  if (need.need === "store") {
    return stableJoinParts([
      head.join("\n"),
      "好～店到店🙂 麻煩回我「超商品牌＋門市」就行（例：7-11 西昌門市 / 全家 XX店）",
    ]);
  }

  if (need.need === "name") {
    return stableJoinParts([
      head.join("\n"),
      "再麻煩留個收件人姓名🙂",
    ]);
  }

  if (need.need === "phone") {
    return stableJoinParts([
      head.join("\n"),
      "再麻煩留個聯絡電話🙂",
    ]);
  }

  if (need.need === "storeContactOptional") {
    return stableJoinParts([
      head.join("\n"),
      `好的～到店購買沒問題🙂 地址在：${STORE.address}`,
      "如果您願意留個姓名或電話，我也可以幫您先備註，之後比較好確認～（不留也可以）",
    ]);
  }

  if (need.need === "d2dNotInRange") {
    return stableJoinParts([
      head.join("\n"),
      `我看地址是「${need.city || "非雙北"}」～雙北親送目前只限台北/新北🙂`,
      "我可以幫您改成：",
      "1) 宅配到府",
      "2) 超商店到店",
      "回 1 或 2 就可以～",
    ]);
  }

  return head.join("\n");
}

/** =========================
 * K) 智慧回覆：資訊優先 + 不鎖購買
 * ========================= */
function buildSmartReply(userId, rawText) {
  const user = ensureUser(userId);

  // 草稿過期：自動重置（但不吵客人）
  if (isDraftExpired(user.draft)) resetDraft(userId);

  const raw = normalizeText(rawText);
  const intents = detectIntents(raw);

  // 0) 取消（只取消草稿，不影響聊天）
  if (intents.includes("cancel")) {
    resetDraft(userId);
    return "好的～我先把這筆購買草稿清掉🙂 之後想買或想看資訊，直接跟我說就可以。";
  }

  // 1) 敏感問題
  if (intents.includes("sensitive")) return TEXT.sensitive;

  // 2) 真人回覆
  if (intents.includes("handoff")) {
    updateUser(userId, (u) => {
      u.handoff.requested = true;
      u.handoff.requestedAt = nowMs();
      u.handoff.note = rawText;
    });
    return TEXT.handoff;
  }

  // 3) 資訊指令永遠優先（不被草稿攔截）
  const pk = detectProductKey(raw);
  if (pk) updateUser(userId, (u) => (u.state.lastProductKey = pk === "soup600" || pk === "soup300" || pk === "soup150" ? "soup" : pk));

  const parts = [];

  // consult
  if (intents.includes("consult")) {
    updateUser(userId, (u) => {});
    const u2 = ensureUser(userId);
    const c = pickVariant(u2, "consultEntry", TEXT.consultEntryVariants);
    parts.push(c);
    updateUser(userId, (u) => (u.state.variantIdx = u2.state.variantIdx));
  }

  // product list
  if (intents.includes("productList")) parts.push(productListText());

  // specs
  if (intents.includes("specs")) {
    if (!pk) parts.push(specsAll());
    else {
      const k = pk === "soup600" || pk === "soup300" || pk === "soup150" ? "soup" : pk;
      if (k === "gel") parts.push(`【${STORE.products.gel.name}｜規格】\n${STORE.products.gel.spec}`);
      else if (k === "drink") parts.push(`【${STORE.products.drink.name}｜規格】\n${STORE.products.drink.spec}`);
      else if (k === "antler") parts.push(`【${STORE.products.antler.name}｜規格】\n${STORE.products.antler.spec}`);
      else parts.push("【龜鹿湯塊(膠)｜規格】\n一斤600g／半斤300g／4兩150g");
    }
  }

  // soup price
  if (intents.includes("soupPrice")) parts.push(soupPriceAll());

  // pricing
  if (intents.includes("pricing") && !intents.includes("soupPrice")) {
    // 官網沒放價格沒關係：這裡照你設定回
    if (!pk) parts.push(pricingAll());
    else {
      const k = pk === "soup600" || pk === "soup300" || pk === "soup150" ? "soup" : pk;
      if (k === "gel") parts.push(productIntroReply("gel").split("\n").slice(0, 3).join("\n"));
      else if (k === "drink") parts.push(productIntroReply("drink").split("\n").slice(0, 3).join("\n"));
      else if (k === "antler") parts.push(productIntroReply("antler").split("\n").slice(0, 3).join("\n"));
      else parts.push(soupPriceAll());
    }
  }

  // buy => 購買方式
  if (intents.includes("buy")) parts.push(TEXT.purchaseMethods);

  if (intents.includes("shipping")) parts.push(TEXT.shipping);
  if (intents.includes("payment")) parts.push(TEXT.payment);
  if (intents.includes("testing")) parts.push(TEXT.testing);
  if (intents.includes("store")) parts.push(storeInfo());
  if (intents.includes("website")) parts.push(`官網：${STORE.website}`);

  // 4) 如果是單打某個產品名/同義詞：回產品介紹（含官網）
  // （但如果他其實在問購買方式/價格就不要搶答）
  if (parts.length === 0 && pk) {
    if (pk === "soup600" || pk === "soup300" || pk === "soup150" || pk === "soup") {
      parts.push(productIntroReply("soup"));
    } else {
      parts.push(productIntroReply(pk));
    }
  }

  // 5) 如果完全沒意圖，才 fallback
  if (parts.length === 0) parts.push(TEXT.fallback);

  // ✅ 排序器/去重
  const reply = stableJoinParts(parts);

  // ✅ 防跳針
  const finalReply = maybeDedupReply(user, reply);
  updateUser(userId, (u) => {
    u.state.lastReplyHash = hashReply(reply);
    u.state.lastReplyAt = nowMs();
  });

  return finalReply;
}

/** =========================
 * L) 購買草稿：吸收訊息（方法/品項/地址/姓名/電話）
 * ========================= */
function absorbPurchaseDraft(userId, rawText) {
  const user = ensureUser(userId);
  if (isDraftExpired(user.draft)) resetDraft(userId);

  const raw = normalizeText(rawText);
  const intents = detectIntents(raw);

  // 取消 / 真人 / 資訊指令 由上層處理，這裡只處理購買草稿吸收
  if (intents.includes("cancel") || intents.includes("handoff") || intents.includes("sensitive")) return { changed: false };

  // 1) 偵測購買方式
  const method = detectMethodFromText(raw);
  if (method) {
    updateUser(userId, (u) => {
      u.draft.active = true;
      u.draft.method = method;
      u.draft.updatedAt = nowMs();
    });
  }

  // 2) 偵測品項數量
  const items = parseItems(rawText);
  if (items && items.length) {
    updateUser(userId, (u) => {
      u.draft.active = true;
      u.draft.items = mergeItems(u.draft.items || [], items);
      u.draft.updatedAt = nowMs();
    });
  }

  // 3) 若客人只打「龜鹿仙膠」之類，仍屬湯塊(膠)，但需要問規格
  if (!items.length && includesAny(rawText, ["龜鹿仙膠","龜鹿二仙膠","龜鹿膠","二仙膠"])) {
    updateUser(userId, (u) => {
      u.draft.active = true;
      // 放一個泛稱 item，讓 draftNeeds 觸發 soupSpec
      const exists = (u.draft.items || []).some(x => x.key === "soup");
      if (!exists) u.draft.items = mergeItems(u.draft.items || [], [{ key: "soup", name: STORE.products.soup.name, qty: 1, unit: "份" }]);
      u.draft.updatedAt = nowMs();
    });
  }

  // 4) 吸收地址/門市
  fillShipFromText(userId, rawText);

  // 5) 吸收姓名/電話
  fillContactFromText(userId, rawText);

  // 6) 如果客人正在草稿中，但突然問「產品名/容量/湯塊價格」等資訊
  // 上層會先回資訊，不在這裡硬回草稿

  const updated = ensureUser(userId);
  return { changed: updated.draft?.active || false };
}

/** =========================
 * M) 24h 追蹤（可保留）
 * ========================= */
async function scanAndSendFollowups() {
  const users = loadUsers();
  const now = nowMs();
  const dueMs = 24 * 60 * 60 * 1000;
  let changed = false;

  for (const [userId, u] of Object.entries(users)) {
    if (!u || !u.followedAt) continue;
    if (u.followupSent) continue;
    if (now - u.followedAt < dueMs) continue;

    try {
      await client.pushMessage(userId, textMessage(`您好🙂 這裡是【${STORE.brandName}】\n\n想看清單回：產品名\n想看怎麼買回：購買方式\n需要真人回：真人回覆`));
      users[userId].followupSent = true;
      users[userId].followupSentAt = nowMs();
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
  // follow：歡迎訊息
  if (event.type === "follow") {
    const userId = event.source && event.source.userId;
    if (userId) {
      const users = loadUsers();
      users[userId] = users[userId] || {};
      users[userId].followedAt = users[userId].followedAt || nowMs();
      users[userId].followupSent = users[userId].followupSent || false;
      users[userId].state = users[userId].state || { lastProductKey: null, lastSeenAt: nowMs(), lastReplyHash: null, lastReplyAt: 0, variantIdx: {} };
      users[userId].draft = users[userId].draft || { active: false, method: null, items: [], contact: { name: null, phone: null }, ship: { address: null, store: null }, notes: null, updatedAt: 0 };
      users[userId].handoff = users[userId].handoff || { requested: false, requestedAt: 0, note: null };
      saveUsers(users);
    }
    return client.replyMessage(event.replyToken, textMessage(TEXT.welcome));
  }

  if (event.type !== "message") return null;
  if (!event.message || event.message.type !== "text") return null;

  const userId = event.source && event.source.userId;
  const userTextRaw = event.message.text || "";

  // 沒 userId 也能回，但不存草稿
  if (!userId) {
    const reply = buildSmartReply("anonymous", userTextRaw);
    return client.replyMessage(event.replyToken, textMessage(reply));
  }

  ensureUser(userId);

  // ✅ 1) 先回「資訊類指令」：永遠優先，不被草稿攔截
  const raw = normalizeText(userTextRaw);
  const intents = detectIntents(raw);

  const isInfoCommand =
    intents.includes("productList") ||
    intents.includes("specs") ||
    intents.includes("pricing") ||
    intents.includes("soupPrice") ||
    intents.includes("store") ||
    intents.includes("website") ||
    intents.includes("testing") ||
    intents.includes("payment") ||
    intents.includes("shipping") ||
    intents.includes("consult") ||
    intents.includes("handoff") ||
    intents.includes("sensitive") ||
    intents.includes("buy") ||
    intents.includes("cancel");

  if (isInfoCommand) {
    const reply = buildSmartReply(userId, userTextRaw);
    return client.replyMessage(event.replyToken, textMessage(reply));
  }

  // ✅ 2) 非資訊指令：嘗試吸收成購買草稿（品項/方式/地址/聯絡）
  absorbPurchaseDraft(userId, userTextRaw);

  const user = ensureUser(userId);
  if (user.draft && user.draft.active) {
    const reply = buildDraftReply(userId);
    // 仍然避免跳針
    const safeReply = maybeDedupReply(user, reply);
    updateUser(userId, (u) => {
      u.state.lastReplyHash = hashReply(reply);
      u.state.lastReplyAt = nowMs();
    });
    return client.replyMessage(event.replyToken, textMessage(safeReply));
  }

  // ✅ 3) 都不是：走一般智慧回覆
  const reply = buildSmartReply(userId, userTextRaw);
  return client.replyMessage(event.replyToken, textMessage(reply));
}

app.listen(PORT, () => console.log(`LINE bot webhook listening on port ${PORT}`));
