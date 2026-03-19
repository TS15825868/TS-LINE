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
  "膏+飲": 2600,
  "膏+飲+湯": 6000
};

// ===== 地區判斷 =====
function 判斷地區(text){
  if(/台北|新北|板橋|林口|三重|中和|永和|新店|淡水/.test(text)){
    return "雙北";
  }
  return "外縣市";
}

// ===== 配送 =====
function 運費(方式){
  if(方式.includes("7-11")) return 60;
  if(方式.includes("宅配")) return 120;
  if(方式.includes("面交")) return 0;
  return 0;
}

// ===== 查用戶 =====
async function 查用戶(userId){
  try{
    const res = await axios.post(CRM_URL,{
      action:"查用戶",
      userId
    });
    return res.data;
  }catch{
    return null;
  }
}

// ===== 存訂單 =====
async function 存訂單(data){
  await axios.post(CRM_URL,{
    action:"訂單",
    ...data
  });
}

// ===== 卡片 =====
function 卡片(title,desc,price,product){
  return {
    type:"flex",
    altText:title,
    contents:{
      type:"bubble",
      body:{
        type:"box",
        layout:"vertical",
        contents:[
          {type:"text",text:title,weight:"bold",size:"lg"},
          {type:"text",text:desc,size:"sm",margin:"md"},
          {type:"text",text:`$${price}`,weight:"bold",margin:"lg"}
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
              label:"直接安排",
              text:`確認購買 ${product}`
            }
          }
        ]
      }
    }
  };
}

// ===== webhook =====
app.post('/webhook', line.middleware(config), (req,res)=>{
  Promise.all(req.body.events.map(處理事件))
  .then(r=>res.json(r));
});

// ===== 主流程 =====
async function 處理事件(event){

  if(event.type !== 'message') return;

  const text = event.message.text;
  const userId = event.source.userId;

  // ===== VIP判斷 =====
  const user = await 查用戶(userId);

  if(user && user.等級 === "高VIP"){
    return 回覆(event,
`🔥 幫你抓進階搭配

膏＋飲＋湯

👉 要直接幫你安排嗎？`);
  }

  if(user && user.等級 === "VIP"){
    return 回覆(event,
`幫你抓一組穩定搭配👇  

膏＋飲  

👉 可以直接幫你安排`);
  }

  // ===== 分流 =====
  if(text==="日常保養"){
    return client.replyMessage(event.replyToken,
      卡片("日常補養","穩定使用","2000","龜鹿膏")
    );
  }

  if(text==="最近比較累"){
    return client.replyMessage(event.replyToken,
      卡片("調整狀態","膏＋飲搭配","2600","膏+飲")
    );
  }

  if(text==="料理搭配"){
    return client.replyMessage(event.replyToken,
      卡片("燉湯使用","龜鹿湯塊","4000","龜鹿湯塊")
    );
  }

  // ===== 確認購買 =====
  if(text.includes("確認購買")){
    return 回覆(event,
`請提供👇  

姓名：  
電話：  
配送方式（7-11 / 宅配 / 面交）  

⚠️ 面交僅限雙北`);
  }

  // ===== 面交限制 =====
  if(text.includes("面交")){
    const area = 判斷地區(text);

    if(area !== "雙北"){
      return 回覆(event,"面交僅限雙北，建議使用宅配或7-11 🙏");
    }
  }

  // ===== 收單 =====
  if(text.includes("姓名")){

    await 存訂單({
      userId,
      內容:text
    }).catch(()=>{});

    return 回覆(event,"已幫你登記完成 🙌 我們會再確認");
  }

  // ===== 回購 =====
  if(/再買|補貨/.test(text)){
    return 回覆(event,"幫你抓一組適合的搭配 👌");
  }

  return 回覆(event,"請直接點選選單👇");

}

// ===== 回覆 =====
function 回覆(event,text){
  return client.replyMessage(event.replyToken,{
    type:'text',
    text
  });
}

app.listen(3000);
