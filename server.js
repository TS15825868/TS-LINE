"use strict";

const express = require("express");
const line = require("@line/bot-sdk");
const axios = require("axios");

const config = {
  channelAccessToken: process.env.CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.CHANNEL_SECRET,
};

const GOOGLE_SCRIPT_WEBHOOK = process.env.GOOGLE_SCRIPT_WEBHOOK || "";

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
  // 🔥 CRM分類（升級版）
  // =========================

  let intent = "general";

  if (/日常補養|調理|保養/.test(msg)) intent = "high_value";
  else if (/外出|方便|攜帶/.test(msg)) intent = "outdoor";
  else if (/燉湯|料理|雞湯|排骨/.test(msg)) intent = "cooking";
  else if (/價格|多少|費用|錢/.test(msg)) intent = "hesitate";
  else if (/好|可以|下單|要買/.test(msg)) intent = "ready";

  // =========================
  // 🔥 CRM紀錄（送Google）
  // =========================

  if (GOOGLE_SCRIPT_WEBHOOK) {
    axios.post(GOOGLE_SCRIPT_WEBHOOK, {
      userId,
      message: msg,
      intent,
      time: new Date().toISOString()
    }).catch(()=>{});
  }

  // =========================
  // 💰 成交邏輯（重點）
  // =========================

  if (intent === "high_value") {
    return reply(event, `
一般會這樣搭 👍  

✔ 龜鹿膏（主體）  
✔ 搭配龜鹿飲（外出）  

🎁 現在會附 30cc × 3  

👉 我幫你配好一組可以直接用  
👉 或直接下單（最快）  
${orderLink}
`);
  }

  if (intent === "outdoor") {
    return reply(event, `
外出方便會搭 👍  

✔ 龜鹿飲  

👉 我幫你配一組好攜帶的  
👉 或直接下單：  
${orderLink}
`);
  }

  if (intent === "cooking") {
    return reply(event, `
燉湯會用 👍  

✔ 龜鹿湯塊  

👉 要雞湯還是排骨我幫你配  
👉 或直接下單：  
${orderLink}
`);
  }

  if (intent === "hesitate") {
    return reply(event, `
現在有活動 👍  

🎁 可以幫你升級到 30cc × 5  

👉 我可以幫你保留一組  
👉 或直接填單最快：  
${orderLink}
`);
  }

  if (intent === "ready") {
    return reply(event, `
我幫你整理好了 👍  

👉 直接填這個就可以安排出貨  
${orderLink}
`);
  }

  // =========================
  // 🔥 SEO導流（加強）
  // =========================

  if (/怎麼選/.test(msg)) {
    return reply(event, `
👉 看這個最快  
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
  // 🧠 預設成交引導
  // =========================

  return reply(event, `
你好 👋  

我幫你整理三種最快 👇  

① 日常補養  
② 外出補充  
③ 燉湯料理  

👉 或直接下單（不用等）  
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
console.log("🔥 LINE CRM 爆單版已啟動");
