"use strict";

const express = require("express");
const line = require("@line/bot-sdk");
const https = require("https");
const http = require("http");

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
const app = express();

/* =========================
   基本資訊
========================= */

const STORE = {
  brandName: "仙加味・龜鹿",
  address: "台北市萬華區西昌街 52 號",
  phone: "(02) 2381-2990"
};

/* =========================
   讀 products.json
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

  const url =
    PRODUCTS_URL ||
    "https://ts15825868.github.io/TaiShing/products.json";

  try {
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

function mainMenu() {
  return {
    type: "template",
    altText: "主選單",
    template: {
      type: "buttons",
      title: STORE.brandName,
      text: "想先看哪個？🙂",
      actions: [
        { type: "message", label: "產品介紹", text: "產品介紹" },
        { type: "message", label: "看價格", text: "看價格" },
        { type: "message", label: "補養建議", text: "補養建議" },
        { type: "message", label: "怎麼購買", text: "怎麼購買" }
      ]
    }
  };
}

/* =========================
   補養建議卡片
========================= */

function nourishCard() {
  return {
    type: "template",
    altText: "補養建議",
    template: {
      type: "carousel",
      columns: [
        {
          title: "日常補養",
          text: "想穩定調整體質、建立節奏",
          actions: [
            { type: "message", label: "查看建議", text: "建議 日常" }
          ]
        },
        {
          title: "加強調整",
          text: "近期較疲勞、想加強",
          actions: [
            { type: "message", label: "查看建議", text: "建議 加強" }
          ]
        },
        {
          title: "忙碌族",
          text: "外出工作、方便為主",
          actions: [
            { type: "message", label: "查看建議", text: "建議 忙碌" }
          ]
        },
        {
          title: "長輩版",
          text: "溫和調整為主",
          actions: [
            { type: "message", label: "查看建議", text: "建議 長輩" }
          ]
        }
      ]
    }
  };
}

function nourishText(type) {
  const map = {
    日常:
      "【日常補養建議】\n龜鹿膏＋龜鹿飲\n建立穩定補養節奏。",
    加強:
      "【加強建議】\n龜鹿膏＋鹿茸粉\n較密集補養。",
    忙碌:
      "【忙碌族】\n龜鹿飲為主\n方便攜帶。",
    長輩:
      "【長輩版】\n龜鹿湯塊燉煮\n溫和吸收。"
  };
  return map[type] || "請選擇類型🙂";
}

/* =========================
   產品介紹（含規格）
========================= */

async function showIntro(name) {
  const data = await getProducts();
  const flat = flattenProducts(data);
  const p = flat.find(x => name.includes(x.name));
  if (!p) return [{ type: "text", text: "找不到產品🙂" }];

  let text =
    `【${p.name}】\n` +
    (p.intro || []).join("\n") +
    "\n\n成分：\n" +
    (p.ingredients || []).join("、") +
    "\n\n使用方式：\n" +
    (p.usage || []).join("\n") +
    "\n\n規格：" +
    (p.spec || "多規格");

  return [
    { type: "text", text: text },
    productAction(p.name)
  ];
}

/* =========================
   價格
========================= */

async function showPrice(name) {
  const data = await getProducts();
  const flat = flattenProducts(data);
  const p = flat.find(x => name.includes(x.name));
  if (!p) return [{ type: "text", text: "找不到產品🙂" }];

  if (p.variants) {
    return [{
      type: "template",
      altText: "價格",
      template: {
        type: "carousel",
        columns: p.variants.map(v => ({
          title: p.name,
          text:
            `${v.label}\n建議售價：${money(v.msrp)}`,
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
        `【${p.name}｜價格】\n建議售價：${money(p.msrp)}\n` +
        (act ? `活動價：${money(act)}\n` : "") +
        "\n※ 價格以現場為準🙂"
    },
    productAction(p.name)
  ];
}

function productAction(name) {
  return {
    type: "template",
    altText: "產品操作",
    template: {
      type: "buttons",
      title: name,
      text: "接下來想做什麼？🙂",
      actions: [
        { type: "message", label: "看價格", text: `價格 ${name}` },
        { type: "message", label: "我要購買", text: `購買 ${name}` },
        { type: "message", label: "回主選單", text: "選單" }
      ]
    }
  };
}

/* =========================
   對話
========================= */

async function handleText(text) {
  const t = text.trim();

  if (!t || t === "選單") return [mainMenu()];

  if (t === "產品介紹") {
    const data = await getProducts();
    const flat = flattenProducts(data);

    return [{
      type: "template",
      altText: "產品列表",
      template: {
        type: "carousel",
        columns: flat.map(p => ({
          title: p.name,
          text: "點擊查看介紹",
          actions: [
            { type: "message", label: "看介紹", text: `介紹 ${p.name}` }
          ]
        }))
      }
    }];
  }

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
          text: "查看價格",
          actions: [
            { type: "message", label: "看價格", text: `價格 ${p.name}` }
          ]
        }))
      }
    }];
  }

  if (t === "補養建議") return [nourishCard()];

  if (t.startsWith("建議 ")) {
    const type = t.replace("建議 ", "");
    return [
      { type: "text", text: nourishText(type) },
      mainMenu()
    ];
  }

  if (t === "怎麼購買") {
    return [{
      type: "text",
      text:
        "請直接貼：\n1) 品項 + 數量\n2) 收件姓名 + 電話\n3) 地址\n\n我收到後幫您確認🙂"
    }];
  }

  if (t.startsWith("介紹 ")) return await showIntro(t.replace("介紹 ", ""));

  if (t.startsWith("價格 ")) return await showPrice(t.replace("價格 ", ""));

  if (t.startsWith("購買 ")) {
    return [{
      type: "text",
      text:
        "請貼：\n1) 規格 + 數量\n2) 收件姓名 + 電話\n3) 地址\n\n我幫您確認🙂"
    }];
  }

  return [
    { type: "text", text: "請點選單操作🙂" },
    mainMenu()
  ];
}

/* =========================
   Webhook
========================= */

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
