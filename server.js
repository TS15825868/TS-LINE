"use strict";

const express = require("express");
const line = require("@line/bot-sdk");
const axios = require("axios");

const config = {
  channelAccessToken: process.env.CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.CHANNEL_SECRET,
};

// ✅ 最新 webhook
const GOOGLE_SCRIPT_WEBHOOK = "https://script.google.com/macros/s/AKfycbyS5_ptRtXNHavGLdpfi3aYtQ9GijVt3IsZ-_vIFNfQGcOm_PcGhqXiMQC7gTXQFJlRsg/exec";

const app = express();
const client = new line.Client(config);

app.post("/webhook", line.middleware(config), async (req, res) => {
  try {
    const results = await Promise.all(req.body.events.map(handleEvent));
    res.json(results);
  } catch (err) {
    console.error(err);
    res.status(500).end();
  }
});

async function handleEvent(event) {
  if (event.type !== "message" || event.message.type !== "text") {
    return Promise.resolve(null);
  }

  const msg = (event.message.text || "").trim();
  const userId = event.source.userId;

  const orderLink = "https://ts15825868.github.io/xianjiawei/order.html";

  // =========================
  // 🔥 CRM分類（最終版）
  // =========================

  let intent = "一般詢問";

  if (/日常補養|保養|調理/.test(msg)) intent = "高潛力客";
  else if (/外出|方便|攜帶/.test(msg)) intent = "外出需求";
  else if (/燉湯|雞湯|排骨/.test(msg)) intent = "料理需求";
  else if (/價格|多少|費用/.test(msg)) intent = "猶豫客";
  else if (/好|可以|下單|要買/.test(msg)) intent = "準成交";

  // =========================
  // 🔥 CRM送資料（不中斷主流程）
  // =========================

  axios.post(GOOGLE_SCRIPT_WEBHOOK, {
    userId,
    message: msg,
    intent,
    time: new Date().toISOString()
  }).catch(()=>{});

  // =========================
  // 💰 成交邏輯（優化）
  // =========================

  if (intent === "高潛力客") {
    return reply(event, `
一般會這樣搭 👍  

✔ 龜鹿膏（主體）  
✔ 搭配龜鹿飲（外出）  

🎁 現在會附 30cc × 3  

👉 我幫你配好一組  
👉 或直接下單（最快）  
${orderLink}
`);
  }

  if (intent === "外出需求") {
    return reply(event, `
外出方便會搭 👍  

✔ 龜鹿飲  

👉 我幫你配一組方便攜帶的  
👉 或直接下單  
${orderLink}
`);
  }

  if (intent === "料理需求") {
    return reply(event, `
燉湯會用 👍  

✔ 龜鹿湯塊  

👉 要雞湯還是排骨我幫你配  
👉 或直接下單  
${orderLink}
`);
  }

  if (intent === "猶豫客") {
    return reply(event, `
現在有活動 👍  

🎁 可以幫你升級到 30cc × 5  

👉 我幫你保留一組  
👉 或直接填單  
${orderLink}
`);
  }

  if (intent === "準成交") {
    return reply(event, `
我幫你整理好了 👍  

👉 直接填這個就可以安排出貨  
${orderLink}
`);
  }

  // =========================
  // 🔍 SEO導流
  // =========================

  if (/怎麼選/.test(msg)) {
    return reply(event, `
👉 這個看最快  
https://ts15825868.github.io/xianjiawei/choose.html
`);
  }

  if (/龜鹿知識|是什麼/.test(msg)) {
    return reply(event, `
👉 這裡整理好了  
https://ts15825868.github.io/xianjiawei/articles.html
`);
  }

  // =========================
  // 🧠 預設引導
  // =========================

  return reply(event, `
你好 👋  

我幫你整理三種最快 👇  

① 日常補養  
② 外出補充  
③ 燉湯料理  

👉 或直接下單  
${orderLink}
`);
}

function reply(event, text) {
  return client.replyMessage(event.replyToken, {
    type: "text",
    text: text.trim(),
  });
}

app.listen(3000);
console.log("🔥 CRM最終爆單版已啟動");
