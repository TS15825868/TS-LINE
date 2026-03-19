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

// ===== webhook =====
app.post('/webhook', line.middleware(config), (req, res) => {
Promise.all(req.body.events.map(handleEvent))
.then(result => res.json(result));
});

// ===== 主流程 =====
async function handleEvent(event){

if(event.type !== 'message') return;

const text = event.message.text;
const userId = event.source.userId;

// ===== 抓用戶 =====
let user = await getUser(userId);
let level = user?.level || "新客";

// ===== 🔥 判斷「訂單」=====
if(text.includes("我要購買")){
const order = parseOrder(text);

// 👉 寫進 CRM
await saveOrder({
userId,
...order
});

// 👉 回覆
return client.replyMessage(event.replyToken,{
type:'text',
text:`✅ 已收到訂單

商品：${order.product}
數量：${order.qty}

我們會盡快與你確認 🙌`
});
}

// ===== 🔥 VIP =====
if(level === "VIP"){
return client.replyMessage(event.replyToken,{
type:'text',
text:`歡迎回來 🙌

幫你準備好一組回購搭配👇
（膏＋飲）

👉 要直接幫你下單嗎？`
});
}

// ===== 一般 =====
return replyMenu(event);

}

// ===== 解析訂單 =====
function parseOrder(text){

const product = (text.match(/商品：(.*)/)||[])[1] || '';
const qty = (text.match(/數量：(.*)/)||[])[1] || '1';
const name = (text.match(/姓名：(.*)/)||[])[1] || '';
const phone = (text.match(/電話：(.*)/)||[])[1] || '';
const ship = (text.match(/配送：(.*)/)||[])[1] || '';

return { product, qty, name, phone, ship };

}

// ===== CRM：查 =====
async function getUser(userId){
try{
const res = await axios.post(CRM_URL,{
action:"getUser",
userId
});
return res.data;
}catch{
return null;
}
}

// ===== CRM：寫 =====
async function saveOrder(data){
await axios.post(CRM_URL,{
action:"order",
...data
});
}

// ===== 商品卡 =====
function productCarousel(){
return {
type:"flex",
altText:"商品",
contents:{
type:"carousel",
contents:[
bubble("龜鹿膏","龜鹿膏"),
bubble("龜鹿飲","龜鹿飲"),
bubble("龜鹿湯塊","龜鹿湯塊"),
bubble("鹿茸粉","鹿茸粉")
]
}
};
}

function bubble(title, product){
return {
type:"bubble",
body:{
type:"box",
layout:"vertical",
contents:[
{type:"text",text:title,weight:"bold"}
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
label:"直接購買",
text:generateOrder(product)
}
}
]
}
};
}

// ===== 一鍵訂單 =====
function generateOrder(product){
return `我要購買👇
商品：${product}
數量：1
姓名：
電話：
配送：7-11 / 宅配 / 面交（限雙北）`;
}

// ===== 主選單 =====
function replyMenu(event){
return client.replyMessage(event.replyToken,[
{
type:'text',
text:'請選商品👇'
},
productCarousel()
]);
}

app.listen(3000);
