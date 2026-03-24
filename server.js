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

// ===== 記憶狀態 =====
const userState = {};

// ===== webhook =====
app.post("/webhook", line.middleware(config), async (req, res) => {
  await Promise.all(req.body.events.map(handleEvent));
  res.json({ success: true });
});

// ===== 主流程 =====
async function handleEvent(event){

  const userId = event.source.userId;

  if(event.type === "follow"){
    return reply(event,"👇 請直接選擇：看產品 / 我要買");
  }

  if(event.type !== "message") return;

  const text = event.message.text;

  // ===== 看產品 =====
  if(text === "看產品"){
    return reply(event,"👉 請輸入：龜鹿膏 / 龜鹿飲 / 龜鹿湯塊 / 鹿茸粉");
  }

  // ===== 我要買 =====
  if(text === "我要買"){
    userState[userId] = { step:"choose" };
    return reply(event,"👉 請輸入要購買的產品");
  }

  // ===== 選產品 =====
  if(["龜鹿膏","龜鹿飲","龜鹿湯塊","鹿茸粉"].includes(text)){
    userState[userId] = {
      step:"info",
      product:text
    };

    return reply(event,
`🧾 商品：${text}

請提供：
姓名 + 電話 + 地址`);
  }

  // ===== 收單 =====
  if(userState[userId]?.step === "info"){

    await saveOrder({
      userId,
      product:userState[userId].product,
      info:text
    });

    userState[userId] = null;

    return reply(event,"✅ 訂單已收到，我們會幫你處理🙂");
  }

  return reply(event,"👉 輸入 看產品 或 我要買");
}

// ===== CRM =====
async function saveOrder(data){
  if(!CRM_URL) return;
  try{
    await axios.post(CRM_URL,data);
  }catch(e){}
}

// ===== 回覆 =====
function reply(event,text){
  return client.replyMessage(event.replyToken,{
    type:"text",
    text
  });
}

app.listen(3000);
