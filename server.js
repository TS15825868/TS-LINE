"use strict";

const express = require("express");
const line = require("@line/bot-sdk");

const config = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET
};

const client = new line.Client(config);
const app = express();

/* =========================
   敏感問題判斷
========================= */

function isSensitiveQuestion(text) {
  const keywords = [
    "懷孕","孕婦","高血壓","糖尿病",
    "心臟病","腎臟病","肝病",
    "癌症","化療","副作用",
    "治療","可以治","適不適合我",
    "吃藥","慢性病"
  ];
  return keywords.some(k => text.includes(k));
}

/* =========================
   中醫師轉接文字
========================= */

function doctorRedirect() {
  return {
    type: "text",
    text:
`這部分會因每個人的身體狀況不同，
為了讓您得到更準確的說明與建議，
建議先由合作的中醫師了解您的情況🙂

✔ 專人一對一說明
✔ 可詢問適不適合食用
✔ 可詢問個人狀況與疑問

➤ Line ID：@changwuchi
➤ 章無忌中醫師諮詢連結：
https://lin.ee/1MK4NR9`
  };
}

/* =========================
   主選單
========================= */

function mainMenu() {
  return {
    type: "template",
    altText: "主選單",
    template: {
      type: "buttons",
      title: "仙加味・龜鹿",
      text: "請選擇功能🙂",
      actions: [
        { type: "message", label: "產品介紹", text: "產品介紹" },
        { type: "message", label: "推薦組合", text: "推薦組合" },
        { type: "message", label: "飲食專區", text: "飲食專區" },
        { type: "message", label: "中醫師諮詢", text: "中醫師諮詢" }
      ]
    }
  };
}

/* =========================
   推薦組合
========================= */

function bundleMenu() {
  return {
    type: "template",
    altText: "推薦組合",
    template: {
      type: "buttons",
      title: "補養推薦組合",
      text: "直接選一種，我幫你說明🙂",
      actions: [
        { type: "message", label: "日常補養組", text: "組合 日常" },
        { type: "message", label: "加強搭配組", text: "組合 加強" },
        { type: "message", label: "長輩溫和組", text: "組合 長輩" }
      ]
    }
  };
}

function bundleReply(type) {
  if (type === "日常") {
    return {
      type:"text",
      text:
`【日常補養組】
✔ 龜鹿膏 1 罐
或
✔ 龜鹿飲 7 包

適合日常穩定補養🙂`
    };
  }

  if (type === "加強") {
    return {
      type:"text",
      text:
`【加強搭配組】
✔ 龜鹿膏 + 龜鹿飲
或
✔ 湯塊燉煮搭配

想要扎實補養者適合🙂`
    };
  }

  return {
    type:"text",
    text:
`【長輩溫和組】
✔ 龜鹿飲為主
✔ 少量膏搭配

溫和好入口🙂`
  };
}

/* =========================
   Webhook
========================= */

app.post("/webhook", line.middleware(config), async (req, res) => {
  try {
    const events = req.body.events;

    await Promise.all(events.map(async (event) => {
      if (event.type !== "message" || event.message.type !== "text") return;

      const text = event.message.text;

      if (isSensitiveQuestion(text)) {
        return client.replyMessage(event.replyToken, doctorRedirect());
      }

      if (text === "選單") {
        return client.replyMessage(event.replyToken, mainMenu());
      }

      if (text === "推薦組合") {
        return client.replyMessage(event.replyToken, bundleMenu());
      }

      if (text.startsWith("組合 ")) {
        const type = text.replace("組合 ","");
        return client.replyMessage(event.replyToken, bundleReply(type));
      }

      if (text === "中醫師諮詢") {
        return client.replyMessage(event.replyToken, doctorRedirect());
      }

      return client.replyMessage(event.replyToken, {
        type: "text",
        text: "您好🙂 回『選單』查看功能。"
      });
    }));

    res.sendStatus(200);

  } catch (err) {
    console.error(err);
    res.sendStatus(500);
  }
});

app.listen(process.env.PORT || 3000, () => {
  console.log("LINE Bot Running");
});
