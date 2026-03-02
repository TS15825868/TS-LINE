"use strict";

/**
 * 仙加味・龜鹿 LINE OA Bot（最終可部署版｜全卡片流程｜串接官網 products.json）
 *
 * ✅ 特色
 * - 主要互動都用「卡片按鈕」（template buttons / carousel）方便長輩使用
 * - 產品資料：從 PRODUCTS_URL 抓取（預設你的 GitHub Pages products.json）
 * - 價格：LINE 顯示（官網可不顯示）
 * - 湯塊：多規格 variants（2兩/4兩/半斤/一斤），半斤/一斤活動 9 折
 * - 補養建議（綜合版）：日常 / 加強 / 忙碌族 / 長輩版
 *
 * ✅ Render 環境變數（建議）
 * - LINE_CHANNEL_ACCESS_TOKEN
 * - LINE_CHANNEL_SECRET
 * - PRODUCTS_URL (可選；未填就用預設)
 */

const express = require("express");
const line = require("@line/bot-sdk");
const https = require("https");
const http = require("http");
const fs = require("fs");
const path = require("path");

/* =========================
   環境變數
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
      "服務仍會啟動（避免 Render Exit 1），但 webhook 會回 500。"
  );
}

const config = {
  channelAccessToken: ACCESS_TOKEN,
  channelSecret: CHANNEL_SEC,
};

const client = new line.Client(config);

/* =========================
   基本資訊
========================= */

const STORE = {
  brandName: "仙加味・龜鹿",
  address: "台北市萬華區西昌街 52 號",
  phoneDisplay: "(02) 2381-2990",
  phoneTel: "0223812990",
  website: "https://ts15825868.github.io/TaiShing/index.html",
  mapUrl:
    "https://www.google.com/maps/search/?api=1&query=%E5%8F%B0%E5%8C%97%E5%B8%82%E8%90%AC%E8%8F%AF%E5%8D%80%E8%A5%BF%E6%98%8C%E8%A1%97+52+%E8%99%9F",
  priceNote:
    "※ 不同通路因服務內容／搭配方案不同，價格可能略有差異🙂\n※ 到店另有不定期活動或搭配方案，依現場為準。",
  infoDisclaimer: "※ 產品資訊以實際包裝標示為準（不同批次可能略有差異）。",
  deliverNote:
    "※ 雙北親送：視路線/時間可安排；若不便親送會改以宅配或店到店協助。",
};

/* =========================
   products.json（快取）
========================= */

let cache = { at: 0, data: null };

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith("https") ? https : http;
    lib
      .get(url, (res) => {
        let data = "";
        res.on("data", (c) => (data += c));
        res.on("end", () => {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            reject(e);
          }
        });
      })
      .on("error", reject);
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
      // 帶上分類，方便之後擴充
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

function safeText(s, max = 480) {
  const t = String(s || "");
  return t.length > max ? t.slice(0, max - 1) + "…" : t;
}

const SOUP_ALIASES = ["龜鹿湯塊", "湯塊", "龜鹿膠", "二仙膠", "仙膠", "龜鹿仙膠", "龜鹿二仙膠"];

function isSoupName(input) {
  const t = String(input || "");
  return SOUP_ALIASES.some((k) => t.includes(k)) || t.includes("龜鹿湯塊（膠）") || t.includes("龜鹿湯塊(膠)");
}

function matchProduct(flat, name) {
  const n = normalizeText(name);
  // 先精準含括
  let p = flat.find((x) => n === x.name);
  if (p) return p;
  // 再模糊（含）
  p = flat.find((x) => n.includes(x.name) || x.name.includes(n));
  if (p) return p;
  // 湯塊別名
  if (isSoupName(n)) {
    return flat.find((x) => x.name.includes("湯塊")) || null;
  }
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

function getUser(userId) {
  const users = loadUsers();
  users[userId] = users[userId] || { buying: null };
  saveUsers(users);
  return users[userId];
}

function updateUser(userId, fn) {
  const users = loadUsers();
  users[userId] = users[userId] || { buying: null };
  fn(users[userId]);
  saveUsers(users);
}

/* =========================
   卡片：主選單（兩張卡片一起送）
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
        { type: "message", label: "怎麼購買", text: "怎麼購買" },
        { type: "message", label: "門市資訊", text: "門市資訊" },
      ],
    },
  };

  const card2 = {
    type: "template",
    altText: "更多",
    template: {
      type: "buttons",
      title: "更多功能",
      text: "也可以看補養建議／或直接前往官網🙂",
      actions: [
        { type: "message", label: "補養建議（綜合版）", text: "補養建議" },
        { type: "uri", label: "官網", uri: STORE.website },
        { type: "uri", label: "一鍵來電", uri: `tel:${STORE.phoneTel}` },
        { type: "uri", label: "地圖", uri: STORE.mapUrl },
      ],
    },
  };

  return [card1, card2];
}

/* =========================
   卡片：門市資訊
========================= */

function storeCard() {
  return {
    type: "template",
    altText: "門市資訊",
    template: {
      type: "buttons",
      title: "門市資訊",
      text: `${STORE.address}\n${STORE.phoneDisplay}\n\n（需要主選單回：選單）`,
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
   卡片：補養建議（四種）
========================= */

function nourishMenuCard() {
  return {
    type: "template",
    altText: "補養建議",
    template: {
      type: "buttons",
      title: "補養建議（綜合版）",
      text: "想走哪一種節奏？直接點🙂",
      actions: [
        { type: "message", label: "日常版", text: "補養 日常" },
        { type: "message", label: "加強版", text: "補養 加強" },
        { type: "message", label: "忙碌族", text: "補養 忙碌族" },
        { type: "message", label: "長輩版", text: "補養 長輩" },
      ],
    },
  };
}

function nourishText(kind) {
  // 盡量不強迫、保留彈性（你先前說不想太制式）
  const k = String(kind || "");
  const head = `【補養建議｜${k}】`;

  if (k.includes("日常")) {
    return [
      head,
      "• 目標：穩穩補、好持續（不追求很猛）",
      "• 建議組合：龜鹿膏 或 龜鹿飲（二選一為主）",
      "• 節奏：一天一次，依生活習慣調整（早/晚都可以）",
      "• 小提醒：建議溫食，少配冰飲",
      "",
      "想看單品介紹 → 點『產品介紹』",
    ].join("\n");
  }

  if (k.includes("加強")) {
    return [
      head,
      "• 目標：想更有感、想拉高補養密度",
      "• 建議組合：龜鹿膏 + 龜鹿飲（分早晚或分時段）",
      "• 或：有煮湯習慣 → 龜鹿湯塊（膠）搭配燉煮",
      "• 節奏：先從少量/低頻開始，覺得OK再加",
      "",
      "（每個人體感不同；若有用藥/慢性病/孕哺等，建議先詢問專業人員）",
    ].join("\n");
  }

  if (k.includes("忙碌")) {
    return [
      head,
      "• 目標：省時間、好攜帶、規律補",
      "• 建議組合：龜鹿飲（即飲）為主；想更扎實再加龜鹿膏",
      "• 節奏：出門前/下午小空檔/運動後，都可以安排",
      "• 小提醒：能溫熱更順口",
    ].join("\n");
  }

  // 長輩
  return [
    head,
    "• 目標：溫和、好入口、好記",
    "• 建議組合：龜鹿膏（小匙）或龜鹿飲（即飲）",
    "• 節奏：固定一天一次即可；若想加強再看狀況加",
    "• 小提醒：以溫食為主；腸胃較敏感者先少量",
  ].join("\n");
}

function afterNourishCard() {
  return {
    type: "template",
    altText: "後續選單",
    template: {
      type: "buttons",
      title: STORE.brandName,
      text: "接下來想看什麼？🙂",
      actions: [
        { type: "message", label: "產品介紹", text: "產品介紹" },
        { type: "message", label: "看價格", text: "看價格" },
        { type: "message", label: "再看補養建議", text: "補養建議" },
        { type: "message", label: "回主選單", text: "選單" },
      ],
    },
  };
}

/* =========================
   卡片：產品列表
========================= */

async function productsCarousel() {
  const data = await getProducts();
  const flat = flattenProducts(data);

  // LINE template carousel：最多 10 欄
  const columns = flat.slice(0, 10).map((p) => ({
    title: safeText(p.name, 40),
    text: safeText((p.intro && p.intro[0]) || "點擊查看介紹", 60),
    actions: [
      { type: "message", label: "看介紹", text: `介紹 ${p.name}` },
      { type: "message", label: "看價格", text: `價格 ${p.name}` },
      { type: "message", label: "我要購買", text: `購買 ${p.name}` },
    ],
  }));

  return {
    type: "template",
    altText: "產品列表",
    template: {
      type: "carousel",
      columns,
    },
  };
}

/* =========================
   產品文字：介紹（含規格/成分/建議）
========================= */

function productIntroFullText(p) {
  if (!p) return "找不到產品🙂";

  // 湯塊（多規格）
  if (p.variants && p.variants.length) {
    const specLines = p.variants
      .map((v) => `• ${v.label}（${v.spec}）${v.note ? `｜${v.note}` : ""}`)
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
    "食用建議：",
    ...(p.usage || []).map((x) => `• ${x}`),
    "",
    STORE.infoDisclaimer,
  ].join("\n");
}

function productActionCard(productName) {
  return {
    type: "template",
    altText: "產品選單",
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

/* =========================
   價格：全部 / 單品 / 湯塊多規格
========================= */

async function priceAllCarousel() {
  const data = await getProducts();
  const flat = flattenProducts(data);

  const columns = [];

  for (const p of flat) {
    if (p.variants && p.variants.length) {
      // 湯塊每個規格一欄
      for (const v of p.variants) {
        const msrp = Number(v.msrp);
        const act = calcDiscount(msrp, v.discount);
        const lines = [
          `${v.label}`,
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

  return {
    type: "template",
    altText: "產品價格",
    template: {
      type: "carousel",
      columns: columns.slice(0, 10),
    },
  };
}

async function priceForProduct(name) {
  const data = await getProducts();
  const flat = flattenProducts(data);
  const p = matchProduct(flat, name);

  if (!p) {
    return [{ type: "text", text: "找不到這個品項🙂（回：選單）" }, ...mainMenuCards()];
  }

  // 湯塊多規格
  if (p.variants && p.variants.length) {
    const columns = p.variants.map((v) => {
      const msrp = Number(v.msrp);
      const act = calcDiscount(msrp, v.discount);
      const lines = [
        `${v.label}`,
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
      {
        type: "template",
        altText: `${p.name} 價格`,
        template: { type: "carousel", columns: columns.slice(0, 10) },
      },
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
  ]
    .filter(Boolean)
    .join("\n");

  return [{ type: "text", text }, productActionCard(p.name)];
}

/* =========================
   怎麼購買：方式選擇
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

function startBuying(userId, method, productName = null) {
  updateUser(userId, (u) => {
    u.buying = {
      active: true,
      method,
      productName: productName || null,
      itemsText: null,
      name: null,
      phone: null,
      address: null,
      total: null,
    };
  });
}

function stopBuying(userId) {
  updateUser(userId, (u) => {
    u.buying = null;
  });
}

function buyExplain(method) {
  if (method === "宅配") {
    return [
      "好的🙂【宅配】",
      "請直接貼：",
      "1) 品項＋數量",
      "2) 收件姓名＋電話",
      "3) 地址",
      "",
      "（要回主選單回：選單）",
    ].join("\n");
  }
  if (method === "店到店") {
    return [
      "好的🙂【超商店到店】",
      "請直接貼：",
      "1) 品項＋數量",
      "2) 收件姓名＋電話",
      "3) 取貨門市（店名/店號/地址）",
      "",
      "（要回主選單回：選單）",
    ].join("\n");
  }
  if (method === "雙北親送") {
    return [
      "好的🙂【雙北親送】",
      STORE.deliverNote,
      "",
      "請直接貼：",
      "1) 品項＋數量",
      "2) 收件姓名＋電話",
      "3) 地址（台北/新北）",
      "",
      "（要回主選單回：選單）",
    ].join("\n");
  }
  return [
    "好的🙂【到店自取】",
    "請直接貼：",
    "1) 品項＋數量",
    "2) 聯絡姓名＋電話",
    "（方便保留並確認取貨時間）",
    "",
    "（要回主選單回：選單）",
  ].join("\n");
}

async function tryParseItemsToTotal(itemsText) {
  const data = await getProducts();
  const flat = flattenProducts(data);

  const t = normalizeText(itemsText);
  if (!t) return { lines: [], total: null };

  const lines = [];
  let total = 0;

  // helper：找數量（預設 1）
  function qtyFor(fragment) {
    const m = fragment.match(/(\d{1,3})\s*(罐|包|盒|組|份|個|瓶|袋)?/);
    if (!m) return 1;
    const q = Number(m[1]);
    return Number.isFinite(q) && q > 0 ? q : 1;
  }

  // 湯塊規格解析（2兩/4兩/半斤/一斤/75g/150g/300g/600g）
  const soup = flat.find((x) => x.variants && x.variants.length);
  const soupVariants = (soup && soup.variants) || [];

  // 逐品項嘗試：龜鹿膏/飲/鹿茸粉
  const names = flat
    .filter((x) => !(x.variants && x.variants.length))
    .map((x) => x.name);

  for (const name of names) {
    if (!t.includes(name)) continue;
    // 截出包含該品名的一小段，抓數量
    const idx = t.indexOf(name);
    const frag = t.slice(idx, idx + name.length + 8);
    const q = qtyFor(frag);
    const p = flat.find((x) => x.name === name);
    const msrp = Number(p.msrp);
    const act = calcDiscount(msrp, p.discount) || msrp;
    const sub = act * q;
    lines.push(`${name} × ${q} ＝ ${money(sub)}`);
    total += sub;
  }

  // 湯塊：看是否提到湯塊關鍵字
  if (isSoupName(t) || t.includes("湯塊") || t.includes("龜鹿湯塊")) {
    // 尋找提到哪個規格
    for (const v of soupVariants) {
      const keys = [v.label, v.spec, v.label.replace(/\s/g, "")];
      const hit = keys.some((k) => k && t.includes(String(k)));
      // 也支援「2兩/4兩/半斤/一斤」
      const shortKey = (v.label || "").split("｜")[0];
      const hit2 = shortKey && t.includes(shortKey);
      if (!hit && !hit2) continue;

      const idx = t.indexOf(shortKey);
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

  // 優先抓電話/地址/姓名
  const phone = looksLikePhone(text);

  updateUser(userId, (x) => {
    const cur = x.buying;
    if (!cur) return;

    if (!cur.itemsText && (text.includes("龜鹿") || text.includes("鹿茸") || text.includes("湯塊") || /\d+\s*(罐|包|盒|組|份|個|瓶|袋)/.test(text))) {
      cur.itemsText = text;
    }

    if (phone) cur.phone = phone;

    if (!cur.address && looksLikeAddress(text) && cur.method !== "自取") {
      cur.address = text;
    }

    // 名字：去掉電話與地址常見字後的剩餘
    if (!cur.name) {
      const candidate = normalizeText(text.replace(String(phone || ""), ""));
      if (candidate.length >= 2 && candidate.length <= 12 && !looksLikeAddress(candidate)) {
        cur.name = candidate;
      }
    }
  });

  const latest = getUser(userId).buying;

  // 計算金額（若有品項）
  if (latest.itemsText && latest.total == null) {
    const { lines, total } = await tryParseItemsToTotal(latest.itemsText);
    updateUser(userId, (x) => {
      if (x.buying) x.buying.total = total;
    });

    if (lines.length) {
      // 提示目前估算
      const msg = [
        "我先幫你把品項換算一下🙂",
        ...lines.map((l) => `• ${l}`),
        "",
        `小計：約 ${money(total)}`,
        "（若有活動/組合/運費等，最後以我們確認為準）",
      ].join("\n");
      return [{ type: "text", text: msg }];
    }
  }

  // 檢查缺哪些
  const need = [];
  if (!latest.itemsText) need.push("品項＋數量");
  if (!latest.name) need.push("姓名");
  if (!latest.phone) need.push("電話");
  if (latest.method !== "自取" && !latest.address) {
    need.push(latest.method === "店到店" ? "取貨門市" : "地址");
  }

  if (need.length) {
    return [{ type: "text", text: `我有看到🙂 目前我還需要：${need.join("、")}（可一次貼一段）` }];
  }

  // 雙北親送：簡單判斷
  if (latest.method === "雙北親送") {
    const addr = String(latest.address || "");
    if (!(addr.includes("台北") || addr.includes("臺北") || addr.includes("新北"))) {
      return [
        {
          type: "text",
          text: "我看到地址好像不是台北/新北🙂\n雙北親送需要台北或新北地址；若要改成宅配/店到店也可以（回：怎麼購買）。",
        },
      ];
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
    "（要回主選單回：選單）",
  ]
    .filter(Boolean)
    .join("\n");

  stopBuying(userId);
  return [{ type: "text", text: summary }, ...mainMenuCards()];
}

/* =========================
   對話邏輯（卡片流程）
========================= */

async function handleText(userId, text) {
  const t = normalizeText(text);

  // 主選單
  if (!t || t === "選單" || t === "0" || t === "主選單") {
    stopBuying(userId);
    return mainMenuCards();
  }

  // 購買流程優先
  const flow = await tryBuyingFlow(userId, text);
  if (flow) return flow;

  // 主功能
  if (t === "產品介紹" || t === "產品" || t === "商品" || t === "產品列表") {
    return [await productsCarousel(), ...mainMenuCards()];
  }

  if (t === "看價格" || t === "價格") {
    return [await priceAllCarousel(), { type: "text", text: STORE.priceNote }, ...mainMenuCards()];
  }

  if (t === "怎麼購買" || t === "購買" || t === "我要買") {
    return [buyMenuCard(), ...mainMenuCards()];
  }

  if (t === "門市資訊" || t === "門市" || t === "地址" || t.includes("怎麼去")) {
    return [storeCard(), ...mainMenuCards()];
  }

  if (t === "補養建議" || t.includes("補養")) {
    return [nourishMenuCard(), ...mainMenuCards()];
  }

  if (t.startsWith("補養 ") || t.startsWith("補養")) {
    const kind = t.replace(/^補養\s*/g, "").trim();
    if (!kind) return [nourishMenuCard(), ...mainMenuCards()];
    return [{ type: "text", text: nourishText(kind) }, afterNourishCard(), ...mainMenuCards()];
  }

  // 購買方式
  if (t.startsWith("購買方式")) {
    const method = t.replace("購買方式", "").trim();
    if (method.includes("宅配")) {
      startBuying(userId, "宅配");
      return [{ type: "text", text: buyExplain("宅配") }, ...mainMenuCards()];
    }
    if (method.includes("店到店")) {
      startBuying(userId, "店到店");
      return [{ type: "text", text: buyExplain("店到店") }, ...mainMenuCards()];
    }
    if (method.includes("雙北")) {
      startBuying(userId, "雙北親送");
      return [{ type: "text", text: buyExplain("雙北親送") }, ...mainMenuCards()];
    }
    if (method.includes("自取")) {
      startBuying(userId, "自取");
      return [{ type: "text", text: buyExplain("自取") }, ...mainMenuCards()];
    }
  }

  // 介紹 / 價格 / 購買（指定商品）
  if (t.startsWith("介紹 ")) {
    const name = t.replace("介紹 ", "").trim();
    const data = await getProducts();
    const flat = flattenProducts(data);
    const p = matchProduct(flat, name);
    if (!p) return [{ type: "text", text: "找不到這個品項🙂（回：選單）" }, ...mainMenuCards()];
    return [{ type: "text", text: productIntroFullText(p) }, productActionCard(p.name)];
  }

  if (t.startsWith("價格 ")) {
    const name = t.replace("價格 ", "").trim();
    const msgs = await priceForProduct(name);
    return [...msgs, ...mainMenuCards()];
  }

  if (t.startsWith("購買 ")) {
    const name = t.replace("購買 ", "").trim();
    const data = await getProducts();
    const flat = flattenProducts(data);
    const p = matchProduct(flat, name);
    // 進入購買方式選單，但帶上商品名稱
    if (p) {
      startBuying(userId, "宅配", p.name); // 先不強迫方式；先問方式
      stopBuying(userId); // 取消：不要誤開宅配
      return [
        {
          type: "text",
          text: `好的🙂【${p.name}】\n你想用哪一種方式購買？（直接點）`,
        },
        buyMenuCard(),
        ...mainMenuCards(),
      ];
    }
    return [{ type: "text", text: "好的🙂 你想用哪一種方式購買？（直接點）" }, buyMenuCard(), ...mainMenuCards()];
  }

  // 支援「看價格 龜鹿膏」這種口語
  if (t.startsWith("看價格 ") || t.startsWith("價格")) {
    const name = t.replace("看價格", "").replace("價格", "").trim();
    if (name) {
      const msgs = await priceForProduct(name);
      return [...msgs, ...mainMenuCards()];
    }
  }

  return [{ type: "text", text: "我有收到🙂\n你可以直接點『選單』開始～" }, ...mainMenuCards()];
}

/* =========================
   Webhook
========================= */

const app = express();

// 健康檢查
app.get("/health", (req, res) => res.status(200).send("ok"));
app.get("/", (req, res) => res.status(200).send("ok"));

app.post(
  "/webhook",
  (req, res, next) => {
    if (!config.channelAccessToken || !config.channelSecret) {
      return res.status(500).send("LINE credentials missing");
    }
    return line.middleware(config)(req, res, next);
  },
  async (req, res) => {
    try {
      const events = req.body.events || [];
      await Promise.all(
        events.map(async (event) => {
          if (event.type !== "message") return;
          if (!event.message || event.message.type !== "text") return;

          const userId = event.source && event.source.userId;
          if (!userId) return;

          const msgs = await handleText(userId, event.message.text);
          return client.replyMessage(event.replyToken, msgs);
        })
      );
      res.sendStatus(200);
    } catch (e) {
      console.error("webhook error:", e?.message || e);
      res.sendStatus(500);
    }
  }
);

app.listen(PORT || 3000, "0.0.0.0", () => {
  console.log("LINE bot running on port", PORT || 3000);
  console.log("PRODUCTS_URL:", PRODUCTS_ENDPOINT);
});
