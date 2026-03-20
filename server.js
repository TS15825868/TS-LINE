"use strict";

const express = require('express');
const line = require('@line/bot-sdk');
const axios = require('axios');

const app = express();

const config = {
channelAccessToken: 'IKjy0y2zfPOhMCp7xiJ4R4z7UkkvzoQgj7A6OH1AJjdMYpDnEzaicgz2HWy4pVz1KMSsUHzhoHoXZVztRQwibp3Q8UPfN+Dp4pBfT2k3Mzu5bBtdO1P78Cpffq+75liFPLL3ftcHMzvzr+WOgm6AEgdB04t89/1O/w1cDnyilFU=',
channelSecret: '7c3c4740afa5a281d54afb9f8ffc1e96'
};

const client = new line.Client(config);

const CRM_URL = 'https://script.google.com/macros/s/AKfycbwAFBxeROd2ZYGJ_h0O7_H2MMxptOMoj3EXIErZpbKuTYFOzOVwQkrk8X1MoxapkHVGSA/exec';

// ========================
// webhook
// ========================
app.post("/webhook", line.middleware(config), async (req, res) => {
  Promise.all(req.body.events.map(handleEvent));
  res.json({ success: true });
});

// ========================
// 主流程
// ========================
async function handleEvent(event) {

  // 🔥 加好友
  if (event.type === "follow") {
    return client.replyMessage(event.replyToken, welcomeMessage());
  }

  if (event.type !== "message" || event.message.type !== "text") {
    return null;
  }

  const msg = event.message.text;
  const userId = event.source.userId;

  // ========================
  // 🔥 VIP判斷
  // ========================
  const user = await getUser(userId);

  if (user && user.vip === "是") {
    return reply(event, flexVIP());
  }

  // ========================
  // 🔥 主分流
  // ========================
  if (msg === "日常保養") return reply(event, flexDaily());
  if (msg === "最近比較累") return reply(event, flexTired());
  if (msg === "想煮湯進補") return reply(event, flexCook());
  if (msg === "先了解看看") return reply(event, flexLearn());

  // ========================
  // 🔥 成交入口
  // ========================
  if (msg.includes("搭配") || msg.includes("推薦")) {
    return reply(event, flexDeal());
  }

  // ========================
  // 🔥 下單
  // ========================
  if (msg.includes("我要購買")) {

    const order = parseOrder(msg);

    await saveOrder({
      userId,
      ...order
    });

    return reply(event, {
      type: "text",
      text:
`🧾 已幫你登記

商品：${order.product}
數量：${order.qty}

👉 我這邊會幫你確認出貨 🙌`
    });
  }

  return null;
}

// ========================
// 💥 歡迎訊息
// ========================
function welcomeMessage() {
  return [
    {
      type: "text",
      text:
        "歡迎加入【仙加味・龜鹿】\n\n我們把補養變簡單一點，不用研究太多，直接用點的就好 👇"
    },
    {
      type: "text",
      text: "請選擇你的狀況",
      quickReply: {
        items: [
          quick("日常保養"),
          quick("最近比較累"),
          quick("想煮湯進補"),
          quick("先了解看看")
        ]
      }
    }
  ];
}

// ========================
// 💥 VIP
// ========================
function flexVIP() {
  return bubble("VIP專屬", "幫你直接配好最適合的", [
    btn("直接幫我配", "幫我做VIP搭配"),
    btn("我要回購", "我要回購"),
    btn("再看產品", "我要看產品")
  ]);
}

// ========================
// 💥 日常
// ========================
function flexDaily() {
  return bubble("日常保養", "建立固定補養節奏", [
    btn("龜鹿膏", "我想了解龜鹿膏"),
    btn("龜鹿飲", "我想了解龜鹿飲"),
    btn("幫我搭配", "幫我做日常搭配")
  ]);
}

// ========================
function flexTired() {
  return bubble("最近比較累", "適合加強補充", [
    btn("龜鹿飲（快速）", "我要快速補充"),
    btn("龜鹿膏（穩定）", "我要穩定補養"),
    btn("直接幫我配", "幫我搭配加強方案")
  ]);
}

// ========================
function flexCook() {
  return bubble("料理搭配", "適合燉湯進補", [
    btn("雞湯", "我要燉雞湯"),
    btn("排骨湯", "我要燉排骨"),
    btnUrl("看食譜", "https://ts15825868.github.io/xianjiawei/recipes.html")
  ]);
}

// ========================
function flexLearn() {
  return bubble("了解龜鹿", "先看看再決定", [
    btnUrl("產品介紹", "https://ts15825868.github.io/xianjiawei/"),
    btnUrl("怎麼選", "https://ts15825868.github.io/xianjiawei/choose.html"),
    btn("幫我推薦", "幫我推薦適合的")
  ]);
}

// ========================
function flexDeal() {
  return bubble("推薦搭配", "直接幫你配好", [
    btn("入門組合", "我要入門方案"),
    btn("日常組合", "我要日常方案"),
    btn("加強組合", "我要加強方案")
  ]);
}

// ========================
// 🧩 元件
// ========================
function bubble(title, text, buttons) {
  return {
    type: "flex",
    altText: title,
    contents: {
      type: "bubble",
      body: {
        type: "box",
        layout: "vertical",
        contents: [
          { type: "text", text: title, weight: "bold", size: "lg" },
          { type: "text", text: text, size: "sm", margin: "md" }
        ]
      },
      footer: {
        type: "box",
        layout: "vertical",
        contents: buttons
      }
    }
  };
}

function btn(label, text) {
  return {
    type: "button",
    action: {
      type: "message",
      label,
      text
    }
  };
}

function btnUrl(label, url) {
  return {
    type: "button",
    action: {
      type: "uri",
      label,
      uri: url
    }
  };
}

function quick(label) {
  return {
    type: "action",
    action: {
      type: "message",
      label,
      text: label
    }
  };
}

// ========================
// 💥 訂單解析
// ========================
function parseOrder(text){
  return {
    product: (text.match(/商品：(.*)/)||[])[1] || "",
    qty: (text.match(/數量：(.*)/)||[])[1] || 1
  };
}

// ========================
// 💥 CRM
// ========================
async function saveOrder(data){
  await axios.post(CRM_URL,{
    action:"order",
    ...data
  });
}

async function getUser(userId){
  try{
    const res = await axios.post(CRM_URL,{
      action:"getUser",
      userId
    });
    return JSON.parse(res.data);
  }catch{
    return null;
  }
}

// ========================
function reply(event, msg){
  return client.replyMessage(event.replyToken, msg);
}

app.listen(3000);
