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

const PRODUCT_MAP = Object.fromEntries(DATA.products.map(p => [p.name, p]));
const PRODUCT_ALIASES = {
  "龜鹿膏": ["龜鹿膏", "膏"],
  "龜鹿飲": ["龜鹿飲", "飲", "30cc", "30 cc"],
  "龜鹿湯塊": ["龜鹿湯塊", "湯塊", "湯包"],
  "鹿茸粉": ["鹿茸粉", "鹿茸", "粉"]
};
const SENSITIVE_RE = /(懷孕|孕婦|哺乳|高血壓|糖尿病|心臟|腎臟|肝|癌|化療|慢性病|過敏|體質|適不適合|能不能吃|中藥|西藥|服藥|吃藥|藥物|手術|月經|經期|感冒|發燒|兒童|小孩|寶寶|老人|長輩|失眠|睡不著|副作用|禁忌|醫師|醫生|診斷)/;

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
  const userId = event.source.userId || "anonymous";
  const state = getUserState(userId);

  if (event.type === "follow") {
    return replyText(event.replyToken, DATA.welcomeText || buildDefaultText());
  }

  if (event.type !== "message" || event.message.type !== "text") return null;
  const raw = String(event.message.text || "").trim();
  const msg = normalize(raw);
  state.history.push(msg);

  if (handleCancel(state, msg)) {
    return replyText(event.replyToken, "已取消目前流程。你可以直接輸入產品名稱，或輸入「幫我推薦」。");
  }
  if (SENSITIVE_RE.test(raw)) {
    return replyText(event.replyToken, DATA.doctorReferral);
  }
  if (state.order.step) return continueOrder(event, state, raw);

  const product = detectProduct(msg);
  const intent = detectIntent(msg);

  if (intent === "welcome") return replyText(event.replyToken, DATA.welcomeText || buildDefaultText());
  if (intent === "recommend") {
    state.lastProduct = null;
    return replyText(event.replyToken, buildRecommendText());
  }
  if (intent === "faq") return replyText(event.replyToken, buildFaqText());
  if (intent === "contact") return replyText(event.replyToken, `可以直接加官方 LINE：${DATA.lineId}\n${LINE_URL}`);
  if (intent === "price") {
    if (product) {
      state.lastProduct = product;
      return replyText(event.replyToken, `${product.name}\n規格：${product.size}\n建議售價：$${product.price}`);
    }
    return replyText(event.replyToken, buildPriceText());
  }
  if (intent === "combo") return replyText(event.replyToken, buildComboText());
  if (intent === "payment") return replyText(event.replyToken, buildPaymentText());
  if (intent === "shipping") return replyText(event.replyToken, buildShippingText());

  if (intent === "order") {
    const orderProduct = product || state.lastProduct;
    if (!orderProduct) return replyText(event.replyToken, "你想下單哪一個呢？\n可直接輸入：龜鹿膏／龜鹿飲／龜鹿湯塊／鹿茸粉");
    startOrder(state, orderProduct.name);
    return replyText(event.replyToken, `好的，我幫你登記 ${orderProduct.name}。\n請先回覆收件姓名。`);
  }

  if (product && ["spec", "usage", "ingredients", "detail"].includes(intent)) {
    state.lastProduct = product;
    return replyText(event.replyToken, buildProductDetail(product, intent));
  }
  if (product) {
    state.lastProduct = product;
    return replyText(event.replyToken, buildProductSummary(product));
  }
  if (["spec", "usage", "ingredients"].includes(intent) && state.lastProduct) {
    return replyText(event.replyToken, buildProductDetail(state.lastProduct, intent));
  }
  if (msg.includes("影片")) {
    return replyText(event.replyToken, "官網影片頁已整理公開影片，可直接查看：\nhttps://ts15825868.github.io/xianjiawei/videos.html");
  }
  return replyText(event.replyToken, buildDefaultText());
}

function getUserState(userId) {
  if (!users[userId]) users[userId] = { history: [], lastProduct: null, order: { step: 0, product: "", name: "", phone: "", address: "", payment: "", shipping: "" } };
  return users[userId];
}
function normalize(text) { return String(text).trim().toLowerCase().replace(/\s+/g, ""); }
function handleCancel(state, msg) {
  if (["取消", "重來", "重新開始"].includes(msg)) {
    state.order = { step: 0, product: "", name: "", phone: "", address: "", payment: "", shipping: "" };
    return true;
  }
  return false;
}
function detectIntent(msg) {
  if (/(歡迎|你好|hi|hello)/.test(msg)) return "welcome";
  if (/(幫我推薦|推薦|怎麼選|選哪個|哪個適合)/.test(msg)) return "recommend";
  if (/(下單|訂購|我要買|購買|我要訂)/.test(msg)) return "order";
  if (/(規格|容量|幾g|幾cc|重量)/.test(msg)) return "spec";
  if (/(怎麼吃|怎麼用|使用|食用|喝法)/.test(msg)) return "usage";
  if (/(成分|內容物|原料)/.test(msg)) return "ingredients";
  if (/(價格|價錢|售價|多少錢|費用)/.test(msg)) return "price";
  if (/(組合|搭配組|套組|組合價)/.test(msg)) return "combo";
  if (/(付款|匯款|貨到付款|付款方式)/.test(msg)) return "payment";
  if (/(宅配|賣貨便|7-11|711|超商|配送|運送|寄送|親送|雙北)/.test(msg)) return "shipping";
  if (/(faq|常見問題|問題)/.test(msg)) return "faq";
  if (/(聯絡|line|客服)/.test(msg)) return "contact";
  return "detail";
}
function detectProduct(msg) {
  for (const [name, aliases] of Object.entries(PRODUCT_ALIASES)) {
    if (aliases.some(alias => msg.includes(alias.toLowerCase().replace(/\s+/g, "")))) return PRODUCT_MAP[name];
  }
  return null;
}
function money(n) { return `$${Number(n).toLocaleString("en-US")}`; }
function buildRecommendText() {
  const lines = ["我幫你快速整理：", ""];
  for (const item of DATA.recommend) {
    lines.push(`・${item.keyword} → ${item.result}`);
    lines.push(`  ${item.desc}`);
  }
  lines.push("", "也可以直接問我：價格／組合／付款方式／配送方式", "如果你想下單，可直接輸入：我要買＋產品名稱");
  return lines.join("\n");
}
function buildFaqText() {
  return DATA.faqs.map(f => `Q：${f.q}\nA：${f.a}`).join("\n\n");
}
function buildPriceText() {
  const lines = ["建議售價如下：", ""];
  for (const p of DATA.products) {
    lines.push(`・${p.name}`);
    lines.push(`  規格：${p.size}`);
    lines.push(`  建議售價：${money(p.price)}`);
  }
  return lines.join("\n");
}
function buildComboText() {
  const lines = ["目前可參考這幾種搭配方向：", ""];
  for (const combo of DATA.combos || []) {
    lines.push(`【${combo.name}】`);
    lines.push(`內容：${combo.items.join("＋")}`);
    lines.push(combo.desc);
    lines.push("");
  }
  lines.push("若你想要我依你的使用方式幫你挑組合，也可以直接輸入：幫我推薦");
  return lines.join("\n").trim();
}
function buildPaymentText() {
  return `付款方式目前可安排：\n・${DATA.payments.join("\n・")}\n\n若要直接下單，可先告訴我想買的品項與數量。`;
}
function buildShippingText() {
  const lines = ["配送方式目前可安排：", ...DATA.shipping.map(x => `・${x}`), ""];
  if (DATA.shippingNotes) {
    Object.entries(DATA.shippingNotes).forEach(([k, v]) => {
      lines.push(`${k}：${v}`);
    });
  }
  return lines.join("\n");
}
function buildProductSummary(product) {
  return `${product.name}\n規格：${product.size}\n建議售價：${money(product.price)}\n${product.description}\n\n你可以直接再問我：\n・${product.name} 規格\n・${product.name} 使用方式\n・${product.name} 成分\n・${product.name} 價格\n・我要買${product.name}`;
}
function buildProductDetail(product, intent) {
  if (intent === "spec") return `${product.name} 的規格是 ${product.size}。`;
  if (intent === "ingredients") return `${product.name} 成分：\n${product.ingredients.join("、")}`;
  if (intent === "usage") return `${product.name} 使用方式：\n${product.usage.map(x => `・${x}`).join("\n")}`;
  return `${buildProductSummary(product)}\n\n成分：${product.ingredients.join("、")}`;
}
function buildDefaultText() {
  return DATA.welcomeText || "歡迎使用仙加味。";
}
function startOrder(state, productName) {
  state.order = { step: 1, product: productName, name: "", phone: "", address: "", payment: "", shipping: "" };
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
    state.order.step = 4;
    return replyText(event.replyToken, "收到。請回覆付款方式：匯款／貨到付款");
  }
  if (state.order.step === 4) {
    state.order.payment = msg;
    state.order.step = 5;
    return replyText(event.replyToken, "收到。請回覆配送方式：宅配／7-11賣貨便／雙北親送");
  }
  if (state.order.step === 5) {
    state.order.shipping = msg;
    const order = { ...state.order, createdAt: new Date().toISOString() };
    state.order = { step: 0, product: "", name: "", phone: "", address: "", payment: "", shipping: "" };
    await saveToCRM(order);
    return replyText(event.replyToken, `已收到你的資料。\n\n產品：${order.product}\n姓名：${order.name}\n電話：${order.phone}\n地址：${order.address}\n付款：${order.payment}\n配送：${order.shipping}\n\n我們會再為你確認。`);
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
