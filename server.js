"use strict";

const express = require("express");
const line = require("@line/bot-sdk");
const crypto = require("crypto");

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

const userOrders = {};

/* =========================
   工具
========================= */

function money(n) {
  return "NT$" + Number(n).toLocaleString();
}

function generateOrderId() {
  return "TS" + Date.now().toString().slice(-8);
}

async function getProducts() {
  const res = await fetch(PRODUCTS_URL);
  return await res.json();
}

function isTaipei(address) {
  return address.includes("台北") || address.includes("新北");
}

/* =========================
   主選單
========================= */

function mainMenu() {
  return bubble("仙加味・龜鹿", [
    btn("產品介紹", "menu_products"),
    btn("我要購買", "menu_products"),
    btn("門市資訊", "menu_store"),
    btn("真人客服", "menu_human"),
  ]);
}

function btn(label, data) {
  return {
    type: "button",
    style: "primary",
    action: { type: "postback", label, data },
  };
}

function bubble(title, buttons) {
  return {
    type: "bubble",
    body: {
      type: "box",
      layout: "vertical",
      spacing: "lg",
      contents: [
        { type: "text", text: title, weight: "bold", size: "xl" },
        { type: "separator" },
        ...buttons,
      ],
    },
  };
}

function flex(replyToken, alt, contents) {
  return client.replyMessage(replyToken, {
    type: "flex",
    altText: alt,
    contents,
  });
}

/* =========================
   Webhook
========================= */

app.post("/webhook", line.middleware(config), async (req, res) => {
  await Promise.all(req.body.events.map(handleEvent));
  res.status(200).end();
});

async function handleEvent(event) {
  if (event.type === "postback") {
    return handlePostback(event);
  }

  if (event.type === "message") {
    const userId = event.source.userId;
    const order = userOrders[userId];

    if (order && !order.address) {
      order.address = event.message.text;

      const shippingType = isTaipei(order.address)
        ? "雙北親送"
        : "宅配";

      const shippingFee =
        shippingType === "雙北親送"
          ? order.subtotal >= 3000 ? 0 : 200
          : 150;

      const total = order.subtotal + shippingFee;

      order.shipping = shippingType;
      order.shippingFee = shippingFee;
      order.total = total;
      order.orderId = generateOrderId();

      return flex(event.replyToken, "訂單確認",
        bubble("訂單確認", [
          btn("訂單編號：" + order.orderId, "none"),
          btn("商品：" + order.productName, "none"),
          btn("數量：" + order.quantity, "none"),
          btn("小計：" + money(order.subtotal), "none"),
          btn("配送：" + shippingType, "none"),
          btn("運費：" + money(shippingFee), "none"),
          btn("總金額：" + money(total), "none"),
          btn("確認下單", "confirm_order"),
          btn("取消", "menu_main"),
        ])
      );
    }

    return flex(event.replyToken, "主選單", mainMenu());
  }
}

/* =========================
   Postback
========================= */

async function handlePostback(event) {
  const data = event.postback.data;
  const products = await getProducts();
  const userId = event.source.userId;

  if (data === "menu_products") {
    return flex(event.replyToken, "產品列表",
      bubble("選擇產品", [
        btn("龜鹿膏", "buy_gel_100g"),
        btn("龜鹿飲", "buy_drink_180cc"),
        btn("鹿茸粉", "buy_antler_75g"),
        btn("龜鹿湯塊 75g", "buy_soup_75"),
        btn("龜鹿湯塊 150g", "buy_soup_150"),
        btn("龜鹿湯塊 300g", "buy_soup_300"),
        btn("龜鹿湯塊 600g", "buy_soup_600"),
        btn("回主選單", "menu_main"),
      ])
    );
  }

  if (data.startsWith("buy_")) {
    const id = data.replace("buy_", "");
    const product = findProduct(products, id);

    userOrders[userId] = {
      productId: id,
      productName: product.name + " " + product.spec,
      price: product.price,
    };

    return flex(event.replyToken, "選擇數量",
      bubble("請選數量", [
        btn("1 件", "qty_1"),
        btn("2 件", "qty_2"),
        btn("3 件", "qty_3"),
        btn("5 件", "qty_5"),
      ])
    );
  }

  if (data.startsWith("qty_")) {
    const qty = parseInt(data.replace("qty_", ""));
    const order = userOrders[userId];

    order.quantity = qty;
    order.subtotal = order.price * qty;

    return client.replyMessage(event.replyToken, {
      type: "text",
      text: "請輸入完整地址"
    });
  }

  if (data === "confirm_order") {
    return client.replyMessage(event.replyToken, {
      type: "text",
      text: "訂單已成立，我們將盡快與您聯繫確認🙂"
    });
  }

  if (data === "menu_main") {
    return flex(event.replyToken, "主選單", mainMenu());
  }
}

function findProduct(products, id) {
  for (const c of products.categories) {
    for (const i of c.items) {
      if (i.id === id) {
        const price = i.discount ? i.msrp * i.discount : i.msrp;
        return { name: i.name, spec: i.spec, price };
      }
      if (i.variants) {
        for (const v of i.variants) {
          if (id.includes(v.spec)) {
            const price = v.discount ? v.msrp * v.discount : v.msrp;
            return { name: i.name, spec: v.spec, price };
          }
        }
      }
    }
  }
}

app.listen(PORT, () => {
  console.log("V5 電商版啟動成功");
});
