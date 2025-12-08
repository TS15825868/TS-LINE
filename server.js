require('dotenv').config();
const express = require('express');
const line = require('@line/bot-sdk');
const { faq, buyWords, dangerWords } = require('./config');

const app = express();

// LINE client
const client = new line.Client({
  channelAccessToken: process.env.CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.CHANNEL_SECRET
});

// LINE Webhook
app.post(
  '/webhook',
  line.middleware({ channelSecret: process.env.CHANNEL_SECRET }),
  async (req, res) => {
    try {
      const event = req.body.events && req.body.events[0];
      if (!event || event.type !== 'message') {
        return res.sendStatus(200);
      }

      if (event.message.type !== 'text') {
        return res.sendStatus(200);
      }

      const text = event.message.text || '';

      // 1. 風險詞 → 只轉人工
      if (dangerWords.some(w => text.includes(w))) {
        await client.replyMessage(event.replyToken, {
          type: 'text',
          text: '這部分我幫您轉請專人協助，請稍等一下🙂'
        });
        return res.sendStatus(200);
      }

      // 2. 想購買 → 轉人工
      if (buyWords.some(w => text.includes(w))) {
        await client.replyMessage(event.replyToken, {
          type: 'text',
          text: '好的🙂 我幫您轉請專人協助，請稍等一下。'
        });
        return res.sendStatus(200);
      }

      // 3. FAQ
      for (const item of faq) {
        if (item.keywords.some(w => text.includes(w))) {
          await client.replyMessage(event.replyToken, {
            type: 'text',
            text: item.reply
          });
          return res.sendStatus(200);
        }
      }

      // 4. 其他訊息 → 不亂回
      return res.sendStatus(200);

    } catch (err) {
      console.error('Webhook error:', err);
      return res.sendStatus(200);
    }
  }
);

// Render 指定 PORT
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log('✅ LINE FAQ Bot running on port', PORT);
});
