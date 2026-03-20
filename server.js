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

// ===== 商品 =====
const productsData = JSON.parse(
  fs.readFileSync("./products.json", "utf8")
);

// ===== webhook =====
app.post("/webhook", line.middleware(config), async (req, res) => {
  await Promise.all(req.body.events.map(handleEvent));
  res.json({ success: true });
});

async function handleEvent(event){

  const userId = event.source.userId;

  if(event.type === "follow"){
    return reply(event,"歡迎加入，輸入『幫我搭配』我直接幫你配");
  }

  if(event.type !== "message") return;

  const text = event.message.text;

  const user = await getUser(userId);

  // ===== VIP =====
  if(user && user.count >= 2){
    if(text.includes("回購")){
      return reply(event,
`🔥 VIP回購

幫你抓最適合👇

✔ 龜鹿膏 + 龜鹿飲
👉 要我直接幫你出單嗎？`);
    }
  }

  // ===== 搭配 =====
  if(text.includes("搭配")){
    return reply(event,
`🔥 幫你配最適合

請說👇
作息 + 想補什麼

👉 我直接幫你配`);
  }

  // ===== 商品 =====
  const product = detectProduct(text);

  if(product){

    const item = getProductInfo(product);

    await saveOrder({
      userId,
      product:item.name,
      price:item.priceText,
      message:text
    });

    return reply(event,
`🧾 ${item.name}

${item.priceText}

👉 要直接幫你出單嗎？`);
  }

  return reply(event,"👉 輸入『幫我搭配』");
}

// ===== 商品判斷 =====
function detectProduct(text){
  if(text.includes("膏")) return "guilu-gao";
  if(text.includes("飲")) return "guilu-drink";
  if(text.includes("湯")) return "guilu-block";
  if(text.includes("鹿茸")) return "lurong-powder";
  return null;
}

// ===== 找商品 =====
function getProductInfo(id){
  for(const cat of productsData.categories){
    for(const item of cat.items){
      if(item.id === id) return item;
    }
  }
  return {};
}

// ===== CRM =====
async function saveOrder(data){
  try{
    await axios.post(CRM_URL,{
      action:"order",
      ...data
    });
  }catch{}
}

async function getUser(userId){
  try{
    const res = await axios.post(CRM_URL,{
      action:"getUser",
      userId
    });
    return res.data;
  }catch{
    return null;
  }
}

// ===== reply =====
function reply(event,text){
  return client.replyMessage(event.replyToken,{
    type:"text",
    text
  });
}

app.get("/health",(req,res)=>res.send("ok"));

app.listen(3000);
