require('dotenv').config();
const express = require('express');
const line = require('@line/bot-sdk');
const { faq, buyWords, dangerWords } = require('./config');

const app = express();

const client = new line.Client({
  channelAccessToken: process.env.CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.CHANNEL_SECRET
});

// ✅ 統一的「醫療相關／是否適合吃」制式回覆
const MEDICAL_REPLY =
  '這部分會因每個人的身體狀況不同，\n' +
  '為了讓您得到更準確的說明與建議，\n' +
  '建議先由合作的中醫師了解您的情況🙂\n\n' +
  '✔ 專人一對一說明\n' +
  '✔ 可詢問適不適合食用\n' +
  '✔ 可詢問個人狀況與疑問\n\n' +
  '➤ Line ID：@changwuchi\n' +
  '➤ 章無忌中醫師諮詢連結：\n' +
  'https://lin.ee/1MK4NR9';

// Webhook 入口
app.post(
  '/webhook',
  line.middleware({ channelSecret: process.env.CHANNEL_SECRET }),
  async (req, res) => {
    try {
      const events = req.body.events || [];

      for (const event of events) {

        // ==========================
        // 新好友加入 → 首次導覽
        // ==========================
        if (event.type === 'follow') {
          await client.replyMessage(event.replyToken, {
            type: 'text',
            text:
              '您好，歡迎加入【仙加味・龜鹿】😊\n' +
              '我們是萬華在地、四代傳承的漢方補養店。\n\n' +
              '目前提供：\n' +
              '・龜鹿膏（100g／罐）\n' +
              '・龜鹿飲（180cc／包）\n\n' +
              '您可以直接輸入：\n' +
              '「有什麼產品」\n' +
              '「龜鹿膏怎麼吃」\n' +
              '「龜鹿飲怎麼喝」\n' +
              '「怎麼選」\n\n' +
              '如需購買，輸入「我要買」，會由專人協助🙂'
          });
          continue;
        }

        // 只處理文字訊息
        if (event.type !== 'message' || event.message.type !== 'text') {
          continue;
        }

        const text = (event.message.text || '').trim();

        // ==========================
        // 法規／醫療相關 → 統一轉中醫師
        // （只要包含 dangerWords 裡任一關鍵字）
        // ==========================
        if (dangerWords.some(w => text.includes(w))) {
          await client.replyMessage(event.replyToken, {
            type: 'text',
            text: MEDICAL_REPLY
          });
          continue;
        }

        // ==========================
        // 想購買 → 轉真人
        // ==========================
        if (buyWords.some(w => text.includes(w))) {
          await client.replyMessage(event.replyToken, {
            type: 'text',
            text: '好的，這部分我幫您轉由專人接手協助🙂 請稍等一下。'
          });
          continue;
        }

        // ==========================
        // FAQ 關鍵字比對
        // ==========================
        let matched = false;

        for (const item of faq) {
          if (item.keywords.some(w => text.includes(w))) {
            await client.replyMessage(event.replyToken, {
              type: 'text',
              text: item.reply
            });
            matched = true;
            break;
          }
        }

        if (matched) continue;

        // ==========================
        // 找不到 → 禮貌引導
        // ==========================
        await client.replyMessage(event.replyToken, {
          type: 'text',
          text:
            '我可能沒有完全理解您的意思🙂\n' +
            '您可以試試輸入：\n' +
            '「有什麼產品」或「龜鹿膏怎麼吃」、「龜鹿飲怎麼喝」。'
        });
      }

      res.sendStatus(200);
    } catch (err) {
      console.error('Webhook error:', err);
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
  console.log('✅ LINE Bot running on port', PORT);
});
