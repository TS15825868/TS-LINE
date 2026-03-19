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

  // ===== 開場（最重要🔥）
  if (msg === "我要搭配") {
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

  if (msg === "1" || msg.includes("日常")) {
    return reply(
      event,
      `
了解 👍

那我會建議你用比較穩的方式👇

👉 龜鹿膏（平常用）
👉 搭配龜鹿飲（外出補）

這樣比較順 👍

你是👇
① 先試看看
② 想穩定吃一段
`
    );
  }

  if (msg === "2" || msg.includes("累")) {
    return reply(
      event,
      `
這種通常會建議補一下 👍

👉 可以用膏 + 飲搭著

平常補
忙的時候也能補

你是👇
① 想先試
② 想直接調整一段
`
    );
  }

  // ===== 產品入口 =====

  if (msg.includes("龜鹿膏")) {
    return reply(
      event,
      `
這個是最常用的 👍

但通常不會單用

👉 會搭龜鹿飲
比較順 👍

你是👇
① 先試看看
② 想穩定吃
`
    );
  }

  if (msg.includes("龜鹿飲")) {
    return reply(
      event,
      `
這個方便 👍

外出或忙的時候很好用

👉 很多人會搭膏一起
效果比較穩 👍
`
    );
  }

  if (msg.includes("湯")) {
    return reply(
      event,
      `
這個是料理用 👍

👉 雞湯 / 排骨都可以

平常吃 + 補養一起做 👍
`
    );
  }

  // ===== 成交引導🔥

  if (msg.includes("試") || msg.includes("1")) {
    return reply(
      event,
      `
那我會建議你先用👇

👉 入門方式（比較好開始）

大概 2000 多 👍

要我幫你配一組嗎？
`
    );
  }

  if (msg.includes("穩定") || msg.includes("2")) {
    return reply(
      event,
      `
那你可以直接這樣👇

👉 日常補養方式

大概 4000～5000 👍

這樣會比較穩

我幫你配好可以直接出 👍
${orderLink}
`
    );
  }

  // ===== 價格抗拒處理🔥

  if (msg.includes("貴")) {
    return reply(
      event,
      `
我懂 👍

很多人一開始也會這樣覺得

所以通常會先用比較好入門的方式
不用一次很多 👍

我可以幫你抓一個比較剛好的
`
    );
  }

  // ===== 準備下單🔥

  if (msg.includes("好") || msg.includes("可以")) {
    return reply(
      event,
      `
我幫你整理好了 👍

👉 直接這邊填就可以安排出貨
${orderLink}
`
    );
  }

  // ===== 預設（真人版🔥）

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

function reply(event, text) {
  return client.replyMessage(event.replyToken, {
    type: "text",
    text: text.trim(),
  });
}

app.listen(3000, () => console.log("LINE Bot running"));
