require('dotenv').config();
const express = require('express');
const line = require('@line/bot-sdk');
const { faq, buyWords, dangerWords } = require('./config');

const app = express();

const client = new line.Client({
  channelAccessToken: process.env.CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.CHANNEL_SECRET
});

app.post('/webhook',
  line.middleware({ channelSecret: process.env.CHANNEL_SECRET }),
  async (req, res) => {
    const event = req.body.events[0];
    if (!event || event.type !== 'message') return res.sendStatus(200);
    const text = event.message.text;

    if (dangerWords.some(w => text.includes(w))) {
      return client.replyMessage(event.replyToken, {
        type: 'text',
        text: '這部分我幫您轉請專人協助🙂'
      });
    }

    if (buyWords.some(w => text.includes(w))) {
      return client.replyMessage(event.replyToken, {
        type: 'text',
        text: '好的，我幫您轉專人處理🙂'
      });
    }

    for (const item of faq) {
      if (item.keywords.some(w => text.includes(w))) {
        return client.replyMessage(event.replyToken, {
          type: 'text',
          text: item.reply
        });
      }
    }

    res.sendStatus(200);
  }
);

app.listen(3000);
