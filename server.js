"use strict";

const express = require("express");
const line = require("@line/bot-sdk");
const axios = require("axios");
const fs = require("fs");

const app = express();

// ===== LINE =====
const config = {
  channelAccessToken: process.env.CHANNEL_ACCESS_TOKEN || "IKjy0y2zfPOhMCp7xiJ4R4z7UkkvzoQgj7A6OH1AJjdMYpDnEzaicgz2HWy4pVz1KMSsUHzhoHoXZVztRQwibp3Q8UPfN+Dp4pBfT2k3Mzu5bBtdO1P78Cpffq+75liFPLL3ftcHMzvzr+WOgm6AEgdB04t89/1O/w1cDnyilFU=",
  channelSecret: process.env.CHANNEL_SECRET || "7c3c4740afa5a281d54afb9f8ffc1e96"
};

const client = new line.Client(config);

// ===== CRM =====
const CRM_URL = process.env.CRM_URL || "https://script.google.com/macros/s/AKfycbwAFBxeROd2ZYGJ_h0O7_H2MMxptOMoj3EXIErZpbKuTYFOzOVwQkrk8X1MoxapkHVGSA/exec";

// ===== 商品資料 =====
let productsData = [];
try{
  productsData = JSON.parse(
    fs.readFileSync("./products.json", "utf8")
  );
}catch(e){}

// ===== webhook =====
app.post("/webhook", line.middleware(config), async (req, res) => {
  await Promise.all(req.body.events.map(handleEvent));
  res.json({ success: true });
});

// ===== 主流程 =====
async function handleEvent(event) {

  const userId = event.source.userId;

  // 加好友
  if (event.type === "follow") {
    return client.replyMessage(event.replyToken, mainMenu());
  }

  if (event.type !== "message") return;

  const text = event.message.text;

  // ===== 主選單 =====
  if (text === "選單") {
    return client.replyMessage(event.replyToken, mainMenu());
  }

  // ===== 產品 =====
  if (text === "看產品") {
    return client.replyMessage(event.replyToken, productMenu());
  }

  // ===== 下單 =====
  if (text === "我要買") {
    return client.replyMessage(event.replyToken, orderMenu());
  }

  // ===== 客製流程 =====
  if (text.includes("龜鹿膏") || text.includes("湯塊")) {
    await saveOrder({ userId, product: text });

    return client.replyMessage(event.replyToken, {
      type: "text",
      text: "👉 請提供：姓名 + 電話 + 地址"
    });
  }

  return client.replyMessage(event.replyToken, mainMenu());
}

// ===== 主選單 =====
function mainMenu() {
  return {
    type: "flex",
    altText: "主選單",
    contents: {
      type: "bubble",
      body: {
        type: "box",
        layout: "vertical",
        contents: [
          btn("看產品"),
          btn("我要買"),
          btn("怎麼吃"),
          btn("客服")
        ]
      }
    }
  };
}

// ===== 商品選單 =====
function productMenu() {
  return {
    type: "flex",
    altText: "產品",
    contents: {
      type: "bubble",
      body: {
        type: "box",
        layout: "vertical",
        contents: [
          btn("龜鹿膏"),
          btn("龜鹿飲"),
          btn("龜鹿湯塊"),
          btn("鹿茸粉")
        ]
      }
    }
  };
}

// ===== 下單 =====
function orderMenu() {
  return {
    type: "flex",
    altText: "下單",
    contents: {
      type: "bubble",
      body: {
        type: "box",
        layout: "vertical",
        contents: [
          btn("我要買龜鹿膏"),
          btn("我要買湯塊")
        ]
      }
    }
  };
}

// ===== 按鈕 =====
function btn(text) {
  return {
    type: "button",
    action: {
      type: "message",
      label: text,
      text: text
    },
    style: "primary"
  };
}

// ===== CRM =====
async function saveOrder(data) {
  if (!CRM_URL) return;
  try {
    await axios.post(CRM_URL, data);
  } catch (e) {}
}

app.listen(3000);
