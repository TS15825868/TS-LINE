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

// ===== 記憶（簡單版）=====
const userState = {};

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
    return replyFlex(event, mainMenu());
  }

  if (event.type !== "message" || event.message.type !== "text") return;

  const text = event.message.text.trim();

  // ===== 主選單 =====
  if (["選單","menu"].includes(text)) {
    return replyFlex(event, mainMenu());
  }

  // ===== 看產品 =====
  if (text === "看產品") {
    return replyFlex(event, productFlex());
  }

  // ===== 我要買 =====
  if (text === "我要買") {
    userState[userId] = { step: "chooseProduct" };
    return replyFlex(event, productFlex());
  }

  // ===== 怎麼吃 =====
  if (text === "怎麼吃") {
    return reply(event, "👉 不同型態用法不同，我直接幫你搭配會比較準🙂");
  }

  // ===== 商品選擇 =====
  if (text.includes("龜鹿膏")) return startOrder(event,userId,"龜鹿膏");
  if (text.includes("龜鹿飲")) return startOrder(event,userId,"龜鹿飲");
  if (text.includes("湯塊")) return startOrder(event,userId,"龜鹿湯塊");
  if (text.includes("鹿茸")) return startOrder(event,userId,"鹿茸粉");

  // ===== 收資料 =====
  if (userState[userId]?.step === "fillInfo") {

    await saveOrder({
      userId,
      product: userState[userId].product,
      info: text
    });

    userState[userId] = null;

    return reply(event,
`✅ 已收到訂單

我們會幫你處理
如需調整會再與你確認🙂`);
  }

  return replyFlex(event, mainMenu());
}

// ===== 開始下單 =====
function startOrder(event,userId,product){

  userState[userId] = {
    step: "fillInfo",
    product
  };

  return reply(event,
`🧾 商品：${product}

👉 請提供：
姓名 + 電話 + 地址`);
}

// ===== 主選單 =====
function mainMenu(){
  return {
    type: "flex",
    altText: "主選單",
    contents: {
      type: "bubble",
      body: {
        type: "box",
        layout: "vertical",
        spacing:"md",
        contents: [
          btn("看產品"),
          btn("我要買"),
          btn("怎麼吃")
        ]
      }
    }
  };
}

// ===== 商品選單 =====
function productFlex(){
  return {
    type:"flex",
    altText:"產品",
    contents:{
      type:"carousel",
      contents:[
        productCard("龜鹿膏"),
        productCard("龜鹿飲"),
        productCard("龜鹿湯塊"),
        productCard("鹿茸粉")
      ]
    }
  }
}

function productCard(name){
  return {
    type:"bubble",
    body:{
      type:"box",
      layout:"vertical",
      contents:[
        {
          type:"text",
          text:name,
          weight:"bold",
          size:"lg"
        },
        {
          type:"button",
          action:{
            type:"message",
            label:"選這個",
            text:name
          },
          style:"primary"
        }
      ]
    }
  }
}

// ===== 按鈕 =====
function btn(text){
  return {
    type:"button",
    action:{
      type:"message",
      label:text,
      text:text
    },
    style:"primary"
  }
}

// ===== 回覆 =====
function reply(event,text){
  return client.replyMessage(event.replyToken,{
    type:"text",
    text
  });
}

function replyFlex(event,flex){
  return client.replyMessage(event.replyToken,flex);
}

// ===== CRM =====
async function saveOrder(data){
  if(!CRM_URL) return;
  try{
    await axios.post(CRM_URL,data);
  }catch(e){}
}

app.listen(3000);
