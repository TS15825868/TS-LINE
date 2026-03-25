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

const COMBO={
 "日常補養組":6000,
 "完整補養組":6100
};

app.post("/webhook",line.middleware(config),(req,res)=>{
 Promise.all(req.body.events.map(handleEvent));
 res.json({});
});

async function handleEvent(e){

 if(e.type!=="message")return;

 const text=e.message.text;

 if(text==="我要買"){
  return client.replyMessage(e.replyToken,flex());
 }

 if(text.includes("我想買")){
  return reply(e,"請提供姓名+電話+地址");
 }

 return reply(e,"👉 點「我要買」開始");
}

function flex(){
 return{
  type:"flex",
  altText:"選組合",
  contents:{
   type:"carousel",
   contents:Object.keys(COMBO).map(n=>({
    type:"bubble",
    body:{
     type:"box",
     layout:"vertical",
     contents:[
      {type:"text",text:n},
      {
       type:"button",
       action:{
        type:"message",
        label:"選這個",
        text:"我想買"+n
       }
      }
     ]
    }
   }))
  }
 };
}

function reply(e,t){
 return client.replyMessage(e.replyToken,{type:"text",text:t});
}

app.listen(3000);
