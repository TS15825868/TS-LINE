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

// ===== 主流程 =====
async function handleEvent(event){

if(event.type !== 'message') return;

const userId = event.source.userId;
const text = event.message.text;

// ===== 使用者資料 =====
let profile;
try{
profile = await client.getProfile(userId);
}catch{
profile = { displayName:"顧客" };
}

const name = profile.displayName;

// ===== 寫入CRM（客戶）=====
await saveUser(userId,name);

// ===== 取得客戶資料 =====
const userData = await getUser(userId);

// ===== 等級判斷 =====
const level = getLevel(userData);

// ===== 👉 下單流程 =====
if(text.startsWith("我想買")){
return sendOrderForm(event,text.replace("我想買",""),level);
}

// 👉 填單
if(text.includes("商品：") && text.includes("電話")){
return handleOrder(event,text,name,userId);
}

// ===== 👉 問需求 =====
if(text.includes("保養") || text.includes("日常")){
return sendRecommend(event,level);
}

if(text.includes("累")){
return sendCombo(event,level);
}

if(text.includes("料理")){
return sendSoup(event,level);
}

// ===== 預設 =====
return sendMenu(event,name,level);
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
try{
await axios.post(CRM_URL,{
action:"saveUser",
userId,
name
});
}catch(e){}
}

// ===== 等級 =====
function getLevel(user){
if(!user) return "新客";

const orders = user.orders || 0;

if(orders >= 3) return "VIP";
if(orders >= 1) return "回購";

return "新客";
}

// ===== 主選單 =====
function sendMenu(event,name,level){

let text = `${name}，你想怎麼補？`;

if(level==="VIP"){
text = `${name}，幫你準備好VIP搭配 👇`;
}

return client.replyMessage(event.replyToken,{
type:'text',
text: text + "\n👉 日常保養 / 最近比較累 / 料理搭配"
});
}

// ===== 推薦 =====
function sendRecommend(event,level){

let text = "";

if(level==="VIP"){
text = "幫你搭一組進階（膏＋飲＋湯）直接穩";
}
else if(level==="回購"){
text = "建議你這次可以膏＋飲一起搭";
}
else{
text = "建議先從龜鹿膏開始";
}

return client.replyMessage(event.replyToken,{
type:'text',
text
});
}

// ===== 累 =====
function sendCombo(event,level){

let text = "建議：膏＋飲搭配";

if(level==="VIP"){
text = "直接上（膏＋飲＋湯）效果會更快";
}

return client.replyMessage(event.replyToken,{
type:'text',
text
});
}

// ===== 料理 =====
function sendSoup(event,level){

let text = "建議：龜鹿湯塊";

if(level==="VIP"){
text = "可以搭湯＋膏一起用";
}

return client.replyMessage(event.replyToken,{
type:'text',
text
});
}

// ===== 商品卡片 =====
function sendCarousel(event){
return client.replyMessage(event.replyToken,{
type:'flex',
altText:'商品',
contents:{
type:'carousel',
contents:[

bubble("龜鹿膏","日常補養","images/guilu-gao-100g.jpg","我想買龜鹿膏"),
bubble("龜鹿飲","快速補充","images/guilu-drink-30cc.jpg","我想買龜鹿飲"),
bubble("龜鹿湯塊","燉湯用","images/guilu-block-300g.jpg","我想買龜鹿湯塊")

]
}
});
}

function bubble(title,desc,img,text){
return {
type:'bubble',
hero:{type:'image',url:img,size:'full',aspectRatio:'1:1'},
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
action:{type:'message',label:'我要這個',text:text}
}
]
}
};
}

// ===== 下單表單 =====
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
text:"✅ 已收到訂單，會盡快幫你處理"
});
}

// ===== 回購推播（未來排程用）=====
async function sendFollowUp(userId,type){

let text = "";

if(type==="7day"){
text = "補養差不多一週，要補一罐嗎？";
}
if(type==="30day"){
text = "一個月了，可以補下一輪";
}
if(type==="vip"){
text = "幫你留VIP組合，要直接開嗎？";
}

return client.pushMessage(userId,{
type:'text',
text
});
}

app.listen(3000);
