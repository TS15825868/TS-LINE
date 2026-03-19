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
  "湯塊": 4000
};

// ===== 配送判斷 =====
function checkDelivery(text){

  if(text.includes("面交")){
    if(/台北|新北|板橋|林口|三重|中和|永和|新店|淡水/.test(text)){
      return "面交";
    }else{
      return "reject";
    }
  }

  if(text.includes("7-11")) return "7-11";
  if(text.includes("宅配")) return "宅配";

  return "";
}

// ===== 卡片 =====
function card(title, desc, price, label){
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
          {type:"separator",margin:"md"},
          {type:"text",text:`$${price}`,weight:"bold",margin:"md"}
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
              text:`確認 ${label}`
            }
          }
        ]
      }
    }
  };
}

// ===== webhook =====
app.post('/webhook', line.middleware(config), (req,res)=>{
  Promise.all(req.body.events.map(handleEvent))
  .then(r=>res.json(r));
});

// ===== 主流程 =====
async function handleEvent(event){

  if(event.type !== 'message') return;

  const text = event.message.text;
  const userId = event.source.userId;

  // ===== 分流 =====

  if(text==="日常保養"){
    return client.replyMessage(event.replyToken,
      card("日常補養","龜鹿膏","2000","龜鹿膏")
    );
  }

  if(text==="最近比較累"){
    return client.replyMessage(event.replyToken,
      card("調整狀態","膏＋飲搭配","2600","膏+飲")
    );
  }

  if(text==="料理搭配"){
    return client.replyMessage(event.replyToken,
      card("燉湯使用","龜鹿湯塊","4000","湯塊")
    );
  }

  if(text==="幫我推薦"){
    return client.replyMessage(event.replyToken,
      card("基礎搭配","膏＋飲","2600","膏+飲")
    );
  }

  // ===== 確認購買 =====
  if(text.includes("確認")){

    return client.replyMessage(event.replyToken,{
      type:"text",
      text:`幫你安排 🙌  

請提供👇  
姓名：  
電話：  
配送方式（7-11 / 宅配 / 面交）  
（面交僅限雙北）`
    });
  }

  // ===== 配送判斷 =====
  const delivery = checkDelivery(text);

  if(delivery==="reject"){
    return client.replyMessage(event.replyToken,{
      type:"text",
      text:"目前面交僅限雙北地區 🙏 建議選擇宅配或7-11"
    });
  }

  // ===== 收單（寫CRM）=====
  if(text.includes("姓名")){

    await axios.post(CRM_URL,{
      action:"order",
      userId,
      text
    }).catch(()=>{});

    return client.replyMessage(event.replyToken,{
      type:"text",
      text:"已幫你登記完成 🙌 我們會再與你確認"
    });
  }

  return client.replyMessage(event.replyToken,{
    type:"text",
    text:"請直接點選下方選單👇"
  });

}

app.listen(3000);
