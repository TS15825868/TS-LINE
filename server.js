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

// ===== 價格 =====
const PRICE = {
  "龜鹿膏": 2000,
  "龜鹿飲": 200,
  "龜鹿湯塊": 4000,
  "鹿茸粉": 2000
};

// ===== webhook =====
app.post("/webhook", line.middleware(config), async (req, res) => {
  Promise.all(req.body.events.map(handleEvent));
  res.json({ success: true });
});

// ===== 主流程 =====
async function handleEvent(event){

  const userId = event.source.userId;

  // 🔥 加好友
  if(event.type === "follow"){
    return client.replyMessage(event.replyToken, welcome());
  }

  if(event.type !== "message" || event.message.type !== "text") return;

  const text = event.message.text;

  // ===== VIP =====
  const user = await getUser(userId);

  if(user && user.count >= 2 && text.includes("你好")){
    return reply(event,
`🔥 VIP專屬

幫你抓一組回購搭配

👉 要我直接幫你出單嗎？`);
  }

  // ===== 分流 =====
  if(text === "日常保養") return reply(event, flexDaily());
  if(text === "最近比較累") return reply(event, flexTired());
  if(text === "想煮湯進補") return reply(event, flexCook());
  if(text === "先了解看看") return reply(event, flexLearn());

  // ===== 成交 =====
  if(text.includes("我要購買")){

    const product = detectProduct(text);
    const price = PRICE[product] || 0;

    const total = price;

    // 🔥 寫CRM
    saveOrder({
      userId,
      product,
      qty:1,
      name:"",
      phone:"",
      ship:""
    });

    return reply(event,
`🧾 幫你整理👇

商品：${product}
金額：$${total}

👉 可以直接幫你出單 🙌`);
  }

  return reply(event,"請點選選單👇");
}

// ===== 工具 =====

function detectProduct(text){
  if(text.includes("膏")) return "龜鹿膏";
  if(text.includes("飲")) return "龜鹿飲";
  if(text.includes("湯")) return "龜鹿湯塊";
  if(text.includes("鹿茸")) return "鹿茸粉";
  return "";
}

function welcome(){
  return [{
    type:"text",
    text:"歡迎加入【仙加味】\n請選擇你的狀況👇",
    quickReply:{
      items:[
        quick("日常保養"),
        quick("最近比較累"),
        quick("想煮湯進補"),
        quick("先了解看看")
      ]
    }
  }];
}

function quick(label){
  return {
    type:"action",
    action:{ type:"message", label, text:label }
  };
}

function flexDaily(){
  return flex("日常保養",[
    btn("龜鹿膏","我要購買龜鹿膏"),
    btn("龜鹿飲","我要購買龜鹿飲"),
    btn("幫我搭配","幫我推薦")
  ]);
}

function flexTired(){
  return flex("最近比較累",[
    btn("快速補充","我要購買龜鹿飲"),
    btn("穩定補養","我要購買龜鹿膏"),
    btn("直接配","幫我搭配加強")
  ]);
}

function flexCook(){
  return flex("料理",[
    btn("燉雞湯","我要購買龜鹿湯塊"),
    btn("排骨湯","我要購買龜鹿湯塊"),
    btnUrl("看食譜","https://ts15825868.github.io/xianjiawei/recipes.html")
  ]);
}

function flexLearn(){
  return flex("了解",[
    btnUrl("產品","https://ts15825868.github.io/xianjiawei"),
    btnUrl("怎麼選","https://ts15825868.github.io/xianjiawei/choose.html"),
    btn("推薦","幫我推薦")
  ]);
}

function flex(title, buttons){
  return {
    type:"flex",
    altText:title,
    contents:{
      type:"bubble",
      body:{ type:"box", layout:"vertical", contents:[
        { type:"text", text:title, weight:"bold" }
      ]},
      footer:{ type:"box", layout:"vertical", contents:buttons }
    }
  };
}

function btn(label,text){
  return { type:"button", action:{ type:"message", label, text }};
}

function btnUrl(label,url){
  return { type:"button", action:{ type:"uri", label, uri:url }};
}

function reply(event,text){
  return client.replyMessage(event.replyToken,{ type:"text", text });
}

async function saveOrder(data){
  await axios.post(CRM_URL,{
    action:"order",
    ...data
  });
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

app.listen(3000);
