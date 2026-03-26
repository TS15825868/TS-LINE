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

const userState = {};
const lastMessage = {};

// ===== 主入口 =====
app.post("/webhook", line.middleware(config), async (req, res) => {
  await Promise.all(req.body.events.map(handleEvent));
  res.sendStatus(200);
});

async function handleEvent(event) {
  if (event.type !== "message") return;

  const userId = event.source.userId;
  const text = event.message.text.trim();

  if (lastMessage[userId] === text) return;
  lastMessage[userId] = text;

  if (!userState[userId]) userState[userId] = {};

  // ===== 推薦系統入口 =====
  if (["1","2","3"].includes(text)) {
    const comboMap = {
      "1": "龜鹿飲 + 龜鹿湯塊",
      "2": "龜鹿膏 + 龜鹿飲",
      "3": "鹿茸粉 + 龜鹿膏"
    };

    userState[userId].combo = comboMap[text];

    return reply(event, `
👉 建議搭配：
${comboMap[text]}

需要我幫你準備嗎？
（回：要 / 我要買）
    `);
  }

  // ===== 看產品 =====
  if (text.includes("看") || text.includes("產品")) {
    return reply(event, `
👉 目前有：

龜鹿膏
龜鹿飲
龜鹿湯塊
鹿茸粉

👉 直接輸入：
龜鹿膏2（商品＋數量）
    `);
  }

  // ===== 我要買 =====
  if (text.includes("要") || text.includes("買")) {
    return reply(event, "👉 請輸入：商品＋數量\n例如：龜鹿膏2");
  }

  // ===== 訂單解析（升級版）=====
  const productMatch = text.match(/(龜鹿膏|龜鹿飲|龜鹿湯塊|鹿茸粉)/);
  const qtyMatch = text.match(/\d+/);

  if (productMatch) {
    const product = productMatch[1];
    const qty = qtyMatch ? qtyMatch[0] : 1;

    userState[userId].order = {
      product,
      qty
    };

    return reply(event, "請輸入姓名");
  }

  // ===== 收單流程 =====
  if (userState[userId].order && !userState[userId].name) {
    userState[userId].name = text;
    return reply(event, "請輸入電話");
  }

  if (userState[userId].order && !userState[userId].phone) {
    userState[userId].phone = text;
    return reply(event, "請輸入地址");
  }

  if (userState[userId].order && !userState[userId].address) {
    userState[userId].address = text;

    const profile = await client.getProfile(userId);

    const orderData = {
      lineName: profile.displayName,
      product: userState[userId].order.product,
      qty: userState[userId].order.qty,
      name: userState[userId].name,
      phone: userState[userId].phone,
      address: userState[userId].address
    };

    // ===== 存Sheet =====
    await sendToSheet(userId, orderData);

    // ===== 通知你 =====
    await notifyBoss(orderData);

    delete userState[userId];

    return reply(event, `
✅ 已收到訂單

商品：${orderData.product}
數量：${orderData.qty}

我們會盡快與你確認 🙏
    `);
  }

  // ===== fallback =====
  return reply(event, `
我可以幫你👇

1️⃣ 幫你選適合的
2️⃣ 看產品
3️⃣ 直接購買

👉 回 1 / 2 / 3
  `);
}

// ===== 回覆 =====
function reply(event, text) {
  return client.replyMessage(event.replyToken, {
    type: "text",
    text,
  });
}

// ===== Google Sheet =====
async function sendToSheet(userId, data) {
  if (!CRM_URL) return;

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
  const bossId = "👉換成你的U開頭ID";

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
