"use strict";

const express = require("express");
const line = require("@line/bot-sdk");
const https = require("https");
const http = require("http");

/* =========================
   環境變數
========================= */

const {
  LINE_CHANNEL_ACCESS_TOKEN,
  LINE_CHANNEL_SECRET,
  CHANNEL_ACCESS_TOKEN,
  CHANNEL_SECRET,
  PRODUCTS_URL,
  PORT
} = process.env;

const ACCESS_TOKEN = LINE_CHANNEL_ACCESS_TOKEN || CHANNEL_ACCESS_TOKEN;
const CHANNEL_SEC = LINE_CHANNEL_SECRET || CHANNEL_SECRET;

const config = {
  channelAccessToken: ACCESS_TOKEN,
  channelSecret: CHANNEL_SEC
};

const client = new line.Client(config);

/* =========================
   基本資訊
========================= */

const STORE = {
  brandName: "仙加味・龜鹿",
  address: "台北市萬華區西昌街 52 號",
  phone: "(02) 2381-2990"
};

/* =========================
   抓 products.json
========================= */

let cache = { at: 0, data: null };

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith("https") ? https : http;
    lib.get(url, (res) => {
      let data = "";
      res.on("data", (c) => (data += c));
      res.on("end", () => resolve(JSON.parse(data)));
    }).on("error", reject);
  });
}

async function getProducts() {
  const ttl = 5 * 60 * 1000;
  if (Date.now() - cache.at < ttl && cache.data) return cache.data;

  try {
    const data = await fetchJson(PRODUCTS_URL);
    cache = { at: Date.now(), data };
    return data;
  } catch (e) {
    return { categories: [] };
  }
}

function flattenProducts(data) {
  const list = [];
  for (const c of data.categories || []) {
    for (const item of c.items || []) {
      list.push(item);
    }
  }
  return list;
}

function money(n) {
  return "$" + Number(n).toLocaleString();
}

function calcDiscount(msrp, d) {
  if (!msrp || !d) return null;
  return Math.round(msrp * d);
}

/* =========================
   主選單卡
========================= */

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
        { type: "message", label: "門市資訊", text: "門市資訊" }
      ]
    }
  };
}

/* =========================
   產品卡片
========================= */

async function productsCarousel() {
  const data = await getProducts();
  const flat = flattenProducts(data);

  return {
    type: "template",
    altText: "產品列表",
    template: {
      type: "carousel",
      columns: flat.map(p => ({
        title: p.name,
        text: (p.intro && p.intro[0]) || "點擊查看介紹",
        actions: [
          { type: "message", label: "看介紹", text: `介紹 ${p.name}` },
          { type: "message", label: "看價格", text: `價格 ${p.name}` },
          { type: "message", label: "回主選單", text: "選單" }
        ]
      }))
    }
  };
}

/* =========================
   價格卡片（支援湯塊多規格）
========================= */

async function priceCarousel() {
  const data = await getProducts();
  const flat = flattenProducts(data);

  const columns = [];

  for (const p of flat) {

    // 如果有 variants（例如龜鹿湯塊）
    if (p.variants && p.variants.length > 0) {
      for (const v of p.variants) {
        const act = calcDiscount(v.msrp, v.discount);
        columns.push({
          title: p.name,
          text:
            `${v.label}\n` +
            `建議售價：${money(v.msrp)}\n` +
            (act ? `活動價：${money(act)}` : ""),
          actions: [
            { type: "message", label: "回主選單", text: "選單" }
          ]
        });
      }
    } else {
      const act = calcDiscount(p.msrp, p.discount);
      columns.push({
        title: p.name,
        text:
          `建議售價：${money(p.msrp || 0)}\n` +
          (act ? `活動價：${money(act)}` : ""),
        actions: [
          { type: "message", label: "回主選單", text: "選單" }
        ]
      });
    }
  }

  return {
    type: "template",
    altText: "產品價格",
    template: {
      type: "carousel",
      columns: columns
    }
  };
}

/* =========================
   介紹文字
========================= */

async function introText(name) {
  const data = await getProducts();
  const flat = flattenProducts(data);
  const p = flat.find(x => name.includes(x.name));
  if (!p) return "找不到產品🙂";

  return `【${p.name}】\n` + (p.intro || []).join("\n");
}

/* =========================
   對話邏輯
========================= */

async function handleText(text) {
  const t = text.trim();

  if (!t || t === "選單") return [mainMenuCard()];

  if (t === "產品介紹") return [await productsCarousel()];

  if (t === "看價格") return [await priceCarousel()];

  if (t === "門市資訊") {
    return [{
      type: "template",
      altText: "門市資訊",
      template: {
        type: "buttons",
        title: "門市資訊",
        text: `${STORE.address}\n${STORE.phone}`,
        actions: [
          { type: "message", label: "回主選單", text: "選單" }
        ]
      }
    }];
  }

  if (t.startsWith("介紹 ")) {
    const name = t.replace("介紹 ", "");
    return [
      { type: "text", text: await introText(name) },
      mainMenuCard()
    ];
  }

  return [
    { type: "text", text: "請點選單操作🙂" },
    mainMenuCard()
  ];
}

/* =========================
   Webhook
========================= */

const app = express();

app.post("/webhook",
  line.middleware(config),
  async (req, res) => {
    const events = req.body.events;

    await Promise.all(events.map(async (event) => {
      if (event.type !== "message") return;
      if (event.message.type !== "text") return;

      const msgs = await handleText(event.message.text);
      return client.replyMessage(event.replyToken, msgs);
    }));

    res.sendStatus(200);
  }
);

app.listen(PORT || 3000, () => {
  console.log("LINE bot running");
});
