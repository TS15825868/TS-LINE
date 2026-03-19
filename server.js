const express = require('express');
const line = require('@line/bot-sdk');
const axios = require('axios');

const app = express();

const config = {
channelAccessToken: 'IKjy0y2zfPOhMCp7xiJ4R4z7UkkvzoQgj7A6OH1AJjdMYpDnEzaicgz2HWy4pVz1KMSsUHzhoHoXZVztRQwibp3Q8UPfN+Dp4pBfT2k3Mzu5bBtdO1P78Cpffq+75liFPLL3ftcHMzvzr+WOgm6AEgdB04t89/1O/w1cDnyilFU=',
channelSecret: '7c3c4740afa5a281d54afb9f8ffc1e96'
};

const client = new line.Client(config);

// 👉 你的 GAS
const CRM_URL = 'https://script.google.com/macros/s/AKfycbzymc5WXqVFhJr1cTBbVvnA4P6WDTNGdNEVtkcqBQDO6SJ03ZL_eQ7BI9ZAIVdyiwbHew/exec';

app.post('/webhook', line.middleware(config), (req, res) => {
Promise.all(req.body.events.map(handleEvent))
.then((result) => res.json(result));
});

async function handleEvent(event){

if(event.type !== 'message') return;

const userId = event.source.userId;
const text = event.message.text;

// ===== 取得用戶資料 =====
let profile;
try{
profile = await client.getProfile(userId);
}catch(e){
profile = { displayName: "顧客" };
}

const name = profile.displayName;

// ===== CRM查詢 =====
const userData = await getUser(userId);

// ===== 分群邏輯 =====
const level = userData?.level || "新客";

// ===== 不同話術 =====
if(text.includes("買") || text.includes("下單")){
return replyOrder(event, level);
}

if(text.includes("保養") || text.includes("累")){
return replyRecommend(event, level);
}

// ===== 預設選單 =====
return replyMenu(event, level);
}

// ===== CRM：查客戶 =====
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

// ===== CRM：寫訂單 =====
async function saveOrder(data){
await axios.post(CRM_URL,{
action:"order",
...data
});
}

// ===== 選單（根據等級變）=====
function replyMenu(event, level){

let msg = "請選擇需求";

if(level==="VIP"){
msg = "歡迎回來，幫你預留了組合 👇";
}

return client.replyMessage(event.replyToken,{
type:'flex',
altText:'選單',
contents:{
type:'bubble',
body:{
type:'box',
layout:'vertical',
spacing:'md',
contents:[
{type:'text',text:msg,weight:'bold'},
btn("日常保養"),
btn("最近比較累"),
btn("料理搭配"),
btn("直接購買")
]
}
}
});
}

// ===== 推薦（分群）=====
function replyRecommend(event, level){

let text = "";

if(level==="VIP"){
text = "幫你搭一組進階搭配（膏＋飲＋湯）";
}else{
text = "建議：龜鹿膏 或 膏＋飲搭配";
}

return client.replyMessage(event.replyToken,{
type:'text',
text:text
});
}

// ===== 下單 =====
function replyOrder(event, level){

let text = `
請提供以下資料👇

1️⃣ 商品
2️⃣ 數量
3️⃣ 收件姓名
4️⃣ 電話
5️⃣ 配送方式（7-11 / 宅配 / 面交）
`;

if(level==="VIP"){
text = "已幫你開VIP快速通道 👇\n" + text;
}

return client.replyMessage(event.replyToken,{
type:'text',
text:text
});
}

// ===== 按鈕 =====
function btn(label){
return {
type:'button',
action:{
type:'message',
label:label,
text:label
}
};
}

app.listen(3000);
