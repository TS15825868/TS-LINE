"use strict";

const express = require("express");
const line = require("@line/bot-sdk");

const app = express();

const config = {
  channelAccessToken: process.env.CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.CHANNEL_SECRET,
};

const client = new line.Client(config);

app.post("/webhook", line.middleware(config), async (req, res) => {
  Promise.all(req.body.events.map(handleEvent));
  res.sendStatus(200);
});

async function handleEvent(event) {
  if (event.type !== "message" || event.message.type !== "text") return null;

  const msg = event.message.text.trim();

  const orderLink =
    "https://ts15825868.github.io/xianjiawei/order.html";

  // ===== 精準判斷 =====
  const isStart = msg === "我要搭配";
  const isDaily = msg === "1" || msg === "①";
  const isTired = msg === "2" || msg === "②";

  const isTry = msg === "1試" || msg === "試" || msg === "①試";
  const isLong = msg === "2穩" || msg === "穩定" || msg === "②";

  // ===== 開場 =====
  if (isStart) {
    return reply(
      event,
      `
我幫你看一下 👀

你大概是👇
① 平常保養
② 最近比較累

打個數字就好 👍
`
    );
  }

  // ===== 分流 =====
  if (isDaily) {
    return reply(
      event,
      `
了解 👍

日常會建議這樣👇

👉 龜鹿膏（主體）
👉 龜鹿飲（外出）

比較穩 👍

你是👇
① 先試看看
② 想穩定吃
`
    );
  }

  if (isTired) {
    return reply(
      event,
      `
這種通常會建議補一下 👍

👉 膏 + 飲一起

會比較順 👍

你是👇
① 想先試
② 想調整一段
`
    );
  }

  // ===== 決策 =====
  if (msg === "1" || msg === "①") {
    return reply(
      event,
      `
可以先用入門方式 👍

👉 大概 2000多

比較好開始

要我幫你配一組嗎？
`
    );
  }

  if (msg === "2" || msg === "②") {
    return reply(
      event,
      `
那你可以直接這樣👇

👉 日常補養方式

大概 4000～5000 👍

我幫你配好會比較快 👍
${orderLink}
`
    );
  }

  // ===== 產品 =====
  if (msg.includes("龜鹿膏")) {
    return reply(
      event,
      `
這個是主體 👍

👉 通常會搭飲

會比較穩 👍
`
    );
  }

  // ===== 價格抗拒 =====
  if (msg.includes("貴")) {
    return reply(
      event,
      `
我懂 👍

可以先用比較好入門的方式
不用一次很多 👍
`
    );
  }

  // ===== 下單 =====
  if (msg.includes("好") || msg.includes("可以")) {
    return reply(
      event,
      `
我幫你整理好了 👍

👉 直接填這邊就可以
${orderLink}
`
    );
  }

  // ===== 預設 =====
  return reply(
    event,
    `
我幫你看一下 👀

你大概是👇
① 平常保養
② 最近比較累
`
  );
}

function reply(event, text) {
  return client.replyMessage(event.replyToken, {
    type: "text",
    text: text.trim(),
  });
}

app.listen(3000, () => console.log("LINE Bot running"));
