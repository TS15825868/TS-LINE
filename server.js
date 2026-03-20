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
const productsData = JSON.parse(
  fs.readFileSync("./products.json", "utf8")
);

// ===== webhook =====
app.post("/webhook", line.middleware(config), async (req, res) => {
  await Promise.all(req.body.events.map(handleEvent));
  res.json({ success: true });
});

// ===== 主流程 =====
async function handleEvent(event){

  const userId = event.source.userId;

  if(event.type === "follow"){
    return reply(event,
`歡迎加入【仙加味】

👉 輸入「幫我搭配」
我幫你直接配好`);
  }

  if(event.type !== "message" || event.message.type !== "text") return;

  const text = event.message.text;

  // ===== 搭配 =====
  if(text.includes("搭配")){
    return reply(event,
`🔥 幫你配最適合

請說👇
作息 + 想補什麼

👉 我直接幫你配`);
  }

  // ===== 商品判斷 =====
  const product = detectProduct(text);

  if(product){

    await saveOrder({
      userId,
      product,
      message:text
    });

    return reply(event,
`🧾 幫你整理👇

商品：${product}

👉 請提供
姓名 + 電話 + 地址`);
  }

  return reply(event,"👉 輸入「幫我搭配」開始");
}

// ===== 商品判斷 =====
function detectProduct(text){
  if(text.includes("膏")) return "龜鹿膏";
  if(text.includes("飲")) return "龜鹿飲";
  if(text.includes("湯")) return "龜鹿湯塊";
  if(text.includes("鹿茸")) return "鹿茸粉";
  return null;
}

// ===== CRM =====
async function saveOrder(data){
  if(!CRM_URL) return;
  try{
    await axios.post(CRM_URL,{
      action:"order",
      ...data
    });
  }catch(e){}
}

// ===== reply =====
function reply(event,text){
  return client.replyMessage(event.replyToken,{
    type:"text",
    text
  });
}

app.listen(3000);
