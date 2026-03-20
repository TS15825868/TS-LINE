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

  // ===== 加好友 =====
  if(event.type === "follow"){
    return client.replyMessage(event.replyToken, welcomeFlex());
  }

  if(event.type !== "message") return;

  const text = event.message.text;

  const user = await getUser(userId);

  // ===== VIP =====
  if(user && user.count >= 2 && text.includes("回購")){
    return client.replyMessage(event.replyToken, vipFlex());
  }

  // ===== 主入口 =====
  if(text.includes("選單") || text.includes("開始")){
    return client.replyMessage(event.replyToken, welcomeFlex());
  }

  // ===== 商品入口 =====
  if(text.includes("商品")){
    return client.replyMessage(event.replyToken, productFlex());
  }

  // ===== 下單 =====
  if(text.includes("我要購買")){
    const product = detectProduct(text);
    const item = getProductInfo(product);

    await saveOrder({
      userId,
      product:item.name,
      price:item.priceText,
      message:text
    });

    return reply(event,
`🧾 已幫你建立訂單

商品：${item.name}

👉 請提供：
姓名 + 電話 + 地址`);
  }

  // ===== 搭配 =====
  if(text.includes("搭配")){
    return reply(event,
`🔥 幫你配最適合

請說👇
作息 + 想補什麼

👉 我直接幫你配`);
  }

  return reply(event,"👉 輸入「選單」開始");
}

// ===== Flex：歡迎 =====
function welcomeFlex(){
  return {
    type:"flex",
    altText:"選單",
    contents:{
      type:"bubble",
      body:{
        type:"box",
        layout:"vertical",
        contents:[
          {type:"text",text:"仙加味",weight:"bold",size:"lg"},
          {type:"text",text:"請選擇👇"}
        ]
      },
      footer:{
        type:"box",
        layout:"vertical",
        contents:[
          btn("商品","商品"),
          btn("幫我搭配","幫我搭配"),
          btn("回購","回購")
        ]
      }
    }
  };
}

// ===== Flex：商品 =====
function productFlex(){
  return {
    type:"flex",
    altText:"商品",
    contents:{
      type:"carousel",
      contents:[
        productCard("龜鹿膏","guilu-gao"),
        productCard("龜鹿飲","guilu-drink"),
        productCard("龜鹿湯塊","guilu-block"),
        productCard("鹿茸粉","lurong-powder")
      ]
    }
  };
}

// ===== Flex：VIP =====
function vipFlex(){
  return {
    type:"flex",
    altText:"VIP",
    contents:{
      type:"bubble",
      body:{
        type:"box",
        layout:"vertical",
        contents:[
          {type:"text",text:"VIP回購",weight:"bold"},
          {type:"text",text:"推薦組合👇"}
        ]
      },
      footer:{
        type:"box",
        layout:"vertical",
        contents:[
          btn("龜鹿膏＋龜鹿飲","我要購買龜鹿膏"),
          btn("直接補貨","我要購買龜鹿膏")
        ]
      }
    }
  };
}

// ===== 商品卡 =====
function productCard(title,id){
  return {
    type:"bubble",
    body:{
      type:"box",
      layout:"vertical",
      contents:[
        {type:"text",text:title,weight:"bold"}
      ]
    },
    footer:{
      type:"box",
      layout:"vertical",
      contents:[
        btn("我要購買","我要購買"+title)
      ]
    }
  };
}

// ===== 按鈕 =====
function btn(label,text){
  return {
    type:"button",
    action:{type:"message",label,text}
  };
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

app.listen(3000);
