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

/* ===== 組合 ===== */
const COMBO = {
  "入門體驗組": {
    content:"龜鹿飲 30cc ×2",
    gift:"再送1罐",
    level:"entry"
  },
  "日常補養組": {
    content:"龜鹿膏 + 龜鹿湯塊",
    gift:"送龜鹿飲1罐",
    level:"normal"
  },
  "完整補養組": {
    content:"龜鹿膏 + 湯塊 + 龜鹿飲",
    gift:"送龜鹿飲2罐",
    level:"vip"
  }
};

/* ===== 單品 ===== */
const PRODUCTS = {
  "龜鹿膏":"100g / 罐",
  "龜鹿飲":"30cc / 罐",
  "龜鹿湯塊":"75g / 盒",
  "鹿茸粉":"75g / 罐"
};

/* ===== 狀態 ===== */
const userState = {};
const userLevel = {};
const userTime = {};
const pushedLog = {};
const viewLog = {};
const clickLog = {}; // 🔥 點擊紀錄

/* ===== webhook ===== */
app.post("/webhook", line.middleware(config), async (req, res) => {
  await Promise.all(req.body.events.map(handleEvent));
  res.json({});
});

/* ===== 主流程 ===== */
async function handleEvent(event){

  if(event.type !== "message") return;

  const text = event.message.text;
  const userId = event.source.userId;

  viewLog[userId] = Date.now();

  /* ===== 點擊紀錄 ===== */
  if(text === "我要買"){
    clickLog[userId] = Date.now();
    return client.replyMessage(event.replyToken, mainFlex());
  }

  /* ===== 優惠 ===== */
  if(/便宜|優惠|折扣/.test(text)){
    return reply(event,
`👉 價格是固定的🙂

不過可以幫你多送比較划算

👉 我幫你配一組會比較剛好`);
  }

  /* ===== 選組合 ===== */
  if(text.includes("我想買") && COMBO[text.replace("我想買","")]){

    const name = text.replace("我想買","");
    userState[userId] = {type:"combo",name,step:"info"};

    return reply(event,
`🧾 ${name}

👉 請提供
姓名 + 電話`);
  }

  /* ===== 單品 ===== */
  if(PRODUCTS[text]){

    userState[userId] = {type:"product",name:text,step:"info"};

    return reply(event,
`🧾 ${text}

規格：${PRODUCTS[text]}

👉 請提供
姓名 + 電話`);
  }

  /* ===== 收資料 ===== */
  if(userState[userId]?.step === "info"){

    userState[userId].info = text;
    userState[userId].step = "delivery";

    return reply(event,
`📦 配送方式：

1️⃣ 宅配
2️⃣ 7-11店到店
3️⃣ 雙北親送`);
  }

  /* ===== 配送 ===== */
  if(userState[userId]?.step === "delivery"){

    userState[userId].delivery = text;
    userState[userId].step = "payment";

    return reply(event,
`💳 付款方式：

1️⃣ 匯款
2️⃣ 貨到付款`);
  }

  /* ===== 完成 ===== */
  if(userState[userId]?.step === "payment"){

    const data = userState[userId];

    if(data.type === "combo"){
      userLevel[userId] = COMBO[data.name].level;
    }

    userTime[userId] = Date.now();
    delete userState[userId];

    return reply(event,
`✅ 訂單完成🙂

👉 要不要一起補齊會比較完整`);
  }

  return reply(event,"👉 點「我要買」或直接打產品名稱🙂");
}

/* ===== 主選單（組合＋單品🔥）===== */
function mainFlex(){
  return {
    type:"flex",
    altText:"選購",
    contents:{
      type:"carousel",
      contents:[
        ...Object.keys(COMBO).map(name=>({
          type:"bubble",
          body:{
            type:"box",
            layout:"vertical",
            contents:[
              {type:"text",text:name,weight:"bold"},
              {
                type:"button",
                action:{
                  type:"message",
                  label:"選這個",
                  text:"我想買"+name
                }
              }
            ]
          }
        })),
        ...Object.keys(PRODUCTS).map(p=>({
          type:"bubble",
          body:{
            type:"box",
            layout:"vertical",
            contents:[
              {type:"text",text:p,weight:"bold"},
              {
                type:"button",
                action:{
                  type:"message",
                  label:"單買",
                  text:p
                }
              }
            ]
          }
        }))
      ]
    }
  };
}

/* ===== 推播系統 ===== */
setInterval(()=>{

  const now = Date.now();

  /* ===== 點擊沒買（2天🔥）===== */
  Object.keys(clickLog).forEach(id=>{
    const days = (now - clickLog[id])/(1000*60*60*24);

    if(days>2 && days<3 && !userLevel[id] && !pushedLog[id+"_click"]){
      pushedLog[id+"_click"]=true;
      push(id,
`👉 剛剛有看到你在看🙂

需要我幫你配比較快`);
    }
  });

  /* ===== 回購 ===== */
  Object.keys(userTime).forEach(id=>{

    const days = (now - userTime[id])/(1000*60*60*24);

    if(days>45 && days<46 && !pushedLog[id+"_45"]){
      pushedLog[id+"_45"]=true;
      push(id,"👉 差不多可以補一波🙂");
    }

  });

},3600000);

/* ===== push ===== */
function push(userId,text){
  return client.pushMessage(userId,{
    type:"text",
    text
  });
}

/* ===== reply ===== */
function reply(event,text){
  return client.replyMessage(event.replyToken,{
    type:"text",
    text
  });
}

app.listen(3000);
