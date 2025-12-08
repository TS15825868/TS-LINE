require('dotenv').config();
const express = require('express');
const line = require('@line/bot-sdk');
const { faq, buyWords, dangerWords } = require('./config');

const app = express();

// LINE client 設定
const client = new line.Client({
  channelAccessToken: process.env.CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.CHANNEL_SECRET
});

// Webhook（LINE 只會打這個路徑）
app.post(
  '/webhook',
  line.middleware({ channelSecret: process.env.CHANNEL_SECRET }),
  async (req, res) => {
    try {
      const event = req.body.events && req.body.events[0];
      if (!event || event.type !== 'message') {
        return res.sendStatus(200);
      }

      // 只處理文字訊息
      if (event.message.type !== 'text') {
        return res.sendStatus(200);
      }

      const text = event.message.text || '';

      // 1️⃣ 風險／法規詞 → 只轉人工
      if (dangerWords.some(w => text.includes(w))) {
        await client.replyMessage(event.replyToken, {
          type: 'text',
          text: '這部分我幫您轉請專人協助，請稍等一下🙂'
        });
        return res.sendStatus(200);
      }

      // 2️⃣ 想購買 → 轉人工
      if (buyWords.some(w => text.includes(w))) {
        await client.replyMessage(event.replyToken, {
          type: 'text',
          text: '好的🙂 我幫您轉請專人協助，請稍等一下。'
        });
        return res.sendStatus(200);
      }

      // 3️⃣ FAQ 比對
      for (const item of faq) {
        if (item.keywords.some(w => text.includes(w))) {
          await client.replyMessage(event.replyToken, {
            type: 'text',
            text: item.reply
          });
          return res.sendStatus(200);
        }
      }

      // 4️⃣ 其他訊息 → 不亂回
      return res.sendStatus(200);

    } catch (err) {
      console.error('Webhook error:', err);
      return res.sendStatus(200);
    }
  }
);

// ✅ Render 要用它指定的 PORT（非常重要）
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log('✅ LINE FAQ Bot running on port', PORT);
});
