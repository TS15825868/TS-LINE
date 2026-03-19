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

// ===== CRM寫入 =====
try{
await axios.post(CRM_URL,{
action:"saveUser",
userId,
name
});
}catch(e){}

// ===== 判斷 =====
if(text.includes("保養") || text.includes("日常")){
return sendCarousel(event);
}

if(text.includes("全部產品") || text.includes("產品")){
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

// ===== 🔥 商品滑動卡片 =====
function sendCarousel(event){
return client.replyMessage(event.replyToken,{
type:'flex',
altText:'商品列表',
contents:{
type:'carousel',
contents:[

productBubble(
"龜鹿膏",
"日常補養首選",
"https://ts15825868.github.io/xianjiawei/images/guilu-gao-100g.jpg",
"我想買龜鹿膏"
),

productBubble(
"龜鹿飲",
"外出方便補充",
"https://ts15825868.github.io/xianjiawei/images/guilu-drink-30cc.jpg",
"我想買龜鹿飲"
),

productBubble(
"龜鹿湯塊",
"燉湯料理使用",
"https://ts15825868.github.io/xianjiawei/images/guilu-block-300g.jpg",
"我想買龜鹿湯塊"
),

productBubble(
"鹿茸粉",
"可加咖啡牛奶",
"https://ts15825868.github.io/xianjiawei/images/lurong-powder-75g.jpg",
"我想買鹿茸粉"
)

]
}
});
}

// ===== 單卡片模板 =====
function productBubble(title,desc,img,text){
return {
type:'bubble',
hero:{
type:'image',
url:img,
size:'full',
aspectRatio:'1:1',
aspectMode:'cover'
},
body:{
type:'box',
layout:'vertical',
contents:[
{type:'text',text:title,weight:'bold',size:'lg'},
{type:'text',text:desc,size:'sm',color:'#666'}
]
},
footer:{
type:'box',
layout:'vertical',
spacing:'sm',
contents:[
{
type:'button',
style:'primary',
action:{
type:'message',
label:'我要這個',
text:text
}
},
{
type:'button',
style:'secondary',
action:{
type:'uri',
label:'LINE詢問',
uri:'https://lin.ee/sHZW7NkR'
}
}
]
}
};
}

// ===== 快速補充 =====
function sendCombo(event){
return client.replyMessage(event.replyToken,{
type:'text',
text:"建議：龜鹿膏＋龜鹿飲（快速補充）"
});
}

// ===== 料理 =====
function sendSoup(event){
return client.replyMessage(event.replyToken,{
type:'text',
text:"建議：龜鹿湯塊（燉湯）"
});
}

// ===== 選單 =====
function sendMenu(event,name){
return client.replyMessage(event.replyToken,{
type:'text',
text:`${name}，你想怎麼補？（日常保養 / 最近比較累 / 料理搭配）`
});
}

app.listen(3000);
