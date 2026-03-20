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

  if(event.type !== "message" || event.message.type !== "text") return;

  const text = event.message.text;

  const user = await getUser(userId);

  // ===== VIP =====
  if(user && user.count >= 2){
    if(text.includes("回購") || text.includes("你好")){
      return client.replyMessage(event.replyToken, vipFlex());
    }
  }

  // ===== 主選單 =====
  if(text.includes("選單") || text.includes("開始")){
    return client.replyMessage(event.replyToken, welcomeFlex());
  }

  // ===== 商品入口 =====
  if(text.includes("商品")){
    return client.replyMessage(event.replyToken, productFlex());
  }

  // ===== 快速成交（關鍵🔥）=====
  if(text.includes("直接買") || text.includes("推薦")){
    return reply(event,
`🔥 幫你配最熱賣組合

✔ 龜鹿膏 + 龜鹿飲（最多人選）
✔ 日常補養＋快速補充

👉 回覆「我要組合」我直接幫你出單`);
  }

  // ===== 下單 =====
  if(text.includes("我要購買") || text.includes("我要組合")){

    const product = detectProduct(text);
    const item = getProductInfo(product);

    await saveOrder({
      userId,
      product:item?.name || "組合",
      message:text
    });

    return reply(event,
`🧾 幫你整理👇

商品：${item?.name || "推薦組合"}

👉 請提供：
姓名 + 電話 + 地址

我直接幫你出貨 🙌`);
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

//
// ===== FLEX 升級 =====
//

function welcomeFlex(){
  return flexBubble("仙加味",[
    btn("🔥 熱門組合","直接買"),
    btn("📦 商品","商品"),
    btn("🧠 幫我搭配","幫我搭配"),
    btn("♻️ 回購","回購")
  ]);
}

function productFlex(){
  return {
    type:"flex",
    altText:"商品",
    contents:{
      type:"carousel",
      contents:[
        productCard("龜鹿膏","日常補養","guilu-gao"),
        productCard("龜鹿飲","快速補充","guilu-drink"),
        productCard("龜鹿湯塊","燉湯進補","guilu-block"),
        productCard("鹿茸粉","隨時添加","lurong-powder")
      ]
    }
  };
}

function vipFlex(){
  return flexBubble("VIP回購",[
    btn("🔥 補貨推薦","我要組合"),
    btn("📦 直接補貨","我要購買龜鹿膏")
  ]);
}

function productCard(title,desc,id){
  return {
    type:"bubble",
    body:{
      type:"box",
      layout:"vertical",
      contents:[
        {type:"text",text:title,weight:"bold",size:"lg"},
        {type:"text",text:desc,size:"sm",color:"#666"}
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

function flexBubble(title,buttons){
  return {
    type:"flex",
    altText:title,
    contents:{
      type:"bubble",
      body:{
        type:"box",
        layout:"vertical",
        contents:[
          {type:"text",text:title,weight:"bold",size:"lg"}
        ]
      },
      footer:{
        type:"box",
        layout:"vertical",
        contents:buttons
      }
    }
  };
}

function btn(label,text){
  return {
    type:"button",
    action:{type:"message",label,text}
  };
}

//
// ===== 商品 =====
//

function detectProduct(text){
  if(text.includes("膏")) return "guilu-gao";
  if(text.includes("飲")) return "guilu-drink";
  if(text.includes("湯")) return "guilu-block";
  if(text.includes("鹿茸")) return "lurong-powder";
  return null;
}

function getProductInfo(id){
  for(const cat of productsData.categories){
    for(const item of cat.items){
      if(item.id === id) return item;
    }
  }
  return null;
}

//
// ===== CRM =====
//

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

function reply(event,text){
  return client.replyMessage(event.replyToken,{
    type:"text",
    text
  });
}

app.listen(3000);
