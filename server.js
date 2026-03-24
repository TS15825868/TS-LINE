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
let productsData = [];
try{
  productsData = JSON.parse(
    fs.readFileSync("./products.json", "utf8")
  );
}catch(e){}

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
    return replyFlex(event,"flex_main.json");
  }

  if(event.type !== "message" || event.message.type !== "text") return;

  const text = event.message.text;

  // ===== 主入口（不用打字🔥）=====
  if(text.includes("幫我選") || text.includes("搭配")){
    return replyFlex(event,"flex_main.json");
  }

  // ===== 直接買 =====
  if(text.includes("直接買")){
    return replyFlex(event,"flex_lifestyle.json");
  }

  // ===== 生活型態判斷 =====
  if(text.includes("外食") || text === "1"){
    return replyFlex(event,"flex_combo.json");
  }

  if(text.includes("偶爾") || text === "2"){
    return reply(event,
`我幫你配👇

👉 日常補養組

✔ 龜鹿膏（每天）
✔ 龜鹿湯塊（燉湯）

👉 很簡單就能維持🙂

要幫你安排嗎？`);
  }

  if(text.includes("自己煮") || text === "3"){
    return reply(event,
`你很適合用湯塊👍

✔ 一鍋放1～2塊
✔ 可燉湯或保溫壺

👉 很自然融入日常

要幫你搭一組嗎🙂`);
  }

  // ===== 收單（CRM保留🔥）=====
  if(text.includes("我要") || text.includes("安排")){
    
    await saveOrder({
      userId,
      product:"套餐",
      message:text
    });

    return reply(event,
`🧾 幫你安排🙂

請提供👇
姓名：
電話：
地址：`);
  }

  // ===== 商品判斷（保留你原本🔥）=====
  const product = detectProduct(text);

  if(product){

    await saveOrder({
      userId,
      product,
      message:text
    });

    return reply(event,
`🧾 幫你整理👇

商品：${product}

請提供👇
姓名：
電話：
地址：`);
  }

  // ===== 使用方式 =====
  if(text.includes("怎麼用")){
    return reply(event,
`✔ 一鍋放1～2塊
✔ 一盒8塊
✔ 可燉雞湯、排骨湯
✔ 可放保溫壺
✔ 可不加藥材，也可依喜好添加`);
  }

  // ===== 敏感轉醫師 =====
  if(text.includes("適合") || text.includes("可以吃嗎")){
    return reply(event,
`這部分會因個人體質不同，

建議由合作中醫師了解🙂

➤ Line ID：@changwuchi
➤ https://lin.ee/1MK4NR9`);
  }

  return reply(event,"👉 點選下方選單開始");
}

// ===== Flex 回覆 =====
function replyFlex(event,file){
  try{
    const flex = JSON.parse(fs.readFileSync(`./${file}`));
    return client.replyMessage(event.replyToken,flex);
  }catch(e){
    return reply(event,"系統設定中");
  }
}

// ===== 商品判斷 =====
function detectProduct(text){
  if(text.includes("膏")) return "龜鹿膏";
  if(text.includes("飲")) return "龜鹿飲";
  if(text.includes("湯")) return "龜鹿湯塊";
  if(text.includes("鹿茸")) return "鹿茸粉";
  return null;
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

// ===== reply =====
function reply(event,text){
  return client.replyMessage(event.replyToken,{
    type:"text",
    text
  });
}

app.listen(3000);
