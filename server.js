
"use strict";

const express = require("express");
const line = require("@line/bot-sdk");
const axios = require("axios");

const config = {
  channelAccessToken: process.env.CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.CHANNEL_SECRET,
};

const GOOGLE_SCRIPT_WEBHOOK = process.env.GOOGLE_SCRIPT_WEBHOOK || ""; // e.g. https://script.google.com/macros/s/XXXXX/exec

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

  // ===== CRM: basic intent classification =====
  let intent = "unknown";
  if (/日常補養/.test(msg)) intent = "daily";
  if (/外出補充/.test(msg)) intent = "outdoor";
  if (/燉湯料理/.test(msg)) intent = "cooking";
  if (/價格|多少/.test(msg)) intent = "price";
  if (/好|可以|下單/.test(msg)) intent = "ready";

  // ===== CRM: send to Google Sheet (non-blocking) =====
  if (GOOGLE_SCRIPT_WEBHOOK) {
    axios.post(GOOGLE_SCRIPT_WEBHOOK, {
      userId,
      message: msg,
      intent,
      time: new Date().toISOString()
    }).catch(()=>{});
  }

  // ===== Responses =====
  if (intent === "daily") {
    return reply(event, `
一般會這樣搭 👍  
✔ 龜鹿膏（主體）  
✔ 搭配龜鹿飲（外出）  

🎁 現在會附 30cc × 3  

👉 要我幫你直接配一組嗎？
👉 或直接下單（不用等）
${orderLink}
`);
  }

  if (intent === "outdoor") {
    return reply(event, `
外出方便會搭 👍  
✔ 龜鹿飲  

👉 我幫你搭一組方便攜帶的
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

  if (intent === "price") {
    return reply(event, `
現在有活動 👍  
🎁 可以幫你升級到 30cc × 5  

👉 要我幫你保留嗎？  
👉 或直接填單：
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

  return reply(event, `
你好 👋  

想了解哪一種呢？  

① 日常補養  
② 外出補充  
③ 燉湯料理  
④ 怎麼選  

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
console.log("LINE CRM bot running...");
