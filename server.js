"use strict";

/**
 * 仙加味・龜鹿 LINE OA Bot（最終可部署版｜卡片按鈕｜串接 products.json）
 *
 * ✅ 特色
 * - 全部選單用「卡片按鈕」（Template Buttons / Carousel），不再用 Quick Reply，老人家更好點。
 * - 串接 products.json（建議用環境變數 PRODUCTS_URL 指向官網 products.json）
 * - 價格只在 LINE 顯示；官網可不顯示價格，但 products.json 仍可保留 msrp/discount 供 LINE 計算。
 * - 支援：宅配 / 超商店到店 / 雙北親送 / 到店自取
 * - 會嘗試解析「品項 + 數量」，自動算小計/總計；雙北親送會用地址關鍵字判斷是否可親送。
 *
 * ✅ Render 環境變數
 * - LINE_CHANNEL_ACCESS_TOKEN（必填）
 * - LINE_CHANNEL_SECRET（必填）
 * - PRODUCTS_URL（選填，例：https://ts15825868.github.io/TaiShing/products.json ）
 * - PORT（Render 自帶，不用手動設）
 *
 * 相容舊命名（若你 Render 還留著）
 * - CHANNEL_ACCESS_TOKEN / CHANNEL_SECRET
 */

const express = require("express");
const line = require("@line/bot-sdk");
const fs = require("fs");
const path = require("path");
const https = require("https");
const http = require("http");

/** =========================
 * 0) Env / LINE config
 * ========================= */
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

const hasLineCred = Boolean(ACCESS_TOKEN && CHANNEL_SEC);

if (!hasLineCred) {
  console.warn(
    "[WARN] 缺少 LINE 金鑰：請在 Render 設定 LINE_CHANNEL_ACCESS_TOKEN 與 LINE_CHANNEL_SECRET。\n" +
      "服務仍會啟動（避免 Exit 1），但 /webhook 會回 500。"
  );
}

const config = { channelAccessToken: ACCESS_TOKEN, channelSecret: CHANNEL_SEC };
const client = new line.Client(config);

/** =========================
 * 1) 基本資訊
 * ========================= */
const STORE = {
  brandName: "仙加味・龜鹿",
  address: "台北市萬華區西昌街 52 號",
  phoneDisplay: "(02) 2381-2990",
  phoneTel: "0223812990",
  website: "https://ts15825868.github.io/TaiShing/index.html",
  productsJsonUrl: PRODUCTS_URL || "",
  mapUrl:
    "https://www.google.com/maps/search/?api=1&query=%E5%8F%B0%E5%8C%97%E5%B8%82%E8%90%AC%E8%8F%AF%E5%8D%80%E8%A5%BF%E6%98%8C%E8%A1%97+52+%E8%99%9F",
  replyNote: "看到會盡快回覆🙂",
  priceNote1: "※ 不同通路因服務內容／搭配方案不同，價格可能略有差異🙂",
  priceNote2: "※ 到店另有不定期活動或搭配方案，依現場為準。",
  deliverNote: "雙北親送需視路線/時間安排；若不便親送會改以宅配或店到店協助。",
  infoDisclaimer: "※ 產品資訊以實際包裝標示為準（不同批次可能略有差異）。",
};

/** =========================
 * 2) 資料儲存（簡單狀態）
 * ========================= */
const DATA_DIR = path.join(__dirname, "data");
const USERS_FILE = path.join(DATA_DIR, "users.json");
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

function loadUsers() {
  try {
    if (!fs.existsSync(USERS_FILE)) return {};
    return JSON.parse(fs.readFileSync(USERS_FILE, "utf8") || "{}");
  } catch {
    return {};
  }
}
function saveUsers(users) {
  try {
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), "utf8");
  } catch {}
}
function ensureUser(userId) {
  const users = loadUsers();
  users[userId] = users[userId] || {};
  users[userId].state = users[userId].state || { step: null, buyMethod: null };
  users[userId].draft = users[userId].draft || { cart: null, name: null, phone: null, address: null, c2c: null };
  saveUsers(users);
  return users[userId];
}
function updateUser(userId, fn) {
  const users = loadUsers();
  users[userId] = users[userId] || {};
  users[userId].state = users[userId].state || {};
  users[userId].draft = users[userId].draft || {};
  fn(users[userId]);
  saveUsers(users);
}

/** =========================
 * 3) products.json（遠端抓取 + 快取）
 * ========================= */
const FALLBACK_PRODUCTS = {
  version: 1,
  updatedAt: "2026-03-01T00:00:00.000Z",
  categories: [
    {
      id: "gel",
      name: "龜鹿膏",
      items: [
        {
          id: "gel_100g",
          name: "龜鹿膏",
          spec: "100g/罐",
          msrp: 2000,
          discount: 0.9,
          ingredients: ["龜板萃取物", "鹿角萃取物", "粉光蔘", "枸杞", "紅棗", "黃耆"],
          intro: ["承襲傳統熬製工序，長時間慢火濃縮製成。", "口感溫潤濃稠，可直接食用或以溫水化開。"],
          usage: ["每日一次，一小匙（初次可從半匙開始）", "可飯後或空腹前後皆可（以個人習慣為準）", "食用期間避免冰飲"],
        },
      ],
    },
    {
      id: "drink",
      name: "龜鹿飲",
      items: [
        {
          id: "drink_180cc",
          name: "龜鹿飲",
          spec: "180cc/包",
          msrp: 200,
          discount: 0.9,
          ingredients: ["水", "鹿角", "全龜", "枸杞", "黃耆", "紅棗", "粉光蔘"],
          intro: ["即飲型設計，方便日常補充與外出攜帶。", "可溫熱飲用，口感順口。"],
          usage: ["每日一包", "可隔水加熱或溫熱飲用", "避免冰飲"],
        },
      ],
    },
    {
      id: "antler",
      name: "鹿茸粉",
      items: [
        {
          id: "antler_75g",
          name: "鹿茸粉",
          spec: "75g/罐",
          msrp: 2000,
          discount: 0.9,
          ingredients: ["鹿茸"],
          intro: ["粉末型設計，便於少量調配。"],
          usage: ["建議少量開始，搭配溫水或飲品", "若容易口乾或睡不好，建議減量或間隔食用"],
        },
      ],
    },
    {
      id: "soup",
      name: "龜鹿湯塊（膠）",
      items: [
        {
          id: "soup_block",
          name: "龜鹿湯塊（膠）",
          spec: "多規格",
          ingredients: ["鹿角萃取物", "全龜萃取物"],
          intro: ["傳統製程濃縮成塊，方便燉煮湯品使用。"],
          usage: ["加入適量水煮滾後，可搭配雞肉或其他食材燉煮", "建議熱食熱飲"],
          variants: [
            { label: "2兩", spec: "75g", msrp: 1000, discount: null, note: "盒子規劃中（目前以傳統包裝出貨）" },
            { label: "4兩", spec: "150g", msrp: 2000, discount: null },
            { label: "半斤", spec: "300g", msrp: 4000, discount: 0.9 },
            { label: "一斤", spec: "600g", msrp: 8000, discount: 0.9 },
          ],
        },
      ],
    },
  ],
};

let productsCache = { at: 0, data: FALLBACK_PRODUCTS };

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith("https") ? https : http;
    lib
      .get(url, (res) => {
        let body = "";
        res.on("data", (c) => (body += c));
        res.on("end", () => {
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
            try {
              resolve(JSON.parse(body));
            } catch (e) {
              reject(e);
            }
          } else {
            reject(new Error(`HTTP ${res.statusCode || 0}`));
          }
        });
      })
      .on("error", reject);
  });
}

function isValidProductsJson(p) {
  return p && Array.isArray(p.categories);
}

async function getProducts() {
  const ttlMs = 5 * 60 * 1000;
  if (Date.now() - productsCache.at < ttlMs) return productsCache.data;

  if (STORE.productsJsonUrl) {
    try {
      const data = await fetchJson(STORE.productsJsonUrl);
      if (isValidProductsJson(data)) {
        productsCache = { at: Date.now(), data };
        return data;
      }
    } catch (e) {
      console.warn("[WARN] 讀取 PRODUCTS_URL 失敗，改用備援資料：", e.message || e);
    }
  }

  try {
    const localPath = path.join(__dirname, "products.json");
    if (fs.existsSync(localPath)) {
      const data = JSON.parse(fs.readFileSync(localPath, "utf8"));
      if (isValidProductsJson(data)) {
        productsCache = { at: Date.now(), data };
        return data;
      }
    }
  } catch {}

  productsCache = { at: Date.now(), data: FALLBACK_PRODUCTS };
  return productsCache.data;
}

function money(n) {
  const x = Math.round(Number(n) || 0);
  return "$" + String(x).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}
function calcDiscount(msrp, d) {
  if (!msrp || !d) return null;
  return Math.round(msrp * d);
}
function norm(s) {
  return String(s || "")
    .replace(/\u3000/g, " ")
    .replace(/[，,、/／]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** =========================
 * 4) LINE Message Builders（卡片）
 * ========================= */
function buttonsTemplate(title, text, actions) {
  return {
    type: "template",
    altText: title,
    template: {
      type: "buttons",
      title: title.slice(0, 40),
      text: text.slice(0, 160),
      actions,
    },
  };
}

function carouselTemplate(altText, columns) {
  return {
    type: "template",
    altText,
    template: {
      type: "carousel",
      columns,
    },
  };
}

function actMsg(label, text) {
  return { type: "message", label: label.slice(0, 20), text };
}
function actUri(label, uri) {
  return { type: "uri", label: label.slice(0, 20), uri };
}

function mainMenuCard() {
  return buttonsTemplate(STORE.brandName, "想先看哪個？直接點就好🙂", [
    actMsg("產品介紹", "產品介紹"),
    actMsg("看價格", "看價格"),
    actMsg("怎麼購買", "怎麼購買"),
    actMsg("門市資訊", "門市資訊"),
  ]);
}

async function productsCard() {
  const p = await getProducts();
  const flat = flattenProducts(p);
  const columns = flat
    .filter((x) => x.kind === "item")
    .slice(0, 4)
    .map((x) => ({
      title: x.displayName.slice(0, 40),
      text: "請選擇要看什麼🙂",
      actions: [
        actMsg("介紹", `介紹 ${x.displayName}`),
        actMsg("規格", `規格 ${x.displayName}`),
        actMsg("價格", `價格 ${x.displayName}`),
        actMsg("我要買", `我要買 ${x.displayName}`),
      ],
    }));
  return carouselTemplate("產品選單", columns);
}

function buyMethodCard() {
  return buttonsTemplate("怎麼購買", "選一種方式，我再引導你填資料🙂", [
    actMsg("宅配", "宅配"),
    actMsg("超商店到店", "店到店"),
    actMsg("雙北親送", "雙北親送"),
    actMsg("到店自取", "到店自取"),
  ]);
}

function storeCard() {
  return buttonsTemplate("門市資訊", `${STORE.address}\n${STORE.phoneDisplay}\n${STORE.replyNote}`, [
    actUri("地圖", STORE.mapUrl),
    actUri("一鍵來電", `tel:${STORE.phoneTel}`),
    actUri("官網", STORE.website),
    actMsg("回主選單", "選單"),
  ]);
}

/** =========================
 * 5) Products flatten + query
 * ========================= */
function flattenProducts(pjson) {
  const out = [];
  for (const c of pjson.categories || []) {
    for (const item of c.items || []) {
      out.push({
        kind: "item",
        categoryId: c.id,
        itemId: item.id,
        displayName: item.name,
        spec: item.spec,
        msrp: item.msrp,
        discount: item.discount,
        ingredients: item.ingredients || [],
        intro: item.intro || [],
        usage: item.usage || [],
        variants: item.variants || null,
      });
      if (Array.isArray(item.variants)) {
        for (const v of item.variants) {
          out.push({
            kind: "variant",
            categoryId: c.id,
            itemId: item.id,
            displayName: `${item.name} ${v.label}`,
            spec: v.spec,
            msrp: v.msrp,
            discount: v.discount,
            note: v.note || null,
          });
        }
      }
    }
  }
  return out;
}

async function findProductByText(text) {
  const pjson = await getProducts();
  const flat = flattenProducts(pjson);
  const t = String(text || "");

  const direct = ["龜鹿膏", "龜鹿飲", "鹿茸粉", "龜鹿湯塊", "龜鹿湯塊（膠）", "湯塊", "龜鹿膠", "二仙膠", "仙膠"];
  const hitKey = direct.find((k) => t.includes(k));
  if (!hitKey) return null;

  if (["湯塊", "龜鹿湯塊", "龜鹿湯塊（膠）", "龜鹿膠", "二仙膠", "仙膠"].includes(hitKey)) {
    return flat.find((x) => x.kind === "item" && x.categoryId === "soup") || null;
  }
  if (hitKey === "龜鹿膏") return flat.find((x) => x.kind === "item" && x.categoryId === "gel") || null;
  if (hitKey === "龜鹿飲") return flat.find((x) => x.kind === "item" && x.categoryId === "drink") || null;
  if (hitKey === "鹿茸粉") return flat.find((x) => x.kind === "item" && x.categoryId === "antler") || null;
  return null;
}

/** =========================
 * 6) Cart parse + total
 * ========================= */
function parseQtyPairs(text) {
  const t = norm(text);
  const pairs = [];

  const pick = (name, re) => {
    let m;
    while ((m = re.exec(t))) {
      const qty = Number(m[1]);
      if (qty > 0) pairs.push({ name, qty });
    }
  };

  pick("龜鹿膏", /龜鹿膏\s*(\d{1,3})/g);
  pick("龜鹿飲", /龜鹿飲\s*(\d{1,3})/g);
  pick("鹿茸粉", /鹿茸粉\s*(\d{1,3})/g);

  // 湯塊（不分規格也可以）
  let m;
  const soupRe = /(龜鹿湯塊（膠）|龜鹿湯塊|湯塊|龜鹿膠|二仙膠|仙膠)\s*(\d{1,3})/g;
  while ((m = soupRe.exec(t))) {
    const qty = Number(m[2]);
    if (qty > 0) pairs.push({ name: "龜鹿湯塊（膠）", qty });
  }

  // 湯塊規格 + 數量
  const variant = [
    { k: "2兩", spec: "75g" },
    { k: "4兩", spec: "150g" },
    { k: "半斤", spec: "300g" },
    { k: "一斤", spec: "600g" },
    { k: "75g", spec: "75g" },
    { k: "150g", spec: "150g" },
    { k: "300g", spec: "300g" },
    { k: "600g", spec: "600g" },
  ];
  for (const v of variant) {
    const r = new RegExp(`${v.k}\\s*(\\d{1,3})`, "g");
    while ((m = r.exec(t))) {
      const qty = Number(m[1]);
      if (qty > 0) pairs.push({ name: "龜鹿湯塊（膠）", qty, variantSpec: v.spec });
    }
  }

  return pairs;
}

function addressIsTaipeiOrNewTaipei(addr) {
  const s = String(addr || "");
  return s.includes("台北") || s.includes("臺北") || s.includes("新北");
}

async function buildQuoteFromPairs(pairs) {
  const pjson = await getProducts();
  const flat = flattenProducts(pjson);

  const merged = new Map();
  for (const p of pairs) {
    const key = `${p.name}|${p.variantSpec || ""}`;
    merged.set(key, (merged.get(key) || 0) + Number(p.qty || 0));
  }

  const lines = [];
  let subtotal = 0;

  for (const [k, qty] of merged.entries()) {
    const [name, variantSpec] = k.split("|");

    let item;
    if (name === "龜鹿湯塊（膠）" && variantSpec) {
      item = flat.find((x) => x.kind === "variant" && x.categoryId === "soup" && x.spec === variantSpec);
    } else {
      item = flat.find((x) => x.kind === "item" && x.displayName === name);
    }
    if (!item) continue;

    const msrp = Number(item.msrp || 0);
    const act = item.discount ? calcDiscount(msrp, item.discount) : null;
    const unit = act || msrp;
    const lineTotal = unit * qty;
    subtotal += lineTotal;

    const label = item.kind === "variant" ? `${name} ${item.spec}` : name;
    lines.push(`• ${label} × ${qty} ＝ ${money(lineTotal)}（${money(unit)}/件${act ? " 活動" : ""}）`);
  }

  if (!lines.length) {
    return { ok: false, text: "我有看到🙂 但我抓不到品項與數量。\n你可以這樣打：\n龜鹿膏 2、龜鹿飲 3\n或：湯塊 半斤 1（300g）" };
  }

  return {
    ok: true,
    subtotal,
    text: `我先幫你算小計：\n\n${lines.join("\n")}\n\n小計：${money(subtotal)}\n\n接著請留：收件姓名＋電話＋地址/門市🙂`,
  };
}

/** =========================
 * 7) Text reply builders
 * ========================= */
async function productIntroText(product) {
  if (!product) return "我先確認一下您想看的品項🙂";

  if (product.categoryId === "soup") {
    const pjson = await getProducts();
    const base = flattenProducts(pjson).find((x) => x.kind === "item" && x.categoryId === "soup");
    const variants = (base.variants || [])
      .map((v) => `• ${v.label}（${v.spec}）${v.note ? `｜${v.note}` : ""}`)
      .join("\n");
    return [
      `【${base.displayName}】`,
      ...(base.intro || []).map((x) => `• ${x}`),
      "",
      "規格：",
      variants || "（規格整理中）",
      "",
      "成分：",
      `• ${(base.ingredients || []).join("\n• ")}`,
      "",
      "使用方式：",
      `• ${(base.usage || []).join("\n• ")}`,
      "",
      STORE.infoDisclaimer,
    ].join("\n");
  }

  return [
    `【${product.displayName}】`,
    ...(product.intro || []).map((x) => `• ${x}`),
    "",
    `規格：${product.spec || "-"}`,
    "",
    "成分：",
    `• ${(product.ingredients || []).join("\n• ")}`,
    "",
    "食用建議：",
    `• ${(product.usage || []).join("\n• ")}`,
    "",
    STORE.infoDisclaimer,
  ].join("\n");
}

async function productSpecText(product) {
  if (!product) return "我先確認一下你要看哪個品項的規格🙂";
  if (product.categoryId === "soup") {
    const pjson = await getProducts();
    const base = flattenProducts(pjson).find((x) => x.kind === "item" && x.categoryId === "soup");
    const variants = (base.variants || [])
      .map((v) => `• ${v.label}（${v.spec}）${v.note ? `｜${v.note}` : ""}`)
      .join("\n");
    return `【龜鹿湯塊（膠）規格】\n${variants || "（規格整理中）"}`;
  }
  return `【${product.displayName} 規格】\n${product.spec || "-"}`;
}

async function productPriceText(product) {
  if (!product) return "我先確認一下你要看哪個品項的價格🙂";

  if (product.categoryId === "soup") {
    const pjson = await getProducts();
    const flat = flattenProducts(pjson);
    const variants = flat.filter((x) => x.kind === "variant" && x.categoryId === "soup");
    const out = ["【龜鹿湯塊（膠）價格】", ""]; 
    for (const v of variants) {
      const act = v.discount ? calcDiscount(v.msrp, v.discount) : null;
      out.push(`• ${v.displayName}（${v.spec}）`);
      out.push(`  建議售價：${money(v.msrp)}`);
      if (act) out.push(`  目前活動價：${money(act)}（9折）`);
      if (v.note) out.push(`  備註：${v.note}`);
      out.push("");
    }
    while (out.length && out[out.length - 1] === "") out.pop();
    out.push("", STORE.priceNote1, STORE.priceNote2);
    return out.join("\n");
  }

  const act = product.discount ? calcDiscount(product.msrp, product.discount) : null;
  return [
    `【${product.displayName} 價格】`,
    `建議售價：${money(product.msrp)}`,
    act ? `目前活動價：${money(act)}（9折）` : "",
    "",
    STORE.priceNote1,
    STORE.priceNote2,
  ]
    .filter(Boolean)
    .join("\n");
}

/** =========================
 * 8) Conversation handler
 * ========================= */
async function handleText(userId, text) {
  ensureUser(userId);
  const u = ensureUser(userId);
  const t = norm(text);

  if (!t || t === "0" || t === "選單" || t === "主選單" || t === "menu") {
    updateUser(userId, (x) => {
      x.state.step = null;
      x.state.buyMethod = null;
      x.draft = { cart: null, name: null, phone: null, address: null, c2c: null };
    });
    return [mainMenuCard()];
  }

  if (t.includes("門市")) return [storeCard()];
  if (t.includes("產品") || t.includes("介紹")) return [await productsCard()];
  if (t.includes("看價格") || t === "價格" || t.includes("價錢")) return [await productsCard()];
  if (t.includes("怎麼購買") || t.includes("購買") || t.includes("下單")) return [buyMethodCard()];

  if (["宅配", "店到店", "雙北親送", "到店自取"].includes(t)) {
    updateUser(userId, (x) => {
      x.state.step = "WAIT_ITEMS";
      x.state.buyMethod = t;
      x.draft = { cart: null, name: null, phone: null, address: null, c2c: null };
    });

    const tip =
      t === "店到店"
        ? "請先打：品項＋數量（例：龜鹿膏2 龜鹿飲3）\n接著我會請你貼：收件姓名＋電話＋取貨門市（店名/店號/地址）"
        : t === "到店自取"
          ? "請先打：品項＋數量（例：龜鹿膏2 湯塊半斤1）\n接著我會請你留：聯絡姓名＋電話（方便保留並確認取貨時間）"
          : "請先打：品項＋數量（例：龜鹿膏2 龜鹿飲3）\n接著我會請你貼：收件姓名＋電話＋地址";

    return [{ type: "text", text: `好的🙂 你選的是【${t}】\n\n${tip}` }];
  }

  if (u.state.step === "WAIT_ITEMS") {
    const pairs = parseQtyPairs(t);
    const quote = await buildQuoteFromPairs(pairs);
    if (!quote.ok) return [{ type: "text", text: quote.text }];

    updateUser(userId, (x) => {
      x.draft.cart = { pairs, subtotal: quote.subtotal };
      x.state.step = "WAIT_CONTACT";
    });
    return [{ type: "text", text: quote.text }];
  }

  if (u.state.step === "WAIT_CONTACT") {
    const digits = String(text || "").replace(/\D/g, "");
    const hasPhone = digits.length >= 8 && digits.length <= 15;
    const looksAddr = /路|街|巷|弄|號|樓|段|區|市|門市|店/.test(text);

    updateUser(userId, (x) => {
      const d = x.draft;
      if (hasPhone) d.phone = digits;
      if (looksAddr) {
        if (x.state.buyMethod === "店到店") d.c2c = String(text).trim();
        else d.address = String(text).trim();
      }
      const nameCandidate = norm(String(text).replace(digits, "").replace(/路|街|巷|弄|號|樓|段|區|市|門市|店/g, ""));
      if (nameCandidate.length >= 2 && nameCandidate.length <= 10) d.name = d.name || nameCandidate;
    });

    const latest = ensureUser(userId);
    const need = [];
    if (!latest.draft.name) need.push("姓名");
    if (!latest.draft.phone) need.push("電話");
    if (latest.state.buyMethod === "店到店") {
      if (!latest.draft.c2c) need.push("取貨門市（店名/店號/地址）");
    } else if (latest.state.buyMethod !== "到店自取") {
      if (!latest.draft.address) need.push("地址");
    }

    if (need.length) return [{ type: "text", text: `我有看到🙂 目前還需要：${need.join("、")}（可一次貼一段）` }];

    if (latest.state.buyMethod === "雙北親送" && !addressIsTaipeiOrNewTaipei(latest.draft.address)) {
      return [{ type: "text", text: "這個地址看起來不是台北/新北🙂\n雙北親送目前只支援台北市/新北市。\n你要不要改成：宅配 或 店到店？（直接回：宅配 / 店到店）" }];
    }

    const method = latest.state.buyMethod;
    const cart = latest.draft.cart;
    const subtotal = cart?.subtotal || 0;
    const addrOrStore = method === "店到店" ? latest.draft.c2c : latest.draft.address;

    const summary = [
      "✅ 已收到訂購資訊：",
      `方式：${method}`,
      `品項：${(cart?.pairs || []).map((p) => `${p.name}${p.variantSpec ? `(${p.variantSpec})` : ""}×${p.qty}`).join("、")}`,
      `小計：${money(subtotal)}`,
      `聯絡：${latest.draft.name} ${latest.draft.phone}`,
      method === "到店自取" ? "" : `地址/門市：${addrOrStore}`,
      "",
      "我接著會回覆：出貨安排與付款資訊🙂",
      "（需要主選單請回：選單）",
    ]
      .filter(Boolean)
      .join("\n");

    updateUser(userId, (x) => {
      x.state.step = null;
      x.state.buyMethod = null;
      x.draft = { cart: null, name: null, phone: null, address: null, c2c: null };
    });

    return [{ type: "text", text: summary }, mainMenuCard()];
  }

  if (t.startsWith("介紹") || t.startsWith("規格") || t.startsWith("價格") || t.startsWith("我要買")) {
    const product = await findProductByText(t);
    if (!product) return [{ type: "text", text: "我沒抓到你要看的品項🙂\n你可以點：產品介紹 / 看價格 來選。" }];

    if (t.startsWith("我要買")) {
      return [{ type: "text", text: `好的🙂 你想買【${product.displayName}】\n請先選購買方式：` }, buyMethodCard()];
    }
    if (t.startsWith("介紹")) return [{ type: "text", text: await productIntroText(product) }, mainMenuCard()];
    if (t.startsWith("規格")) return [{ type: "text", text: await productSpecText(product) }, mainMenuCard()];
    if (t.startsWith("價格")) return [{ type: "text", text: await productPriceText(product) }, mainMenuCard()];
  }

  if (t.includes("湯塊") && (t.includes("價") || t.includes("多少"))) {
    const product = await findProductByText("湯塊");
    return [{ type: "text", text: await productPriceText(product) }, mainMenuCard()];
  }

  if (t.includes("湯塊") && (t.includes("搭配") || t.includes("煮") || t.includes("食材") || t.includes("藥材"))) {
    return [
      {
        type: "text",
        text:
          "龜鹿湯塊（膠）常見搭配（偏日常、好入口）：\n\n" +
          "【食材】\n" +
          "• 雞腿/全雞、排骨、瘦肉\n" +
          "• 山藥、紅棗、枸杞、薑片\n" +
          "• 香菇、玉米、胡蘿蔔（提升甜味）\n\n" +
          "【藥材】（想走補養但不想太燥）\n" +
          "• 黃耆、黨參、當歸（依體質斟酌）\n" +
          "• 熟地/枸杞/紅棗（偏溫潤）\n\n" +
          "你想煮給『自己日常』、還是『長輩補養』？我可以幫你配一個更簡單的版本🙂",
      },
      mainMenuCard(),
    ];
  }

  return [
    { type: "text", text: "我有收到🙂\n你可以直接點選單，或回：產品介紹 / 看價格 / 怎麼購買 / 門市資訊" },
    mainMenuCard(),
  ];
}

/** =========================
 * 9) Express / Webhook
 * ========================= */
const app = express();

app.get("/health", (req, res) => res.status(200).send("ok"));
app.get("/", (req, res) => res.status(200).send("ok"));

app.post(
  "/webhook",
  (req, res, next) => {
    if (!hasLineCred) return res.status(500).send("LINE credentials missing");
    return line.middleware(config)(req, res, next);
  },
  async (req, res) => {
    try {
      const events = req.body.events || [];
      await Promise.all(
        events.map(async (event) => {
          if (event.type === "follow") {
            const userId = event.source && event.source.userId;
            if (userId) ensureUser(userId);
            return client.replyMessage(event.replyToken, [
              { type: "text", text: `您好🙂 這裡是【${STORE.brandName}】\n直接點選單就可以開始～` },
              mainMenuCard(),
            ]);
          }

          if (event.type !== "message" || !event.message || event.message.type !== "text") return null;
          const userId = event.source && event.source.userId;
          if (!userId) return null;
          const msgs = await handleText(userId, event.message.text || "");
          return client.replyMessage(event.replyToken, msgs);
        })
      );
      res.status(200).end();
    } catch (e) {
      console.error("Webhook error:", e);
      res.status(500).end();
    }
  }
);

app.post("*", (req, res) => res.status(404).send("Not Found"));

const listenPort = Number(PORT) || 10000;
app.listen(listenPort, "0.0.0.0", () => {
  console.log(`LINE bot listening on port ${listenPort}`);
  if (STORE.productsJsonUrl) console.log("PRODUCTS_URL:", STORE.productsJsonUrl);
});
