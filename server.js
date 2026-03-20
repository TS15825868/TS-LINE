"use strict";

const express = require('express');
const line = require('@line/bot-sdk');
const axios = require('axios');

const app = express();

const config = {
channelAccessToken: 'IKjy0y2zfPOhMCp7xiJ4R4z7UkkvzoQgj7A6OH1AJjdMYpDnEzaicgz2HWy4pVz1KMSsUHzhoHoXZVztRQwibp3Q8UPfN+Dp4pBfT2k3Mzu5bBtdO1P78Cpffq+75liFPLL3ftcHMzvzr+WOgm6AEgdB04t89/1O/w1cDnyilFU=',
channelSecret: '7c3c4740afa5a281d54afb9f8ffc1e96'
};

const client = new line.Client(config);

const CRM_URL = 'https://script.google.com/macros/s/AKfycbwAFBxeROd2ZYGJ_h0O7_H2MMxptOMoj3EXIErZpbKuTYFOzOVwQkrk8X1MoxapkHVGSA/exec';

// ===== webhook =====
app.post("/webhook", line.middleware(config), async (req, res) => {
  await Promise.all(req.body.events.map(handleEvent));
  res.json({ success: true });
});

async function handleEvent(event){

  if(event.type === "follow"){
    return reply(event,"歡迎加入仙加味，直接說「幫我搭配」我幫你配好");
  }

  if(event.type !== "message") return;

  const text = event.message.text;

  // 🔥 成交入口
  if(text.includes("搭配")){
    return reply(event,
`🔥 幫你配最適合

請告訴我👇
1️⃣ 平常作息
2️⃣ 想補什麼（體力/日常/料理）

👉 我直接幫你配好`);
  }

  // 🔥 下單
  if(text.includes("購買")){
    await axios.post(CRM_URL,{
      action:"order",
      userId:event.source.userId,
      text
    });

    return reply(event,"已幫你記錄，直接幫你出單 🙌");
  }

  return reply(event,"請輸入「幫我搭配」開始");
}

function reply(event,text){
  return client.replyMessage(event.replyToken,{
    type:"text",
    text
  });
}

app.listen(3000);
