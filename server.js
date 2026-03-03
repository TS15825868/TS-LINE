/* eslint-disable no-console */
"use strict";

/**
 * 仙加味・龜鹿 LINE OA Bot（OA v2.2.1｜抗 timeout 強化｜敏感問題導向中醫師）
 *
 * ✅ 重點
 * - 主互動採「卡片按鈕」（Buttons / Carousel）→ 長輩好用、少打字
 * - 產品資料：從 PRODUCTS_URL 抓取（預設 GitHub Pages products.json）
 * - 價格：僅在 LINE 顯示（官網可不顯示價格）
 * - 飲食建議：從 products.json 的 guides 讀取（補養/季節/燉煮/FAQ）
 * - 敏感/個人化身體問題：自動引導至合作中醫師 LINE（避免醫療建議風險）
 *
 * ✅ Render 環境變數
 * - LINE_CHANNEL_ACCESS_TOKEN  (或 CHANNEL_ACCESS_TOKEN)
 * - LINE_CHANNEL_SECRET        (或 CHANNEL_SECRET)
 * - PRODUCTS_URL               (可選，不填就用預設)
 * - PORT                       (Render 會自帶)
 */

const express = require("express");
const line = require("@line/bot-sdk");
const https = require("https");
const http = require("http");

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

/* =========================
   LINE SDK
========================= */
const config = {
  channelAccessToken: ACCESS_TOKEN,
  channelSecret: CHANNEL_SEC,
};
const client = new line.Client(config);

if (!ACCESS_TOKEN || !CHANNEL_SEC) {
  console.warn(
    "[WARN] 缺少 LINE 金鑰：請設定 LINE_CHANNEL_ACCESS_TOKEN / LINE_CHANNEL_SECRET（或相容的 CHANNEL_ACCESS_TOKEN / CHANNEL_SECRET）。\n" +
      "服務仍會啟動（避免 Render Exit 1），但 /webhook 會回 500。"
  );
}

/* =========================
   基本資訊（可自行微調）
========================= */
const STORE = {
  brandName: "仙加味・龜鹿",
  address: "台北市萬華區西昌街 52 號",
  phoneDisplay: "(02) 2381-2990",
  phoneTel: "0223812990",
  website: "https://ts15825868.github.io/TaiShing/",
  lineId: "@762jybnm",
  lineLink: "https://lin.ee/sHZW7NkR",
  mapUrl:
    "https://www.google.com/maps/search/?api=1&query=%E5%8F%B0%E5%8C%97%E5%B8%82%E8%90%AC%E8%8F%AF%E5%8D%80%E8%A5%BF%E6%98%8C%E8%A1%97+52+%E8%99%9F",
  priceNote:
    "※ 不同通路因服務內容／搭配方案不同，價格可能略有差異🙂\n※ 到店另有不定期活動或搭配方案，依現場為準。",
  infoDisclaimer: "※ 產品資訊以實際包裝標示為準（不同批次可能略有差異）。",
  foodDisclaimer:
    "※ 以上為飲食搭配/烹調參考；實際仍以個人口味與生活作息調整。",
  deliverNote:
    "※ 雙北親送：視路線/時間可安排；若不便親送會改以宅配或店到店協助。",
};

/* =========================
   合作中醫師（敏感問題導向）
========================= */
const DOCTOR = {
  lineId: "@changwuchi",
  link: "https://lin.ee/1MK4NR9",
  message:
`這部分會因每個人的身體狀況不同，
為了讓您得到更準確的說明與建議，
建議先由合作的中醫師了解您的情況🙂

✔ 專人一對一說明
✔ 可詢問適不適合食用
✔ 可詢問個人狀況與疑問

➤ Line ID：@changwuchi
➤ 章無忌中醫師諮詢連結：
https://lin.ee/1MK4NR9`,
};

/* =========================
   products.json 快取（SWR）
========================= */
let cache = { at: 0, data: null, refreshing: false };

function fetchJson(url, timeoutMs = 6500) {
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

async function refreshProductsInBackground() {
  if (cache.refreshing) return;
  cache.refreshing = true;
  try {
    const data = await fetchJson(PRODUCTS_ENDPOINT);
    cache = { at: Date.now(), data, refreshing: false };
  } catch (e) {
    cache.refreshing = false;
    console.error("[products] 背景更新失敗：", e?.message || e);
  }
}

async function getProducts() {
  const ttl = 5 * 60 * 1000; // 5min
  const staleOk = 60 * 60 * 1000; // 60min

  // 有新鮮資料
  if (cache.data && Date.now() - cache.at < ttl) return cache.data;

  // 有舊資料：先回舊的，再背景更新（SWR）
  if (cache.data && Date.now() - cache.at < staleOk) {
    refreshProductsInBackground();
    return cache.data;
  }

  // 沒資料：必須拉一次（加速：timeout 6.5s）
  try {
    const data = await fetchJson(PRODUCTS_ENDPOINT);
    cache = { at: Date.now(), data, refreshing: false };
    return data;
  } catch (e) {
    console.error("[products] 讀取失敗：", e?.message || e);
    return cache.data || { categories: [], guides: {} };
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
  return SOUP_ALIASES.some((k) => t.includes(k)) || t.includes("龜鹿湯塊（膠）") || t.includes("龜鹿湯塊(膠)");
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
   敏感問題偵測（導向中醫師）
========================= */
const SENSITIVE_KEYWORDS = [
  "懷孕","孕婦","哺乳","小孩","幼兒","兒童",
  "慢性","肝","腎","心臟","高血壓","低血壓","糖尿","痛風",
  "癌","腫瘤","化療","放療",
  "手術","開刀",
  "吃藥","用藥","處方","抗凝血","華法林","阿斯匹靈",
  "過敏","副作用","禁忌","交互作用",
  "蠶豆症","g6pd",
  "發燒","胸悶","喘","暈","抽筋","出血",
];

function looksSensitiveQuestion(t) {
  const s = String(t || "");
  const lower = s.toLowerCase();
  const hasHealthWord = SENSITIVE_KEYWORDS.some((k) => lower.includes(String(k).toLowerCase()));
  const askingFit = /(適合|能不能|可以吃|可吃|可不可以|會不會|要不要|是否|禁忌|副作用|搭配藥|跟藥)/.test(s);
  // 若明確點「中醫師諮詢」則一定導向
  if (/中醫師|醫師|諮詢/.test(s)) return true;
  // 有健康字眼且在問適不適合/能不能吃
  if (hasHealthWord && askingFit) return true;
  // 直接描述症狀/疾病也導向（避免你被要求給醫療建議）
  if (hasHealthWord && /痛|不舒服|症狀|病|診斷|檢查|指數|超標/.test(s)) return true;
  return false;
}

function doctorCard() {
  return {
    type: "template",
    altText: "中醫師諮詢",
    template: {
      type: "buttons",
      title: "中醫師諮詢",
      text: "個人狀況建議由中醫師一對一了解🙂",
      actions: [
        { type: "uri", label: "立即諮詢（LINE）", uri: DOCTOR.link },
        { type: "message", label: "回主選單", text: "選單" },
        { type: "uri", label: "回官網", uri: STORE.website },
        { type: "uri", label: "門市地圖", uri: STORE.mapUrl },
      ],
    },
  };
}

/* =========================
   主選單（只在「選單」或 follow 時送出）
========================= */
function mainMenuCard() {
  return {
    type: "template",
    altText: "選單",
    template: {
      type: "buttons",
      title: STORE.brandName,
      text: "請選擇功能🙂",
      actions: [
        { type: "message", label: "產品介紹", text: "產品介紹" },
        { type: "message", label: "推薦組合", text: "推薦組合" },
        { type: "message", label: "飲食建議", text: "飲食建議" },
        { type: "message", label: "中醫師諮詢", text: "中醫師諮詢" },
      ],
    },
  };
}

function menuMoreCard() {
  return {
    type: "template",
    altText: "更多",
    template: {
      type: "buttons",
      title: "更多",
      text: "也可以看門市／官網🙂",
      actions: [
        { type: "uri", label: "官網", uri: STORE.website },
        { type: "uri", label: "加入LINE", uri: STORE.lineLink },
        { type: "uri", label: "一鍵來電", uri: `tel:${STORE.phoneTel}` },
        { type: "uri", label: "地圖", uri: STORE.mapUrl },
      ],
    },
  };
}

function mainMenu() {
  return [mainMenuCard(), menuMoreCard()];
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
      { type: "message", label: "回選單", text: "選單" },
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
      "食用建議：",
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
    altText: "下一步",
    template: {
      type: "buttons",
      title: safeText(productName, 40),
      text: "接下來想看什麼？🙂",
      actions: [
        { type: "message", label: "看價格", text: `價格 ${productName}` },
        { type: "message", label: "其他產品", text: "產品介紹" },
        { type: "message", label: "飲食建議", text: "飲食建議" },
        { type: "message", label: "回選單", text: "選單" },
      ],
    },
  };
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
          { type: "message", label: "回選單", text: "選單" },
          { type: "message", label: "中醫師諮詢", text: "中醫師諮詢" },
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
   推薦組合
========================= */
function comboMenuCard() {
  return {
    type: "template",
    altText: "推薦組合",
    template: {
      type: "buttons",
      title: "補養推薦組合",
      text: "直接選一種🙂",
      actions: [
        { type: "message", label: "日常補養組", text: "組合 日常" },
        { type: "message", label: "加強搭配組", text: "組合 加強" },
        { type: "message", label: "長輩溫和組", text: "組合 長輩" },
        { type: "message", label: "回選單", text: "選單" },
      ],
    },
  };
}

function comboText(kind) {
  if (kind.includes("日常")) {
    return [
      "【日常補養組】",
      "✓ 龜鹿膏 1 罐",
      "或",
      "✓ 龜鹿飲 7 包",
      "",
      "適合日常穩定補養🙂",
    ].join("\n");
  }
  if (kind.includes("加強")) {
    return [
      "【加強搭配組】",
      "✓ 龜鹿膏 + 龜鹿飲",
      "✓ 湯塊燉煮搭配",
      "",
      "想要更扎實補養者🙂",
    ].join("\n");
  }
  return [
    "【長輩溫和組】",
    "✓ 龜鹿飲為主",
    "✓ 少量膏搭配",
    "",
    "溫和好入口🙂",
  ].join("\n");
}

/* =========================
   飲食建議（從 products.json guides）
========================= */
function foodMenuCard() {
  return {
    type: "template",
    altText: "飲食建議",
    template: {
      type: "buttons",
      title: "飲食建議",
      text: "想先看哪一種？🙂",
      actions: [
        { type: "message", label: "補養建議（綜合版）", text: "飲食 補養" },
        { type: "message", label: "季節推薦", text: "飲食 季節" },
        { type: "message", label: "燉煮建議", text: "飲食 燉煮" },
        { type: "message", label: "常見問題 FAQ", text: "飲食 FAQ" },
      ],
    },
  };
}

function buildFoodFromGuides(guides) {
  const disclaimer = guides?.disclaimer || STORE.foodDisclaimer;

  const nourish = guides?.nourish || [];
  const season = guides?.season || [];
  const cooking = guides?.cooking || guides?.cook || {};
  const faq = guides?.faq || [];

  return { disclaimer, nourish, season, cooking, faq };
}

function nourishCarousel(nourishItems) {
  const cols = (nourishItems || []).slice(0, 10).map((it) => ({
    title: safeText(it.title || "補養建議", 40),
    text: safeText(it.subtitle || (it.bullets && it.bullets[0]) || "點一下看內容", 60),
    actions: [
      { type: "message", label: "看內容", text: `飲食 補養 ${it.title}` },
      { type: "message", label: "回飲食建議", text: "飲食建議" },
      { type: "message", label: "回選單", text: "選單" },
    ],
  }));
  return { type: "template", altText: "補養建議", template: { type: "carousel", columns: cols.length ? cols : [{
    title:"補養建議", text:"目前尚未設定內容", actions:[{type:"message",label:"回飲食建議",text:"飲食建議"}]
  }] } };
}

function nourishTextFromItem(it, disclaimer) {
  const bullets = (it?.bullets || []).map((x) => `• ${x}`).join("\n");
  const tips = (it?.tips || []).length ? `\n\n小提醒：\n${it.tips.map((x)=>`• ${x}`).join("\n")}` : "";
  return [`【補養建議｜${it?.title || "—"}】`, it?.subtitle ? `• ${it.subtitle}` : "", bullets, tips, "", disclaimer].filter(Boolean).join("\n");
}

function seasonCarousel(seasonItems) {
  const cols = (seasonItems || []).slice(0, 10).map((it) => ({
    title: safeText(it.title || "季節推薦", 40),
    text: safeText(it.subtitle || "點一下看建議", 60),
    actions: [
      { type: "message", label: "看建議", text: `飲食 季節 ${it.title}` },
      { type: "message", label: "回飲食建議", text: "飲食建議" },
      { type: "message", label: "回選單", text: "選單" },
    ],
  }));
  return { type: "template", altText: "季節推薦", template: { type: "carousel", columns: cols.length ? cols : [{
    title:"季節推薦", text:"目前尚未設定內容", actions:[{type:"message",label:"回飲食建議",text:"飲食建議"}]
  }] } };
}

function seasonTextFromItem(it, disclaimer) {
  const recos = (it?.recos || []).map((r) => `• ${r.product}：${r.text}`).join("\n");
  const tips = (it?.tips || []).length ? `\n\n小提醒：\n${it.tips.map((x)=>`• ${x}`).join("\n")}` : "";
  return [`【季節推薦｜${it?.title || "—"}】`, it?.subtitle ? `• ${it.subtitle}` : "", recos, tips, "", disclaimer].filter(Boolean).join("\n");
}

function cookTextFromGuides(cooking, disclaimer) {
  const general = (cooking?.general || []).map((x) => `• ${x}`).join("\n");
  const ideas = (cooking?.ideas || []).map((x) => `• ${x}`).join("\n");
  return [
    "【燉煮建議】",
    general ? `基本原則：\n${general}` : "",
    ideas ? `\n更多搭配：\n${ideas}` : "",
    "",
    disclaimer,
  ].filter(Boolean).join("\n");
}

function faqMenuCardFromGuides(faq, disclaimer) {
  const top4 = (faq || []).slice(0, 4);
  if (!top4.length) {
    return [{ type: "text", text: `【FAQ】目前尚未設定內容。\n\n${disclaimer}` }];
  }
  const actions = top4.map((q, idx) => ({ type: "message", label: safeText(q.q, 20), text: `飲食 FAQ ${idx+1}` }));
  // buttons actions max 4
  return [{
    type: "template",
    altText: "FAQ",
    template: {
      type: "buttons",
      title: "常見問題（FAQ）",
      text: "想看哪一題？🙂",
      actions,
    },
  }];
}

function faqTextByIndex(faq, idx, disclaimer) {
  const i = Number(idx);
  const q = (faq || [])[i-1];
  if (!q) return `找不到這題🙂\n\n${disclaimer}`;
  return [`【FAQ】${q.q}`, q.a, "", disclaimer].filter(Boolean).join("\n");
}

/* =========================
   對話控制
========================= */
async function handleText(userId, text) {
  const raw = String(text || "");
  const t = normalizeText(raw);

  if (!t || t === "選單" || t === "0" || t === "主選單") {
    return mainMenu();
  }

  // 敏感/醫療相關 → 導向中醫師
  if (looksSensitiveQuestion(raw)) {
    return [{ type: "text", text: DOCTOR.message }, doctorCard()];
  }

  // 主功能
  if (t === "產品介紹" || t === "產品" || t === "商品") return [await productsCarousel()];
  if (t === "推薦組合" || t === "組合" || t === "推薦") return [comboMenuCard()];
  if (t === "飲食建議" || t === "飲食" || t === "飲食專區") return [foodMenuCard()];
  if (t === "中醫師諮詢" || t === "醫師諮詢" || t === "中醫師") return [{ type: "text", text: DOCTOR.message }, doctorCard()];

  // 組合內容
  if (t.startsWith("組合 ")) {
    const kind = t.replace("組合", "").trim();
    return [{ type: "text", text: comboText(kind) }, { type: "text", text: "需要其他功能：回「選單」🙂" }];
  }

  // 產品內容
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

  // 飲食內容（從 guides）
  if (t === "飲食 補養" || t === "補養建議" || t === "補養建議（綜合版）") {
    const data = await getProducts();
    const g = buildFoodFromGuides(data.guides || {});
    return [nourishCarousel(g.nourish)];
  }

  if (t.startsWith("飲食 補養 ")) {
    const title = t.replace("飲食 補養", "").trim();
    const data = await getProducts();
    const g = buildFoodFromGuides(data.guides || {});
    const it = (g.nourish || []).find((x) => normalizeText(x.title) === normalizeText(title)) || (g.nourish || []).find((x) => normalizeText(title).includes(normalizeText(x.title)));
    if (!it) return [nourishCarousel(g.nourish)];
    return [{ type: "text", text: nourishTextFromItem(it, g.disclaimer) }, { type: "text", text: "回「飲食建議」或回「選單」🙂" }];
  }

  if (t === "飲食 季節" || t === "季節推薦") {
    const data = await getProducts();
    const g = buildFoodFromGuides(data.guides || {});
    return [seasonCarousel(g.season)];
  }

  if (t.startsWith("飲食 季節 ")) {
    const title = t.replace("飲食 季節", "").trim();
    const data = await getProducts();
    const g = buildFoodFromGuides(data.guides || {});
    const it = (g.season || []).find((x) => normalizeText(x.title) === normalizeText(title)) || (g.season || []).find((x) => normalizeText(title).includes(normalizeText(x.title)));
    if (!it) return [seasonCarousel(g.season)];
    return [{ type: "text", text: seasonTextFromItem(it, g.disclaimer) }, { type: "text", text: "回「飲食建議」或回「選單」🙂" }];
  }

  if (t === "飲食 燉煮" || t === "燉煮建議") {
    const data = await getProducts();
    const g = buildFoodFromGuides(data.guides || {});
    return [{ type: "text", text: cookTextFromGuides(g.cooking, g.disclaimer) }, { type: "text", text: "回「飲食建議」或回「選單」🙂" }];
  }

  if (t === "飲食 FAQ" || t === "FAQ" || t === "常見問題") {
    const data = await getProducts();
    const g = buildFoodFromGuides(data.guides || {});
    return faqMenuCardFromGuides(g.faq, g.disclaimer).concat([{ type: "text", text: "（也可以直接輸入：飲食 FAQ 1 / 2 / 3 / 4）" }]);
  }

  if (t.startsWith("飲食 FAQ ")) {
    const idx = t.replace("飲食 FAQ", "").trim();
    const data = await getProducts();
    const g = buildFoodFromGuides(data.guides || {});
    const msg = faqTextByIndex(g.faq, idx, g.disclaimer);
    return [{ type: "text", text: msg }, { type: "text", text: "回「飲食建議」或回「選單」🙂" }];
  }

  return [{ type: "text", text: "您好🙂 回「選單」查看功能。" }];
}

/* =========================
   Webhook / Server（抗 timeout）
   - Webhook 驗證/大量事件時：先回 200，再背景處理
========================= */
const app = express();

app.get("/health", (req, res) => res.status(200).send("ok"));
app.get("/", (req, res) => res.status(200).send("ok"));

app.post(
  "/webhook",
  (req, res, next) => {
    if (!config.channelAccessToken || !config.channelSecret) return res.status(500).send("LINE credentials missing");
    return line.middleware(config)(req, res, next);
  },
  (req, res) => {
    // ✅ 先回 200（避免 LINE/驗證 timeout）
    res.sendStatus(200);

    // ✅ 背景處理（不阻塞回應）
    setImmediate(async () => {
      try {
        const events = req.body.events || [];
        for (const event of events) {
          // follow：新加入/重新加入 → 送歡迎 + 選單
          if (event.type === "follow") {
            await client.replyMessage(event.replyToken, [
              { type: "text", text: `您好🙂 我是「${STORE.brandName}」小幫手。\n回「選單」即可開始～` },
              ...mainMenu(),
            ]);
            continue;
          }

          // message
          if (event.type === "message" && event.message && event.message.type === "text") {
            const userId = event.source && event.source.userId;
            if (!userId) continue;
            const msgs = await handleText(userId, event.message.text);
            await client.replyMessage(event.replyToken, msgs);
            continue;
          }

          // postback（保留擴充）
          if (event.type === "postback") {
            const userId = event.source && event.source.userId;
            if (!userId) continue;
            const data = (event.postback && event.postback.data) || "";
            const msgs = await handleText(userId, data);
            await client.replyMessage(event.replyToken, msgs);
          }
        }
      } catch (e) {
        console.error("webhook background error:", e?.message || e);
      }
    });
  }
);

app.listen(PORT || 3000, "0.0.0.0", () => {
  console.log("LINE Bot Running on port", PORT || 3000);
  console.log("PRODUCTS_URL:", PRODUCTS_ENDPOINT);
});
