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

// ===== 組合價格 =====
const COMBO = {
  "入門體驗組":4000,
  "日常補養組":6000,
  "完整補養組":6100,
  "加強補養組":12000
};

// ===== 使用者狀態 =====
const userState = {};
const userBuyTime = {};

// ===== webhook =====
app.post("/webhook", line.middleware(config), async (req, res) => {
  await Promise.all(req.body.events.map(handleEvent));
  res.json({});
});

async function handleEvent(event){

  if(event.type === "follow"){
    return reply(event,"👉 點下方選單開始");
  }

  if(event.type !== "message") return;

  const userId = event.source.userId;
  const text = event.message.text;

  // ===== 我要買 =====
  if(text === "我要買"){
    return client.replyMessage(event.replyToken, comboFlex());
  }

  // ===== 選組合 =====
  if(text.includes("我想買")){

    const combo = text.replace("我想買","").trim();
    const price = COMBO[combo];

    userState[userId] = {
      step:"info",
      combo
    };

    return reply(event,
`🧾 ${combo}

💰 ${price} 元

請提供：
姓名 + 電話 + 地址`);
  }

  // ===== 填資料 =====
  if(userState[userId]?.step === "info"){

    await saveOrder({
      userId,
      combo:userState[userId].combo,
      info:text
    });

    userBuyTime[userId] = Date.now();
    delete userState[userId];

    return reply(event,"✅ 已完成，我們會盡快聯絡你🙂");
  }

  return reply(event,"👉 點「我要買」開始");
}

// ===== Flex =====
function comboFlex(){
  return {
    type:"flex",
    altText:"選擇組合",
    contents:{
      type:"carousel",
      contents:Object.keys(COMBO).map(name=>({
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
              },
              style:"primary"
            }
          ]
        }
      }))
    }
  };
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

// ===== 回購提醒 =====
setInterval(()=>{
  const now = Date.now();

  Object.keys(userBuyTime).forEach(id=>{
    const diff = now - userBuyTime[id];

    if(diff > 7*24*60*60*1000 && diff < 8*24*60*60*1000){
      push(id,"最近有在補嗎🙂");
    }

    if(diff > 14*24*60*60*1000 && diff < 15*24*60*60*1000){
      push(id,"可以再補一波囉🙂");
    }
  });

},3600000);

// ===== push =====
function push(userId,text){
  return client.pushMessage(userId,{
    type:"text",
    text
  });
}

// ===== reply =====
function reply(event,text){
  return client.replyMessage(event.replyToken,{
    type:"text",
    text
  });
}

app.listen(3000);
