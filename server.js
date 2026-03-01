"use strict";

/**
 * 仙加味・龜鹿 LINE Bot（V2 升級版）
 * ✅ Flex 卡片（產品/價格/訂單確認）
 * ✅ 不制式：客人自然語句可用（代碼仍保留做捷徑）
 * ✅ 自動算單：抓 products.json 的 msrp/discount/variants 計算
 * ✅ 湯塊規格變體辨識：2兩(75g)/4兩(150g)/半斤(300g)/一斤(600g)
 * ✅ 串接官網 products.json（PRODUCTS_URL）
 *
 * Render 環境變數（請用這組命名）
 * - LINE_CHANNEL_ACCESS_TOKEN
 * - LINE_CHANNEL_SECRET
 * - PRODUCTS_URL   （例：https://ts15825868.github.io/TaiShing/products.json）
 * - PORT           （Render 自動提供，可不填）
 */

const express = require("express");
const line = require("@line/bot-sdk");
const fs = require("fs");
const path = require("path");

const {
  LINE_CHANNEL_ACCESS_TOKEN,
  LINE_CHANNEL_SECRET,
  PRODUCTS_URL,
  PORT = 10000,
} = process.env;

if (!LINE_CHANNEL_ACCESS_TOKEN || !LINE_CHANNEL_SECRET) {
  console.error("缺少環境變數：LINE_CHANNEL_ACCESS_TOKEN 或 LINE_CHANNEL_SECRET");
  process.exit(1);
}

const config = {
  channelAccessToken: LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: LINE_CHANNEL_SECRET,
};

const app = express();
const client = new line.Client(config);

/** =========================
 * 店家資訊（可自行改）
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
  },
  priceNote: "※ 價格可能因通路服務/搭配方案不同略有差異🙂 到店常有不定期活動，依現場為準。",
  infoDisclaimer: "※ 產品資訊以實際包裝標示為準（不同批次可能略有差異）。",
  orderNote:
    "※ 訂單確認後會依出貨方式提供付款資訊。\n※ 若需改單請於出貨前通知；已出貨將依物流狀況處理。",
  deliverNote: "※ 若順路/時間允許可安排親送；若不便親送會改以宅配或店到店協助。",
  humanModeNote:
    "我已先幫您轉真人協助🙂\n\n（真人回覆期間系統會少說話，避免打架）\n要回主選單：回 0 或「選單」\n要解除真人：回「解除真人」",
};

/** =========================
 * products.json：串接官網（快取 + 容錯 + 本地備援）
 * ========================= */
const PRODUCTS_CACHE = { data: null, loadedAt: 0, ttlMs: 5 * 60 * 1000 };

function now() { return Date.now(); }
function clampText(t) { t = String(t || ""); return t.length > 4900 ? t.slice(0, 4900) : t; }
function money(n) {
  const s = String(Math.round(Number(n))).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `NT$${s}`;
}
function calcDiscount(msrp, discount) {
  if (!msrp || !discount) return null;
  return Math.round(Number(msrp) * Number(discount));
}
function normalizeText(s) {
  return String(s || "")
    .replace(/\u3000/g, " ")
    .replace(/[，,、/／]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
function safeDigits(raw) { return String(raw || "").replace(/[^\d]/g, ""); }
function includesAny(t, arr) { const s = String(t || ""); return arr.some((k) => s.includes(k)); }

async function fetchProductsFromUrl(url) {
  const res = await fetch(url, { method: "GET", headers: { "cache-control": "no-cache" } });
  if (!res.ok) throw new Error(`PRODUCTS_URL fetch failed: ${res.status}`);
  return await res.json();
}
function loadProductsLocalFallback() {
  try {
    const local = path.join(__dirname, "products.json");
    if (fs.existsSync(local)) return JSON.parse(fs.readFileSync(local, "utf8"));
  } catch {}
  return null;
}
async function getProducts() {
  if (PRODUCTS_CACHE.data && now() - PRODUCTS_CACHE.loadedAt < PRODUCTS_CACHE.ttlMs) return PRODUCTS_CACHE.data;

  if (PRODUCTS_URL) {
    try {
      const data = await fetchProductsFromUrl(PRODUCTS_URL);
      PRODUCTS_CACHE.data = data;
      PRODUCTS_CACHE.loadedAt = now();
      return data;
    } catch (e) {
      console.error("抓 PRODUCTS_URL 失敗：", e?.message || e);
    }
  }

  const local = loadProductsLocalFallback();
  if (local) {
    PRODUCTS_CACHE.data = local;
    PRODUCTS_CACHE.loadedAt = now();
    return local;
  }

  return { version: 0, categories: [] };
}
function buildProductIndex(productsJson) {
  const categories = Array.isArray(productsJson?.categories) ? productsJson.categories : [];
  const byCatId = {};
  for (const c of categories) if (c?.id) byCatId[c.id] = c;
  return { categories, byCatId };
}

/** 固定代碼（仍保留捷徑） */
const CODE_MAP = {
  intro: { "11": "gel", "12": "drink", "13": "antler", "14": "soup" },
  spec: { "31": "gel", "32": "drink", "33": "antler", "34": "soup" },
  price: { "51": "gel", "52": "drink", "53": "antler", "54": "soup" },
};
function catToCodes(catId) {
  const introCode = Object.keys(CODE_MAP.intro).find((k) => CODE_MAP.intro[k] === catId);
  const specCode = Object.keys(CODE_MAP.spec).find((k) => CODE_MAP.spec[k] === catId);
  const priceCode = Object.keys(CODE_MAP.price).find((k) => CODE_MAP.price[k] === catId);
  return { introCode, specCode, priceCode };
}

/** =========================
 * 使用者狀態（含 pendingOrder）
 * ========================= */
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
  try { fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), "utf8"); } catch {}
}
function ensureUser(userId) {
  const users = loadUsers();
  users[userId] = users[userId] || {};
  users[userId].state = users[userId].state || {
    humanMode: false,
    lastCat: null,
    pendingOrder: null, // { items:[{catId, variantKey, name, qty, unit, line}], total }
    buy: { active: false, step: null, method: null, itemsText: null, name: null, phone: null, address: null },
    lastSeenAt: now(),
  };
  users[userId].state.lastSeenAt = now();
  saveUsers(users);
  return users[userId];
}
function updateUser(userId, fn) {
  const users = loadUsers();
  users[userId] = users[userId] || {};
  users[userId].state = users[userId].state || {};
  fn(users[userId]);
  users[userId].state.lastSeenAt = now();
  saveUsers(users);
}
function setHumanMode(userId, on) {
  updateUser(userId, (u) => { u.state.humanMode = !!on; });
}
function setPendingOrder(userId, pending) {
  updateUser(userId, (u) => { u.state.pendingOrder = pending; });
}

/** =========================
 * Quick Reply（當頁）
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
      return { items: [qr("產品", "產品"), qr("價格", "價格"), qr("怎麼吃", "怎麼吃"), qr("怎麼買", "怎麼買"), qr("門市", "門市"), qr("真人", "真人"), qr("官網", "官網")] };
    case "products":
      return { items: [qr("龜鹿膏", "龜鹿膏"), qr("龜鹿飲", "龜鹿飲"), qr("鹿茸粉", "鹿茸粉"), qr("龜鹿湯塊", "龜鹿湯塊"), qr("回主選單", "選單")] };
    case "buy":
      return { items: [qr("宅配", "宅配"), qr("店到店", "店到店"), qr("雙北親送", "親送"), qr("到店自取", "自取"), qr("主選單", "選單")] };
    case "product_page":
      return { items: [ctx.priceCode ? qr("看價格", String(ctx.priceCode)) : qr("看價格", "價格"), qr("我要買", "我要買"), qr("其他產品", "產品"), qr("主選單", "選單")] };
    case "order_confirm":
      return { items: [qr("確認下單", "確認下單"), qr("改一下", "修改訂單"), qr("主選單", "選單")] };
    case "store":
      return { items: [qrUri("地圖", STORE.mapUrl), qrUri("來電", `tel:${STORE.phoneTel}`), qr("主選單", "選單")] };
    default:
      return { items: [qr("主選單", "選單")] };
  }
}
function textMessage(text, menu = "main", ctx = {}) {
  return { type: "text", text: clampText(text), quickReply: quickReplies(menu, ctx) };
}

/** =========================
 * Flex helpers
 * ========================= */
function flexMessage(altText, contents, menu = "main", ctx = {}) {
  return { type: "flex", altText: clampText(altText), contents, quickReply: quickReplies(menu, ctx) };
}
function flexProductCard({ title, subtitleLines = [], bodyLines = [], buttons = [] }) {
  const mkText = (txt, size = "sm", weight = "regular", wrap = true, color) => {
    const o = { type: "text", text: clampText(txt), size, weight, wrap };
    if (color) o.color = color;
    return o;
  };

  return {
    type: "bubble",
    body: {
      type: "box",
      layout: "vertical",
      spacing: "md",
      contents: [
        mkText(title, "lg", "bold"),
        ...subtitleLines.map((x) => mkText(x, "sm", "regular", true, "#666666")),
        { type: "separator" },
        ...bodyLines.map((x) => mkText(x, "sm", "regular")),
      ],
    },
    footer: buttons.length
      ? {
          type: "box",
          layout: "vertical",
          spacing: "sm",
          contents: buttons.map((b) => ({
            type: "button",
            style: b.style || "primary",
            action: { type: "message", label: b.label, text: b.text },
          })),
        }
      : undefined,
  };
}

function storeInfoText() {
  return `【門市資訊｜${STORE.brandName}】
地址：${STORE.address}
電話：${STORE.phoneDisplay}

營業：${STORE.hours.weekday}
自取：${STORE.hours.pickupLate}
週末：${STORE.hours.weekend}`;
}

function mainMenuText() {
  return `您好，這裡是【${STORE.brandName}】🙂

你可以直接打：
•「龜鹿飲價格」
•「鹿茸粉怎麼吃」
•「我要龜鹿膏 2 罐」
•「門市地址」

或按下方快捷鍵也可以。`;
}

/** =========================
 * 產品內容（由 products.json）
 * ========================= */
function buildIntroFlex(catId, cat, item, priceCode) {
  const name = item?.name || cat?.name || "產品";
  const intro = Array.isArray(item?.intro) ? item.intro : [];
  const ing = Array.isArray(item?.ingredients) ? item.ingredients : [];
  const usage = Array.isArray(item?.usage) ? item.usage : [];

  let specLine = item?.spec ? `規格：${item.spec}` : "";
  if (Array.isArray(item?.variants) && item.variants.length) {
    specLine = "規格：" + item.variants.map((v) => `${v.label} ${v.spec}`).join(" / ");
  }

  const hintName =
    name.includes("龜鹿飲") ? "龜鹿飲" :
    name.includes("龜鹿膏") ? "龜鹿膏" :
    name.includes("鹿茸") ? "鹿茸粉" :
    name.includes("湯塊") ? "龜鹿湯塊" : name;

  const priceHint = priceCode
    ? `想看價格：回 ${priceCode}（或打「${hintName}價格」）`
    : `想看價格：直接打「${hintName}價格」`;

  const bodyLines = [
    ...intro.map((x) => `• ${x}`),
    specLine ? `\n${specLine}` : "",
    ing.length ? `\n成分：${ing.join("、")}` : "",
    usage.length ? `\n食用建議：${usage.join(" / ")}` : "",
    `\n${priceHint}`,
    STORE.infoDisclaimer,
  ].filter(Boolean);

  return flexProductCard({
    title: `【${name}】`,
    subtitleLines: [],
    bodyLines,
    buttons: [
      { label: "看價格", text: priceCode ? String(priceCode) : `${hintName}價格`, style: "primary" },
      { label: "我要買", text: "我要買", style: "secondary" },
      { label: "其他產品", text: "產品", style: "secondary" },
    ],
  });
}

function buildPriceFlex(cat, item) {
  const name = item?.name || cat?.name || "產品";

  const lines = [];
  if (Array.isArray(item?.variants) && item.variants.length) {
    for (const v of item.variants) {
      const act = v.discount ? calcDiscount(v.msrp, v.discount) : null;
      lines.push(`• ${v.label}（${v.spec}）`);
      if (v.msrp) lines.push(`  建議：${money(v.msrp)}`);
      if (act) lines.push(`  活動：${money(act)}（${Math.round(v.discount * 10)}折）`);
      if (v.note) lines.push(`  備註：${v.note}`);
      lines.push("");
    }
  } else {
    const msrp = item?.msrp;
    const discount = item?.discount;
    const act = discount ? calcDiscount(msrp, discount) : null;
    lines.push(msrp ? `建議售價：${money(msrp)}` : "建議售價：—");
    if (act) lines.push(`目前活動價：${money(act)}（${Math.round(discount * 10)}折）`);
  }

  while (lines.length && lines[lines.length - 1] === "") lines.pop();
  lines.push("");
  lines.push(STORE.priceNote);

  return flexProductCard({
    title: `【${name} 價格】`,
    subtitleLines: [],
    bodyLines: lines,
    buttons: [
      { label: "我要買", text: "我要買", style: "primary" },
      { label: "其他產品", text: "產品", style: "secondary" },
    ],
  });
}

/** =========================
 * 自然語句：產品辨識
 * ========================= */
function detectCatIdFromText(t) {
  const s = String(t || "");
  if (includesAny(s, ["龜鹿膏"])) return "gel";
  if (includesAny(s, ["龜鹿飲"])) return "drink";
  if (includesAny(s, ["鹿茸粉", "鹿茸"])) return "antler";
  if (includesAny(s, ["龜鹿湯塊", "湯塊", "膠"])) return "soup";
  return null;
}

/** =========================
 * 訂單辨識（含湯塊 variants）
 * ========================= */
const cnMap = { 一:1, 二:2, 兩:2, 三:3, 四:4, 五:5, 六:6, 七:7, 八:8, 九:9, 十:10 };
function toNum(x) {
  if (!x) return null;
  if (/^\d+$/.test(x)) return Number(x);
  if (cnMap[x] != null) return cnMap[x];
  return null;
}
function parseSoupVariantKey(text) {
  const s = String(text || "");
  // 2兩 / 75g
  if (includesAny(s, ["2兩", "二兩", "75g", "75克", "75公克"])) return "75g";
  // 4兩 / 150g
  if (includesAny(s, ["4兩", "四兩", "150g", "150克", "150公克"])) return "150g";
  // 半斤 / 300g
  if (includesAny(s, ["半斤", "300g", "300克", "300公克"])) return "300g";
  // 一斤 / 600g
  if (includesAny(s, ["一斤", "600g", "600克", "600公克"])) return "600g";
  return null;
}

function parseOrder(text) {
  const s = normalizeText(text);
  const items = [];

  const patterns = [
    { name: "龜鹿膏", catId: "gel", re: /(龜鹿膏)\s*([0-9一二兩三四五六七八九十]{1,3})?\s*(罐|瓶)?/g },
    { name: "龜鹿飲", catId: "drink", re: /(龜鹿飲)\s*([0-9一二兩三四五六七八九十]{1,3})?\s*(包|袋|瓶)?/g },
    { name: "鹿茸粉", catId: "antler", re: /(鹿茸粉|鹿茸)\s*([0-9一二兩三四五六七八九十]{1,3})?\s*(罐)?/g },
    { name: "龜鹿湯塊（膠）", catId: "soup", re: /(龜鹿湯塊|湯塊|膠)\s*([0-9一二兩三四五六七八九十]{1,3})?\s*(盒|份|塊)?/g },
  ];

  for (const p of patterns) {
    let m;
    while ((m = p.re.exec(s)) !== null) {
      const qty = toNum(m[2]) || null;
      const variantKey = p.catId === "soup" ? parseSoupVariantKey(text) : null;
      items.push({ catId: p.catId, name: p.name, qty, variantKey });
    }
  }

  // merge：同 catId + variantKey 合併 qty（取最大或相加都可；這裡用相加更貼近直覺）
  const merged = {};
  for (const it of items) {
    const key = `${it.catId}::${it.variantKey || ""}`;
    if (!merged[key]) merged[key] = { ...it, qty: it.qty || 1 };
    else merged[key].qty = (merged[key].qty || 1) + (it.qty || 1);
  }
  const out = Object.values(merged);
  if (!out.length) return null;

  const strongBuy = includesAny(s, ["我要買", "下單", "訂購", "想買", "要買", "買", "訂"]);
  return { items: out, strongBuy };
}

/** =========================
 * 從 products.json 算價
 * ========================= */
function findUnitPriceFromProducts(idx, catId, variantKey) {
  const cat = idx.byCatId[catId];
  const item = Array.isArray(cat?.items) ? cat.items[0] : null;
  if (!item) return null;

  // variants（湯塊）
  if (Array.isArray(item.variants) && item.variants.length) {
    // 以 spec 或 label 對應 variantKey
    const v = item.variants.find((x) => {
      const spec = String(x.spec || "").toLowerCase();
      const label = String(x.label || "");
      if (variantKey === "75g") return spec.includes("75") || label.includes("2兩") || label.includes("二兩");
      if (variantKey === "150g") return spec.includes("150") || label.includes("4兩") || label.includes("四兩");
      if (variantKey === "300g") return spec.includes("300") || label.includes("半斤");
      if (variantKey === "600g") return spec.includes("600") || label.includes("一斤");
      return false;
    }) || null;

    if (!v) return { unit: null, name: item.name || cat.name, spec: "（請補規格：2兩/4兩/半斤/一斤）" };

    const unit = v.discount ? calcDiscount(v.msrp, v.discount) : v.msrp || null;
    return {
      unit,
      name: item.name || cat.name,
      spec: `${v.label} ${v.spec}`,
      msrp: v.msrp || null,
      discount: v.discount || null,
      note: v.note || null,
    };
  }

  // 一般品項
  const msrp = item.msrp || null;
  const unit = item.discount ? calcDiscount(msrp, item.discount) : msrp;
  return {
    unit,
    name: item.name || cat.name,
    spec: item.spec || "",
    msrp,
    discount: item.discount || null,
    note: null,
  };
}

function buildOrderSummaryFlex(pending) {
  const lines = [];
  for (const it of pending.items) {
    const qty = it.qty || 1;
    const unitTxt = it.unit ? money(it.unit) : "（待確認）";
    const lineTxt = it.line != null ? money(it.line) : "（待確認）";
    const spec = it.spec ? `｜${it.spec}` : "";
    lines.push(`• ${it.name}${spec} × ${qty}`);
    lines.push(`  單價：${unitTxt}　小計：${lineTxt}`);
    if (it.note) lines.push(`  備註：${it.note}`);
  }

  lines.push("");
  lines.push(pending.total != null ? `合計：${money(pending.total)}` : "合計：待確認（請補規格/數量）");
  lines.push("");
  lines.push(STORE.priceNote);

  return flexProductCard({
    title: "【訂單確認】",
    subtitleLines: ["你可以直接回「確認下單」或「改一下」🙂"],
    bodyLines: lines,
    buttons: [
      { label: "確認下單", text: "確認下單", style: "primary" },
      { label: "改一下", text: "修改訂單", style: "secondary" },
      { label: "主選單", text: "選單", style: "secondary" },
    ],
  });
}

/** =========================
 * 購買流程（更柔性）
 * ========================= */
function startBuyFlow(userId, presetItemsText = null) {
  updateUser(userId, (u) => {
    u.state.buy = {
      active: true,
      step: presetItemsText ? "choose_method" : "ask_items",
      method: null,
      itemsText: presetItemsText,
      name: null,
      phone: null,
      address: null,
    };
  });
}
function stopBuyFlow(userId) {
  updateUser(userId, (u) => {
    u.state.buy = { active: false, step: null, method: null, itemsText: null, name: null, phone: null, address: null };
  });
}
function buyExplain(method) {
  if (method === "home") return `好的🙂 我用【宅配】幫您處理。\n請補：收件姓名＋電話＋地址`;
  if (method === "c2c") return `好的🙂 我用【超商店到店】幫您處理。\n請補：收件人姓名＋電話 + 取貨門市（店名/店號/地址）`;
  if (method === "deliver") return `好的🙂 我用【雙北親送】幫您處理。\n請補：收件姓名＋電話＋地址\n\n${STORE.deliverNote}`;
  if (method === "pickup") return `好的🙂 我用【到店自取】幫您處理。\n請補：聯絡姓名＋電話\n取貨時間：${STORE.hours.pickupLate}`;
  return "";
}
function handleBuyFlow(userId, rawText) {
  const u = ensureUser(userId);
  const b = u.state.buy;
  if (!b?.active) return null;

  const text = normalizeText(rawText);

  if (text === "0" || text === "選單" || text === "主選單") {
    stopBuyFlow(userId);
    return { reply: mainMenuText(), menu: "main" };
  }

  const method =
    includesAny(text, ["宅配"]) ? "home" :
    includesAny(text, ["店到店", "超商"]) ? "c2c" :
    includesAny(text, ["親送", "雙北"]) ? "deliver" :
    includesAny(text, ["自取", "到店"]) ? "pickup" :
    (["91","92","93","94"].includes(text) ? ({ "91":"home","92":"c2c","93":"deliver","94":"pickup"}[text]) : null);

  if (b.step === "ask_items") {
    const po = parseOrder(text);
    if (po) {
      const itemsText = po.items.map(i => `${i.name}${i.variantKey ? `(${i.variantKey})` : ""}${i.qty ? ` ${i.qty}` : ""}`).join("、");
      updateUser(userId, (x) => { x.state.buy.itemsText = itemsText; x.state.buy.step = "choose_method"; });
      return { reply: `收到🙂 我先幫您記下：${itemsText}\n\n想用哪種方式？（宅配/店到店/親送/自取）`, menu: "buy" };
    }
    return { reply: "好的🙂 方便跟我說一下要買哪些品項＋數量嗎？\n例：龜鹿膏 1 罐、龜鹿飲 5 包、湯塊 半斤 1", menu: "buy" };
  }

  if (b.step === "choose_method") {
    if (!method) return { reply: "你想用哪種方式？宅配 / 店到店 / 親送 / 自取（也可按下方快捷鍵）", menu: "buy" };
    updateUser(userId, (x) => { x.state.buy.method = method; x.state.buy.step = "collect_contact"; });
    return { reply: buyExplain(method), menu: "buy" };
  }

  if (b.step === "collect_contact") {
    const digits = safeDigits(rawText);
    const hasPhone = digits.length >= 8 && digits.length <= 15;

    updateUser(userId, (x) => {
      const cur = x.state.buy;

      if (hasPhone) cur.phone = digits;

      const looksLikeAddress =
        rawText.length >= 6 &&
        (rawText.includes("路") || rawText.includes("街") || rawText.includes("巷") || rawText.includes("號") || rawText.includes("樓") || rawText.includes("段") || rawText.includes("弄"));

      if (cur.method === "c2c" && includesAny(rawText, ["門市", "店", "路", "街", "號", "全家", "7-11", "711", "萊爾富", "OK"])) {
        cur.address = rawText.trim();
      }
      if ((cur.method === "home" || cur.method === "deliver") && looksLikeAddress) {
        cur.address = rawText.trim();
      }

      const nn = normalizeText(rawText.replace(digits, ""));
      const nameOk =
        nn.length >= 2 &&
        nn.length <= 10 &&
        !includesAny(nn, ["路", "街", "巷", "號", "樓", "段", "弄", "門市", "店", "台北", "新北", "市", "縣"]);

      if (nameOk) cur.name = nn.trim();
    });

    const latest = ensureUser(userId).state.buy;
    const need = [];
    if (!latest.name) need.push("姓名");
    if (!latest.phone) need.push("電話");
    if (latest.method !== "pickup" && !latest.address) need.push(latest.method === "c2c" ? "取貨門市" : "地址");

    if (need.length) return { reply: `我有收到🙂 目前還需要：${need.join("、")}\n（可以分段貼，也可以一次貼完）`, menu: "buy" };

    const summary = [
      "✅ 已收到購買資訊：",
      `品項：${latest.itemsText || "（尚未填）"}`,
      `方式：${latest.method === "home" ? "宅配" : latest.method === "c2c" ? "超商店到店" : latest.method === "deliver" ? "雙北親送" : "到店自取"}`,
      `聯絡：${latest.name} ${latest.phone}`,
      latest.method === "pickup" ? "" : `${latest.method === "c2c" ? "取貨門市" : "地址"}：${latest.address}`,
      "",
      STORE.orderNote,
      "",
      "我接著會回覆：出貨/取貨安排與付款資訊🙂",
    ].filter(Boolean).join("\n");

    stopBuyFlow(userId);
    return { reply: summary, menu: "main" };
  }

  return { reply: "我有收到🙂 你也可以回「選單」回主選單。", menu: "main" };
}

/** =========================
 * 敏感字眼導流（柔性）
 * ========================= */
const SENSITIVE = [
  "孕婦","懷孕","備孕","哺乳","餵母乳",
  "慢性病","三高","高血壓","糖尿病","洗腎","肝","心臟",
  "癌","癌症","化療","放療","手術","術後",
  "用藥","抗凝血","阿斯匹靈","warfarin",
  "能不能吃","可以吃嗎","適不適合","副作用","禁忌","過敏"
];
function sensitiveText() {
  const tail =
    STORE.doctorLineId && STORE.doctorLink
      ? `如果你方便，我可以幫你轉專人協助：\n➤ ${STORE.doctorLineId}\n➤ ${STORE.doctorLink}`
      : "如果你願意，先提供：年齡/體質/目前用藥，我們會用更安全的方式協助你🙂";

  return `這類問題會因個人狀況不同，為了更安全、也避免你白跑一趟🙂
我建議先了解你的狀況再給建議。

${tail}

（回「選單」可回主選單）`;
}

/** =========================
 * Webhook（簽章驗證：/webhook 前不要 express.json）
 * ========================= */
app.get("/", (req, res) => res.status(200).send("OK"));

app.post("/webhook", line.middleware(config), async (req, res) => {
  try {
    const events = req.body?.events || [];
    await Promise.all(events.map(handleEvent));
    res.status(200).end();
  } catch (err) {
    console.error("Webhook error:", err?.message || err);
    res.status(500).end();
  }
});

// 其他路由才用 json
app.use(express.json());

app.get("/health", async (req, res) => {
  const p = await getProducts();
  res.json({
    ok: true,
    time: new Date().toISOString(),
    productsUrl: PRODUCTS_URL || null,
    version: p?.version || 0,
    updatedAt: p?.updatedAt || null,
  });
});

/** =========================
 * 主事件處理
 * ========================= */
async function handleEvent(event) {
  if (event.type !== "message" || event.message?.type !== "text") return null;

  const userId = event.source?.userId;
  const raw = event.message.text || "";
  const text = normalizeText(raw);

  if (!userId) return client.replyMessage(event.replyToken, textMessage(mainMenuText(), "main"));

  const user = ensureUser(userId);

  /** 真人模式 */
  if (text === "解除真人") {
    setHumanMode(userId, false);
    stopBuyFlow(userId);
    setPendingOrder(userId, null);
    return client.replyMessage(event.replyToken, textMessage(mainMenuText(), "main"));
  }
  if (includesAny(text, ["真人", "人工", "客服"]) || text === "6") {
    setHumanMode(userId, true);
    stopBuyFlow(userId);
    return client.replyMessage(event.replyToken, textMessage(STORE.humanModeNote, "main"));
  }
  if (user.state.humanMode) {
    if (text === "選單" || text === "0") {
      setHumanMode(userId, false);
      stopBuyFlow(userId);
      setPendingOrder(userId, null);
      return client.replyMessage(event.replyToken, textMessage(mainMenuText(), "main"));
    }
    return client.replyMessage(event.replyToken, textMessage("我有收到🙂 已轉真人協助中。\n要回主選單回：選單\n要解除真人回：解除真人", "main"));
  }

  /** 主選單 */
  if (text === "選單" || text === "0" || text === "主選單") {
    stopBuyFlow(userId);
    setPendingOrder(userId, null);
    return client.replyMessage(event.replyToken, textMessage(mainMenuText(), "main"));
  }

  /** 購買流程（若正在進行） */
  const buyHandled = handleBuyFlow(userId, raw);
  if (buyHandled) return client.replyMessage(event.replyToken, textMessage(buyHandled.reply, buyHandled.menu));

  /** 敏感字 */
  if (includesAny(text, SENSITIVE)) {
    return client.replyMessage(event.replyToken, textMessage(sensitiveText(), "main"));
  }

  /** 讀 products.json */
  const productsJson = await getProducts();
  const idx = buildProductIndex(productsJson);

  /** 直接導向：官網/門市 */
  if (includesAny(text, ["官網", "網站", "網址"])) {
    return client.replyMessage(event.replyToken, textMessage(`官網：\n${STORE.website}`, "main"));
  }
  if (includesAny(text, ["門市", "地址", "電話", "營業", "幾點", "來電"])) {
    return client.replyMessage(event.replyToken, textMessage(storeInfoText(), "store"));
  }

  /** 訂單確認（Flex 按鈕文字） */
  if (text === "修改訂單" || includesAny(text, ["改一下", "修改"])) {
    setPendingOrder(userId, null);
    startBuyFlow(userId, null);
    return client.replyMessage(event.replyToken, textMessage("沒問題🙂 你想改成哪些品項＋數量？\n例：龜鹿膏 1 罐、龜鹿飲 5 包、湯塊 半斤 1", "buy"));
  }
  if (text === "確認下單" || includesAny(text, ["確認", "就這樣", "可以下單"])) {
    const latest = ensureUser(userId).state.pendingOrder;
    // 沒有 pendingOrder 就直接進購買流程
    if (!latest) {
      startBuyFlow(userId, null);
      return client.replyMessage(event.replyToken, textMessage("好的🙂 想用哪種方式？（宅配/店到店/親送/自取）\n也可以直接跟我說要買哪些品項＋數量。", "buy"));
    }
    // 有 pendingOrder：帶入 itemsText
    const itemsText = latest.items.map(i => `${i.name}${i.spec ? `(${i.spec})` : ""} × ${i.qty}`).join("、");
    startBuyFlow(userId, itemsText);
    return client.replyMessage(event.replyToken, textMessage(`收到🙂 你這單是：${itemsText}\n\n想用哪種方式？（宅配/店到店/親送/自取）`, "buy"));
  }

  /** 快速語意：怎麼買 */
  if (includesAny(text, ["怎麼買", "購買", "下單", "訂購", "我要買"])) {
    const po = parseOrder(text);
    if (po) {
      const pending = buildPendingFromParsedOrder(idx, po);
      setPendingOrder(userId, pending);
      return client.replyMessage(
        event.replyToken,
        flexMessage("訂單確認", buildOrderSummaryFlex(pending), "order_confirm")
      );
    }
    startBuyFlow(userId, null);
    return client.replyMessage(event.replyToken, textMessage("好的🙂 你可以直接跟我說：要買哪些品項＋數量\n例：龜鹿膏 1 罐、龜鹿飲 5 包、湯塊 半斤 1", "buy"));
  }

  /** 代碼捷徑 */
  if (["1","2","3","4","5","7"].includes(text)) {
    if (text === "1") return client.replyMessage(event.replyToken, textMessage("想看哪個？你可以直接打品名（龜鹿膏/龜鹿飲/鹿茸粉/龜鹿湯塊）", "products"));
    if (text === "2") return client.replyMessage(event.replyToken, textMessage("你想查哪個規格？直接打品名也可以🙂", "products"));
    if (text === "3") return client.replyMessage(event.replyToken, textMessage("想看哪個價格？直接打「龜鹿膏價格 / 龜鹿飲價格」也可以🙂", "products"));
    if (text === "4") { startBuyFlow(userId, null); return client.replyMessage(event.replyToken, textMessage("好的🙂 你想怎麼取貨/出貨？（宅配/店到店/親送/自取）", "buy")); }
    if (text === "5") return client.replyMessage(event.replyToken, textMessage(storeInfoText(), "store"));
    if (text === "7") return client.replyMessage(event.replyToken, textMessage(`官網：\n${STORE.website}`, "main"));
  }

  // 產品介紹 11~14
  if (Object.keys(CODE_MAP.intro).includes(text)) {
    const catId = CODE_MAP.intro[text];
    const cat = idx.byCatId[catId];
    const item = Array.isArray(cat?.items) ? cat.items[0] : null;
    const { priceCode } = catToCodes(catId);
    updateUser(userId, (u) => { u.state.lastCat = catId; });

    return client.replyMessage(
      event.replyToken,
      flexMessage(`${item?.name || cat?.name || "產品"} 介紹`, buildIntroFlex(catId, cat, item, priceCode), "product_page", { priceCode })
    );
  }

  // 規格 31~34
  if (Object.keys(CODE_MAP.spec).includes(text)) {
    const catId = CODE_MAP.spec[text];
    const cat = idx.byCatId[catId];
    const item = Array.isArray(cat?.items) ? cat.items[0] : null;

    const specText = Array.isArray(item?.variants) && item.variants.length
      ? `【${item?.name || cat?.name} 規格】\n` + item.variants.map(v => `• ${v.label}：${v.spec}${v.note ? `（${v.note}）` : ""}`).join("\n")
      : `【${item?.name || cat?.name} 規格】\n${item?.spec || "—"}`;

    return client.replyMessage(event.replyToken, textMessage(specText, "products"));
  }

  // 價格 51~54
  if (Object.keys(CODE_MAP.price).includes(text)) {
    const catId = CODE_MAP.price[text];
    const cat = idx.byCatId[catId];
    const item = Array.isArray(cat?.items) ? cat.items[0] : null;

    return client.replyMessage(
      event.replyToken,
      flexMessage(`${item?.name || cat?.name} 價格`, buildPriceFlex(cat, item), "products")
    );
  }

  /** 非代碼：自然語句（產品/價格/規格/吃法） */
  const catId = detectCatIdFromText(text);
  const wantsPrice = includesAny(text, ["價格", "價錢", "多少錢", "售價"]);
  const wantsSpec = includesAny(text, ["規格", "幾g", "幾cc", "容量", "重量"]);
  const wantsUsage = includesAny(text, ["怎麼吃", "食用", "用法", "一天", "建議"]);
  const wantsIntro = includesAny(text, ["介紹", "是什麼", "內容", "成分"]) || (!!catId && !wantsPrice && !wantsSpec && !wantsUsage);

  /** 若文字像「直接下單」→ 先做訂單 Flex 確認 */
  const po = parseOrder(text);
  if (po && po.strongBuy) {
    const pending = buildPendingFromParsedOrder(idx, po);
    setPendingOrder(userId, pending);
    return client.replyMessage(
      event.replyToken,
      flexMessage("訂單確認", buildOrderSummaryFlex(pending), "order_confirm")
    );
  }

  if (catId) {
    const cat = idx.byCatId[catId];
    const item = Array.isArray(cat?.items) ? cat.items[0] : null;
    const { priceCode } = catToCodes(catId);

    // 規格查詢（湯塊可帶變體）
    if (wantsSpec) {
      const specText = Array.isArray(item?.variants) && item.variants.length
        ? `【${item?.name || cat?.name} 規格】\n` + item.variants.map(v => `• ${v.label}：${v.spec}${v.note ? `（${v.note}）` : ""}`).join("\n")
        : `【${item?.name || cat?.name} 規格】\n${item?.spec || "—"}`;
      return client.replyMessage(event.replyToken, textMessage(specText, "product_page", { priceCode }));
    }

    // 價格用 Flex
    if (wantsPrice) {
      return client.replyMessage(
        event.replyToken,
        flexMessage(`${item?.name || cat?.name} 價格`, buildPriceFlex(cat, item), "product_page", { priceCode })
      );
    }

    // 介紹/怎麼吃 → 介紹 Flex（並修正你圈起來那句：直接指到本品價格）
    if (wantsUsage || wantsIntro) {
      updateUser(userId, (u) => { u.state.lastCat = catId; });
      return client.replyMessage(
        event.replyToken,
        flexMessage(`${item?.name || cat?.name} 介紹`, buildIntroFlex(catId, cat, item, priceCode), "product_page", { priceCode })
      );
    }
  }

  /** 只說「產品/有哪些」 */
  if (includesAny(text, ["產品", "有哪些", "有賣什麼"])) {
    return client.replyMessage(event.replyToken, textMessage("目前主力品項有：龜鹿膏、龜鹿飲、鹿茸粉、龜鹿湯塊（膠）。\n你想先看哪個？（直接打品名就行🙂）", "products"));
  }
  if (includesAny(text, ["價格", "多少錢"])) {
    return client.replyMessage(event.replyToken, textMessage("你想查哪個價格？直接打「龜鹿膏價格 / 龜鹿飲價格」也可以🙂", "products"));
  }

  /** Fallback */
  return client.replyMessage(event.replyToken, textMessage("我有收到🙂\n你可以直接打：\n• 龜鹿膏 / 龜鹿飲 / 鹿茸粉 / 龜鹿湯塊\n• 也可以加上「價格/規格/怎麼吃」\n\n或按下方快捷鍵。", "main"));
}

/** =========================
 * 由 parseOrder + products.json 生成 pendingOrder（含小計/合計）
 * ========================= */
function buildPendingFromParsedOrder(idx, po) {
  const items = [];
  let total = 0;
  let totalReady = true;

  for (const it of po.items) {
    const qty = it.qty || 1;
    const priceInfo = findUnitPriceFromProducts(idx, it.catId, it.variantKey);
    const unit = priceInfo?.unit ?? null;

    const line = unit != null ? unit * qty : null;
    if (line != null) total += line;
    else totalReady = false;

    items.push({
      catId: it.catId,
      variantKey: it.variantKey || null,
      name: priceInfo?.name || it.name,
      spec: priceInfo?.spec || "",
      qty,
      unit,
      line,
      note: priceInfo?.note || null,
    });
  }

  return { items, total: totalReady ? total : null };
}

app.listen(PORT, () => {
  console.log(`LINE bot listening on port ${PORT}`);
});
