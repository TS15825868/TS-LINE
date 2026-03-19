const express = require('express');
const line = require('@line/bot-sdk');

const app = express();

const config = {
channelAccessToken: 'YOUR_TOKEN',
channelSecret: 'YOUR_SECRET'
};

const client = new line.Client(config);

app.post('/webhook', line.middleware(config), (req, res) => {
Promise.all(req.body.events.map(handleEvent))
.then((result) => res.json(result));
});

function handleEvent(event){

const text = event.message.text;

if(text.includes("保養")){
return client.replyMessage(event.replyToken,{
type:'text',
text:'建議：龜鹿膏 + 龜鹿飲'
});
}

if(text.includes("累")){
return client.replyMessage(event.replyToken,{
type:'text',
text:'建議：膏 + 飲一起'
});
}

return client.replyMessage(event.replyToken,{
type:'text',
text:'請選擇：平常保養 / 最近比較累'
});
}

app.listen(3000);
