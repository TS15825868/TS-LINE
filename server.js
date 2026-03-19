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

// 🔥 你的 GAS
const CRM_URL = 'https://script.google.com/macros/s/AKfycbwAFBxeROd2ZYGJ_h0O7_H2MMxptOMoj3EXIErZpbKuTYFOzOVwQkrk8X1MoxapkHVGSA/exec';

app.post('/webhook', line.middleware(config), (req, res) => {
Promise.all(req.body.events.map(handleEvent))
.then(result => res.json(result));
});

async function handleEvent(event){

if(event.type !== 'message') return;

const userId = event.source.userId;
const text = event.message.text;

// ===== 取得LINE名稱 =====
let profile;
try{
profile = await client.getProfile(userId);
}catch(e){
profile = { displayName:"顧客" };
}

const name = profile.displayName;

// ===== 寫入客戶（每次互動）=====
await axios.post(CRM_URL,{
action:"saveUser",
userId,
name
});

// ===== 取得分群 =====
const res = await axios.post(CRM_URL,{
action:"getUser",
userId
});

const user = res.data || {};
const level = user.level || "新客";

// ===== 話術 =====
if(text.includes("買") || text.includes("下單")){
return replyOrder(event, level);
}

if(text.includes("保養")){
return reply(event, level==="VIP"
? "幫你搭VIP組合（膏＋飲＋湯）"
: "建議：龜鹿膏（日常補養）");
}

if(text.includes("累")){
return reply(event, level==="VIP"
? "幫你進階搭配（膏＋飲）"
: "建議：膏＋飲搭配");
}

if(text.includes("煮")){
return reply(event,"建議：龜鹿湯塊（料理用）");
}

// 主選單
return client.replyMessage(event.replyToken,{
type:'flex',
altText:'選單',
contents:{
type:'bubble',
body:{
type:'box',
layout:'vertical',
contents:[
{type:'text',text:`${name}，你想怎麼補？`,weight:'bold'},
btn("日常保養"),
btn("最近比較累"),
btn("料理搭配"),
btn("直接購買")
]
}
}
});
}

// ===== 下單 =====
function replyOrder(event, level){

let text = `
請提供👇

1. 商品
2. 數量
3. 姓名
4. 電話
5. 配送方式
`;

if(level==="VIP"){
text = "VIP快速通道👇\n" + text;
}

return client.replyMessage(event.replyToken,{
type:'text',
text
});
}

function reply(event,text){
return client.replyMessage(event.replyToken,{
type:'text',
text
});
}

function btn(label){
return {
type:'button',
action:{type:'message',label,text:label}
};
}

app.listen(3000);
