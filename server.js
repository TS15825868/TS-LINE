"use strict";

const line = require("@line/bot-sdk");
const express = require("express");
const fetch = require("node-fetch");

const config = {
  channelAccessToken: process.env.CHANNEL_ACCESS_TOKEN || "IKjy0y2zfPOhMCp7xiJ4R4z7UkkvzoQgj7A6OH1AJjdMYpDnEzaicgz2HWy4pVz1KMSsUHzhoHoXZVztRQwibp3Q8UPfN+Dp4pBfT2k3Mzu5bBtdO1P78Cpffq+75liFPLL3ftcHMzvzr+WOgm6AEgdB04t89/1O/w1cDnyilFU=",
  channelSecret: process.env.CHANNEL_SECRET || "7c3c4740afa5a281d54afb9f8ffc1e96"
};

const app = express();
const client = new line.Client(config);

// 🔥 Google Sheet CRM
const CRM_URL = process.env.CRM_URL || "https://script.google.com/macros/s/AKfycbwAFBxeROd2ZYGJ_h0O7_H2MMxptOMoj3EXIErZpbKuTYFOzOVwQkrk8X1MoxapkHVGSA/exec";

// 🔥 使用者狀態
const users = {};

app.post("/webhook", line.middleware(config), async (req, res) => {
  await Promise.all(req.body.events.map(handleEvent));
  res.sendStatus(200);
});

async function handleEvent(event) {
  if (event.type !== "message" || event.message.type !== "text") return;

  const userId = event.source.userId;
  const msg = event.message.text.trim();

  if (!users[userId]) {
    users[userId] = {
      step: 0,
      history: [],
      level: "new"
    };
  }

  users[userId].history.push(msg);

  // 🔥 === 一鍵成交 ===
  if (msg.includes("我要")) {
    users[userId].step = 1;
    users[userId].product = msg;

    return reply(event, `
好的👌 我幫你安排

請提供👇
1️⃣ 姓名
2️⃣ 電話
3️⃣ 地址
`);
  }

  // 🔥 === 下單流程 ===
  if (users[userId].step === 1) {
    users[userId].name = msg;
    users[userId].step = 2;
    return reply(event, "請輸入電話");
  }

  if (users[userId].step === 2) {
    users[userId].phone = msg;
    users[userId].step = 3;
    return reply(event, "請輸入地址");
  }

  if (users[userId].step === 3) {
    users[userId].address = msg;
    users[userId].step = 0;

    // 🔥 CRM寫入
    await saveToCRM(users[userId]);

    return reply(event, `
✅ 訂單完成

產品：${users[userId].product}
姓名：${users[userId].name}

👉 已幫你登記，我們會盡快出貨
`);
  }

  // 🔥 === 智能推薦 ===
  if (msg.includes("推薦") || msg.includes("怎麼選")) {
    return reply(event, `
我幫你快速配👇

✔ 忙碌 → 龜鹿飲  
✔ 想穩定 → 龜鹿膏  
✔ 料理 → 湯塊  
✔ 進階 → 鹿茸粉  

👉 直接說「我要＋產品」
`);
  }

  // 🔥 === 套餐推 ===
  if (msg.includes("忙") || msg.includes("累")) {
    return reply(event, `
👉 建議：龜鹿飲（方便補養）

直接回👇
👉 我要龜鹿飲
`);
  }

  // 🔥 === 客戶分級 ===
  if (users[userId].history.length > 5) {
    users[userId].level = "warm";
  }

  if (users[userId].history.length > 10) {
    users[userId].level = "hot";
  }

  // 🔥 === 產品導購 ===
  if (msg.includes("龜鹿膏")) {
    return reply(event, `
龜鹿膏｜日常穩定補養

👉 回「我要龜鹿膏」直接下單
`);
  }

  if (msg.includes("龜鹿飲")) {
    return reply(event, `
龜鹿飲｜快速補充

👉 回「我要龜鹿飲」
`);
  }

  if (msg.includes("湯塊")) {
    return reply(event, `
龜鹿湯塊｜料理補養

👉 回「我要湯塊」
`);
  }

  if (msg.includes("鹿茸")) {
    return reply(event, `
鹿茸粉｜進階調養

👉 回「我要鹿茸粉」
`);
  }

  // 🔥 預設入口（成交導向）
  return reply(event, `
歡迎使用仙加味 👋

你可以直接👇

✔ 我要龜鹿膏  
✔ 我要龜鹿飲  
✔ 我要湯塊  
✔ 我要鹿茸粉  
✔ 幫我推薦  

👉 我會直接幫你處理
`);
}

// 🔥 CRM寫入
async function saveToCRM(data) {
  try {
    await fetch(CRM_URL, {
      method: "POST",
      body: JSON.stringify(data)
    });
  } catch (e) {
    console.log("CRM error");
  }
}

// 回覆
function reply(event, text) {
  return client.replyMessage(event.replyToken, {
    type: "text",
    text
  });
}

app.listen(3000);
