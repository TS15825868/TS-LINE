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

const CRM_URL = process.env.CRM_URL || "https://script.google.com/macros/s/AKfycbwAFBxeROd2ZYGJ_h0O7_H2MMxptOMoj3EXIErZpbKuTYFOzOVwQkrk8X1MoxapkHVGSA/exec";

const userState = {};
const lastMessage = {};

// 👉 簡易CRM（記憶用戶狀態）
let users = {};

app.post("/webhook", line.middleware(config), async (req, res) => {
  const events = req.body.events;
  await Promise.all(events.map(handleEvent));
  res.sendStatus(200);
});

async function handleEvent(event) {
  if (event.type !== "message") return;

  const userId = event.source.userId;
  const msg = event.message.text;

  if (!users[userId]) users[userId] = { step: 0 };

  // 🔥 下單流程
  if (msg.includes("我要")) {
    users[userId].step = 1;
    users[userId].product = msg;

    return reply(event, `
好的👌

請提供👇
1️⃣ 姓名
2️⃣ 電話
3️⃣ 地址
`);
  }

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

    return reply(event, `
✅ 訂單完成

產品：${users[userId].product}
姓名：${users[userId].name}
電話：${users[userId].phone}
地址：${users[userId].address}

👉 我們會盡快出貨
`);
  }

  // 🔥 產品回覆
  if (msg.includes("龜鹿膏")) {
    return reply(event, "龜鹿膏適合日常穩定補養 👉 回「我要龜鹿膏」直接下單");
  }

  if (msg.includes("龜鹿飲")) {
    return reply(event, "龜鹿飲適合忙碌補養 👉 回「我要龜鹿飲」");
  }

  if (msg.includes("湯塊")) {
    return reply(event, "湯塊適合料理 👉 回「我要湯塊」");
  }

  if (msg.includes("鹿茸")) {
    return reply(event, "鹿茸粉適合進階 👉 回「我要鹿茸粉」");
  }

  // 🔥 預設
  return reply(event, `
歡迎使用仙加味 👋

你可以直接說👇
✔ 龜鹿膏 / 龜鹿飲 / 湯塊 / 鹿茸粉
✔ 我要購買
✔ 幫我推薦
`);
}

function reply(event, text) {
  return client.replyMessage(event.replyToken, {
    type: "text",
    text
  });
}

app.listen(3000);
