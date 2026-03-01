const express = require('express');
const line = require('@line/bot-sdk');

const app = express();
app.use(express.json());

// 不使用 middleware 驗證
const client = new line.Client({
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
});

app.post('/webhook', async (req, res) => {
  console.log("Webhook hit!");
  console.log("Headers:", req.headers);

  const events = req.body.events;

  if (!events) {
    return res.status(200).send("No events");
  }

  for (const event of events) {
    if (event.type === 'message' && event.message.type === 'text') {
      await client.replyMessage(event.replyToken, {
        type: 'text',
        text: "測試成功",
      });
    }
  }

  res.status(200).send("OK");
});

app.get('/', (req, res) => {
  res.send('LINE Bot is running');
});

const PORT = process.env.PORT || 10000;

app.listen(PORT, () => {
  console.log(`LINE bot listening on port ${PORT}`);
});
