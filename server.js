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

// ===== 載入商品資料（你那份）=====
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
    return reply(event,
`歡迎加入【仙加味】

👉 直接輸入「幫我搭配」
我幫你配好最適合的`);
  }

  if(event.type !== "message" || event.message.type !== "text") return;

  const text = event.message.text;

  // ===== 取得用戶 =====
  const user = await getUser(userId);

  // ===== VIP回購 =====
  if(user && user.count >= 2){
    if(text.includes("你好") || text.includes("回購")){
      return reply(event,
`🔥 VIP回購專區

幫你抓一組回購搭配👇

✔ 龜鹿膏 + 龜鹿飲
✔ 或直接幫你補貨

👉 要我直接幫你出單嗎？`);
    }
  }

  // ===== 搭配入口 =====
  if(text.includes("搭配") || text.includes("推薦")){
    return reply(event,
`🔥 幫你配最適合

請告訴我👇
1️⃣ 作息（熬夜 / 正常）
2️⃣ 想補什麼（體力 / 日常 / 料理）

👉 我直接幫你配好`);
  }

  // ===== 商品辨識 =====
  const product = detectProduct(text);

  if(product){

    const item = getProductInfo(product);

    // ===== 寫CRM =====
    await saveOrder({
      userId,
      message:text,
      intent:"購買",
      product:item.name
    });

    return reply(event,
`🧾 幫你整理👇

商品：${item.fullName}
規格：${item.spec}

${item.priceText}

👉 我可以直接幫你出單 🙌`);
  }

  // ===== fallback =====
  return reply(event,"👉 輸入「幫我搭配」我幫你配好");
}

// ===== 商品判斷 =====
function detectProduct(text){

  if(text.includes("膏")) return "guilu-gao";
  if(text.includes("飲")) return "guilu-drink";
  if(text.includes("湯")) return "guilu-block";
  if(text.includes("鹿茸")) return "lurong-powder";

  return null;
}

// ===== 找商品資料 =====
function getProductInfo(id){
  for(const cat of productsData.categories){
    for(const item of cat.items){
      if(item.id === id) return item;
    }
  }
  return {};
}

// ===== CRM寫入 =====
async function saveOrder(data){
  try{
    await axios.post(CRM_URL,{
      action:"order",
      ...data
    });
  }catch(e){}
}

// ===== 讀CRM =====
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

// ===== 回覆 =====
function reply(event,text){
  return client.replyMessage(event.replyToken,{
    type:"text",
    text
  });
}

// ===== 健康檢查 =====
app.get("/health",(req,res)=>res.send("ok"));

app.listen(3000);
