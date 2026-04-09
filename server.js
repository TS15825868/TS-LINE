"use strict";

const line = require("@line/bot-sdk");
const express = require("express");
const fs = require("fs");
const path = require("path");

const config = {
  channelAccessToken: process.env.CHANNEL_ACCESS_TOKEN || "IKjy0y2zfPOhMCp7xiJ4R4z7UkkvzoQgj7A6OH1AJjdMYpDnEzaicgz2HWy4pVz1KMSsUHzhoHoXZVztRQwibp3Q8UPfN+Dp4pBfT2k3Mzu5bBtdO1P78Cpffq+75liFPLL3ftcHMzvzr+WOgm6AEgdB04t89/1O/w1cDnyilFU=",
  channelSecret: process.env.CHANNEL_SECRET || "7c3c4740afa5a281d54afb9f8ffc1e96",
};

if (!config.channelAccessToken || !config.channelSecret) {
  console.warn("Missing CHANNEL_ACCESS_TOKEN or CHANNEL_SECRET in environment variables.");
}

const client = new line.Client(config);
const app = express();

const CRM_URL =
  process.env.CRM_URL ||
  "https://script.google.com/macros/s/AKfycbwAFBxeROd2ZYGJ_h0O7_H2MMxptOMoj3EXIErZpbKuTYFOzOVwQkrk8X1MoxapkHVGSA/exec";

const DATA = JSON.parse(
  fs.readFileSync(path.join(__dirname, "products.json"), "utf8")
);

const users = {};

// =======================
// webhook
// =======================
app.post("/webhook", line.middleware(config), async (req, res) => {
  try {
    await Promise.all(req.body.events.map((e) => handleEvent(e)));
    res.sendStatus(200);
  } catch (err) {
    console.error(err);
    res.sendStatus(500);
  }
});

// =======================
// 主流程
// =======================
async function handleEvent(event) {
  if (event.type !== "message" && event.type !== "follow") return;

  const userId = event.source.userId || "anon";
  if (!users[userId]) {
    users[userId] = {
      order: {},
      lastProduct: null,
      welcomed: false,
    };
  }

  const state = users[userId];

  // =====================
  // 初次進入（保證一定出）
  // =====================
  if (event.type === "follow" || !state.welcomed) {
    state.welcomed = true;
    return client.replyMessage(event.replyToken, buildWelcome());
  }

  if (event.message.type !== "text") return;

  const msg = event.message.text;

  // =====================
  // 敏感轉醫師
  // =====================
  if (/(懷孕|高血壓|糖尿病|吃藥|體質|副作用)/.test(msg)) {
    return client.replyMessage(event.replyToken, {
      type: "text",
      text: DATA.doctorReferral,
    });
  }

  // =====================
  // 看產品
  // =====================
  if (msg.includes("產品")) {
    return client.replyMessage(event.replyToken, buildProducts());
  }

  // =====================
  // 推薦
  // =====================
  if (msg.includes("推薦")) {
    return client.replyMessage(event.replyToken, buildRecommend());
  }

  // =====================
  // 組合（成交核心）
  // =====================
  if (msg.includes("組合")) {
    return client.replyMessage(event.replyToken, buildCombo());
  }

  // =====================
  // 價格（只回單品）
  // =====================
  const product = DATA.products.find(p => msg.includes(p.name));
  if (msg.includes("價格") && product) {
    state.lastProduct = product;
    return client.replyMessage(event.replyToken, buildPrice(product));
  }

  // =====================
  // 殺價（轉成交）
  // =====================
  if (/(貴|便宜一點|優惠)/.test(msg)) {
    return client.replyMessage(event.replyToken, buildRetention(state.lastProduct));
  }

  // =====================
  // 下單
  // =====================
  if (msg.includes("買")) {
    return client.replyMessage(event.replyToken, buildOrder());
  }

  return client.replyMessage(event.replyToken, buildWelcome());
}

// =======================
// FLEX 卡片
// =======================

function buildWelcome() {
  return {
    type: "flex",
    altText: "歡迎",
    contents: {
      type: "bubble",
      body: {
        type: "box",
        layout: "vertical",
        contents: [
          { type: "text", text: "仙加味", weight: "bold", size: "xl" },
          { type: "text", text: "補養做得剛剛好", size: "sm" }
        ]
      },
      footer: {
        type: "box",
        layout: "vertical",
        contents: [
          btn("看產品"),
          btn("幫我推薦"),
          btn("看搭配組合"),
          btn("我要買")
        ]
      }
    }
  };
}

function buildProducts() {
  return {
    type: "flex",
    altText: "產品",
    contents: {
      type: "carousel",
      contents: DATA.products.map(p => ({
        type: "bubble",
        body: {
          type: "box",
          layout: "vertical",
          contents: [
            { type: "text", text: p.name, weight: "bold" },
            { type: "text", text: p.description, wrap: true, size: "sm" }
          ]
        },
        footer: {
          type: "box",
          layout: "vertical",
          contents: [
            btn("看價格", `${p.name} 價格`, "primary"),
            btn("我要買", `我要買 ${p.name}`)
          ]
        }
      }))
    }
  };
}

function buildPrice(p) {
  return {
    type: "flex",
    altText: "價格",
    contents: {
      type: "bubble",
      body: {
        type: "box",
        layout: "vertical",
        contents: [
          { type: "text", text: p.name, weight: "bold" },
          { type: "text", text: `規格：${p.size}` },
          { type: "text", text: `建議售價：$${p.price}` }
        ]
      },
      footer: {
        type: "box",
        layout: "vertical",
        contents: [
          btn("看搭配組合", "看搭配組合"),
          btn("我要買", `我要買 ${p.name}`)
        ]
      }
    }
  };
}

function buildCombo() {
  return {
    type: "flex",
    altText: "組合",
    contents: {
      type: "carousel",
      contents: DATA.offers.comboOffers.map(o => ({
        type: "bubble",
        body: {
          type: "box",
          layout: "vertical",
          contents: [
            { type: "text", text: o.name, weight: "bold" },
            { type: "text", text: o.items.join("＋"), size: "sm" },
            { type: "text", text: o.gift || "", size: "sm", color: "#D35400" }
          ]
        },
        footer: {
          type: "box",
          layout: "vertical",
          contents: [
            btn("我要這組", `我要買 ${o.name}`, "primary")
          ]
        }
      }))
    }
  };
}

function buildRetention(product) {
  return {
    type: "flex",
    altText: "優惠",
    contents: {
      type: "bubble",
      body: {
        type: "box",
        layout: "vertical",
        contents: [
          { type: "text", text: "如果在評估價格", weight: "bold" },
          { type: "text", text: "可以幫你安排比較好入手的方式🙂", wrap: true }
        ]
      },
      footer: {
        type: "box",
        layout: "vertical",
        contents: [
          btn("看搭配組合"),
          btn("我要買")
        ]
      }
    }
  };
}

function buildOrder() {
  return {
    type: "text",
    text: "請直接回覆：產品＋數量，我幫你安排🙂"
  };
}

function buildRecommend() {
  return {
    type: "text",
    text: "想固定 → 龜鹿膏\n想方便 → 龜鹿飲\n想料理 → 湯塊\n想自己配 → 鹿茸粉"
  };
}

// =======================
// 小工具
// =======================
function btn(label, text = label, style = "link") {
  return {
    type: "button",
    style,
    action: { type: "message", label, text }
  };
}

const port = process.env.PORT || 3000;
app.listen(port, () => console.log("LINE bot running"));
