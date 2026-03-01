"use strict";

/**
 * 仙加味・龜鹿 LINE Bot（完整可替換版）
 * - 分層選單（主選單 → 子選單 → 單品頁）
 * - 串接 products.json（可用 PRODUCTS_URL 或本機 ./products.json）
 * - 價格只在 LINE 顯示（網站端是否顯示由前端控制）
 *
 * Render 環境變數（請用你現在這套）：
 * - LINE_CHANNEL_ACCESS_TOKEN
 * - LINE_CHANNEL_SECRET
 * - PRODUCTS_URL（可選，例：https://xxx/products.json）
 */

// ===== 0) ENV（統一用 LINE_CHANNEL_*；仍相容 CHANNEL_*） =====
const CHANNEL_ACCESS_TOKEN =
  process.env.LINE_CHANNEL_ACCESS_TOKEN ||
  process.env.CHANNEL_ACCESS_TOKEN;

const CHANNEL_SECRET =
  process.env.LINE_CHANNEL_SECRET ||
  process.env.CHANNEL_SECRET;

const PRODUCTS_URL = process.env.PRODUCTS_URL || ""; // 可空：會改讀本機 ./products.json
const PORT = Number(process.env.PORT || 10000);

if (!CHANNEL_ACCESS_TOKEN || !CHANNEL_SECRET) {
  console.error("缺少環境變數：LINE_CHANNEL_ACCESS_TOKEN 或 LINE_CHANNEL_SECRET");
  process.exit(1);
}

// ===== 1) 基本依賴 =====
const express = require("express");
const line = require("@line/bot-sdk");
const fs = require("fs");
const path = require("path");

// Node 18+ 有 fetch；Render 新版通常有。若沒有也會在載入 products 時 fallback 本機檔。
const hasFetch = typeof fetch === "function";

const config = { channelAccessToken: CHANNEL_ACCESS_TOKEN, channelSecret: CHANNEL_SECRET };
const client = new line.Client(config);
const app = express();

// ===== 2) 店家資訊（你可自行改） =====
const STORE = {
  brandName: "仙加味・龜鹿",
  address: "台北市萬華區西昌街 52 號",
  phoneDisplay: "(02) 2381-2990",
  phoneTel: "0223812990",
  website: "https://ts15825868.github.io/TaiShing/index.html",
  productsPage: "https://ts15825868.github.io/TaiShing/products.html", // 可不需要
  mapUrl: "https://www.google.com/maps/search/?api=1&query=%E5%8F%B0%E5%8C%97%E5%B8%82%E8%90%AC%E8%8F%AF%E5%8D%80%E8%A5%BF%E6%98%8C%E8%A1%97+52+%E8%99%9F",

  // 真人模式提示（你想要的話）
  humanModeNote:
    "我已先幫您轉真人協助🙂\n\n※ 真人回覆期間，系統會先暫停自動回覆，避免訊息打架。\n要回到主選單可回：0 或「選單」\n若要解除真人模式可回：解除真人",

  hours: {
    weekday: "週一～週五 9:30–18:30",
    pickupLate: "自取可到約 21:30–22:00（請先訊息確認）",
    weekend: "週六日若剛好在店/方便外出，也可協助取貨（建議先訊息確認）",
    reply: "回覆時間多在白天～晚間（看到會盡快回覆）",
  },

  priceNote1: "※ 不同通路因服務內容／搭配方案不同，價格可能略有差異🙂",
  priceNote2: "※ 到店另有不定期活動或搭配方案，依現場為準。",
};

// ===== 3) products.json 讀取與快取 =====
const LOCAL_PRODUCTS_FILE = path.join(__dirname, "products.json");

let PRODUCTS_CACHE = null;
let PRODUCTS_CACHE_AT = 0;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 分鐘快取，避免每次 webhook 都抓一次

function normalizeText(s) {
  return String(s || "")
    .replace(/\u3000/g, " ")
    .replace(/[，,、/／]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function money(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return "";
  const s = String(Math.round(x)).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `NT$${s}`;
}

function roundPrice(n) {
  const x = Number(n);
  return Number.isFinite(x) ? Math.round(x) : null;
}
function calcDiscount(msrp, discount) {
  const m = Number(msrp);
  const d = Number(discount);
  if (!Number.isFinite(m) || !Number.isFinite(d)) return null;
  return roundPrice(m * d);
}

async function fetchProductsFromUrl(url) {
  if (!url) return null;
  if (!hasFetch) return null;

  const res = await fetch(url, { method: "GET" });
  if (!res.ok) throw new Error(`products.json fetch failed: ${res.status}`);
  const data = await res.json();
  return data;
}

function loadProductsFromFile() {
  if (!fs.existsSync(LOCAL_PRODUCTS_FILE)) return null;
  const raw = fs.readFileSync(LOCAL_PRODUCTS_FILE, "utf8");
  return raw ? JSON.parse(raw) : null;
}

async function getProducts() {
  const now = Date.now();
  if (PRODUCTS_CACHE && now - PRODUCTS_CACHE_AT < CACHE_TTL_MS) return PRODUCTS_CACHE;

  // 先嘗試 URL
  if (PRODUCTS_URL) {
    try {
      const d = await fetchProductsFromUrl(PRODUCTS_URL);
      if (d && d.categories) {
        PRODUCTS_CACHE = d;
        PRODUCTS_CACHE_AT = now;
        return PRODUCTS_CACHE;
      }
    } catch (e) {
      console.error("抓 PRODUCTS_URL 失敗，改用本機 products.json：", e?.message || e);
    }
  }

  // fallback 本機檔
  try {
    const d = loadProductsFromFile();
    if (d && d.categories) {
      PRODUCTS_CACHE = d;
      PRODUCTS_CACHE_AT = now;
      return PRODUCTS_CACHE;
    }
  } catch (e) {
    console.error("讀本機 products.json 失敗：", e?.message || e);
  }

  // 都沒有
  return { version: 0, updatedAt: new Date().toISOString(), categories: [] };
}

// ===== 4) 選單代碼（固定兩位數邏輯）=====
// 主選單：0 / 1 / 2 / 3 / 4 / 5 / 6 / 7
// 產品介紹：11~14（依 categories id 對應）
// 規格：31~34
// 價格：51~54（湯塊 54 一次顯示全部 variants）
// 購買：91~94

const CATEGORY_CODE = {
  gel:   { intro: "11", spec: "31", price: "51" },
  drink: { intro: "12", spec: "32", price: "52" },
  antler:{ intro: "13", spec: "33", price: "53" },
  soup:  { intro: "14", spec: "34", price: "54" },
};

function getCategoryById(products, id) {
  return (products.categories || []).find((c) => c.id === id) || null;
}
function firstItemOfCategory(products, id) {
  const c = getCategoryById(products, id);
  return c && Array.isArray(c.items) && c.items.length ? c.items[0] : null;
}

// ===== 5) Quick Reply（只留當頁）=====
function qr(label, text) {
  return { type: "action", action: { type: "message", label, text } };
}
function qrUri(label, uri) {
  return { type: "action", action: { type: "uri", label, uri } };
}

function textMessage(text, quickReplyItems = null) {
  const msg = { type: "text", text: String(text || "").slice(0, 4900) };
  if (quickReplyItems && quickReplyItems.length) msg.quickReply = { items: quickReplyItems };
  return msg;
}

function mainMenuText() {
  return `您好，這裡是【${STORE.brandName}】🙂
請回覆數字查詢：

1) 產品介紹
2) 規格
3) 價格（LINE 內顯示）
4) 購買方式
5) 門市資訊／來電
6) 真人回覆
7) 官網

（隨時回 0 或「選單」可回主選單）`;
}

function mainMenuQR() {
  return [
    qr("1 產品介紹", "1"),
    qr("2 規格", "2"),
    qr("3 價格", "3"),
    qr("4 購買方式", "4"),
    qr("5 門市/來電", "5"),
    qr("6 真人回覆", "6"),
    qr("7 官網", "7"),
  ];
}

function productMenuText(products) {
  const gel = firstItemOfCategory(products, "gel");
  const drink = firstItemOfCategory(products, "drink");
  const antler = firstItemOfCategory(products, "antler");
  const soup = firstItemOfCategory(products, "soup");

  return `【產品介紹】請回覆代碼：
11) ${gel?.name || "龜鹿膏"}
12) ${drink?.name || "龜鹿飲"}
13) ${antler?.name || "鹿茸粉"}
14) ${soup?.name || "龜鹿湯塊（膠）"}

0) 回主選單`;
}

function productMenuQR() {
  return [
    qr("11 龜鹿膏", "11"),
    qr("12 龜鹿飲", "12"),
    qr("13 鹿茸粉", "13"),
    qr("14 湯塊(膠)", "14"),
    qr("0 主選單", "0"),
  ];
}

function specMenuText(products) {
  const gel = firstItemOfCategory(products, "gel");
  const drink = firstItemOfCategory(products, "drink");
  const antler = firstItemOfCategory(products, "antler");
  const soup = firstItemOfCategory(products, "soup");

  return `【規格】請回覆代碼：
31) ${gel?.name || "龜鹿膏"}
32) ${drink?.name || "龜鹿飲"}
33) ${antler?.name || "鹿茸粉"}
34) ${soup?.name || "龜鹿湯塊（膠）"}

0) 回主選單`;
}

function specMenuQR() {
  return [
    qr("31 龜鹿膏", "31"),
    qr("32 龜鹿飲", "32"),
    qr("33 鹿茸粉", "33"),
    qr("34 湯塊(膠)", "34"),
    qr("0 主選單", "0"),
  ];
}

function priceMenuText(products) {
  const gel = firstItemOfCategory(products, "gel");
  const drink = firstItemOfCategory(products, "drink");
  const antler = firstItemOfCategory(products, "antler");
  const soup = firstItemOfCategory(products, "soup");

  return `【價格（LINE 內顯示）】請回覆代碼：
51) ${gel?.name || "龜鹿膏"}
52) ${drink?.name || "龜鹿飲"}
53) ${antler?.name || "鹿茸粉"}
54) ${soup?.name || "龜鹿湯塊（膠）"}

0) 回主選單`;
}

function priceMenuQR() {
  return [
    qr("51 龜鹿膏", "51"),
    qr("52 龜鹿飲", "52"),
    qr("53 鹿茸粉", "53"),
    qr("54 湯塊(膠)", "54"),
    qr("4 購買方式", "4"),
    qr("0 主選單", "0"),
  ];
}

function buyMenuText() {
  return `【購買方式】先選一種方式（回覆代碼）：
91) 宅配
92) 超商店到店
93) 雙北親送
94) 到店自取

0) 回主選單`;
}

function buyMenuQR() {
  return [
    qr("91 宅配", "91"),
    qr("92 店到店", "92"),
    qr("93 雙北親送", "93"),
    qr("94 到店自取", "94"),
    qr("0 主選單", "0"),
  ];
}

function storeInfoText() {
  return `【門市資訊｜${STORE.brandName}】
地址：${STORE.address}
電話：${STORE.phoneDisplay}

營業：${STORE.hours.weekday}
自取：${STORE.hours.pickupLate}
週末：${STORE.hours.weekend}
回覆：${STORE.hours.reply}

（回 0 或「選單」可回主選單）`;
}

function storeMenuQR() {
  return [
    qr("0 主選單", "0"),
    qrUri("地圖", STORE.mapUrl),
    qrUri("來電", `tel:${STORE.phoneTel}`),
    qrUri("官網", STORE.website),
  ];
}

function productIntroText(item, categoryName) {
  const lines = [];
  lines.push(`【${item.name}】`);
  if (item.intro && item.intro.length) lines.push(`• ${item.intro.join("\n• ")}`);
  lines.push("");
  if (item.spec) lines.push(`規格：${item.spec}`);
  if (item.ingredients && item.ingredients.length) {
    lines.push("");
    lines.push("成分：");
    lines.push(`• ${item.ingredients.join("\n• ")}`);
  }
  if (item.usage && item.usage.length) {
    lines.push("");
    lines.push("食用建議：");
    lines.push(`• ${item.usage.join("\n• ")}`);
  }

  // 湯塊 variants
  if (Array.isArray(item.variants) && item.variants.length) {
    lines.push("");
    lines.push("規格（多規格）：");
    for (const v of item.variants) {
      lines.push(`• ${v.label}：${v.spec}${v.note ? `（${v.note}）` : ""}`);
    }
  }

  lines.push("");
  lines.push("想看價格：回 3 → 再選該品項代碼");
  lines.push("（回 0 或「選單」可回主選單）");
  return lines.join("\n");
}

function productSpecText(item) {
  if (Array.isArray(item.variants) && item.variants.length) {
    const lines = [`【${item.name} 規格】`];
    for (const v of item.variants) {
      lines.push(`• ${v.label}：${v.spec}${v.note ? `（${v.note}）` : ""}`);
    }
    lines.push("");
    lines.push("（回 0 或「選單」可回主選單）");
    return lines.join("\n");
  }
  return `【${item.name} 規格】\n${item.spec || "—"}\n\n（回 0 或「選單」可回主選單）`;
}

function productPriceText(item) {
  const lines = [];
  lines.push(`【${item.name} 價格】`);

  if (Array.isArray(item.variants) && item.variants.length) {
    lines.push("");
    for (const v of item.variants) {
      lines.push(`${v.label}（${v.spec}）`);
      if (v.msrp != null) lines.push(`建議售價：${money(v.msrp)}`);
      const act = v.discount ? calcDiscount(v.msrp, v.discount) : null;
      if (act != null) lines.push(`目前活動價：${money(act)}（9折）`);
      if (v.note) lines.push(`備註：${v.note}`);
      lines.push("");
    }
    while (lines.length && lines[lines.length - 1] === "") lines.pop();
  } else {
    if (item.msrp != null) lines.push(`建議售價：${money(item.msrp)}`);
    const act = item.discount ? calcDiscount(item.msrp, item.discount) : null;
    if (act != null) lines.push(`目前活動價：${money(act)}（9折）`);
  }

  lines.push("");
  lines.push(STORE.priceNote1);
  lines.push(STORE.priceNote2);
  lines.push("");
  lines.push("（回 0 或「選單」可回主選單）");
  return lines.join("\n");
}

// ===== 6) 真人模式（簡化：用記憶體，重啟會清掉；你要持久化我再加 users.json）=====
const HUMAN_MODE = new Set(); // userId set

// ===== 7) Webhook 路由 =====
// 讓你瀏覽網址時不再看到 Cannot GET
app.get("/", (req, res) => res.status(200).send("OK"));
app.get("/health", (req, res) => res.status(200).json({ ok: true }));
app.get("/webhook", (req, res) => res.status(200).send("OK")); // 方便你手動打開測試

// LINE webhook（要驗簽：避免亂打）
app.post("/webhook", line.middleware(config), async (req, res) => {
  try {
    const events = req.body.events || [];
    await Promise.all(events.map(handleEvent));
    res.status(200).end();
  } catch (err) {
    console.error("Webhook error:", err?.message || err);
    res.status(500).end();
  }
});

async function handleEvent(event) {
  // follow：新好友
  if (event.type === "follow") {
    return client.replyMessage(event.replyToken, textMessage(mainMenuText(), mainMenuQR()));
  }

  if (event.type !== "message") return null;
  if (!event.message || event.message.type !== "text") return null;

  const userId = event.source && event.source.userId;
  const raw = event.message.text || "";
  const t = normalizeText(raw);

  if (!userId) {
    return client.replyMessage(event.replyToken, textMessage("您好🙂 請回 0 或「選單」叫出主選單。", mainMenuQR()));
  }

  // 真人模式
  if (t === "解除真人" || t === "取消真人" || t === "恢復自動") {
    HUMAN_MODE.delete(userId);
    return client.replyMessage(event.replyToken, textMessage(mainMenuText(), mainMenuQR()));
  }
  if (t === "6" || t.includes("真人") || t.includes("人工") || t.includes("客服")) {
    HUMAN_MODE.add(userId);
    return client.replyMessage(event.replyToken, textMessage(STORE.humanModeNote, mainMenuQR()));
  }
  if (HUMAN_MODE.has(userId)) {
    if (t === "0" || t === "選單") {
      HUMAN_MODE.delete(userId);
      return client.replyMessage(event.replyToken, textMessage(mainMenuText(), mainMenuQR()));
    }
    return client.replyMessage(
      event.replyToken,
      textMessage("我有收到🙂 已轉真人協助中。\n要回主選單回：0 或「選單」\n要解除真人回：解除真人", mainMenuQR())
    );
  }

  // 主選單快捷
  if (t === "0" || t === "選單" || t === "主選單" || t.toLowerCase() === "menu") {
    return client.replyMessage(event.replyToken, textMessage(mainMenuText(), mainMenuQR()));
  }

  // 串接 products.json
  const products = await getProducts();

  // 主選單：1/2/3/4/5/7
  if (t === "1") {
    return client.replyMessage(event.replyToken, textMessage(productMenuText(products), productMenuQR()));
  }
  if (t === "2") {
    return client.replyMessage(event.replyToken, textMessage(specMenuText(products), specMenuQR()));
  }
  if (t === "3") {
    return client.replyMessage(event.replyToken, textMessage(priceMenuText(products), priceMenuQR()));
  }
  if (t === "4") {
    return client.replyMessage(event.replyToken, textMessage(buyMenuText(), buyMenuQR()));
  }
  if (t === "5") {
    return client.replyMessage(event.replyToken, textMessage(storeInfoText(), storeMenuQR()));
  }
  if (t === "7" || t.includes("官網") || t.includes("網址") || t.includes("網站")) {
    return client.replyMessage(
      event.replyToken,
      textMessage(`官網（品牌介紹／產品資訊）：\n${STORE.website}\n\n（回 0 或「選單」可回主選單）`, mainMenuQR())
    );
  }

  // 產品介紹：11~14
  if (["11", "12", "13", "14"].includes(t)) {
    const map = { "11": "gel", "12": "drink", "13": "antler", "14": "soup" };
    const cid = map[t];
    const cat = getCategoryById(products, cid);
    const item = cat && cat.items && cat.items[0];
    if (!item) {
      return client.replyMessage(event.replyToken, textMessage("目前此品項資料尚未同步完成🙂\n請回 0 或「選單」回主選單。", mainMenuQR()));
    }

    // 產品頁 quick reply：該品項價格 + 購買 + 回子選單 + 主選單
    const priceCode = CATEGORY_CODE[cid]?.price || "3";
    const qrs = [
      qr(`${priceCode} 看價格`, String(priceCode)),
      qr("4 購買方式", "4"),
      qr("1 產品選單", "1"),
      qr("0 主選單", "0"),
    ];

    return client.replyMessage(event.replyToken, textMessage(productIntroText(item, cat?.name || ""), qrs));
  }

  // 規格：31~34
  if (["31", "32", "33", "34"].includes(t)) {
    const map = { "31": "gel", "32": "drink", "33": "antler", "34": "soup" };
    const cid = map[t];
    const cat = getCategoryById(products, cid);
    const item = cat && cat.items && cat.items[0];
    if (!item) {
      return client.replyMessage(event.replyToken, textMessage("目前此品項資料尚未同步完成🙂\n請回 0 或「選單」回主選單。", mainMenuQR()));
    }
    return client.replyMessage(event.replyToken, textMessage(productSpecText(item), specMenuQR()));
  }

  // 價格：51~54（湯塊 54 顯示全部 variants）
  if (["51", "52", "53", "54"].includes(t)) {
    const map = { "51": "gel", "52": "drink", "53": "antler", "54": "soup" };
    const cid = map[t];
    const cat = getCategoryById(products, cid);
    const item = cat && cat.items && cat.items[0];
    if (!item) {
      return client.replyMessage(event.replyToken, textMessage("目前此品項價格資料尚未同步🙂\n請回 0 或「選單」回主選單。", mainMenuQR()));
    }
    return client.replyMessage(event.replyToken, textMessage(productPriceText(item), priceMenuQR()));
  }

  // 購買：91~94（這裡先給簡化版；你要「收斂式填單」我再加進去）
  if (["91", "92", "93", "94"].includes(t)) {
    const methodMap = {
      "91": "宅配",
      "92": "超商店到店",
      "93": "雙北親送",
      "94": "到店自取",
    };
    const m = methodMap[t];

    const msg = `好的🙂 我先用【${m}】協助您。

請直接回覆：
1) 要買的品項＋數量（例如：龜鹿膏1、龜鹿飲3）
2) 姓名＋電話
3) 若是宅配/親送再加：地址
4) 若是店到店再加：取貨門市（店名/店號/地址）

（回 0 或「選單」可回主選單）`;

    return client.replyMessage(event.replyToken, textMessage(msg, buyMenuQR()));
  }

  // 自然語句導引
  if (t.includes("規格") || t.includes("容量") || t.includes("幾g") || t.includes("幾cc") || t.includes("重量")) {
    return client.replyMessage(event.replyToken, textMessage(specMenuText(products), specMenuQR()));
  }
  if (t.includes("價格") || t.includes("價錢") || t.includes("售價") || t.includes("報價")) {
    return client.replyMessage(event.replyToken, textMessage(priceMenuText(products), priceMenuQR()));
  }
  if (t.includes("購買") || t.includes("怎麼買") || t.includes("下單") || t.includes("訂購") || t.includes("宅配") || t.includes("店到店") || t.includes("自取") || t.includes("親送")) {
    return client.replyMessage(event.replyToken, textMessage(buyMenuText(), buyMenuQR()));
  }
  if (t.includes("門市") || t.includes("地址") || t.includes("電話") || t.includes("營業")) {
    return client.replyMessage(event.replyToken, textMessage(storeInfoText(), storeMenuQR()));
  }

  // fallback
  return client.replyMessage(
    event.replyToken,
    textMessage("我有收到🙂\n要叫出主選單請回：0 或「選單」\n也可以回：1 產品介紹／2 規格／3 價格／4 購買方式", mainMenuQR())
  );
}

// ===== 8) 啟動 =====
app.listen(PORT, () => {
  console.log(`LINE bot listening on port ${PORT}`);
  if (PRODUCTS_URL) console.log(`PRODUCTS_URL: ${PRODUCTS_URL}`);
});
