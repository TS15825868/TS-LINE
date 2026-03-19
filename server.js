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

// ===== 名稱 =====
let profile;
try{
profile = await client.getProfile(userId);
}catch{
profile = { displayName:"顧客" };
}
const name = profile.displayName;

// ===== CRM寫入 =====
try{
await axios.post(CRM_URL,{
action:"saveUser",
userId,
name
});
}catch(e){}

// ===== 👉 自動下單判斷 =====
if(text.startsWith("我想買")){
return sendOrderForm(event,text.replace("我想買",""));
}

// ===== 👉 使用者填資料（判斷訂單）=====
if(text.includes("商品：") && text.includes("電話")){
return handleOrder(event,text,name,userId);
}

// ===== 推薦 =====
if(text.includes("日常") || text.includes("保養")){
return sendCarousel(event);
}

if(text.includes("累")){
return sendCombo(event);
}

if(text.includes("料理")){
return sendSoup(event);
}

return sendMenu(event,name);
}

// ===== 商品卡片 =====
function sendCarousel(event){
return client.replyMessage(event.replyToken,{
type:'flex',
altText:'商品列表',
contents:{
type:'carousel',
contents:[

productBubble("龜鹿膏","日常補養",
"https://ts15825868.github.io/xianjiawei/images/guilu-gao-100g.jpg",
"我想買龜鹿膏"),

productBubble("龜鹿飲","外出補充",
"https://ts15825868.github.io/xianjiawei/images/guilu-drink-30cc.jpg",
"我想買龜鹿飲"),

productBubble("龜鹿湯塊","燉湯使用",
"https://ts15825868.github.io/xianjiawei/images/guilu-block-300g.jpg",
"我想買龜鹿湯塊"),

productBubble("鹿茸粉","日常搭配",
"https://ts15825868.github.io/xianjiawei/images/lurong-powder-75g.jpg",
"我想買鹿茸粉")

]
}
});
}

function productBubble(title,desc,img,text){
return {
type:'bubble',
hero:{type:'image',url:img,size:'full',aspectRatio:'1:1',aspectMode:'cover'},
body:{
type:'box',
layout:'vertical',
contents:[
{type:'text',text:title,weight:'bold'},
{type:'text',text:desc,size:'sm',color:'#666'}
]
},
footer:{
type:'box',
layout:'vertical',
contents:[
{
type:'button',
style:'primary',
action:{type:'message',label:'我要這個',text:text}
}
]
}
};
}

// ===== 👉 出訂單表單 =====
function sendOrderForm(event,product){
return client.replyMessage(event.replyToken,{
type:'text',
text:
`請填寫訂單👇

商品：${product}
數量：
姓名：
電話：
配送：7-11 / 宅配`
});
}

// ===== 👉 處理訂單 =====
async function handleOrder(event,text,name,userId){

const product = text.match(/商品：(.*)/)?.[1]?.trim() || "";
const qty = text.match(/數量：(.*)/)?.[1]?.trim() || "";
const phone = text.match(/電話：(.*)/)?.[1]?.trim() || "";
const delivery = text.match(/配送：(.*)/)?.[1]?.trim() || "";

// 👉 寫入CRM
try{
await axios.post(CRM_URL,{
action:"order",
userId,
name,
product,
qty,
phone,
delivery
});
}catch(e){}

return client.replyMessage(event.replyToken,{
type:'text',
text:"✅ 已收到訂單，我會盡快幫你處理"
});
}

// ===== 其他 =====
function sendCombo(event){
return client.replyMessage(event.replyToken,{
type:'text',
text:"建議：龜鹿膏＋龜鹿飲"
});
}

function sendSoup(event){
return client.replyMessage(event.replyToken,{
type:'text',
text:"建議：龜鹿湯塊"
});
}

function sendMenu(event,name){
return client.replyMessage(event.replyToken,{
type:'text',
text:`${name}，你想怎麼補？（日常保養 / 最近比較累 / 料理搭配）`
});
}

app.listen(3000);
