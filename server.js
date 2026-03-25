"use strict";

const line = require("@line/bot-sdk");
const express = require("express");
const fetch = require("node-fetch");

const config = {
  channelAccessToken: process.env.CHANNEL_ACCESS_TOKEN || "IKjy0y2zfPOhMCp7xiJ4R4z7UkkvzoQgj7A6OH1AJjdMYpDnEzaicgz2HWy4pVz1KMSsUHzhoHoXZVztRQwibp3Q8UPfN+Dp4pBfT2k3Mzu5bBtdO1P78Cpffq+75liFPLL3ftcHMzvzr+WOgm6AEgdB04t89/1O/w1cDnyilFU=",
  channelSecret: process.env.CHANNEL_SECRET || "7c3c4740afa5a281d54afb9f8ffc1e96"
};

const app = express();
const client = new line.Client(config);

const CRM_URL = process.env.CRM_URL || "https://script.google.com/macros/s/AKfycbwAFBxeROd2ZYGJ_h0O7_H2MMxptOMoj3EXIErZpbKuTYFOzOVwQkrk8X1MoxapkHVGSA/exec";

const userOrders = {};
const lastMessage = {};

app.post("/webhook", line.middleware(config), async (req, res) => {
  await Promise.all(req.body.events.map(handleEvent));
  res.sendStatus(200);
});

async function handleEvent(event) {
  if (event.type !== "message") return;

  const userId = event.source.userId;
  const text = event.message.text.trim();

  // ===== 防重複 =====
  if (lastMessage[userId] === text) return;
  lastMessage[userId] = text;

  // ===== 基本指令 =====
  if (text.includes("看產品")) {
    return reply(event, "👉 請直接說產品名稱\n例如：龜鹿膏");
  }

  if (text.includes("我要買")) {
    return reply(event, "👉 請輸入：商品＋數量\n例如：龜鹿膏2");
  }

  // ===== 訂單解析 =====
  if (text.match(/龜鹿|鹿茸/)) {
    const match = text.match(/(龜鹿膏|龜鹿飲|龜鹿湯塊|鹿茸粉)(\d+)/);

    if (!match) {
      return reply(event, "請輸入正確格式，例如：龜鹿膏2");
    }

    const product = match[1];
    const qty = match[2];

    userOrders[userId] = {
      product,
      qty,
    };

    return reply(event, "請輸入姓名");
  }

  if (userOrders[userId] && !userOrders[userId].name) {
    userOrders[userId].name = text;
    return reply(event, "請輸入電話");
  }

  if (userOrders[userId] && !userOrders[userId].phone) {
    userOrders[userId].phone = text;
    return reply(event, "請輸入地址");
  }

  if (userOrders[userId] && !userOrders[userId].address) {
    userOrders[userId].address = text;

    // ===== 取得LINE名稱 =====
    const profile = await client.getProfile(userId);
    userOrders[userId].lineName = profile.displayName;

    // ===== 寫入Sheet =====
    await sendToSheet(userId, userOrders[userId]);

    // ===== 通知你 =====
    await notifyBoss(userOrders[userId]);

    delete userOrders[userId];

    return reply(event, "✅ 已收到訂單，我們會與你確認🙂");
  }

  return reply(event, "請輸入：看產品 / 我要買");
}

function reply(event, text) {
  return client.replyMessage(event.replyToken, {
    type: "text",
    text,
  });
}

// ===== 傳到Google Sheet =====
async function sendToSheet(userId, data) {
  await fetch(CRM_URL, {
    method: "POST",
    body: JSON.stringify({
      action: "order",
      userId,
      ...data,
    }),
  });
}

// ===== 通知你 =====
async function notifyBoss(order) {
  const bossId = "👉這裡換成你的U開頭ID";

  await client.pushMessage(bossId, {
    type: "text",
    text: `
🔥 新訂單

LINE：${order.lineName}
商品：${order.product}
數量：${order.qty}

姓名：${order.name}
電話：${order.phone}
地址：${order.address}
    `,
  });
}

app.listen(3000);
