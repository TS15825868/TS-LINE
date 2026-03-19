const express = require('express');
const line = require('@line/bot-sdk');

const app = express();

const config = {
channelAccessToken: 'IKjy0y2zfPOhMCp7xiJ4R4z7UkkvzoQgj7A6OH1AJjdMYpDnEzaicgz2HWy4pVz1KMSsUHzhoHoXZVztRQwibp3Q8UPfN+Dp4pBfT2k3Mzu5bBtdO1P78Cpffq+75liFPLL3ftcHMzvzr+WOgm6AEgdB04t89/1O/w1cDnyilFU=',
channelSecret: '7c3c4740afa5a281d54afb9f8ffc1e96'
};

const client = new line.Client(config);

app.post('/webhook', line.middleware(config), (req, res) => {
Promise.all(req.body.events.map(handleEvent))
.then((result) => res.json(result));
});

// ===== 主流程 =====
function handleEvent(event){

if(event.type !== 'message') return Promise.resolve(null);

const text = event.message.text;

// ===== 關鍵字分流 =====
if(text.includes("保養")){
return replyRecommend(event,"日常保養");
}

if(text.includes("累")){
return replyRecommend(event,"最近比較累");
}

if(text.includes("料理")){
return replyRecommend(event,"料理搭配");
}

if(text.includes("買") || text.includes("下單")){
return replyOrder(event);
}

// ===== 預設：顯示按鈕選單 =====
return replyMenu(event);

}

// ===== 按鈕選單（封頂）=====
function replyMenu(event){
return client.replyMessage(event.replyToken,{
type:'flex',
altText:'請選擇需求',
contents:{
type:'bubble',
body:{
type:'box',
layout:'vertical',
spacing:'md',
contents:[
{
type:'text',
text:'請選擇你的需求',
weight:'bold',
size:'lg'
},
btn("日常保養"),
btn("最近比較累"),
btn("料理搭配"),
btn("直接購買")
]
}
}
});
}

// ===== 推薦邏輯 =====
function replyRecommend(event,type){

let text="";

if(type==="日常保養"){
text = "建議：龜鹿膏（建立節奏）";
}

if(type==="最近比較累"){
text = "建議：龜鹿膏＋龜鹿飲搭配";
}

if(type==="料理搭配"){
text = "建議：龜鹿湯塊（燉湯使用）";
}

return client.replyMessage(event.replyToken,{
type:'flex',
altText:'推薦結果',
contents:{
type:'bubble',
body:{
type:'box',
layout:'vertical',
spacing:'md',
contents:[
{
type:'text',
text:text,
wrap:true
},
{
type:'button',
action:{
type:'uri',
label:'👉 直接詢問搭配',
uri:'https://lin.ee/sHZW7NkR'
}
},
{
type:'button',
action:{
type:'message',
label:'👉 直接下單',
text:'我要下單'
}
}
]
}
}
});
}

// ===== 下單流程 =====
function replyOrder(event){
return client.replyMessage(event.replyToken,{
type:'text',
text:
`請提供以下資料👇

1️⃣ 商品（例：龜鹿膏）
2️⃣ 數量
3️⃣ 收件姓名
4️⃣ 電話
5️⃣ 地址或7-11店號

我會幫你安排出貨`
});
}

// ===== 按鈕元件 =====
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
