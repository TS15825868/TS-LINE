"use strict";

const express = require("express");
const line = require("@line/bot-sdk");

const {
  LINE_CHANNEL_ACCESS_TOKEN,
  LINE_CHANNEL_SECRET,
  PORT = 3000
} = process.env;

if (!LINE_CHANNEL_ACCESS_TOKEN || !LINE_CHANNEL_SECRET) {
  console.warn("Missing LINE credentials");
}

const config = {
  channelAccessToken: LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: LINE_CHANNEL_SECRET
};

const client = new line.Client(config);
const app = express();

/* ========= 健康檢查 ========= */
app.get("/", (req, res) => {
  res.status(200).send("ok");
});

/* ========= 主選單卡片 ========= */
function mainMenu() {
  return {
    type: "flex",
    altText: "主選單",
    contents: {
      type: "bubble",
      body: {
        type: "box",
        layout: "vertical",
        spacing: "md",
        contents: [
          { type: "text", text: "仙加味・龜鹿", weight: "bold", size: "xl" },
          { type: "separator" },
          button("產品介紹", "產品"),
          button("看價格", "價格"),
          button("怎麼購買", "購買"),
          button("門市資訊", "門市")
        ]
      }
    }
  };
}

function button(label, text) {
  return {
    type: "button",
    style: "primary",
    action: {
      type: "message",
      label: label,
      text: text
    }
  };
}

/* ========= Webhook ========= */
app.post("/webhook", line.middleware(config), async (req, res) => {
  try {
    await Promise.all(req.body.events.map(handleEvent));
    res.status(200).end();
  } catch (err) {
    console.error(err);
    res.status(500).end();
  }
});

/* ========= 訊息處理 ========= */
async function handleEvent(event) {
  if (event.type !== "message" || event.message.type !== "text") return null;

  const text = event.message.text;

  if (text === "選單") {
    return client.replyMessage(event.replyToken, mainMenu());
  }

  if (text === "產品") {
    return client.replyMessage(event.replyToken, {
      type: "text",
      text: "目前主力產品：龜鹿膏、龜鹿飲、鹿茸粉、龜鹿湯塊（膠）"
    });
  }

  if (text === "價格") {
    return client.replyMessage(event.replyToken, {
      type: "text",
      text: "龜鹿膏 建議售價 $2000\n目前活動 9 折 $1800"
    });
  }

  if (text === "購買") {
    return client.replyMessage(event.replyToken, {
      type: "text",
      text: "可選：宅配、雙北親送、店到店、自取\n請告訴我品項與數量"
    });
  }

  if (text === "門市") {
    return client.replyMessage(event.replyToken, {
      type: "text",
      text: "台北市萬華區西昌街 52 號\n電話：(02)2381-2990"
    });
  }

  return client.replyMessage(event.replyToken, {
    type: "text",
    text: "請輸入「選單」"
  });
}

app.listen(PORT, () => {
  console.log("Server running");
});
