"use strict";

const express = require("express");
const line = require("@line/bot-sdk");
const axios = require("axios");

const app = express();

// ===== LINE 設定 =====
const config = {
  channelAccessToken: process.env.CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.CHANNEL_SECRET,
};

if (!config.channelAccessToken || !config.channelSecret) {
  console.error("❌ 缺少 LINE ENV 變數");
  process.exit(1);
}

const client = new line.Client(config);

// ===== CRM（可選）=====
const GOOGLE_SCRIPT_WEBHOOK =
  process.env.GOOGLE_SCRIPT_WEBHOOK || "";

// ===== 首頁 =====
app.get("/", (req, res) => {
  res.send("TS LINE OA is running.");
});

// ===== Webhook =====
app.post("/webhook", line.middleware(config), async (req, res) => {
  try {
    const results = await Promise.all(req.body.events.map(handleEvent));
    res.json(results);
  } catch (err) {
    console.error("❌ webhook error", err);
    res.status(500).end();
  }
});

// ===== 主邏輯 =====
async function handleEvent(event) {
  if (event.type !== "message" || event.message.type !== "text") {
    return null;
  }

  const msg = event.message.text.trim();
  const userId = event.source.userId;

  const orderLink =
    "https://ts15825868.github.io/xianjiawei/order.html";

  // ===== 意圖判斷 =====
  let intent = "unknown";

  if (/日常補養/.test(msg)) intent = "daily";
  else if (/外出補充/.test(msg)) intent = "outdoor";
  else if (/燉湯料理/.test(msg)) intent = "cooking";
  else if (/價格|多少/.test(msg)) intent = "price";
  else if (/好|可以|下單/.test(msg)) intent = "ready";

  // ===== CRM紀錄（可關）=====
  if (GOOGLE_SCRIPT_WEBHOOK) {
    axios.post(GOOGLE_SCRIPT_WEBHOOK, {
      userId,
      message: msg,
      intent,
      time: new Date().toISOString(),
    }).catch(() => {});
  }

  // ===== 成交腳本 =====

  // 🟢 日常補養（主力商品）
  if (intent === "daily") {
    return reply(
      event,
      `
一般會這樣搭 👍  

✔ 龜鹿膏（主體日常補養）  
✔ 搭配龜鹿飲（外出補充）  

🎁 現在都有附 30cc 體驗組  

👉 我可以幫你配一組最剛好  
👉 或直接下單（不用等）  
${orderLink}
`
    );
  }

  // 🟡 外出補充
  if (intent === "outdoor") {
    return reply(
      event,
      `
外出方便會選 👍  

✔ 龜鹿飲（30cc / 180cc）  

👉 我幫你配方便攜帶組合  
👉 或直接下單  
${orderLink}
`
    );
  }

  // 🟠 燉湯料理
  if (intent === "cooking") {
    return reply(
      event,
      `
燉湯會用 👍  

✔ 龜鹿湯塊  

👉 雞湯 / 排骨我可以幫你配  
👉 或直接下單  
${orderLink}
`
    );
  }

  // 💰 價格導成交
  if (intent === "price") {
    return reply(
      event,
      `
現在有做搭配優惠 👍  

🎁 體驗組會幫你升級  

👉 要我幫你配一組最划算  
👉 或直接下單  
${orderLink}
`
    );
  }

  // 🔥 準備下單
  if (intent === "ready") {
    return reply(
      event,
      `
我幫你整理好了 👍  

👉 直接填這個就可以安排出貨  
${orderLink}
`
    );
  }

  // 🧭 預設引導
  return reply(
    event,
    `
你好 👋  

可以直接選👇  

① 日常補養  
② 外出補充  
③ 燉湯料理  

👉 或直接下單  
${orderLink}
`
  );
}

// ===== 回覆函式 =====
function reply(event, text) {
  return client.replyMessage(event.replyToken, {
    type: "text",
    text: text.trim(),
  });
}

// ===== 啟動 =====
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on ${PORT}`);
});
