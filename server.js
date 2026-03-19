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
"龜鹿飲180": 200,
"龜鹿飲30": 100,
"湯塊600": 8000,
"湯塊300": 4000,
"湯塊75": 2000,
"鹿茸粉": 2000
};

// ===== 搭配優惠 =====
function getComboPrice(product){

if(product === "膏+飲"){
return {
price: 2000, // 👉 原本 2200
note: "（已幫你配好優惠組合）"
};
}

return null;
}

// ===== 運費 =====
function getShippingFee(ship){
if(ship.includes("7-11")) return 60;
if(ship.includes("宅配")) return 120;
if(ship.includes("面交")) return 0;
return 0;
}

// ===== 地區 =====
function detectArea(text){
if(/台北|新北|板橋|林口|三重|中和|永和|新店|淡水/.test(text)){
return "雙北";
}
return "外縣市";
}

// ===== 商品解析 =====
function detectProduct(text){

if(text.includes("膏") && text.includes("飲")) return "膏+飲";

if(text.includes("龜鹿膏")) return "龜鹿膏";

if(text.includes("龜鹿飲")){
if(text.includes("30")) return "龜鹿飲30";
return "龜鹿飲180";
}

if(text.includes("湯塊")){
if(text.includes("600") || text.includes("一斤")) return "湯塊600";
if(text.includes("300") || text.includes("半斤")) return "湯塊300";
if(text.includes("75") || text.includes("2兩")) return "湯塊75";
}

if(text.includes("鹿茸粉")) return "鹿茸粉";

return "";
}

// ===== 訂單解析 =====
function parseOrder(text){

return {
product: detectProduct(text),
qty: (text.match(/數量：(.*)/)||[])[1] || '1',
name: (text.match(/姓名：(.*)/)||[])[1] || '',
phone: (text.match(/電話：(.*)/)||[])[1] || '',
ship: (text.match(/配送：(.*)/)||[])[1] || ''
};
}

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

// ===== 地區提醒 =====
if(/台北|新北|台中|高雄|桃園/.test(text)){
const area = detectArea(text);

if(area === "雙北"){
return reply(event,"你在雙北，可選面交或宅配 🙌");
}else{
return reply(event,"建議使用宅配或7-11會比較方便 👍");
}
}

// ===== 商品 =====
if(/商品|產品|買/.test(text)){
return client.replyMessage(event.replyToken, productCarousel());
}

// ===== 搭配 =====
if(/日常|累|搭配/.test(text)){
return client.replyMessage(event.replyToken, comboCarousel());
}

// ===== 訂單 =====
if(text.includes("我要購買")){

const order = parseOrder(text);
const combo = getComboPrice(order.product);

let price = 0;
let note = "";

if(combo){
price = combo.price;
note = combo.note;
}else{
price = PRICE[order.product] || 0;
}

const shipping = getShippingFee(order.ship);
const total = price * Number(order.qty) + shipping;

// 🔥 非同步寫CRM（不卡速度）
saveOrder({
userId,
...order,
total
}).catch(()=>{});

return reply(event,
`🧾 幫你整理好👇

商品：${order.product}
數量：${order.qty}

💰 本次幫你抓：$${price}
${note}

🚚 運費：$${shipping}

—————————
總計：$${total}

👉 可以直接幫你出單 🙌`
);
}

// ===== VIP =====
const user = await getUser(userId);

if(user && user.count >= 2){
return reply(event,
`🔥 VIP快速回購

幫你抓一組「膏＋飲」優惠

👉 直接幫你下單嗎？`
);
}

// ===== 預設 =====
return reply(event,"請選擇👇");

}

// ===== 回覆 =====
function reply(event,text){
return client.replyMessage(event.replyToken,{
type:'text',
text
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
bubble("龜鹿膏"),
bubble("龜鹿飲"),
bubble("龜鹿湯塊"),
bubble("鹿茸粉")
]
}
};
}

function bubble(name){
return {
type:"bubble",
body:{
type:"box",
layout:"vertical",
contents:[
{type:"text",text:name,weight:"bold"}
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
label:"我要這個",
text:`我要購買👇
商品：${name}
數量：1
配送：7-11`
}
}
]
}
};
}

// ===== 搭配卡 =====
function comboCarousel(){
return {
type:"flex",
altText:"搭配",
contents:{
type:"carousel",
contents:[
combo("快速恢復","膏+飲"),
combo("日常穩定","龜鹿膏"),
combo("料理用","龜鹿湯塊")
]
}
};
}

function combo(title, product){
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
label:"我要這個",
text:`我要購買👇
商品：${product}
數量：1
配送：7-11`
}
}
]
}
};
}

// ===== CRM =====
async function saveOrder(data){
await axios.post(CRM_URL,{
action:"order",
...data
});
}

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

app.listen(3000);
