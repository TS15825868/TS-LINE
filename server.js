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
  "龜鹿飲180": 200,
  "龜鹿飲30": 100,
  "湯塊300": 4000,
  "鹿茸粉": 2000
};

// ===== 搭配系統 =====
function getCombo(product){

  if(product === "膏+飲"){
    return {
      name:"膏＋飲",
      price:2000,
      gift:"送龜鹿飲1包",
      note:"🔥 最多人這樣搭"
    };
  }

  if(product === "龜鹿膏"){
    return {
      name:"龜鹿膏",
      price:2000,
      gift:"送試飲",
      note:"日常補養"
    };
  }

  if(product === "龜鹿湯塊"){
    return {
      name:"湯塊",
      price:4000,
      gift:"送小包",
      note:"料理進補"
    };
  }

  return null;
}

// ===== 訂單解析 =====
function detectProduct(text){

  if(text.includes("膏") && text.includes("飲")) return "膏+飲";
  if(text.includes("龜鹿膏")) return "龜鹿膏";
  if(text.includes("湯塊")) return "龜鹿湯塊";

  return "";
}

// ===== webhook =====
app.post('/webhook', line.middleware(config), (req, res) => {
  Promise.all(req.body.events.map(handleEvent))
  .then(() => res.sendStatus(200));
});

// ===== 主流程 =====
async function handleEvent(event){

  if(event.type !== 'message') return;

  const text = event.message.text;
  const userId = event.source.userId;

  // ===== 分流 =====
  if(/日常|1/.test(text)){
    return sendCombo(event,"膏+飲");
  }

  if(/累|2/.test(text)){
    return sendCombo(event,"膏+飲");
  }

  if(/料理|3/.test(text)){
    return sendCombo(event,"龜鹿湯塊");
  }

  if(/推薦|4/.test(text)){
    return sendCombo(event,"膏+飲");
  }

  // ===== 點擊購買 =====
  if(text.includes("我要")){
    const product = detectProduct(text);
    const combo = getCombo(product);

    return reply(event,
`🔥 幫你整理好

商品：${combo.name}

💰 本次：$${combo.price}
🎁 ${combo.gift}

${combo.note}

👉 回「確認」直接幫你出單`
    );
  }

  // ===== 成交 =====
  if(text.includes("確認")){

    await axios.post(CRM_URL,{
      action:"order",
      userId
    });

    return reply(event,
`✅ 訂單完成

🎁 已幫你保留優惠

我們會儘快聯絡 🙌`
    );
  }

  // ===== 預設 =====
  return reply(event,
`歡迎來到仙加味 🙌

① 日常保養  
② 最近比較累  
③ 料理搭配  
④ 直接推薦`
  );

}

// ===== 推薦卡 =====
function sendCombo(event,product){

  const c = getCombo(product);

  return client.replyMessage(event.replyToken,{
    type:"flex",
    altText:"推薦",
    contents:{
      type:"bubble",
      body:{
        type:"box",
        layout:"vertical",
        contents:[
          {type:"text",text:c.name,size:"xl",weight:"bold"},
          {type:"text",text:c.note},
          {type:"text",text:`🎁 ${c.gift}`}
        ]
      },
      footer:{
        type:"box",
        layout:"vertical",
        contents:[
          {
            type:"button",
            style:"primary",
            action:{
              type:"message",
              label:"我要這個",
              text:`我要 ${c.name}`
            }
          }
        ]
      }
    }
  });

}

// ===== reply =====
function reply(event,text){
  return client.replyMessage(event.replyToken,{
    type:'text',
    text
  });
}

app.listen(3000);
