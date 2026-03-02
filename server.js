"use strict";

/**
 * 仙加味・龜鹿 LINE OA Bot（最終可部署｜卡片按鈕為主｜串接 products.json）
 *
 * 特色
 * - 全流程「卡片按鈕」：主選單／產品列表／產品操作（介紹/規格/價格）／規格列表／價格列表／購買方式
 * - 價格/規格/食用建議/成分，全部以官網 products.json 為資料來源（避免資料不一致）
 * - 湯塊(膠) 支援多規格 variants（避免 NaN）
 * - 雙北親送：依地址自動判斷是否台北/新北（不符合會提示改用其他方式）
 * - 下單流程：解析「品項+數量」→ 自動算商品小計（配送費另計/另報）
 * - Webhook 同時支援 /webhook 與 /（避免後台填錯路徑）
 */

const express = require("express");
const line = require("@line/bot-sdk");
const https = require("https");
const http = require("http");

/** =========================
 * 0) 環境變數（相容兩套命名）
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

const config = {
  channelAccessToken: ACCESS_TOKEN,
  channelSecret: CHANNEL_SEC,
};

const client = new line.Client(config);

const STORE = {
  brandName: "仙加味・龜鹿",
  address: "台北市萬華區西昌街 52 號",
  phoneDisplay: "(02) 2381-2990",
  phoneTel: "0223812990",
  website: "https://ts15825868.github.io/TaiShing/index.html",
  mapUrl:
    "https://www.google.com/maps/search/?api=1&query=%E5%8F%B0%E5%8C%97%E5%B8%82%E8%90%AC%E8%8F%AF%E5%8D%80%E8%A5%BF%E6%98%8C%E8%A1%97+52+%E8%99%9F",
  infoDisclaimer: "※ 產品資訊以實際包裝標示為準（不同批次可能略有差異）。",
  priceNote: "※ 不同通路因服務內容／搭配方案不同，價格可能略有差異🙂\n※ 到店另有不定期活動或搭配方案，依現場為準。",
};

const DEFAULT_PRODUCTS_URL = "https://ts15825868.github.io/TaiShing/products.json";
const PRODUCTS_ENDPOINT = (PRODUCTS_URL || DEFAULT_PRODUCTS_URL).trim();

/** =========================
 * 1) products.json 讀取（快取）
 * ========================= */
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

async function getProductsData() {
  const ttl = 5 * 60 * 1000;
  if (cache.data && Date.now() - cache.at < ttl) return cache.data;
  try {
    const data = await fetchJson(PRODUCTS_ENDPOINT);
    cache = { at: Date.now(), data };
    return data;
  } catch (e) {
    // 不要讓 bot 直接掛掉
    return { categories: [] };
  }
}

function flattenProducts(data) {
  const out = [];
  for (const c of data.categories || []) {
    for (const item of c.items || []) out.push(item);
  }
  return out;
}

function normText(s) {
  return String(s || "")
    .replace(/\u3000/g, " ")
    .replace(/[\t\n\r]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function toNumber(x) {
  const n = Number(x);
  return Number.isFinite(n) ? n : 0;
}

function money(n) {
  const x = Math.round(toNumber(n));
  return "$" + x.toLocaleString("en-US");
}

function calcDiscount(msrp, d) {
  const m = toNumber(msrp);
  const dd = toNumber(d);
  if (!m || !dd) return null;
  const v = Math.round(m * dd);
  return v > 0 ? v : null;
}

function safeTitle(t) {
  // LINE buttons/carousel title 有長度限制（約 40）
  const s = String(t || "");
  return s.length > 40 ? s.slice(0, 40) : s;
}

function safeText(t, max = 60) {
  const s = String(t || "");
  return s.length > max ? s.slice(0, max - 1) + "…" : s;
}

/** =========================
 * 2) 地區判斷（雙北親送）
 * ========================= */
function isTaipeiOrNewTaipei(addr) {
  const a = String(addr || "");
  return a.includes("台北") || a.includes("臺北") || a.includes("新北") || a.includes("臺北市") || a.includes("台北市") || a.includes("新北市");
}

/** =========================
 * 3) 訊息模板（卡片按鈕）
 * ========================= */

function mainMenuCard() {
  return {
    type: "template",
    altText: "主選單",
    template: {
      type: "buttons",
      title: STORE.brandName,
      text: "想先看哪個？直接點就好🙂",
      actions: [
        { type: "message", label: "產品介紹", text: "產品介紹" },
        { type: "message", label: "產品規格", text: "產品規格" },
        { type: "message", label: "看價格", text: "看價格" },
        { type: "message", label: "怎麼購買", text: "怎麼購買" },
      ].slice(0, 4),
    },
  };
}

function mainMenuCard2() {
  // buttons template 最多 4 個 action，所以把「門市資訊」放第二張
  return {
    type: "template",
    altText: "更多",
    template: {
      type: "buttons",
      title: "更多",
      text: "需要門市/電話/官網？",
      actions: [
        { type: "message", label: "門市資訊", text: "門市資訊" },
        { type: "message", label: "回主選單", text: "選單" },
      ],
    },
  };
}

function backToMenuCard() {
  return {
    type: "template",
    altText: "回主選單",
    template: {
      type: "buttons",
      title: STORE.brandName,
      text: "要回主選單嗎？",
      actions: [{ type: "message", label: "回主選單", text: "選單" }],
    },
  };
}

function storeCard() {
  return {
    type: "template",
    altText: "門市資訊",
    template: {
      type: "buttons",
      title: "門市資訊",
      text: `${STORE.address}\n${STORE.phoneDisplay}`,
      actions: [
        { type: "uri", label: "地圖", uri: STORE.mapUrl },
        { type: "uri", label: "一鍵來電", uri: `tel:${STORE.phoneTel}` },
        { type: "uri", label: "官網", uri: STORE.website },
        { type: "message", label: "回主選單", text: "選單" },
      ],
    },
  };
}

function buyMenuCard() {
  // 方式 4 個 action 剛好
  return {
    type: "template",
    altText: "怎麼購買",
    template: {
      type: "buttons",
      title: "怎麼購買",
      text: "選一種方式，我再引導你填資料🙂",
      actions: [
        { type: "message", label: "宅配", text: "購買 宅配" },
        { type: "message", label: "超商店到店", text: "購買 店到店" },
        { type: "message", label: "雙北親送", text: "購買 雙北親送" },
        { type: "message", label: "到店自取", text: "購買 自取" },
      ],
    },
  };
}

function productActionCard(pname) {
  return {
    type: "template",
    altText: `${pname} 操作`,
    template: {
      type: "buttons",
      title: safeTitle(pname),
      text: "接下來想看什麼？🙂",
      actions: [
        { type: "message", label: "看介紹", text: `介紹 ${pname}` },
        { type: "message", label: "看規格", text: `規格 ${pname}` },
        { type: "message", label: "看價格", text: `價格 ${pname}` },
        { type: "message", label: "回主選單", text: "選單" },
      ],
    },
  };
}

async function productsCarousel(mode) {
  // mode: intro|spec|price 影響卡片 actions
  const data = await getProductsData();
  const flat = flattenProducts(data);

  // LINE carousel 最多 10 欄
  const columns = flat.slice(0, 10).map((p) => {
    const teaser =
      (Array.isArray(p.intro) && p.intro.length ? p.intro[0] : "點擊查看");

    const actions =
      mode === "intro"
        ? [
            { type: "message", label: "看介紹", text: `介紹 ${p.name}` },
            { type: "message", label: "看規格", text: `規格 ${p.name}` },
            { type: "message", label: "看價格", text: `價格 ${p.name}` },
          ]
        : mode === "spec"
        ? [
            { type: "message", label: "看規格", text: `規格 ${p.name}` },
            { type: "message", label: "看介紹", text: `介紹 ${p.name}` },
            { type: "message", label: "看價格", text: `價格 ${p.name}` },
          ]
        : [
            { type: "message", label: "看價格", text: `價格 ${p.name}` },
            { type: "message", label: "看介紹", text: `介紹 ${p.name}` },
            { type: "message", label: "看規格", text: `規格 ${p.name}` },
          ];

    return {
      title: safeTitle(p.name),
      text: safeText(teaser, 60),
      actions,
    };
  });

  const alt =
    mode === "spec" ? "產品規格" : mode === "price" ? "產品價格" : "產品介紹";

  return {
    type: "template",
    altText: alt,
    template: {
      type: "carousel",
      columns,
    },
  };
}

async function priceCarouselAll() {
  const data = await getProductsData();
  const flat = flattenProducts(data);
  const columns = [];

  for (const p of flat) {
    const pMsrp = toNumber(p.msrp);
    const pDisc = toNumber(p.discount || p.activityDiscount);

    // 湯塊 variants
    if (Array.isArray(p.variants) && p.variants.length) {
      for (const v of p.variants) {
        const vMsrp = toNumber(v.msrp);
        const vDisc = toNumber(v.discount || v.activityDiscount);
        const act = calcDiscount(vMsrp, vDisc);
        const label = v.label || v.spec || "";
        const lines = [
          label,
          `建議售價：${money(vMsrp)}`,
          act ? `活動價：${money(act)}（9折）` : "",
          v.note ? `備註：${safeText(v.note, 40)}` : "",
        ].filter(Boolean);

        columns.push({
          title: safeTitle(p.name),
          text: safeText(lines.join("\n"), 60),
          actions: [
            { type: "message", label: "看規格", text: `規格 ${p.name}` },
            { type: "message", label: "看介紹", text: `介紹 ${p.name}` },
            { type: "message", label: "回主選單", text: "選單" },
          ],
        });
      }
      continue;
    }

    const act = calcDiscount(pMsrp, pDisc);
    const lines = [
      `建議售價：${money(pMsrp)}`,
      act ? `活動價：${money(act)}（9折）` : "",
    ].filter(Boolean);

    columns.push({
      title: safeTitle(p.name),
      text: safeText(lines.join("\n"), 60),
      actions: [
        { type: "message", label: "看介紹", text: `介紹 ${p.name}` },
        { type: "message", label: "看規格", text: `規格 ${p.name}` },
        { type: "message", label: "回主選單", text: "選單" },
      ],
    });
  }

  // LINE carousel 最多 10 欄；你目前產品不多，足夠
  return {
    type: "template",
    altText: "產品價格",
    template: {
      type: "carousel",
      columns: columns.slice(0, 10),
    },
  };
}

/** =========================
 * 4) 文字內容（來自 products.json）
 * ========================= */

async function findProductByName(name) {
  const data = await getProductsData();
  const flat = flattenProducts(data);
  const n = String(name || "");

  // 先精準包含
  let p = flat.find((x) => n.includes(String(x.name || "")));
  if (p) return p;

  // 再用簡單關鍵字
  const key = n.replace(/\s+/g, "");
  p = flat.find((x) => key.includes(String(x.name || "").replace(/\s+/g, "")));
  return p || null;
}

function joinBullets(arr) {
  if (!Array.isArray(arr) || !arr.length) return "";
  return arr.map((x) => `• ${String(x).trim()}`).join("\n");
}

async function introText(name) {
  const p = await findProductByName(name);
  if (!p) return "我找不到這個品項🙂\n可以點「產品介紹」再選一次。";

  const parts = [];
  parts.push(`【${p.name}】`);
  if (Array.isArray(p.intro) && p.intro.length) parts.push(joinBullets(p.intro));
  if (p.spec) parts.push(`\n規格：${p.spec}`);

  if (Array.isArray(p.ingredients) && p.ingredients.length) {
    parts.push("\n成分：");
    parts.push(joinBullets(p.ingredients));
  }

  if (Array.isArray(p.usage) && p.usage.length) {
    parts.push("\n食用建議：");
    parts.push(joinBullets(p.usage));
  }

  if (p.note) parts.push(`\n補充：${p.note}`);

  parts.push("\n" + STORE.infoDisclaimer);
  return parts.join("\n");
}

async function specText(name) {
  const p = await findProductByName(name);
  if (!p) return "我找不到這個品項🙂\n可以點「產品規格」再選一次。";

  const parts = [];
  parts.push(`【${p.name}｜規格】`);

  if (Array.isArray(p.variants) && p.variants.length) {
    // 湯塊多規格
    parts.push(joinBullets(p.variants.map((v) => v.label || v.spec || "")));
  } else {
    parts.push(p.spec ? p.spec : "（此品項規格資料待補）");
  }

  parts.push("\n" + STORE.infoDisclaimer);
  return parts.join("\n");
}

async function priceText(name) {
  const p = await findProductByName(name);
  if (!p) return "我找不到這個品項🙂\n可以點「看價格」再選一次。";

  const parts = [];

  if (Array.isArray(p.variants) && p.variants.length) {
    // 湯塊：一次列出全部規格
    parts.push(`【${p.name}｜價格】`);
    for (const v of p.variants) {
      const vMsrp = toNumber(v.msrp);
      const vDisc = toNumber(v.discount || v.activityDiscount);
      const act = calcDiscount(vMsrp, vDisc);
      parts.push(`\n${v.label || ""}`);
      parts.push(`建議售價：${money(vMsrp)}`);
      if (act) parts.push(`活動價：${money(act)}（9折）`);
      if (v.note) parts.push(`備註：${v.note}`);
    }
    parts.push(`\n${STORE.priceNote}`);
    return parts.join("\n");
  }

  const msrp = toNumber(p.msrp);
  const disc = toNumber(p.discount || p.activityDiscount);
  const act = calcDiscount(msrp, disc);

  parts.push(`【${p.name}｜價格】`);
  parts.push(`建議售價：${money(msrp)}`);
  if (act) parts.push(`目前活動：9折 ${money(act)}`);
  parts.push(`\n${STORE.priceNote}`);
  return parts.join("\n");
}

/** =========================
 * 5) 下單流程（簡易狀態）
 * ========================= */

// Render 多實例時不保證狀態一致；但對 OA 互動已足夠。
const orderState = new Map();

function resetOrder(userId) {
  orderState.delete(userId);
}

function startOrder(userId, method) {
  orderState.set(userId, {
    active: true,
    step: "items",
    method, // home | c2c | deliver | pickup
    itemsRaw: "",
    items: [],
    name: "",
    phone: "",
    address: "",
    subtotal: 0,
  });
}

function methodLabel(method) {
  if (method === "home") return "宅配";
  if (method === "c2c") return "超商店到店";
  if (method === "deliver") return "雙北親送";
  if (method === "pickup") return "到店自取";
  return "";
}

async function buildPriceIndex() {
  const data = await getProductsData();
  const flat = flattenProducts(data);

  // 以 name 做索引；湯塊 variants 另開 label key
  const index = [];

  for (const p of flat) {
    if (Array.isArray(p.variants) && p.variants.length) {
      // 湯塊：支援「湯塊 300g」這種寫法（抓 label 裡的 300g / 600g / 150g / 75g）
      for (const v of p.variants) {
        index.push({
          type: "variant",
          productName: p.name,
          variantLabel: v.label || "",
          matchKeys: [
            p.name,
            "湯塊",
            "龜鹿湯塊",
            "龜鹿湯塊（膠）",
            ...extractWeightTokens(v.label || ""),
          ].filter(Boolean),
          msrp: toNumber(v.msrp),
          discount: toNumber(v.discount || v.activityDiscount),
        });
      }
    } else {
      index.push({
        type: "product",
        productName: p.name,
        matchKeys: [p.name],
        msrp: toNumber(p.msrp),
        discount: toNumber(p.discount || p.activityDiscount),
      });
    }
  }

  return index;
}

function extractWeightTokens(label) {
  // 從「300g｜16入」抽出 300g
  const m = String(label).match(/(\d+(?:\.\d+)?)\s*g/i);
  if (!m) return [];
  return [m[0].toLowerCase()];
}

function parseItemsLine(text, priceIndex) {
  // 支援格式：
  // - 龜鹿膏2罐
  // - 龜鹿飲 3包
  // - 湯塊300g 1盒
  // - 湯塊 600g*2

  const raw = normText(text);
  const tokens = raw
    .replace(/[，,、]/g, " ")
    .replace(/\*/g, " ")
    .split(/\s+/)
    .filter(Boolean);

  const joined = raw.replace(/\s+/g, "");

  // 先用正則抓「(品名...)(數量)(單位)」
  const patterns = [
    /([\u4e00-\u9fa5A-Za-z（）()\d\.]+)\s*([0-9]{1,3})\s*(罐|包|盒|組|份|個)?/g,
  ];

  const found = [];
  for (const re of patterns) {
    let m;
    while ((m = re.exec(raw))) {
      const namePart = (m[1] || "").trim();
      const qty = toNumber(m[2]);
      const unit = (m[3] || "").trim();
      if (!namePart || !qty) continue;
      found.push({ namePart, qty, unit });
    }
  }

  // 如果抓不到，就整段當一項（等真人處理）
  if (!found.length) {
    return { items: [], note: "" };
  }

  const items = [];
  let subtotal = 0;

  for (const f of found) {
    const key = f.namePart.replace(/\s+/g, "");

    // 找最符合的 index item
    let best = null;
    let bestScore = -1;

    for (const it of priceIndex) {
      const keys = it.matchKeys || [];
      let score = 0;
      for (const k of keys) {
        if (!k) continue;
        const kk = String(k).replace(/\s+/g, "");
        if (key.includes(kk) || joined.includes(kk)) score += Math.min(10, kk.length);
      }
      if (score > bestScore) {
        bestScore = score;
        best = it;
      }
    }

    if (!best || bestScore <= 0) {
      items.push({ display: `${f.namePart} x${f.qty}`, price: 0, qty: f.qty });
      continue;
    }

    const act = calcDiscount(best.msrp, best.discount) || best.msrp;
    const lineTotal = Math.round(act * f.qty);
    subtotal += lineTotal;

    const title = best.type === "variant"
      ? `${best.productName}（${best.variantLabel}）`
      : best.productName;

    items.push({
      display: `${title} x${f.qty}`,
      price: act,
      qty: f.qty,
      lineTotal,
    });
  }

  return { items, subtotal };
}

async function handleOrderMessage(userId, text) {
  const st = orderState.get(userId);
  if (!st || !st.active) return null;

  const t = normText(text);
  if (t === "選單" || t === "0") {
    resetOrder(userId);
    return [mainMenuCard(), mainMenuCard2()];
  }

  if (st.step === "items") {
    const priceIndex = await buildPriceIndex();
    const parsed = parseItemsLine(t, priceIndex);

    if (!parsed.items || !parsed.items.length) {
      return [
        {
          type: "text",
          text:
            "收到🙂\n麻煩用這種格式貼我就能自動算金額：\n\n例如：龜鹿膏2罐 龜鹿飲3包 湯塊300g1盒\n\n（回『選單』可回主選單）",
        },
      ];
    }

    st.itemsRaw = t;
    st.items = parsed.items;
    st.subtotal = parsed.subtotal || 0;
    st.step = "contact";

    const lines = ["✅ 已收到品項："]; 
    for (const it of st.items) {
      lines.push(`- ${it.display}${it.lineTotal ? `（小計 ${money(it.lineTotal)}）` : ""}`);
    }
    lines.push(`\n商品小計：${money(st.subtotal)}（未含運/未含親送費）`);
    lines.push("\n接著麻煩貼：姓名 + 電話 + 地址/門市\n（可一次貼一段）");

    // 雙北親送先提醒
    if (st.method === "deliver") {
      lines.push("\n※ 雙北親送僅限台北/新北，地址若不在雙北會改建議宅配/店到店🙂");
    }

    return [{ type: "text", text: lines.join("\n") }];
  }

  if (st.step === "contact") {
    // 粗略抓電話（8~15 碼）
    const digits = String(t).replace(/\D/g, "");
    if (digits.length >= 8 && digits.length <= 15) st.phone = digits;

    // 抓姓名（去掉電話）
    const noDigits = t.replace(digits, "").trim();
    // 以第一段當姓名（避免把地址當名字）
    const nameCandidate = noDigits.split(/\s+/)[0];
    if (nameCandidate && nameCandidate.length >= 2 && nameCandidate.length <= 10) st.name = nameCandidate;

    // 抓地址/門市
    if (t.includes("路") || t.includes("街") || t.includes("巷") || t.includes("號") || t.includes("樓") || t.includes("段") || t.includes("門市") || t.includes("店")) {
      st.address = t;
    }

    const need = [];
    if (!st.name) need.push("姓名");
    if (!st.phone) need.push("電話");
    if (!st.address && st.method !== "pickup") need.push(st.method === "c2c" ? "取貨門市" : "地址");

    if (need.length) {
      return [{ type: "text", text: `我有看到🙂 目前我還需要：${need.join("、")}\n（回『選單』可回主選單）` }];
    }

    // 雙北判斷
    if (st.method === "deliver" && !isTaipeiOrNewTaipei(st.address)) {
      resetOrder(userId);
      return [
        {
          type: "text",
          text:
            "我看地址似乎不是台北/新北🙂\n雙北親送目前僅限台北/新北。\n\n建議改用：宅配 或 超商店到店\n你直接點『怎麼購買』再選一次就好。",
        },
        buyMenuCard(),
        backToMenuCard(),
      ];
    }

    const summary = [];
    summary.push("✅ 訂單資訊確認");
    summary.push(`方式：${methodLabel(st.method)}`);
    summary.push(`姓名：${st.name}`);
    summary.push(`電話：${st.phone}`);
    if (st.method !== "pickup") summary.push(`${st.method === "c2c" ? "門市" : "地址"}：${st.address}`);
    summary.push("\n品項：");
    for (const it of st.items) summary.push(`- ${it.display}${it.lineTotal ? `（${money(it.lineTotal)}）` : ""}`);
    summary.push(`\n商品小計：${money(st.subtotal)}（未含運/未含親送費）`);
    summary.push("\n我接著會回覆：出貨安排與付款資訊🙂");

    resetOrder(userId);
    return [{ type: "text", text: summary.join("\n") }, backToMenuCard()];
  }

  return null;
}

/** =========================
 * 6) 對話路由
 * ========================= */

async function handleTextMessage(userId, text) {
  const t = normText(text);

  // 下單流程優先
  const orderMsgs = await handleOrderMessage(userId, t);
  if (orderMsgs) return orderMsgs;

  // 主選單
  if (!t || t === "選單" || t === "0" || t === "主選單") {
    return [mainMenuCard(), mainMenuCard2()];
  }

  // 主功能
  if (t === "產品介紹") {
    return [await productsCarousel("intro"), backToMenuCard()];
  }
  if (t === "產品規格") {
    return [await productsCarousel("spec"), backToMenuCard()];
  }
  if (t === "看價格") {
    return [await priceCarouselAll(), { type: "text", text: STORE.priceNote }, backToMenuCard()];
  }
  if (t === "怎麼購買") {
    return [buyMenuCard(), backToMenuCard()];
  }
  if (t === "門市資訊") {
    return [storeCard()];
  }

  // 購買方式
  if (t === "購買 宅配") {
    startOrder(userId, "home");
    return [{ type: "text", text: "好的🙂\n請先回：品項＋數量\n例如：龜鹿膏2罐 龜鹿飲3包\n（回『選單』可回主選單）" }];
  }
  if (t === "購買 店到店") {
    startOrder(userId, "c2c");
    return [{ type: "text", text: "好的🙂\n請先回：品項＋數量\n例如：龜鹿膏2罐 湯塊300g1盒\n（回『選單』可回主選單）" }];
  }
  if (t === "購買 雙北親送") {
    startOrder(userId, "deliver");
    return [{ type: "text", text: "好的🙂（雙北親送）\n請先回：品項＋數量\n例如：龜鹿膏2罐 龜鹿飲3包\n（回『選單』可回主選單）" }];
  }
  if (t === "購買 自取") {
    startOrder(userId, "pickup");
    return [{ type: "text", text: "好的🙂（到店自取）\n請先回：品項＋數量\n例如：龜鹿膏1罐\n（回『選單』可回主選單）" }];
  }

  // 產品指令
  if (t.startsWith("介紹 ")) {
    const name = t.replace(/^介紹\s+/, "");
    const txt = await introText(name);
    const p = await findProductByName(name);
    return p ? [{ type: "text", text: txt }, productActionCard(p.name)] : [{ type: "text", text: txt }, backToMenuCard()];
  }
  if (t.startsWith("規格 ")) {
    const name = t.replace(/^規格\s+/, "");
    const txt = await specText(name);
    const p = await findProductByName(name);
    return p ? [{ type: "text", text: txt }, productActionCard(p.name)] : [{ type: "text", text: txt }, backToMenuCard()];
  }
  if (t.startsWith("價格 ")) {
    const name = t.replace(/^價格\s+/, "");
    const txt = await priceText(name);
    const p = await findProductByName(name);
    return p ? [{ type: "text", text: txt }, productActionCard(p.name)] : [{ type: "text", text: txt }, backToMenuCard()];
  }

  // 直接輸入品名（老人家常用）
  // 例：龜鹿膏 / 湯塊
  const maybe = await findProductByName(t);
  if (maybe) {
    return [productActionCard(maybe.name)];
  }

  // fallback
  return [{ type: "text", text: "我有收到🙂\n直接點『選單』比較快～" }, mainMenuCard(), mainMenuCard2()];
}

/** =========================
 * 7) Web Server / Webhook
 * ========================= */

const app = express();

app.get("/health", (req, res) => res.status(200).send("ok"));
app.get("/", (req, res) => res.status(200).send("ok"));

function mountWebhook(pathname) {
  // 缺金鑰時不要 crash：回 500 讓 verify/日誌看得出原因
  app.post(pathname, (req, res, next) => {
    if (!ACCESS_TOKEN || !CHANNEL_SEC) return res.status(500).send("LINE credentials missing");
    return line.middleware(config)(req, res, next);
  });

  app.post(pathname, async (req, res) => {
    try {
      const events = req.body.events || [];
      await Promise.all(
        events.map(async (event) => {
          if (event.type !== "message") return;
          if (!event.message || event.message.type !== "text") return;

          const userId = event.source && event.source.userId;
          const text = event.message.text || "";
          const msgs = await handleTextMessage(userId || "", text);
          return client.replyMessage(event.replyToken, msgs);
        })
      );
      res.sendStatus(200);
    } catch (e) {
      console.error("Webhook error:", e);
      res.sendStatus(500);
    }
  });
}

mountWebhook("/webhook");
mountWebhook("/");

app.listen(PORT || 3000, "0.0.0.0", () => {
  console.log("LINE bot running on", PORT || 3000);
  console.log("PRODUCTS_URL:", PRODUCTS_ENDPOINT);
});
