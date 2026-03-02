"use strict";

/**
 * 仙加味・龜鹿 LINE OA Bot（全卡片按鈕版｜串接 products.json）
 * ------------------------------------------------------------
 * 特色：
 * - 主選單/產品/價格/購買/門市 全部用「卡片按鈕」或「輪播卡片」操作（不強迫打數字）
 * - 產品介紹內已包含：介紹/成分/食用建議/規格（因此「看規格」按鈕已移除）
 * - 價格：一般品項顯示「建議售價 + 活動價（若有折扣）」；湯塊（膠）顯示多規格價格
 * - products.json 來源：Render 環境變數 PRODUCTS_URL（未填則用官網預設）
 *
 * Render 環境變數（擇一套命名即可）：
 * - LINE_CHANNEL_ACCESS_TOKEN / LINE_CHANNEL_SECRET（建議）
 *   或 CHANNEL_ACCESS_TOKEN / CHANNEL_SECRET（相容）
 * - PRODUCTS_URL（可選）例：https://ts15825868.github.io/TaiShing/products.json
 */

const express = require("express");
const line = require("@line/bot-sdk");
const https = require("https");
const http = require("http");

/* =========================
 * 0) 環境變數
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

// products.json 預設來源（不填 PRODUCTS_URL 也能跑）
const DEFAULT_PRODUCTS_URL = "https://ts15825868.github.io/TaiShing/products.json";
const PRODUCTS_JSON_URL = (PRODUCTS_URL && String(PRODUCTS_URL).trim()) || DEFAULT_PRODUCTS_URL;

if (!ACCESS_TOKEN || !CHANNEL_SEC) {
  console.warn(
    "[WARN] 缺少 LINE 金鑰：請設定 LINE_CHANNEL_ACCESS_TOKEN/LINE_CHANNEL_SECRET（或 CHANNEL_ACCESS_TOKEN/CHANNEL_SECRET）。\n" +
      "服務仍會啟動（避免 Render Exit 1），但 /webhook 會回 500。"
  );
}

const config = { channelAccessToken: ACCESS_TOKEN, channelSecret: CHANNEL_SEC };
const client = new line.Client(config);

/* =========================
 * A) 基本資訊
 * ========================= */
const STORE = {
  brandName: "仙加味・龜鹿",
  address: "台北市萬華區西昌街 52 號",
  phoneDisplay: "(02) 2381-2990",
  phoneTel: "0223812990",
  website: "https://ts15825868.github.io/TaiShing/index.html",
  mapUrl:
    "https://www.google.com/maps/search/?api=1&query=%E5%8F%B0%E5%8C%97%E5%B8%82%E8%90%AC%E8%8F%AF%E5%8D%80%E8%A5%BF%E6%98%8C%E8%A1%97+52+%E8%99%9F",
  priceNote: "※ 不同通路因服務內容／搭配方案不同，價格可能略有差異；到店另有不定期活動，依現場為準🙂",
  infoDisclaimer: "※ 產品資訊以實際包裝標示為準（不同批次可能略有差異）。",
  deliverNote: "雙北親送：視路線/時間可安排；若不便親送會改以宅配或店到店協助🙂",
};

/* =========================
 * B) 讀取 products.json（含快取）
 * ========================= */
let cache = { at: 0, data: null };
const CACHE_TTL = 5 * 60 * 1000;

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    try {
      const lib = String(url).startsWith("https") ? https : http;
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
    } catch (e) {
      reject(e);
    }
  });
}

async function getProductsData() {
  if (cache.data && Date.now() - cache.at < CACHE_TTL) return cache.data;

  try {
    const data = await fetchJson(PRODUCTS_JSON_URL);
    cache = { at: Date.now(), data };
    return data;
  } catch (e) {
    console.error("[ERR] 讀取 products.json 失敗：", e?.message || e);
    // fallback：至少不要讓 bot 掛掉
    return { categories: [] };
  }
}

function flattenProducts(data) {
  const list = [];
  for (const c of data.categories || []) {
    for (const item of c.items || []) list.push(item);
  }
  return list;
}

function findProductByName(flat, name) {
  const key = String(name || "").trim();
  if (!key) return null;
  // 先精準包含
  let p = flat.find((x) => key === x.name);
  if (p) return p;
  // 再用 includes
  p = flat.find((x) => key.includes(x.name) || x.name.includes(key));
  if (p) return p;

  // 湯塊別名（保險）
  const soupAliases = ["湯塊", "龜鹿湯塊", "龜鹿湯塊（膠）", "龜鹿膠", "二仙膠", "仙膠", "龜鹿仙膠"];
  if (soupAliases.some((k) => key.includes(k))) {
    return flat.find((x) => String(x.name).includes("湯塊"));
  }
  return null;
}

/* =========================
 * C) 格式工具
 * ========================= */
function clampText(t) {
  const s = String(t || "");
  return s.length > 4900 ? s.slice(0, 4900) : s;
}

function money(n) {
  const x = Math.round(Number(n) || 0);
  return "$" + String(x).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function calcDiscount(msrp, d) {
  if (msrp == null || d == null) return null;
  const m = Number(msrp);
  const dd = Number(d);
  if (!isFinite(m) || !isFinite(dd) || dd <= 0) return null;
  return Math.round(m * dd);
}

function firstLineIntro(p) {
  if (!p) return "點擊查看";
  if (Array.isArray(p.intro) && p.intro.length) return String(p.intro[0]).slice(0, 60);
  return "點擊查看";
}

/* =========================
 * D) 卡片（Buttons / Carousel）
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
        { type: "message", label: "看價格", text: "看價格" },
        { type: "message", label: "怎麼購買", text: "怎麼購買" },
        { type: "message", label: "門市資訊", text: "門市資訊" },
      ],
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

function productsCarousel(flat) {
  // LINE template carousel columns 上限 10
  const cols = flat.slice(0, 10).map((p) => ({
    title: String(p.name).slice(0, 40),
    text: firstLineIntro(p),
    actions: [
      { type: "message", label: "看介紹", text: `介紹 ${p.name}` },
      { type: "message", label: "看價格", text: `價格 ${p.name}` },
      { type: "message", label: "回主選單", text: "選單" },
    ],
  }));

  return {
    type: "template",
    altText: "產品列表",
    template: { type: "carousel", columns: cols },
  };
}

function productActionsCard(p) {
  return {
    type: "template",
    altText: "產品操作",
    template: {
      type: "buttons",
      title: String(p.name).slice(0, 40),
      text: "接下來想看什麼？🙂",
      actions: [
        // ✅ 已移除「看規格」：因為介紹內已包含規格
        { type: "message", label: "看價格", text: `價格 ${p.name}` },
        { type: "message", label: "怎麼購買", text: "怎麼購買" },
        { type: "message", label: "回主選單", text: "選單" },
      ],
    },
  };
}

/* =========================
 * E) 文字內容（介紹/規格/價格）
 * ========================= */
function introText(p) {
  if (!p) return "找不到這個產品🙂\n回「選單」可回主選單。";

  const lines = [];
  lines.push(`【${p.name}】`);

  if (Array.isArray(p.intro) && p.intro.length) {
    lines.push(`• ${p.intro.join("\n• ")}`);
    lines.push("");
  }

  // 規格：一般品項用 spec；湯塊用 variants
  if (Array.isArray(p.variants) && p.variants.length) {
    lines.push("規格：");
    p.variants.forEach((v) => {
      const label = v.label || v.spec || "";
      const note = v.note ? `（${v.note}）` : "";
      lines.push(`• ${label}${note}`);
    });
    lines.push("");
  } else if (p.spec) {
    lines.push(`規格：${p.spec}`);
    lines.push("");
  }

  if (Array.isArray(p.ingredients) && p.ingredients.length) {
    lines.push("成分：");
    lines.push(`• ${p.ingredients.join("\n• ")}`);
    lines.push("");
  }

  if (Array.isArray(p.usage) && p.usage.length) {
    lines.push("食用建議：");
    lines.push(`• ${p.usage.join("\n• ")}`);
    lines.push("");
  }

  lines.push(STORE.infoDisclaimer);

  return clampText(lines.join("\n"));
}

function specText(p) {
  if (!p) return "找不到這個產品🙂\n回「選單」可回主選單。";

  const lines = [];
  lines.push(`【${p.name}｜規格】`);
  if (Array.isArray(p.variants) && p.variants.length) {
    p.variants.forEach((v) => {
      const label = v.label || v.spec || "";
      const note = v.note ? `（${v.note}）` : "";
      lines.push(`• ${label}${note}`);
    });
  } else {
    lines.push(p.spec ? `• ${p.spec}` : "• （未提供）");
  }
  return clampText(lines.join("\n"));
}

function priceTextSingle(p) {
  // 一般品項（單規格）
  const msrp = p.msrp;
  const act = calcDiscount(p.msrp, p.discount);
  const lines = [];
  lines.push(`【${p.name}｜價格】`);
  lines.push(`建議售價：${money(msrp)}`);
  if (act) lines.push(`活動價：${money(act)}`);
  lines.push("");
  lines.push(STORE.priceNote);
  return clampText(lines.join("\n"));
}

function soupPriceCarousel(p) {
  // 湯塊（多規格）
  const cols = (p.variants || []).slice(0, 10).map((v) => {
    const act = calcDiscount(v.msrp, v.discount);
    const txt = [
      v.label || v.spec || "",
      `建議售價：${money(v.msrp)}`,
      act ? `活動價：${money(act)}` : "",
      v.note ? `備註：${v.note}` : "",
    ]
      .filter(Boolean)
      .join("\n")
      .slice(0, 120);

    return {
      title: String(p.name).slice(0, 40),
      text: txt || "價格資訊",
      actions: [{ type: "message", label: "回主選單", text: "選單" }],
    };
  });

  return {
    type: "template",
    altText: "湯塊價格",
    template: { type: "carousel", columns: cols },
  };
}

async function priceCarouselAll(flat) {
  const columns = [];

  for (const p of flat) {
    // 若有 variants，改成「湯塊價格」入口卡（避免一口氣塞太多）
    if (Array.isArray(p.variants) && p.variants.length) {
      columns.push({
        title: String(p.name).slice(0, 40),
        text: "多規格價格（點我查看）",
        actions: [
          { type: "message", label: "查看各規格", text: `價格 ${p.name}` },
          { type: "message", label: "回主選單", text: "選單" },
          { type: "message", label: "怎麼購買", text: "怎麼購買" },
        ],
      });
      continue;
    }

    const act = calcDiscount(p.msrp, p.discount);
    const txt = [
      `建議售價：${money(p.msrp)}`,
      act ? `活動價：${money(act)}` : "",
    ]
      .filter(Boolean)
      .join("\n");

    columns.push({
      title: String(p.name).slice(0, 40),
      text: txt || "價格資訊",
      actions: [
        { type: "message", label: "看介紹", text: `介紹 ${p.name}` },
        { type: "message", label: "怎麼購買", text: "怎麼購買" },
        { type: "message", label: "回主選單", text: "選單" },
      ],
    });
  }

  return {
    type: "template",
    altText: "產品價格",
    template: { type: "carousel", columns: columns.slice(0, 10) },
  };
}

/* =========================
 * F) 訊息分流（不強迫客人輸入數字）
 * ========================= */
function normalizeText(s) {
  return String(s || "").replace(/\u3000/g, " ").replace(/\s+/g, " ").trim();
}

async function handleText(text) {
  const t = normalizeText(text);

  // 主選單
  if (!t || t === "選單" || t === "主選單" || t === "0") return [mainMenuCard()];

  // 入口按鈕
  if (t === "產品介紹" || t === "產品" || t === "商品" || t === "看產品") {
    const data = await getProductsData();
    const flat = flattenProducts(data);
    if (!flat.length) return [{ type: "text", text: "目前暫時讀不到產品資料🙂\n請稍後再試或回「門市資訊」直接來電。" }, mainMenuCard()];
    return [productsCarousel(flat)];
  }

  if (t === "看價格" || t === "價格" || t === "價錢") {
    const data = await getProductsData();
    const flat = flattenProducts(data);
    if (!flat.length) return [{ type: "text", text: "目前暫時讀不到價格資料🙂\n請稍後再試或回「門市資訊」直接來電。" }, mainMenuCard()];
    return [await priceCarouselAll(flat)];
  }

  if (t === "怎麼購買" || t === "購買" || t === "我要買" || t === "怎麼買") {
    return [buyMenuCard()];
  }

  if (t === "門市資訊" || t === "門市" || t === "地址" || t === "電話") {
    return [storeCard()];
  }

  // 購買方式（先簡化：引導客人留下資料）
  if (t.startsWith("購買")) {
    const mode = t.replace("購買", "").trim();
    let msg = "好的🙂\n請直接貼：\n1) 想買的品項＋數量\n2) 收件姓名＋電話\n3) 地址/門市\n\n我收到就幫你確認金額與出貨方式。";
    if (mode.includes("雙北")) msg = `好的🙂\n【雙北親送】\n${STORE.deliverNote}\n\n請直接貼：\n1) 品項＋數量\n2) 收件姓名＋電話\n3) 地址\n\n我收到就幫你確認金額與出貨安排。`;
    if (mode.includes("自取")) msg = "好的🙂\n【到店自取】\n請直接貼：\n1) 品項＋數量\n2) 聯絡姓名＋電話\n\n我收到就幫你保留並確認可取貨時間。";
    if (mode.includes("店到店")) msg = "好的🙂\n【超商店到店】\n請直接貼：\n1) 品項＋數量\n2) 收件姓名＋電話\n3) 取貨門市（店名/店號/地址）\n\n我收到就幫你確認金額與寄送。";
    return [{ type: "text", text: msg }, mainMenuCard()];
  }

  // 介紹 / 規格 / 價格（針對單品）
  const data = await getProductsData();
  const flat = flattenProducts(data);

  if (t.startsWith("介紹")) {
    const name = t.replace(/^介紹\s*/, "");
    const p = findProductByName(flat, name);
    return [{ type: "text", text: introText(p) }, productActionsCard(p || { name: STORE.brandName })];
  }

  if (t.startsWith("規格")) {
    const name = t.replace(/^規格\s*/, "");
    const p = findProductByName(flat, name);
    return [{ type: "text", text: specText(p) }, (p ? productActionsCard(p) : mainMenuCard())];
  }

  if (t.startsWith("價格")) {
    const name = t.replace(/^價格\s*/, "");
    const p = findProductByName(flat, name);

    if (!p) return [{ type: "text", text: "我找不到這個品項🙂\n你可以點「產品介紹」直接選。"}, mainMenuCard()];

    // 湯塊（膠）：多規格用輪播
    if (Array.isArray(p.variants) && p.variants.length) {
      return [soupPriceCarousel(p), mainMenuCard()];
    }

    return [{ type: "text", text: priceTextSingle(p) }, productActionsCard(p)];
  }

  // 兜底
  return [{ type: "text", text: "我有收到🙂\n你可以直接點「選單」回主選單。" }, mainMenuCard()];
}

/* =========================
 * G) Server / Webhook
 * ========================= */
const app = express();

// Health check（Render）
app.get("/", (req, res) => res.status(200).send("ok"));
app.get("/health", (req, res) => res.status(200).send("ok"));

// Webhook（LINE 必須簽章驗證）
app.post("/webhook", (req, res, next) => {
  if (!config.channelAccessToken || !config.channelSecret) {
    return res.status(500).send("LINE credentials missing");
  }
  return line.middleware(config)(req, res, next);
}, async (req, res) => {
  try {
    const events = req.body.events || [];
    await Promise.all(events.map(async (event) => {
      if (event.type !== "message") return;
      if (!event.message || event.message.type !== "text") return;

      const msgs = await handleText(event.message.text);
      return client.replyMessage(event.replyToken, msgs);
    }));
    res.sendStatus(200);
  } catch (e) {
    console.error("Webhook error:", e?.message || e);
    res.sendStatus(500);
  }
});

app.listen(PORT || 3000, "0.0.0.0", () => {
  console.log(`LINE bot listening on port ${PORT || 3000}`);
  console.log(`PRODUCTS_JSON_URL = ${PRODUCTS_JSON_URL}`);
});
