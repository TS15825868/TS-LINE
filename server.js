"use strict";

/*
  仙加味・龜鹿 LINE OA Bot
  ✅ 抗 timeout 強化版
  ✅ Webhook 立即回 200
  ✅ products.json 快取保護
  ✅ follow 重新加好友會送歡迎
  ✅ 不自動洗主選單
*/

const express = require("express");
const line = require("@line/bot-sdk");
const https = require("https");

const {
  LINE_CHANNEL_ACCESS_TOKEN,
  LINE_CHANNEL_SECRET,
  PRODUCTS_URL,
  PORT
} = process.env;

const config = {
  channelAccessToken: LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: LINE_CHANNEL_SECRET
};

const client = new line.Client(config);
const app = express();

/* =========================
   基本資訊
========================= */

const STORE = {
  brandName: "仙加味・龜鹿",
  website: "https://ts15825868.github.io/TaiShing/",
  phone: "0223812990",
  map: "https://www.google.com/maps/search/?api=1&query=台北市萬華區西昌街52號"
};

/* =========================
   products 快取
========================= */

let cache = {
  data: null,
  time: 0
};

const TTL = 5 * 60 * 1000; // 5分鐘

function fetchJSON(url, timeout = 6000) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, res => {
      let raw = "";
      res.on("data", chunk => raw += chunk);
      res.on("end", () => {
        try {
          resolve(JSON.parse(raw));
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on("error", reject);
    req.setTimeout(timeout, () => {
      req.destroy(new Error("fetch timeout"));
    });
  });
}

async function getProducts() {
  if (cache.data && Date.now() - cache.time < TTL) {
    return cache.data;
  }

  try {
    const data = await fetchJSON(PRODUCTS_URL);
    cache = {
      data,
      time: Date.now()
    };
    return data;
  } catch (e) {
    console.log("products fetch failed, using cache");
    return cache.data || { categories: [] };
  }
}

/* =========================
   主選單
========================= */

function mainMenu() {
  return [
    {
      type: "template",
      altText: "主選單",
      template: {
        type: "buttons",
        title: STORE.brandName,
        text: "想先看哪個？🙂",
        actions: [
          { type: "message", label: "產品介紹", text: "產品介紹" },
          { type: "message", label: "看價格", text: "看價格" },
          { type: "message", label: "飲食專區", text: "飲食專區" },
          { type: "message", label: "怎麼購買", text: "怎麼購買" }
        ]
      }
    }
  ];
}

/* =========================
   飲食專區
========================= */

function foodMenu() {
  return [{
    type: "template",
    altText: "飲食專區",
    template: {
      type: "buttons",
      title: "飲食專區",
      text: "搭配建議都在這裡🙂",
      actions: [
        { type: "message", label: "補養建議", text: "補養建議" },
        { type: "message", label: "季節推薦", text: "季節推薦" },
        { type: "message", label: "燉煮建議", text: "燉煮建議" },
        { type: "message", label: "回主選單", text: "選單" }
      ]
    }
  }];
}

/* =========================
   文字處理
========================= */

async function handleText(text) {

  if (!text || text === "選單") {
    return mainMenu();
  }

  if (text === "產品介紹") {
    const data = await getProducts();
    const flat = [];

    for (const c of data.categories || []) {
      for (const item of c.items || []) {
        flat.push(item);
      }
    }

    return [{
      type: "text",
      text: flat.map(p => `• ${p.name}`).join("\n")
    }];
  }

  if (text === "看價格") {
    return [{
      type: "text",
      text: "價格資訊請選擇產品查看🙂"
    }];
  }

  if (text === "飲食專區") {
    return foodMenu();
  }

  if (text === "補養建議") {
    return [{
      type: "text",
      text: "日常補養建議：\n龜鹿膏 / 龜鹿飲皆可依作息安排🙂"
    }];
  }

  if (text === "季節推薦") {
    return [{
      type: "text",
      text: "冬季建議溫補、燉湯搭配🙂"
    }];
  }

  if (text === "燉煮建議") {
    return [{
      type: "text",
      text: "湯塊建議小火化開後再燉煮🙂"
    }];
  }

  return [{
    type: "text",
    text: "我有收到🙂 回「選單」開始。"
  }];
}

/* =========================
   Webhook
========================= */

app.get("/", (req, res) => res.send("ok"));
app.get("/health", (req, res) => res.send("ok"));

app.post("/webhook",
  line.middleware(config),
  (req, res) => {

    // ⭐ 立即回應 200（抗 timeout 核心）
    res.sendStatus(200);

    const events = req.body.events || [];

    Promise.all(events.map(async event => {

      try {

        if (event.type === "follow") {
          return client.replyMessage(event.replyToken, mainMenu());
        }

        if (event.type !== "message" || event.message.type !== "text") {
          return;
        }

        const reply = await handleText(event.message.text);
        return client.replyMessage(event.replyToken, reply);

      } catch (e) {
        console.log("event error:", e);
      }

    }));

  }
);

app.listen(PORT || 3000, () => {
  console.log("LINE Bot Running");
});
