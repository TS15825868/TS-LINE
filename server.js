// 全自動成交版 LINE Bot
"use strict";

const express = require("express");
const line = require("@line/bot-sdk");

const app = express();

const config = {
  channelAccessToken: process.env.CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.CHANNEL_SECRET
};

const client = new line.Client(config);

app.post("/webhook", line.middleware(config), async (req, res) => {
  const events = req.body.events;
  await Promise.all(events.map(handleEvent));
  res.json({ success: true });
});

async function handleEvent(event) {
  if (event.type !== "message" || event.message.type !== "text") return;

  const text = event.message.text;

  if (text.includes("開始") || text.includes("你好")) {
    return replyButtons(event.replyToken, "你想找哪一種👇", [
      "日常補養",
      "方便直接喝",
      "燉湯料理",
      "幫我推薦"
    ]);
  }

  if (text === "日常補養") {
    return replyButtons(event.replyToken, "推薦龜鹿膏 👍", [
      "先試試",
      "長期吃"
    ]);
  }

  if (text === "方便直接喝") {
    return replyButtons(event.replyToken, "推薦龜鹿飲 👍", [
      "日常喝",
      "快速補充"
    ]);
  }

  if (text === "燉湯料理") {
    return replyButtons(event.replyToken, "推薦龜鹿湯塊 👍", [
      "常煮",
      "偶爾煮"
    ]);
  }

  if (
    text === "先試試" ||
    text === "日常喝" ||
    text === "常煮"
  ) {
    return replyProduct(event.replyToken);
  }

  if (
    text === "長期吃" ||
    text === "快速補充" ||
    text === "偶爾煮" ||
    text === "幫我推薦"
  ) {
    return replyBundle(event.replyToken);
  }
}

function replyButtons(token, text, labels) {
  return client.replyMessage(token, {
    type: "template",
    altText: text,
    template: {
      type: "buttons",
      text,
      actions: labels.map(l => ({
        type: "message",
        label: l,
        text: l
      }))
    }
  });
}

function replyProduct(token) {
  return client.replyMessage(token, {
    type: "text",
    text:
      "👉 新手推薦\n\n龜鹿膏（入門）\n最多人從這開始 👍\n\n要幫你安排嗎？"
  });
}

function replyBundle(token) {
  return client.replyMessage(token, {
    type: "text",
    text:
      "🔥 熱門組合\n\n龜鹿膏 + 龜鹿飲\n\n✔ 最多人選\n✔ 日常＋方便\n\n要幫你安排這組嗎？"
  });
}

app.listen(3000, () => {
  console.log("LINE Bot running");
});
