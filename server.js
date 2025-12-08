require('dotenv').config();
const express = require('express');
const line = require('@line/bot-sdk');
const { faq, buyWords, dangerWords } = require('./config');

const app = express();

const client = new line.Client({
  channelAccessToken: process.env.CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.CHANNEL_SECRET
});

// Webhook
app.post(
  '/webhook',
  line.middleware({ channelSecret: process.env.CHANNEL_SECRET }),
  async (req, res) => {
    try {
      const event = req.body.events && req.body.events[0];
      if (!event) return res.sendStatus(200);

      // ✅ 新好友加入（首次導覽）
      if (event.type === 'follow') {
        await client.replyMessage(event.replyToken, {
          type: 'text',
          text:
            '您好，歡迎加入【台興山產・仙加味】😊\n' +
            '我們是萬華在地、四代傳承的漢方補養店。\n\n' +
            '目前提供：\n' +
            '・龜鹿膏\n' +
            '・龜鹿飲\n\n' +
            '您可以直接輸入：\n' +
            '「有什麼產品」\n' +
            '「龜鹿膏 怎麼吃」\n' +
            '「龜鹿飲 怎麼喝」\n' +
            '「怎麼選」\n\n' +
            '如需購買，輸入「我要買」即可轉由專人協助🙂'
        });
        return res.sendStatus(200);
      }

      // 只處理文字訊息
      if (event.type !== 'message' || event.message.type !== 'text') {
        return res.sendStatus(200);
      }

      const text = event.message.text;

      // ✅ 法規 / 敏感 → 真人
      if (dangerWords.some(w => text.includes(w))) {
        await client.replyMessage(event.replyToken, {
          type: 'text',
          text: '這部分會由專人協助您說明🙂 請稍等一下。'
        });
        return res.sendStatus(200);
      }

      // ✅ 想購買 → 真人
      if (buyWords.some(w => text.includes(w))) {
        await client.replyMessage(event.replyToken, {
          type: 'text',
          text: '好的，這部分我幫您轉由專人接手協助🙂 請稍等一下。'
        });
        return res.sendStatus(200);
      }

      // ✅ FAQ 比對
      for (const item of faq) {
        if (item.keywords.some(w => text.includes(w))) {
          await client.replyMessage(event.replyToken, {
            type: 'text',
            text: item.reply
          });
          return res.sendStatus(200);
        }
      }

      // ✅ 找不到 → 禮貌回覆
      await client.replyMessage(event.replyToken, {
        type: 'text',
        text: '我可能沒有完全理解您的意思🙂\n您可以試試輸入「有什麼產品」或「我要買」。'
      });

      res.sendStatus(200);

    } catch (err) {
      console.error(err);
      res.sendStatus(200);
    }
  }
);

// 健康檢查
app.get('/', (req, res) => {
  res.send('LINE Bot is running ✅');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on ${PORT}`);
});
