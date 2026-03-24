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

const COMBO = {
  "入門體驗組":4000,
  "日常補養組":6000,
  "完整補養組":6100,
  "加強補養組":12000
};

const userState = {};
const userBuyTime = {};

app.post("/webhook", line.middleware(config), async (req, res) => {
  await Promise.all(req.body.events.map(handleEvent));
  res.json({});
});

async function handleEvent(event){

  if(event.type !== "message") return;

  const text = event.message.text;
  const userId = event.source.userId;

  if(text === "我要買"){
    return client.replyMessage(event.replyToken, comboFlex());
  }

  if(text === "看產品"){
    return reply(event,"👉 直接點「我要買」比較快🙂");
  }

  if(text === "怎麼使用"){
    return reply(event,"👉 日常吃＋燉湯搭配\n\n需要我幫你配嗎🙂");
  }

  if(text.includes("我想買")){
    const combo = text.replace("我想買","");
    const price = COMBO[combo];

    userState[userId] = {combo};

    return reply(event,
`🧾 ${combo}

💰 ${price} 元

請提供：
姓名 + 電話 + 地址`);
  }

  if(userState[userId]){
    userBuyTime[userId] = Date.now();
    delete userState[userId];

    return reply(event,"✅ 已完成，我們會聯絡你🙂");
  }

  return reply(event,"👉 點「我要買」開始");
}

function comboFlex(){
  return {
    type:"flex",
    altText:"選組合",
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
              }
            }
          ]
        }
      }))
    }
  }
}

function reply(event,text){
  return client.replyMessage(event.replyToken,{
    type:"text",
    text
  });
}

app.listen(3000);
