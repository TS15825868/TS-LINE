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

app.post("/webhook", line.middleware(config), async (req, res) => {
  await Promise.all(req.body.events.map(handleEvent));
  res.json({});
});

async function handleEvent(event){

  if(event.type !== "message") return;

  const text = event.message.text;

  /* ===== AI判斷 ===== */

  if(text.includes("搭配")){
    return reply(event,
`我幫你分三種👇

① 入門開始
② 日常補養
③ 完整搭配

直接打數字就可以`);
  }

  if(text === "1"){
    return reply(event,
`👉 入門建議

✔ 龜鹿膏 或 龜鹿飲

需要我幫你配更適合的嗎🙂`);
  }

  if(text === "2"){
    return reply(event,
`👉 日常建議

✔ 龜鹿膏 + 龜鹿湯塊

最多人這樣搭`);
  }

  if(text === "3"){
    return reply(event,
`👉 完整搭配

✔ 膏 + 飲 + 湯塊 + 鹿茸粉

我可以幫你調整`);
  }

  /* ===== 價格處理（不降價） ===== */

  if(text.includes("便宜") || text.includes("優惠")){
    return reply(event,
`有的🙂

通常用「搭配或多入」
會比較划算

👉 要我幫你算一組嗎？`);
  }

  /* ===== 預設 ===== */

  return reply(event,"👉 輸入「幫我搭配」開始");
}

function reply(event,text){
  return client.replyMessage(event.replyToken,{
    type:"text",
    text
  });
}

app.listen(3000);
