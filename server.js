"use strict";

const express = require("express");
const line = require("@line/bot-sdk");

const app = express();

// ✅ 直接用環境變數（唯一正解）
const config = {
  channelAccessToken: process.env.CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.CHANNEL_SECRET,
};

// 🔥 檢查環境變數（避免炸掉）
if (!config.channelAccessToken || !config.channelSecret) {
  console.error("❌ 缺少 LINE ENV 變數");
  process.exit(1);
}

const client = new line.Client(config);

// 👉 測試首頁
app.get("/", (req, res) => {
  res.send("TS LINE OA is running.");
});

// 👉 webhook
app.post("/webhook", line.middleware(config), async (req, res) => {
  console.log("🔥 webhook進來了");

  try {
    const results = await Promise.all(req.body.events.map(handleEvent));
    res.json(results);
  } catch (err) {
    console.error("❌ webhook錯誤", err);
    res.status(500).end();
  }
});

async function handleEvent(event) {
  if (event.type !== "message" || event.message.type !== "text") {
    return null;
  }

  const msg = event.message.text;

  console.log("👉 收到:", msg);

  return client.replyMessage(event.replyToken, {
    type: "text",
    text: `你說的是：${msg}`,
  });
}

// 👉 Render PORT
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on ${PORT}`);
});
