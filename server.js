\
"use strict";

/**
 * 仙加味・龜鹿 LINE OA Bot（最終可部署版｜全卡片流程｜串接官網 products.json）
 *
 * ✅ 目標（你這次要的）
 * 1) 全卡片按鈕流程：主選單 / 產品介紹 / 價格 / 怎麼購買 / 門市資訊 / 飲食專區（補養/季節/燉煮/FAQ）
 * 2) 產品資料：從 PRODUCTS_URL 抓取（預設 GitHub Pages 的 products.json）
 * 3) 不出現「諮詢/中醫師」類型字眼；內容以「一般飲食/料理參考」為主，避免個案醫療建議
 * 4) 湯塊支援多規格 variants（2兩/4兩/半斤/一斤）
 * 5) FAQ / 燉煮建議 / 季節推薦 / 補養建議（綜合版）都放進同一套卡片流程
 *
 * ✅ Render 環境變數
 * - LINE_CHANNEL_ACCESS_TOKEN
 * - LINE_CHANNEL_SECRET
 * - PRODUCTS_URL（可選；未填就用預設）
 * - PORT（Render 會給）
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
  PRODUCTS_URL,
  PORT
} = process.env;

const ACCESS_TOKEN = LINE_CHANNEL_ACCESS_TOKEN || "";
const CHANNEL_SEC = LINE_CHANNEL_SECRET || "";

const PRODUCTS_URL_FALLBACK = "https://ts15825868.github.io/TaiShing/products.json";
const PRODUCTS_ENDPOINT = PRODUCTS_URL || PRODUCTS_URL_FALLBACK;

if (!ACCESS_TOKEN || !CHANNEL_SEC) {
  console.warn(
    "[WARN] 缺少 LINE 金鑰：請設定 LINE_CHANNEL_ACCESS_TOKEN / LINE_CHANNEL_SECRET。\n" +
    "服務仍會啟動（避免 Render Exit 1），但 webhook 會回 500。"
  );
}

const config = {
  channelAccessToken: ACCESS_TOKEN,
  channelSecret: CHANNEL_SEC
};

const client = new line.Client(config);

/* =========================
   基本資訊（可自行改）
========================= */

const STORE = {
  brandName: "仙加味・龜鹿",
  address: "台北市萬華區西昌街 52 號",
  phoneDisplay: "(02) 2381-2990",
  phoneTel: "0223812990",
  website: "https://ts15825868.github.io/TaiShing/",
  mapUrl: "https://www.google.com/maps/search/?api=1&query=%E5%8F%B0%E5%8C%97%E5%B8%82%E8%90%AC%E8%8F%AF%E5%8D%80%E8%A5%BF%E6%98%8C%E8%A1%97+52+%E8%99%9F",
  // 價格備註（避免爭議：以實際成交為準）
  priceNote: "※ 不同通路/組合/活動可能略有差異，最後以我們確認與現場為準🙂",
  // 資訊備註（避免食品標示爭議）
  infoDisclaimer: "※ 產品資訊以實際包裝標示為準（不同批次可能略有差異）。",
  // 一般性提醒（非醫療）
  generalDisclaimer: "以下為一般飲食與料理參考；若有特殊狀況（孕哺/慢性病/長期用藥等）請先與專業醫療人員確認。"
};

/* =========================
   products.json（快取）
========================= */

let cache = { at: 0, data: null };

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith("https") ? https : http;
    lib.get(url, (res) => {
      let data = "";
      res.on("data", (c) => (data += c));
      res.on("end", () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    }).on("error", reject);
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
    return { categories: [], guides: null };
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

const SOUP_ALIASES = ["龜鹿湯塊", "湯塊", "龜鹿膠", "二仙膠", "龜鹿湯塊（膠）", "龜鹿湯塊(膠)"];
function isSoupName(input) {
  const t = String(input || "");
  return SOUP_ALIASES.some((k) => t.includes(k)) || t.includes("湯塊");
}

function matchProduct(flat, name) {
  const n = normalizeText(name);
  if (!n) return null;

  // 先精準
  let p = flat.find((x) => n === x.name);
  if (p) return p;

  // 再模糊包含
  p = flat.find((x) => n.includes(x.name) || x.name.includes(n));
  if (p) return p;

  // 湯塊別名
  if (isSoupName(n)) {
    return flat.find((x) => (x.variants && x.variants.length) || x.name.includes("湯塊")) || null;
  }

  return null;
}

/* =========================
   使用者狀態（購買引導）
   - 只保存「購買方式」與「是否在填資料」，避免複雜
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

function startBuying(userId, method, productName = null) {
  updateUser(userId, (u) => {
    u.buying = { active: true, method, productName };
  });
}

function stopBuying(userId) {
  updateUser(userId, (u) => (u.buying = null));
}

/* =========================
   卡片：主選單（2 張）
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
        { type: "message", label: "怎麼購買", text: "怎麼購買" }
      ]
    }
  };

  const card2 = {
    type: "template",
    altText: "門市/官網",
    template: {
      type: "buttons",
      title: "門市與官網",
      text: "門市資訊 / 官網 / 一鍵來電 / 地圖🙂",
      actions: [
        { type: "message", label: "門市資訊", text: "門市資訊" },
        { type: "uri", label: "官網", uri: STORE.website },
        { type: "uri", label: "一鍵來電", uri: `tel:${STORE.phoneTel}` },
        { type: "uri", label: "地圖", uri: STORE.mapUrl }
      ]
    }
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
      text: `${STORE.address}\n${STORE.phoneDisplay}\n\n（回主選單：選單）`,
      actions: [
        { type: "uri", label: "地圖", uri: STORE.mapUrl },
        { type: "uri", label: "一鍵來電", uri: `tel:${STORE.phoneTel}` },
        { type: "uri", label: "官網", uri: STORE.website },
        { type: "message", label: "回主選單", text: "選單" }
      ]
    }
  };
}

/* =========================
   飲食專區：卡片選單（1 張）
========================= */

function foodMenuCard() {
  return {
    type: "template",
    altText: "飲食專區",
    template: {
      type: "buttons",
      title: "飲食專區",
      text: "想先看哪一種？🙂",
      actions: [
        { type: "message", label: "補養建議（綜合版）", text: "補養建議" },
        { type: "message", label: "季節推薦", text: "季節推薦" },
        { type: "message", label: "燉煮建議", text: "燉煮建議" },
        { type: "message", label: "常見問題", text: "FAQ" }
      ]
    }
  };
}

/* =========================
   補養建議（綜合版）
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
        { type: "message", label: "長輩版", text: "補養 長輩" }
      ]
    }
  };
}

async function nourishText(kind) {
  const data = await getProducts();
  const plans = (data.guides && data.guides.nourish_plans) || [];
  const key = normalizeText(kind);

  // 對照 id 或 title
  const pick =
    plans.find((p) => key.includes("日常") && p.id === "daily") ||
    plans.find((p) => key.includes("加強") && p.id === "boost") ||
    plans.find((p) => key.includes("忙碌") && p.id === "busy") ||
    plans.find((p) => (key.includes("長輩") || key.includes("長者")) && p.id === "senior") ||
    null;

  if (!pick) {
    return [
      `【補養建議｜${kind}】`,
      "請點卡片選單選擇：日常/加強/忙碌族/長輩🙂"
    ].join("\n");
  }

  return [
    `【補養建議｜${pick.title}】`,
    ...(pick.points || []).map((x) => `• ${x}`),
    "",
    "範例節奏：",
    ...(pick.sample_routine || []).map((x) => `• ${x}`),
    "",
    STORE.generalDisclaimer
  ].join("\n");
}

/* =========================
   季節推薦（綜合版 + 依產品）
========================= */

function seasonMenuCard() {
  return {
    type: "template",
    altText: "季節推薦",
    template: {
      type: "buttons",
      title: "季節推薦",
      text: "想看哪個季節？🙂",
      actions: [
        { type: "message", label: "春季", text: "季節 春" },
        { type: "message", label: "夏季", text: "季節 夏" },
        { type: "message", label: "秋季", text: "季節 秋" },
        { type: "message", label: "冬季", text: "季節 冬" }
      ]
    }
  };
}

async function seasonText(seasonKey) {
  const data = await getProducts();
  const season = seasonKey.includes("春")
    ? "spring"
    : seasonKey.includes("夏")
    ? "summer"
    : seasonKey.includes("秋")
    ? "autumn"
    : "winter";

  const seasonTitle =
    season === "spring" ? "春季" :
    season === "summer" ? "夏季" :
    season === "autumn" ? "秋季" : "冬季";

  const base = (data.guides && data.guides.season_reco && data.guides.season_reco[season]) || "";
  const flat = flattenProducts(data);

  const lines = [];
  for (const p of flat) {
    const s = p.season_reco && p.season_reco[season];
    if (s) lines.push(`• ${p.name}：${s}`);
  }

  return [
    `【季節推薦｜${seasonTitle}】`,
    base ? `• ${base}` : "",
    "",
    "各產品搭配：",
    ...(lines.length ? lines : ["•（尚未設定）"]),
    "",
    STORE.generalDisclaimer
  ].filter(Boolean).join("\n");
}

/* =========================
   燉煮建議（以湯塊為主）
========================= */

function cookMenuCard() {
  return {
    type: "template",
    altText: "燉煮建議",
    template: {
      type: "buttons",
      title: "燉煮建議",
      text: "想先看哪一類？🙂",
      actions: [
        { type: "message", label: "湯塊基本做法", text: "燉煮 基本" },
        { type: "message", label: "經典搭配", text: "燉煮 搭配" },
        { type: "message", label: "懶人電鍋", text: "燉煮 電鍋" },
        { type: "message", label: "回飲食專區", text: "飲食專區" }
      ]
    }
  };
}

async function cookText(kind) {
  const data = await getProducts();
  const guides = data.guides || {};
  const cooking = guides.cooking || {};
  const general = cooking.soup_block_general || [];
  const pairings = cooking.pairings || [];

  if (kind.includes("基本")) {
    return [
      "【湯塊基本做法】",
      ...(general.map((x) => `• ${x}`)),
      "",
      "想看更多搭配 → 點『經典搭配』🙂"
    ].join("\n");
  }

  if (kind.includes("電鍋")) {
    return [
      "【懶人電鍋做法】",
      "• 內鍋：食材＋水（依濃淡 600–900 ml）＋湯塊",
      "• 外鍋：1–2 杯水（依份量調整）",
      "• 跳起後再悶 10 分鐘，最後少量調味即可",
      "",
      "小提醒：想更清爽就多加水；想更濃就少加水🙂"
    ].join("\n");
  }

  // 搭配清單（文字列出）
  const blocks = pairings.slice(0, 10).map((p) => {
    const ing = (p.ingredients || []).join("、");
    const steps = (p.steps || []).map((s) => `  - ${s}`).join("\n");
    return `【${p.title}】\n• 食材：${ing}\n• 步驟：\n${steps}`;
  });

  return [
    "【經典搭配（多一些）】",
    ...blocks,
    "",
    "※ 口味可依個人濃淡、鹽度調整。",
    STORE.generalDisclaimer
  ].join("\n");
}

/* =========================
   FAQ
========================= */

async function faqText() {
  const data = await getProducts();
  const faq = (data.guides && data.guides.faq) || [];
  if (!faq.length) {
    return "【常見問題】\n（尚未設定）";
  }
  return [
    "【常見問題】",
    ...faq.map((x) => `${x.q}\n${x.a}`),
    "",
    STORE.generalDisclaimer
  ].join("\n");
}

/* =========================
   產品卡片：列表（carousel）
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
      { type: "message", label: "我要購買", text: `購買 ${p.name}` }
    ]
  }));

  return {
    type: "template",
    altText: "產品列表",
    template: { type: "carousel", columns }
  };
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
        { type: "message", label: "飲食專區", text: "飲食專區" },
        { type: "message", label: "回主選單", text: "選單" }
      ]
    }
  };
}

/* =========================
   產品文字：介紹（含規格/成分/建議；不單獨再做「看規格」按鈕）
========================= */

function productIntroFullText(p) {
  if (!p) return "找不到產品🙂";

  // 湯塊（多規格）
  if (p.variants && p.variants.length) {
    const specLines = p.variants
      .map((v) => `• ${v.label}${v.spec ? `（${v.spec}）` : ""}${v.note ? `｜${v.note}` : ""}`)
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
      STORE.infoDisclaimer
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
    STORE.infoDisclaimer
  ].join("\n");
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
      for (const v of p.variants) {
        const msrp = Number(v.msrp);
        const act = calcDiscount(msrp, v.discount);
        const lines = [
          `${v.label}`,
          `建議售價：${money(msrp)}`,
          act ? `活動價：${money(act)}` : "",
          v.note ? `備註：${v.note}` : ""
        ].filter(Boolean);

        columns.push({
          title: safeText(p.name, 40),
          text: safeText(lines.join("\n"), 60),
          actions: [
            { type: "message", label: "我要購買", text: `購買 ${p.name}` },
            { type: "message", label: "回主選單", text: "選單" }
          ]
        });
      }
      continue;
    }

    const msrp = Number(p.msrp);
    const act = calcDiscount(msrp, p.discount);
    const lines = [
      `建議售價：${money(msrp)}`,
      act ? `活動價：${money(act)}` : ""
    ].filter(Boolean);

    columns.push({
      title: safeText(p.name, 40),
      text: safeText(lines.join("\n"), 60),
      actions: [
        { type: "message", label: "我要購買", text: `購買 ${p.name}` },
        { type: "message", label: "回主選單", text: "選單" }
      ]
    });
  }

  return {
    type: "template",
    altText: "產品價格",
    template: { type: "carousel", columns: columns.slice(0, 10) }
  };
}

async function priceForProduct(name) {
  const data = await getProducts();
  const flat = flattenProducts(data);
  const p = matchProduct(flat, name);

  if (!p) {
    return [{ type: "text", text: "找不到這個品項🙂（回：選單）" }, ...mainMenuCards()];
  }

  // 湯塊多規格 → carousel
  if (p.variants && p.variants.length) {
    const columns = p.variants.map((v) => {
      const msrp = Number(v.msrp);
      const act = calcDiscount(msrp, v.discount);
      const lines = [
        `${v.label}`,
        `建議售價：${money(msrp)}`,
        act ? `活動價：${money(act)}` : "",
        v.note ? `備註：${v.note}` : ""
      ].filter(Boolean);

      return {
        title: safeText(p.name, 40),
        text: safeText(lines.join("\n"), 60),
        actions: [
          { type: "message", label: "我要購買", text: `購買 ${p.name}` },
          { type: "message", label: "回主選單", text: "選單" }
        ]
      };
    });

    return [
      { type: "template", altText: `${p.name} 價格`, template: { type: "carousel", columns: columns.slice(0, 10) } },
      { type: "text", text: STORE.priceNote }
    ];
  }

  const msrp = Number(p.msrp);
  const act = calcDiscount(msrp, p.discount);
  const text = [
    `【${p.name}｜價格】`,
    `建議售價：${money(msrp)}`,
    act ? `活動價：${money(act)}` : "",
    "",
    STORE.priceNote
  ].filter(Boolean).join("\n");

  return [{ type: "text", text }, productActionCard(p.name)];
}

/* =========================
   怎麼購買：方式選單 + 引導文字
========================= */

function buyMenuCard(productName = null) {
  return {
    type: "template",
    altText: "怎麼購買",
    template: {
      type: "buttons",
      title: productName ? `購買｜${safeText(productName, 30)}` : "怎麼購買",
      text: "選一種方式，我再引導你填資料🙂",
      actions: [
        { type: "message", label: "宅配", text: `購買方式 宅配${productName ? `｜${productName}` : ""}` },
        { type: "message", label: "超商店到店", text: `購買方式 店到店${productName ? `｜${productName}` : ""}` },
        { type: "message", label: "雙北親送", text: `購買方式 雙北親送${productName ? `｜${productName}` : ""}` },
        { type: "message", label: "到店自取", text: `購買方式 自取${productName ? `｜${productName}` : ""}` }
      ]
    }
  };
}

function buyExplain(method, productName = null) {
  const head = productName ? `【${productName}】` : "";
  if (method === "宅配") {
    return [
      `好的🙂【宅配】${head ? `\n${head}` : ""}`,
      "請直接貼：",
      "1) 品項＋數量（可直接貼文字）",
      "2) 收件姓名＋電話",
      "3) 地址",
      "",
      "我收到後會再跟你確認金額與出貨安排🙂"
    ].join("\n");
  }
  if (method === "店到店") {
    return [
      `好的🙂【超商店到店】${head ? `\n${head}` : ""}`,
      "請直接貼：",
      "1) 品項＋數量",
      "2) 收件姓名＋電話",
      "3) 取貨門市（店名/店號/地址）",
      "",
      "我收到後會再跟你確認金額與出貨安排🙂"
    ].join("\n");
  }
  if (method === "雙北親送") {
    return [
      `好的🙂【雙北親送】${head ? `\n${head}` : ""}`,
      "（視路線/時間可安排；若不便親送會改以宅配或店到店協助）",
      "",
      "請直接貼：",
      "1) 品項＋數量",
      "2) 收件姓名＋電話",
      "3) 地址（台北/新北）",
      "",
      "我收到後會再跟你確認金額與出貨安排🙂"
    ].join("\n");
  }
  return [
    `好的🙂【到店自取】${head ? `\n${head}` : ""}`,
    "請直接貼：",
    "1) 品項＋數量",
    "2) 聯絡姓名＋電話",
    "",
    "我收到後會幫你保留並確認可取貨時間🙂"
  ].join("\n");
}

/* =========================
   卡片：輸入提示（購買中）
========================= */

function buyingHintCard() {
  return {
    type: "template",
    altText: "購買中",
    template: {
      type: "buttons",
      title: "購買資料填寫中",
      text: "你可以直接貼文字，我收到就會回覆🙂\n（要取消回主選單：選單）",
      actions: [
        { type: "message", label: "回主選單", text: "選單" },
        { type: "message", label: "再選購買方式", text: "怎麼購買" },
        { type: "message", label: "看價格", text: "看價格" },
        { type: "message", label: "門市資訊", text: "門市資訊" }
      ]
    }
  };
}

/* =========================
   對話邏輯
========================= */

async function handleText(userId, rawText) {
  const t = normalizeText(rawText);

  // 主選單
  if (!t || t === "選單" || t === "0" || t === "主選單") {
    stopBuying(userId);
    return mainMenuCards();
  }

  // 如果正在購買中：任何文字都當作「已收到」
  const u = getUser(userId);
  if (u.buying && u.buying.active) {
    // 使用者貼完資料就收；不做醫療/客服承諾
    stopBuying(userId);
    const method = u.buying.method || "（未指定）";
    const prod = u.buying.productName ? `\n品項：${u.buying.productName}` : "";
    return [
      { type: "text", text: `已收到🙂\n方式：${method}${prod}\n\n我會再跟你確認金額與出貨安排。` },
      ...mainMenuCards()
    ];
  }

  // 主功能
  if (t === "產品介紹" || t === "產品" || t === "商品" || t === "產品列表") {
    return [await productsCarousel(), ...mainMenuCards()];
  }

  if (t === "看價格" || t === "價格") {
    return [await priceAllCarousel(), { type: "text", text: STORE.priceNote }, ...mainMenuCards()];
  }

  if (t === "飲食專區" || t === "飲食" || t === "搭配" || t === "建議") {
    return [foodMenuCard(), ...mainMenuCards()];
  }

  if (t === "怎麼購買" || t === "購買" || t === "我要買") {
    return [buyMenuCard(), ...mainMenuCards()];
  }

  if (t === "門市資訊" || t === "門市" || t === "地址") {
    return [storeCard(), ...mainMenuCards()];
  }

  // 飲食專區 → 各子功能
  if (t === "補養建議") {
    return [nourishMenuCard(), ...mainMenuCards()];
  }

  if (t.startsWith("補養")) {
    const kind = t.replace(/^補養\s*/g, "").trim();
    if (!kind) return [nourishMenuCard(), ...mainMenuCards()];
    return [
      { type: "text", text: await nourishText(kind) },
      { type: "template", altText: "後續", template: { type: "buttons", title: "接下來", text: "還想看什麼？🙂", actions: [
        { type: "message", label: "再看補養建議", text: "補養建議" },
        { type: "message", label: "季節推薦", text: "季節推薦" },
        { type: "message", label: "燉煮建議", text: "燉煮建議" },
        { type: "message", label: "回主選單", text: "選單" }
      ] } },
      ...mainMenuCards()
    ];
  }

  if (t === "季節推薦") {
    return [seasonMenuCard(), ...mainMenuCards()];
  }

  if (t.startsWith("季節")) {
    const kind = t.replace(/^季節\s*/g, "").trim();
    if (!kind) return [seasonMenuCard(), ...mainMenuCards()];
    return [
      { type: "text", text: await seasonText(kind) },
      seasonMenuCard(),
      ...mainMenuCards()
    ];
  }

  if (t === "燉煮建議") {
    return [cookMenuCard(), ...mainMenuCards()];
  }

  if (t.startsWith("燉煮")) {
    const kind = t.replace(/^燉煮\s*/g, "").trim();
    if (!kind) return [cookMenuCard(), ...mainMenuCards()];
    return [
      { type: "text", text: await cookText(kind) },
      cookMenuCard(),
      ...mainMenuCards()
    ];
  }

  if (t === "FAQ" || t === "常見問題") {
    return [{ type: "text", text: await faqText() }, ...mainMenuCards()];
  }

  // 購買方式
  if (t.startsWith("購買方式")) {
    // 支援：購買方式 宅配｜龜鹿膏
    const rest = t.replace("購買方式", "").trim();
    const [methodPart, productPart] = rest.split("｜").map((x) => (x || "").trim());
    const method = methodPart || "";
    const productName = productPart || null;

    if (method.includes("宅配")) {
      startBuying(userId, "宅配", productName);
      return [{ type: "text", text: buyExplain("宅配", productName) }, buyingHintCard(), ...mainMenuCards()];
    }
    if (method.includes("店到店")) {
      startBuying(userId, "店到店", productName);
      return [{ type: "text", text: buyExplain("店到店", productName) }, buyingHintCard(), ...mainMenuCards()];
    }
    if (method.includes("雙北")) {
      startBuying(userId, "雙北親送", productName);
      return [{ type: "text", text: buyExplain("雙北親送", productName) }, buyingHintCard(), ...mainMenuCards()];
    }
    if (method.includes("自取")) {
      startBuying(userId, "自取", productName);
      return [{ type: "text", text: buyExplain("自取", productName) }, buyingHintCard(), ...mainMenuCards()];
    }

    return [{ type: "text", text: "請點卡片選擇購買方式🙂" }, buyMenuCard(productName), ...mainMenuCards()];
  }

  // 介紹 / 價格 / 購買（指定商品）
  if (t.startsWith("介紹 ")) {
    const name = t.replace("介紹 ", "").trim();
    const data = await getProducts();
    const flat = flattenProducts(data);
    const p = matchProduct(flat, name);
    if (!p) return [{ type: "text", text: "找不到這個品項🙂（回：選單）" }, ...mainMenuCards()];
    return [{ type: "text", text: productIntroFullText(p) }, productActionCard(p.name), ...mainMenuCards()];
  }

  if (t.startsWith("價格 ")) {
    const name = t.replace("價格 ", "").trim();
    const msgs = await priceForProduct(name);
    return [...msgs, ...mainMenuCards()];
  }

  if (t.startsWith("購買 ")) {
    const name = t.replace("購買 ", "").trim();
    // 先讓使用者選購買方式（帶上品名）
    return [{ type: "text", text: `好的🙂【${name}】\n你想用哪一種方式購買？（直接點）` }, buyMenuCard(name), ...mainMenuCards()];
  }

  // 支援「看價格 龜鹿膏」口語
  if (t.startsWith("看價格 ")) {
    const name = t.replace("看價格", "").trim();
    if (name) {
      const msgs = await priceForProduct(name);
      return [...msgs, ...mainMenuCards()];
    }
  }

  // 找不到指令 → 回主選單
  return [{ type: "text", text: "我有收到🙂\n你可以直接點『選單』開始～" }, ...mainMenuCards()];
}

/* =========================
   Webhook
========================= */

const app = express();

// 健康檢查
app.get("/", (req, res) => res.status(200).send("ok"));
app.get("/health", (req, res) => res.status(200).send("ok"));

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
