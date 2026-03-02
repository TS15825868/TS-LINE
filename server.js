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
  PRODUCTS_URL,
  PORT
} = process.env;

const config = {
  channelAccessToken: LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: LINE_CHANNEL_SECRET
};

const client = new line.Client(config);

const STORE = {
  brandName: "仙加味・龜鹿",
  address: "台北市萬華區西昌街 52 號",
  phone: "(02) 2381-2990",
  website: "https://ts15825868.github.io/TaiShing/"
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
  const data = await fetchJson(PRODUCTS_URL);
  cache = { at: Date.now(), data };
  return data;
}

function flattenProducts(data) {
  const list = [];
  for (const c of data.categories || []) {
    for (const i of c.items || []) list.push(i);
  }
  return list;
}

function money(n) {
  return "$" + Number(n).toLocaleString();
}

function discount(msrp, d) {
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
        { type: "message", label: "飲食專區", text: "飲食專區" },
        { type: "message", label: "怎麼購買", text: "怎麼購買" }
      ]
    }
  };
}

/* =========================
   產品列表
========================= */

async function productCarousel() {
  const data = await getProducts();
  const flat = flattenProducts(data);

  return {
    type: "template",
    altText: "產品介紹",
    template: {
      type: "carousel",
      columns: flat.map(p => ({
        title: p.name,
        text: (p.intro || ["點擊查看介紹"])[0],
        actions: [
          { type: "message", label: "看介紹", text: `介紹 ${p.name}` },
          { type: "message", label: "看價格", text: `價格 ${p.name}` },
          { type: "message", label: "我要購買", text: `購買 ${p.name}` }
        ]
      }))
    }
  };
}

/* =========================
   價格顯示
========================= */

async function priceCarousel() {
  const data = await getProducts();
  const flat = flattenProducts(data);
  const cols = [];

  for (const p of flat) {
    if (p.variants) {
      for (const v of p.variants) {
        const act = discount(v.msrp, v.discount);
        cols.push({
          title: `${p.name}（${v.label}）`,
          text:
            `建議售價：${money(v.msrp)}\n` +
            (act ? `活動價：${money(act)}` : ""),
          actions: [
            { type: "message", label: "我要購買", text: `購買 ${p.name}` }
          ]
        });
      }
    } else {
      const act = discount(p.msrp, p.discount);
      cols.push({
        title: p.name,
        text:
          `建議售價：${money(p.msrp)}\n` +
          (act ? `活動價：${money(act)}` : ""),
        actions: [
          { type: "message", label: "我要購買", text: `購買 ${p.name}` }
        ]
      });
    }
  }

  return {
    type: "template",
    altText: "產品價格",
    template: { type: "carousel", columns: cols }
  };
}

/* =========================
   飲食專區
========================= */

function foodMenu() {
  return {
    type: "template",
    altText: "飲食專區",
    template: {
      type: "buttons",
      title: "飲食專區",
      text: "更多搭配與建議🙂",
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
   補養建議
========================= */

function supplementAdvice() {
  return {
    type: "template",
    altText: "補養建議",
    template: {
      type: "carousel",
      columns: [
        { title: "日常版", text: "適合日常飲食搭配節奏", actions: [] },
        { title: "加強版", text: "想加強飲食補充者", actions: [] },
        { title: "忙碌族", text: "外出攜帶方便", actions: [] },
        { title: "長輩版", text: "溫和飲食搭配", actions: [] }
      ]
    }
  };
}

/* =========================
   季節推薦
========================= */

function seasonAdvice() {
  return {
    type: "template",
    altText: "季節推薦",
    template: {
      type: "carousel",
      columns: [
        { title: "春季", text: "溫和飲食節奏", actions: [] },
        { title: "夏季", text: "清爽搭配", actions: [] },
        { title: "秋季", text: "飲食調整期", actions: [] },
        { title: "冬季", text: "溫暖飲食", actions: [] }
      ]
    }
  };
}

/* =========================
   燉煮建議
========================= */

function cookAdvice() {
  return {
    type: "text",
    text:
`【燉煮建議】

1️⃣ 經典雞湯
2️⃣ 排骨燉煮
3️⃣ 山藥搭配
4️⃣ 菇類素食版
5️⃣ 海鮮清爽版
6️⃣ 電鍋懶人版

※ 建議依個人口味調整濃淡。`
  };
}

/* =========================
   FAQ
========================= */

function faq() {
  return {
    type: "text",
    text:
`【常見問題】

Q：可以天天食用嗎？
A：可作為日常飲食搭配。

Q：保存方式？
A：請依包裝標示。

※ 本產品為食品。`
  };
}

/* =========================
   購買說明
========================= */

function buyInfo(name) {
  return {
    type: "text",
    text:
`好的🙂
【${name}】

請提供：
1️⃣ 規格＋數量
2️⃣ 收件姓名＋電話
3️⃣ 地址

我會為您確認出貨安排。`
  };
}

/* =========================
   對話控制
========================= */

async function handleText(text) {

  if (text === "選單") return [mainMenu()];
  if (text === "產品介紹") return [await productCarousel()];
  if (text === "看價格") return [await priceCarousel()];
  if (text === "飲食專區") return [foodMenu()];
  if (text === "補養建議") return [supplementAdvice()];
  if (text === "季節推薦") return [seasonAdvice()];
  if (text === "燉煮建議") return [cookAdvice()];
  if (text === "FAQ") return [faq()];
  if (text === "怎麼購買") return [{
    type:"text",
    text:"請選擇產品後點擊「我要購買」🙂"
  }];

  if (text.startsWith("介紹 ")) {
    const name = text.replace("介紹 ","");
    const data = await getProducts();
    const flat = flattenProducts(data);
    const p = flat.find(x=>x.name===name);
    return [{
      type:"text",
      text:`【${p.name}】\n`+(p.intro||[]).join("\n")
    }];
  }

  if (text.startsWith("購買 ")) {
    const name = text.replace("購買 ","");
    return [buyInfo(name)];
  }

  return [mainMenu()];
}

/* =========================
   Webhook
========================= */

const app = express();

app.post("/webhook",
  line.middleware(config),
  async (req,res)=>{
    const events = req.body.events;

    await Promise.all(events.map(async e=>{
      if(e.type!=="message"||e.message.type!=="text") return;
      const msgs = await handleText(e.message.text);
      return client.replyMessage(e.replyToken,msgs);
    }));

    res.sendStatus(200);
  }
);

app.listen(PORT||3000,()=>console.log("LINE Bot Running"));
