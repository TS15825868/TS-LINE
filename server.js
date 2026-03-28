"use strict";

const line = require("@line/bot-sdk");
const express = require("express");
const fs = require("fs");
const path = require("path");

const config = {
  channelAccessToken: process.env.CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.CHANNEL_SECRET
};

if (!config.channelAccessToken || !config.channelSecret) {
  console.warn("Missing CHANNEL_ACCESS_TOKEN or CHANNEL_SECRET in environment variables.");
}

const client = new line.Client(config);
const app = express();
const CRM_URL = process.env.CRM_URL || "";
const DATA = JSON.parse(fs.readFileSync(path.join(__dirname, "products.json"), "utf8"));
const LINE_URL = DATA.lineUrl || "https://lin.ee/sHZW7NkR";
const users = Object.create(null);

const PRODUCT_ALIASES = {
  "龜鹿膏": ["龜鹿膏", "膏"],
  "龜鹿飲": ["龜鹿飲", "飲", "30cc", "30 cc"],
  "龜鹿湯塊": ["龜鹿湯塊", "湯塊", "湯包"],
  "鹿茸粉": ["鹿茸粉", "鹿茸", "粉"]
};
const PRODUCT_MAP = Object.fromEntries(DATA.products.map(p => [p.name, p]));

app.get("/", (req, res) => res.send("TS-LINE bot is running."));
app.post("/webhook", line.middleware(config), async (req, res) => {
  try {
    await Promise.all(req.body.events.map(handleEvent));
    res.sendStatus(200);
  } catch (err) {
    console.error(err);
    res.sendStatus(500);
  }
});

async function handleEvent(event) {
  if (event.type !== "message" || event.message.type !== "text") return null;
  const userId = event.source.userId || "anonymous";
  const msg = normalize(event.message.text || "");
  const state = getUserState(userId);
  state.history.push(msg);

  if (handleCancel(state, msg)) {
    return replyText(event.replyToken, "已取消目前流程。你可以直接輸入產品名稱，或輸入「幫我推薦」。");
  }
  if (state.order.step) return continueOrder(event, state, msg);

  const product = detectProduct(msg);
  const intent = detectIntent(msg);

  if (intent === "recommend") {
    state.lastProduct = null;
    return replyText(event.replyToken, buildRecommendText());
  }
  if (intent === "faq") return replyText(event.replyToken, buildFaqText());
  if (intent === "contact") return replyText(event.replyToken, `可以直接加官方 LINE：${DATA.lineId}\n${LINE_URL}`);

  if (intent === "order") {
    const orderProduct = product || state.lastProduct;
    if (!orderProduct) return replyText(event.replyToken, "你想下單哪一個呢？\n可直接輸入：龜鹿膏／龜鹿飲／龜鹿湯塊／鹿茸粉");
    startOrder(state, orderProduct.name);
    return replyText(event.replyToken, `好的，我幫你登記 ${orderProduct.name}。\n請先回覆收件姓名。`);
  }

  if (product && (intent === "spec" || intent === "usage" || intent === "ingredients" || intent === "detail")) {
    state.lastProduct = product;
    return replyText(event.replyToken, buildProductDetail(product, intent));
  }
  if (product) {
    state.lastProduct = product;
    return replyText(event.replyToken, buildProductSummary(product));
  }
  if ((intent === "spec" || intent === "usage" || intent === "ingredients") && state.lastProduct) {
    return replyText(event.replyToken, buildProductDetail(state.lastProduct, intent));
  }
  if (msg.includes("影片")) {
    return replyText(event.replyToken, "官網影片頁已整理公開影片，可直接查看：\nhttps://ts15825868.github.io/xianjiawei/videos.html");
  }
  return replyText(event.replyToken, buildDefaultText());
}

function getUserState(userId) {
  if (!users[userId]) users[userId] = { history: [], lastProduct: null, order: { step: 0, product: "", name: "", phone: "", address: "" } };
  return users[userId];
}
function normalize(text) { return String(text).trim(); }
function handleCancel(state, msg) {
  if (["取消", "重來", "重新開始"].includes(msg)) {
    state.order = { step: 0, product: "", name: "", phone: "", address: "" };
    return true;
  }
  return false;
}
function detectIntent(msg) {
  if (/幫我推薦|推薦|怎麼選|選哪個|哪個適合/.test(msg)) return "recommend";
  if (/下單|訂購|我要|購買/.test(msg)) return "order";
  if (/規格|容量|幾g|幾cc|重量/.test(msg)) return "spec";
  if (/怎麼吃|怎麼用|使用|食用|喝法/.test(msg)) return "usage";
  if (/成分|內容物|原料/.test(msg)) return "ingredients";
  if (/FAQ|常見問題|問題/.test(msg)) return "faq";
  if (/聯絡|line|客服/.test(msg)) return "contact";
  return "detail";
}
function detectProduct(msg) {
  for (const [name, aliases] of Object.entries(PRODUCT_ALIASES)) {
    if (aliases.some(alias => msg.includes(alias))) return PRODUCT_MAP[name];
  }
  return null;
}
function buildRecommendText() {
  const lines = ["我幫你快速整理：", ""];
  for (const item of DATA.recommend) {
    lines.push(`・${item.keyword} → ${item.result}`);
    lines.push(`  ${item.desc}`);
  }
  lines.push("", "直接回產品名稱，我就整理規格與使用方式給你。", "也可以直接回：我要＋產品名稱");
  return lines.join("\n");
}
function buildFaqText() {
  return DATA.faqs.map(f => `Q：${f.q}\nA：${f.a}`).join("\n\n");
}
function buildProductSummary(product) {
  return `${product.name}\n規格：${product.size}\n${product.description}\n\n你可以直接再問我：\n・${product.name} 規格\n・${product.name} 使用方式\n・${product.name} 成分\n・我要${product.name}`;
}
function buildProductDetail(product, intent) {
  if (intent === "spec") return `${product.name} 的規格是 ${product.size}。`;
  if (intent === "ingredients") return `${product.name} 成分：\n${product.ingredients.join('、')}`;
  if (intent === "usage") return `${product.name} 使用方式：\n${product.usage.map(x => `・${x}`).join("\n")}`;
  return `${buildProductSummary(product)}\n\n成分：${product.ingredients.join('、')}`;
}
function buildDefaultText() {
  return "歡迎使用仙加味。\n\n你可以直接輸入：\n・龜鹿膏\n・龜鹿飲\n・龜鹿湯塊\n・鹿茸粉\n・幫我推薦\n・FAQ\n\n如果要下單，也可以直接輸入：我要龜鹿膏";
}
function startOrder(state, productName) {
  state.order = { step: 1, product: productName, name: "", phone: "", address: "" };
}
async function continueOrder(event, state, msg) {
  if (state.order.step === 1) {
    state.order.name = msg;
    state.order.step = 2;
    return replyText(event.replyToken, "收到。請回覆收件電話。");
  }
  if (state.order.step === 2) {
    state.order.phone = msg;
    state.order.step = 3;
    return replyText(event.replyToken, "收到。請回覆收件地址。");
  }
  if (state.order.step === 3) {
    state.order.address = msg;
    const order = { ...state.order, createdAt: new Date().toISOString() };
    state.order = { step: 0, product: "", name: "", phone: "", address: "" };
    await saveToCRM(order);
    return replyText(event.replyToken, `已收到你的資料。\n\n產品：${order.product}\n姓名：${order.name}\n電話：${order.phone}\n地址：${order.address}\n\n我們會再為你確認。`);
  }
  return replyText(event.replyToken, "請重新輸入一次，或輸入「取消」結束目前流程。");
}
async function saveToCRM(data) {
  if (!CRM_URL || typeof fetch !== "function") return;
  try {
    await fetch(CRM_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data)
    });
  } catch (e) {
    console.error("CRM error", e.message);
  }
}
function replyText(replyToken, text) {
  return client.replyMessage(replyToken, { type: "text", text });
}
const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`TS-LINE bot listening on ${port}`));
