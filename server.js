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
