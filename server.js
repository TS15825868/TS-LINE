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
  "龜鹿飲30": 100,
  "龜鹿飲180": 200,
  "湯塊75": 2000,
  "湯塊300": 4000,
  "湯塊600": 8000,
  "鹿茸粉": 2000,

  "入門組": 2000,
  "日常組": 4000,
  "加強組": 6000
};

// ===== 搭贈 =====
function getBonus(product){
  if(product === "入門組") return "贈：龜鹿飲";
  if(product === "日常組") return "贈：龜鹿飲＋優惠";
  if(product === "加強組") return "贈：龜鹿飲＋龜鹿湯塊";
  return "";
}

// ===== webhook =====
app.post("/webhook", line.middleware(config), async (req, res) => {
  await Promise.all(req.body.events.map(handleEvent));
  res.json({ success: true });
});

// ===== 主流程 =====
async function handleEvent(event){

  const userId = event.source.userId;

  if(event.type === "follow"){
    return client.replyMessage(event.replyToken, welcome());
  }

  if(event.type !== "message" || event.message.type !== "text") return;

  const text = event.message.text;

  // ===== VIP =====
  const user = await getUser(userId);

  if(user && user.vip === "是"){
    return reply(event,
`🔥 VIP專屬

已幫你準備回購搭配

👉 要直接幫你出單嗎？`);
  }

  // ===== 分流 =====
  if(text === "日常保養") return replyFlex(event, flexDaily());
  if(text === "最近比較累") return replyFlex(event, flexTired());
  if(text === "想煮湯進補") return replyFlex(event, flexCook());
  if(text === "先了解看看") return replyFlex(event, flexLearn());

  // ===== 湯塊規格 =====
  if(text.includes("湯塊")){
    return replyFlex(event, flexSoup());
  }

  // ===== 組合 =====
  if(text.includes("入門")) return checkout(event,userId,"入門組");
  if(text.includes("日常")) return checkout(event,userId,"日常組");
  if(text.includes("加強")) return checkout(event,userId,"加強組");

  // ===== 單品 =====
  if(text.includes("購買")){
    const product = detectProduct(text);
    const price = PRICE[product] || 0;

    saveOrder({userId,product,price});

    return reply(event,
`🧾 幫你整理👇

商品：${product}
金額：$${price}

👉 需要幫你搭配更划算的組合嗎？`);
  }

  return reply(event,"請點選選單👇");
}

// ===== 商品判斷 =====
function detectProduct(text){

  if(text.includes("湯塊")){
    if(text.includes("600")||text.includes("一斤")) return "湯塊600";
    if(text.includes("300")||text.includes("半斤")) return "湯塊300";
    if(text.includes("75")||text.includes("2兩")) return "湯塊75";
  }

  if(text.includes("膏")) return "龜鹿膏";

  if(text.includes("飲")){
    if(text.includes("30")) return "龜鹿飲30";
    return "龜鹿飲180";
  }

  if(text.includes("鹿茸")) return "鹿茸粉";

  return "";
}

// ===== 成交 =====
async function checkout(event,userId,product){

  const price = PRICE[product];
  const bonus = getBonus(product);

  await saveOrder({userId,product,price});

  return reply(event,
`🧾 幫你配好了👇

${product}
💰 $${price}

🎁 ${bonus}

👉 可以直接幫你出單 🙌`);
}

// ===== FLEX =====
function flexDaily(){
  return flex("日常保養",[
    btn("入門組","我要入門組"),
    btn("日常組","我要日常組")
  ]);
}

function flexTired(){
  return flex("最近比較累",[
    btn("日常組","我要日常組"),
    btn("加強組","我要加強組")
  ]);
}

function flexCook(){
  return flex("料理",[
    btn("雞湯","我要湯塊"),
    btn("排骨","我要湯塊"),
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

function flexSoup(){
  return {
    type:"flex",
    altText:"湯塊",
    contents:{
      type:"carousel",
      contents:[
        soup("75g","我要湯塊75"),
        soup("300g","我要湯塊300"),
        soup("600g","我要湯塊600")
      ]
    }
  };
}

function soup(title,text){
  return {
    type:"bubble",
    body:{type:"box",layout:"vertical",contents:[
      {type:"text",text:title,weight:"bold"}
    ]},
    footer:{type:"box",layout:"vertical",contents:[
      btn("我要這個",text)
    ]}
  };
}

// ===== UI =====
function flex(title,buttons){
  return {
    type:"flex",
    altText:title,
    contents:{
      type:"bubble",
      body:{type:"box",layout:"vertical",contents:[
        {type:"text",text:title,weight:"bold"}
      ]},
      footer:{type:"box",layout:"vertical",contents:buttons}
    }
  };
}

function btn(label,text){
  return {type:"button",action:{type:"message",label,text}};
}

function btnUrl(label,url){
  return {type:"button",action:{type:"uri",label,uri:url}};
}

// ===== 工具 =====
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
  return {type:"action",action:{type:"message",label,text:label}};
}

function reply(event,text){
  return client.replyMessage(event.replyToken,{type:"text",text});
}

function replyFlex(event,msg){
  return client.replyMessage(event.replyToken,msg);
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
