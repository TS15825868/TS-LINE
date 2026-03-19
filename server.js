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

app.post('/webhook', line.middleware(config), (req, res) => {
Promise.all(req.body.events.map(handleEvent))
.then(result => res.json(result));
});

// ===== 主流程 =====
async function handleEvent(event){

if(event.type !== 'message') return;

const userId = event.source.userId;
const text = event.message.text;

// ===== 使用者 =====
let profile;
try{
profile = await client.getProfile(userId);
}catch{
profile = { displayName:"顧客" };
}
const name = profile.displayName;

// ===== CRM =====
await saveUser(userId,name);
const userData = await getUser(userId);
const level = getLevel(userData);

// ===== 推薦搭配入口 =====
if(text.includes("推薦搭配")){
return askNeed(event);
}

// ===== 選需求 =====
if(text.includes("日常補養")){
return sendComboCard(event,"normal",level);
}

if(text.includes("最近比較累")){
return sendComboCard(event,"tired",level);
}

if(text.includes("想煮湯")){
return sendComboCard(event,"soup",level);
}

// ===== 商品列表 =====
if(text.includes("商品")){
return sendProductCarousel(event);
}

// ===== 下單 =====
if(text.startsWith("我想買")){
return sendOrderForm(event,text.replace("我想買",""),level);
}

// ===== 填單 =====
if(text.includes("商品：") && text.includes("電話")){
return handleOrder(event,text,name,userId);
}

// ===== 其他 =====
return sendMenu(event,name,level);
}

// ===== 問需求 =====
function askNeed(event){
return client.replyMessage(event.replyToken,{
type:'text',
text:
`我幫你快速搭配👇

① 日常補養
② 最近比較累
③ 想煮湯

👉 直接回覆即可`
});
}

// ===== 搭配卡片 =====
function sendComboCard(event,type,level){

let cards = [];

if(type==="normal"){
cards = [
combo("入門補養","龜鹿膏","我想買龜鹿膏"),
combo("日常搭配","膏＋飲","我想買膏＋飲")
];
}

if(type==="tired"){
cards = [
combo("快速恢復","膏＋飲","我想買膏＋飲"),
combo("加強補養","膏＋飲＋湯","我想買膏＋飲＋湯")
];
}

if(type==="soup"){
cards = [
combo("燉湯補養","龜鹿湯塊","我想買龜鹿湯塊"),
combo("湯＋膏","湯＋膏","我想買湯＋膏")
];
}

// VIP 加一張
if(level==="VIP"){
cards.push(
combo("🔥 VIP組合","膏＋飲＋湯（含搭贈）","我想買VIP組合")
);
}

return client.replyMessage(event.replyToken,{
type:'flex',
altText:'推薦搭配',
contents:{
type:'carousel',
contents:cards
}
});
}

function combo(title,desc,text){
return {
type:'bubble',
body:{
type:'box',
layout:'vertical',
contents:[
{type:'text',text:title,weight:'bold'},
{type:'text',text:desc,size:'sm'}
]
},
footer:{
type:'box',
layout:'vertical',
contents:[
{
type:'button',
style:'primary',
action:{
type:'message',
label:'我要這個',
text:text
}
}
]
}
};
}

// ===== 商品卡片 =====
function sendProductCarousel(event){
return client.replyMessage(event.replyToken,{
type:'flex',
altText:'商品',
contents:{
type:'carousel',
contents:[
combo("龜鹿膏","日常補養","我想買龜鹿膏"),
combo("龜鹿飲","快速補充","我想買龜鹿飲"),
combo("龜鹿湯塊","燉湯用","我想買龜鹿湯塊")
]
}
});
}

// ===== 訂單表 =====
function sendOrderForm(event,product,level){

let prefix = "";
if(level==="VIP") prefix = "🔥 VIP快速下單\n";

return client.replyMessage(event.replyToken,{
type:'text',
text:
prefix +
`請填寫👇

商品：${product}
數量：
姓名：
電話：
配送：7-11 / 宅配`
});
}

// ===== 處理訂單 =====
async function handleOrder(event,text,name,userId){

const product = text.match(/商品：(.*)/)?.[1]?.trim() || "";
const qty = text.match(/數量：(.*)/)?.[1]?.trim() || "";
const phone = text.match(/電話：(.*)/)?.[1]?.trim() || "";
const delivery = text.match(/配送：(.*)/)?.[1]?.trim() || "";

await axios.post(CRM_URL,{
action:"order",
userId,
name,
product,
qty,
phone,
delivery
});

return client.replyMessage(event.replyToken,{
type:'text',
text:"✅ 已收到訂單"
});
}

// ===== CRM =====
async function getUser(userId){
try{
const res = await axios.post(CRM_URL,{
action:"getUser",
userId:userId
});
return res.data;
}catch(e){
return null;
}
}

async function saveUser(userId,name){
await axios.post(CRM_URL,{
action:"saveUser",
userId,
name
});
}

// ===== 等級 =====
function getLevel(user){
if(!user) return "新客";
const c = user.count || 0;
if(c>=3) return "VIP";
if(c>=1) return "回購";
return "新客";
}

// ===== 預設 =====
function sendMenu(event,name,level){
return client.replyMessage(event.replyToken,{
type:'text',
text:`${name}，你想怎麼補？（日常補養 / 最近比較累 / 料理搭配 / 推薦搭配）`
});
}

app.listen(3000);
