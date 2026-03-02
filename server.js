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
    const url =
      PRODUCTS_URL ||
      "https://ts15825868.github.io/TaiShing/products.json";

    const data = await fetchJson(url);
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
   主選單
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
        { type: "message", label: "怎麼購買", text: "怎麼購買" },
        { type: "message", label: "門市資訊", text: "門市資訊" }
      ]
    }
  };
}

/* =========================
   產品輪播
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
          { type: "message", label: "看價格", text: `價格 ${p.name}` }
        ]
      }))
    }
  };
}

/* =========================
   單產品操作卡
========================= */

function productActionCard(name) {
  return {
    type: "template",
    altText: "產品操作",
    template: {
      type: "buttons",
      title: name,
      text: "接下來想看什麼？🙂",
      actions: [
        { type: "message", label: "看價格", text: `價格 ${name}` },
        { type: "message", label: "我要購買", text: `購買 ${name}` },
        { type: "message", label: "回主選單", text: "選單" }
      ]
    }
  };
}

/* =========================
   價格顯示
========================= */

async function showPrice(name) {
  const data = await getProducts();
  const flat = flattenProducts(data);
  const p = flat.find(x => name.includes(x.name));
  if (!p) return [{ type: "text", text: "找不到產品🙂" }];

  if (p.variants && p.variants.length > 0) {
    return [{
      type: "template",
      altText: "產品價格",
      template: {
        type: "carousel",
        columns: p.variants.map(v => ({
          title: p.name,
          text:
            `${v.label}\n` +
            `建議售價：${money(v.msrp)}`,
          actions: [
            { type: "message", label: "我要購買", text: `購買 ${p.name}` },
            { type: "message", label: "回主選單", text: "選單" }
          ]
        }))
      }
    }];
  }

  const act = calcDiscount(p.msrp, p.discount);

  return [
    {
      type: "text",
      text:
        `【${p.name}｜價格】\n` +
        `建議售價：${money(p.msrp)}\n` +
        (act ? `活動價：${money(act)}\n` : "") +
        `\n※ 價格以現場為準🙂`
    },
    productActionCard(p.name)
  ];
}

/* =========================
   介紹
========================= */

async function showIntro(name) {
  const data = await getProducts();
  const flat = flattenProducts(data);
  const p = flat.find(x => name.includes(x.name));
  if (!p) return [{ type: "text", text: "找不到產品🙂" }];

  return [
    {
      type: "text",
      text:
        `【${p.name}】\n` +
        (p.intro || []).join("\n")
    },
    productActionCard(p.name)
  ];
}

/* =========================
   購買流程
========================= */

function buyFlow(name) {
  return [
    {
      type: "text",
      text:
        `好的🙂\n【${name}】\n\n` +
        `請直接貼：\n` +
        `1) 規格 + 數量\n` +
        `2) 收件姓名 + 電話\n` +
        `3) 地址\n\n` +
        `我收到後會幫你確認金額與出貨安排。`
    },
    mainMenuCard()
  ];
}

/* =========================
   對話邏輯
========================= */

async function handleText(text) {
  const t = text.trim();

  if (!t || t === "選單") return [mainMenuCard()];

  if (t === "產品介紹") return [await productsCarousel()];

  if (t === "看價格") {
    const data = await getProducts();
    const flat = flattenProducts(data);

    return [{
      type: "template",
      altText: "價格列表",
      template: {
        type: "carousel",
        columns: flat.map(p => ({
          title: p.name,
          text: `查看 ${p.name} 價格`,
          actions: [
            { type: "message", label: "看價格", text: `價格 ${p.name}` }
          ]
        }))
      }
    }];
  }

  if (t === "怎麼購買") {
    return [{
      type: "template",
      altText: "購買方式",
      template: {
        type: "buttons",
        title: "怎麼購買",
        text: "請選一種方式🙂",
        actions: [
          { type: "message", label: "我要購買", text: "購買" },
          { type: "message", label: "回主選單", text: "選單" }
        ]
      }
    }];
  }

  if (t.startsWith("介紹 ")) {
    return await showIntro(t.replace("介紹 ", ""));
  }

  if (t.startsWith("價格 ")) {
    return await showPrice(t.replace("價格 ", ""));
  }

  if (t.startsWith("購買 ")) {
    return buyFlow(t.replace("購買 ", ""));
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
