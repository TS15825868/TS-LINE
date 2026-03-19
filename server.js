"use strict";

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
.then(result => res.json(result));
});

async function handleEvent(event){

if(event.type !== 'message') return;

const text = event.message.text;

// ===== 智能分流 =====
if(text.includes("保養")){
return reply(event,"建議：龜鹿膏（日常）");
}

if(text.includes("累")){
return reply(event,"建議：膏＋飲搭配");
}

if(text.includes("煮")){
return reply(event,"建議：龜鹿湯塊");
}

if(text.includes("買") || text.includes("下單")){
return reply(event,`
請提供👇

1. 商品
2. 數量
3. 姓名
4. 電話
5. 配送方式
`);
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
{type:'text',text:'請選擇👇',weight:'bold'},
btn("日常保養"),
btn("最近比較累"),
btn("料理搭配"),
btn("直接購買")
]
}
}
});
}

function reply(event,text){
return client.replyMessage(event.replyToken,{
type:'text',
text:text
});
}

function btn(label){
return {
type:'button',
action:{type:'message',label:label,text:label}
};
}

app.listen(3000);
