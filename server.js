/**
 * LINE Bot Webhook - 完整可替換版 server.js
 * 功能：關鍵字自動回覆 + 預設防呆回覆
 *
 * 需要環境變數：
 * - CHANNEL_ACCESS_TOKEN
 * - CHANNEL_SECRET
 * - PORT (可選)
 *
 * 套件：
 * npm i express @line/bot-sdk
 */

"use strict";

const express = require("express");
const line = require("@line/bot-sdk");

const {
  CHANNEL_ACCESS_TOKEN,
  CHANNEL_SECRET,
  PORT = 3000,
} = process.env;

if (!CHANNEL_ACCESS_TOKEN || !CHANNEL_SECRET) {
  console.error("缺少環境變數：CHANNEL_ACCESS_TOKEN 或 CHANNEL_SECRET");
  process.exit(1);
}

const config = {
  channelAccessToken: CHANNEL_ACCESS_TOKEN,
  channelSecret: CHANNEL_SECRET,
};

const app = express();
const client = new line.Client(config);

/** ============ 回覆模板（繁體中文，防黏字） ============ */

const REPLY_WELCOME = [
  "您好，歡迎您 😊",
  "這裡是【仙加味・龜鹿】官方帳號",
  "",
  "請輸入下列關鍵字，我會為您說明👇",
  "",
  "1️⃣ 有什麼產品",
  "2️⃣ 龜鹿膏怎麼吃",
  "3️⃣ 龜鹿飲怎麼喝",
  "",
  "也可以直接留言您的需求，",
  "我們將由專人為您回覆。",
].join("\n");

const REPLY_PRODUCTS = [
  "目前主要產品如下👇",
  "",
  "▪️ 龜鹿膏",
  "▪️ 龜鹿飲",
  "▪️ 龜鹿湯塊",
  "▪️ 鹿茸粉",
  "",
  "如想了解食用方式，請輸入👇",
  "「龜鹿膏怎麼吃」",
  "或",
  "「龜鹿飲怎麼喝」",
  "",
  "也可直接告訴我們您的需求，",
  "由專人為您建議。",
].join("\n");

const REPLY_GEL = [
  "【龜鹿膏 食用方式】",
  "",
  "▪️ 建議早上或空腹前後食用",
  "▪️ 一天一次，一小匙（初次可先半匙）",
  "▪️ 可用熱水化開後搭配溫水",
  "▪️ 或直接食用",
  "▪️ 食用期間避免冰飲",
  "",
  "如有特殊狀況或想更了解，",
  "可直接留言，我們會協助說明。",
].join("\n");

const REPLY_DRINK = [
  "【龜鹿飲 飲用方式】",
  "",
  "▪️ 每日一包",
  "▪️ 可隔水加熱或溫熱飲用",
  "▪️ 建議早上或白天飲用",
  "▪️ 飲用期間避免冰飲",
  "",
  "如想搭配其他產品，或詢問適合對象，",
  "歡迎直接留言諮詢。",
].join("\n");

const REPLY_FALLBACK = [
  "不好意思，可能沒有完全理解您的意思 😊",
  "您可以試試輸入👇",
  "",
  "▪️ 有什麼產品",
  "▪️ 龜鹿膏怎麼吃",
  "▪️ 龜鹿飲怎麼喝",
  "",
  "或直接留言您的需求，",
  "我們將由專人回覆您。",
].join("\n");

/** ============ 關鍵字規則 ============ */

// 入口（Rich Menu 建議送這些字）
const TRIGGERS_WELCOME = new Set(["諮詢", "LINE諮詢", "產品"]);
const TRIGGERS_PRODUCTS = new Set(["有什麼產品"]);
const TRIGGERS_GEL = new Set(["龜鹿膏怎麼吃"]);
const TRIGGERS_DRINK = new Set(["龜鹿飲怎麼喝"]);

/** 清理文字：去前後空白、把全形空白/多空白收斂 */
function normalizeText(s) {
  return String(s)
    .replace(/\u3000/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** 核心：依輸入決定回覆內容 */
function pickReply(text) {
  const t = normalizeText(text);

  if (TRIGGERS_PRODUCTS.has(t)) return REPLY_PRODUCTS;
  if (TRIGGERS_GEL.has(t)) return REPLY_GEL;
  if (TRIGGERS_DRINK.has(t)) return REPLY_DRINK;
  if (TRIGGERS_WELCOME.has(t)) return REPLY_WELCOME;

  // 你也可以放一些「模糊命中」
  // 例如使用者打「龜鹿膏」就導去食用方式
  if (t.includes("龜鹿膏")) return REPLY_GEL;
  if (t.includes("龜鹿飲")) return REPLY_DRINK;
  if (t.includes("產品")) return REPLY_PRODUCTS;

  return REPLY_FALLBACK;
}

/** ============ Webhook 路由 ============ */

app.get("/", (req, res) => {
  res.status(200).send("OK");
});

app.post("/webhook", line.middleware(config), async (req, res) => {
  try {
    const events = req.body.events || [];
    await Promise.all(events.map(handleEvent));
    res.status(200).end();
  } catch (err) {
    console.error("Webhook error:", err);
    res.status(500).end();
  }
});

async function handleEvent(event) {
  // 只處理文字訊息
  if (event.type !== "message") return null;
  if (!event.message || event.message.type !== "text") return null;

  const userText = event.message.text || "";
  const replyText = pickReply(userText);

  return client.replyMessage(event.replyToken, {
    type: "text",
    text: replyText,
  });
}

/** ============ 啟動 ============ */

app.listen(PORT, () => {
  console.log(`LINE bot webhook listening on port ${PORT}`);
});
