const express = require('express');
const line = require('@line/bot-sdk');

const app = express();

const config = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET,
};

app.post('/webhook',
  line.middleware(config),
  async (req, res) => {
    try {
      const events = req.body.events;

      await Promise.all(events.map(async (event) => {
        if (event.type === 'message' && event.message.type === 'text') {
          await new line.Client(config).replyMessage(event.replyToken, {
            type: 'text',
            text: '正式版運作正常',
          });
        }
      }));

      res.status(200).end();
    } catch (err) {
      console.error(err);
      res.status(500).end();
    }
  }
);

app.get('/', (req, res) => res.send('OK'));

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`LINE bot listening on port ${PORT}`));
