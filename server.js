"use strict";

const express = require("express");
const line = require("@line/bot-sdk");

const {
  LINE_CHANNEL_ACCESS_TOKEN,
  LINE_CHANNEL_SECRET,
  PRODUCTS_URL,
  PORT = 10000,
} = process.env;

const config = {
  channelAccessToken: LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: LINE_CHANNEL_SECRET,
};

const app = express();
const client = new line.Client(config);

/* =====================================================
   工具
===================================================== */

function money(n) {
  return "NT$" + Number(n).toLocaleString();
}

async function getProducts() {
  const res = await fetch(PRODUCTS_URL);
  return await res.json();
}

/* =====================================================
   主選單（老人模式）
===================================================== */

function mainMenu() {
  return {
    type: "bubble",
    body: {
      type: "box",
      layout: "vertical",
      spacing: "lg",
      contents: [
        { type: "text", text: "仙加味・龜鹿", weight: "bold", size: "xl" },
        { type: "separator" },
        button("產品介紹", "menu_products"),
        button("查看價格", "menu_prices"),
        button("我要購買", "menu_buy"),
        button("門市資訊", "menu_store"),
        button("真人客服", "menu_human"),
      ],
    },
  };
}

function button(label, data) {
  return {
    type: "button",
    style: "primary",
    action: {
      type: "postback",
      label,
      data,
    },
  };
}

/* =====================================================
   產品列表
===================================================== */

function productMenu() {
  return {
    type: "bubble",
    body: {
      type: "box",
      layout: "vertical",
      spacing: "md",
      contents: [
        { type: "text", text: "選擇產品", weight: "bold", size: "lg" },
        { type: "separator" },
        button("龜鹿膏", "product_gel"),
        button("龜鹿飲", "product_drink"),
        button("鹿茸粉", "product_antler"),
        button("龜鹿湯塊", "product_soup"),
        button("回主選單", "menu_main"),
      ],
    },
  };
}

/* =====================================================
   產品介紹卡
===================================================== */

function productCard(name, intro, nextData) {
  return {
    type: "bubble",
    body: {
      type: "box",
      layout: "vertical",
      spacing: "md",
      contents: [
        { type: "text", text: name, weight: "bold", size: "lg" },
        { type: "separator" },
        { type: "text", text: intro, wrap: true },
      ],
    },
    footer: {
      type: "box",
      layout: "vertical",
      spacing: "sm",
      contents: [
        button("看價格", nextData),
        button("我要買", "buy_" + nextData),
        button("回產品列表", "menu_products"),
      ],
    },
  };
}

/* =====================================================
   價格卡
===================================================== */

function priceCard(name, priceLines) {
  return {
    type: "bubble",
    body: {
      type: "box",
      layout: "vertical",
      spacing: "md",
      contents: [
        { type: "text", text: name + " 價格", weight: "bold", size: "lg" },
        { type: "separator" },
        ...priceLines.map(x => ({
          type: "text",
          text: x,
          wrap: true
        }))
      ],
    },
    footer: {
      type: "box",
      layout: "vertical",
      contents: [
        button("我要買", "menu_buy"),
        button("回主選單", "menu_main"),
      ],
    },
  };
}

/* =====================================================
   Webhook
===================================================== */

app.post("/webhook", line.middleware(config), async (req, res) => {
  await Promise.all(req.body.events.map(handleEvent));
  res.status(200).end();
});

async function handleEvent(event) {

  if (event.type === "postback") {
    return handlePostback(event);
  }

  if (event.type === "message" && event.message.type === "text") {
    return client.replyMessage(event.replyToken, {
      type: "flex",
      altText: "主選單",
      contents: mainMenu()
    });
  }
}

/* =====================================================
   Postback 處理
===================================================== */

async function handlePostback(event) {
  const data = event.postback.data;
  const products = await getProducts();

  if (data === "menu_main") {
    return client.replyMessage(event.replyToken, {
      type: "flex",
      altText: "主選單",
      contents: mainMenu()
    });
  }

  if (data === "menu_products") {
    return client.replyMessage(event.replyToken, {
      type: "flex",
      altText: "產品列表",
      contents: productMenu()
    });
  }

  if (data === "product_gel") {
    const gel = products.categories.find(c => c.id === "gel").items[0];
    return client.replyMessage(event.replyToken, {
      type: "flex",
      altText: "龜鹿膏",
      contents: productCard("龜鹿膏", gel.intro.join("\n"), "price_gel")
    });
  }

  if (data === "price_gel") {
    const gel = products.categories.find(c => c.id === "gel").items[0];
    const price = gel.discount ? gel.msrp * gel.discount : gel.msrp;
    return client.replyMessage(event.replyToken, {
      type: "flex",
      altText: "龜鹿膏價格",
      contents: priceCard("龜鹿膏", [
        "建議售價：" + money(gel.msrp),
        "活動價：" + money(price)
      ])
    });
  }

  if (data === "menu_store") {
    return client.replyMessage(event.replyToken, {
      type: "text",
      text: "門市地址：台北市萬華區西昌街52號\n電話：(02)2381-2990"
    });
  }

  if (data === "menu_human") {
    return client.replyMessage(event.replyToken, {
      type: "text",
      text: "已通知真人客服，請稍候🙂"
    });
  }

  return client.replyMessage(event.replyToken, {
    type: "flex",
    altText: "主選單",
    contents: mainMenu()
  });
}

app.listen(PORT, () => {
  console.log("V3 老人模式啟動成功");
});
