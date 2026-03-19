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

const text = event.message.text;
const userId = event.source.userId;

// ===== 取得名稱 =====
let profile;
try{
profile = await client.getProfile(userId);
}catch{
profile = { displayName:"顧客" };
}
const name = profile.displayName;

// ===== 寫入CRM =====
await axios.post(CRM_URL,{action:"saveUser",userId,name});

// ===== 取得客戶 =====
const res = await axios.post(CRM_URL,{action:"getUser",userId});
const user = res.data || {};
const level = user.level || "新客";

// ===== 判斷需求 =====
let intent = "";

if(text.includes("保養")) intent="日常";
if(text.includes("累")) intent="快速";
if(text.includes("煮")) intent="料理";

// ===== 存需求 =====
if(intent){
await axios.post(CRM_URL,{
action:"saveIntent",
userId,
intent
});
}

// ===== AI推薦 =====
if(intent){
return recommend(event, level, intent);
}

// ===== 下單 =====
if(text.includes("買") || text.includes("下單")){
return orderFlow(event, level);
}

// ===== 預設 =====
return menu(event, name, level);
}

// ===== 推薦 =====
function recommend(event, level, intent){

let text="";

if(intent==="日常"){
text = level==="VIP"
? "幫你配VIP組合（膏＋飲＋湯）"
: "建議：龜鹿膏（日常）";
}

if(intent==="快速"){
text = level==="VIP"
? "進階快速補充（膏＋飲）"
: "建議：膏＋飲";
}

if(intent==="料理"){
text = "建議：龜鹿湯塊";
}

return client.replyMessage(event.replyToken,{
type:'text',
text
});
}

// ===== 下單 =====
function orderFlow(event, level){

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

// ===== 選單 =====
function menu(event, name, level){

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

function btn(label){
return {
type:'button',
action:{type:'message',label,text:label}
};
}

app.listen(3000);
