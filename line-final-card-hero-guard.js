"use strict";

/**
 * LINE OA 最終卡片 hero 防空白守門
 * - 針對推薦／搭配／使用類卡片，只在 hero 缺失時補上既有正式 LINE OA 橫式情境圖。
 * - 不覆蓋已正確辨識的正式產品圖、DM 或試喝圖。
 * - 修正實機錄影中「固定日常安排」卡片大片空白問題。
 */
const line = require("@line/bot-sdk");

const VERSION = "20260821-final-card-hero-no-blank-v1";
const SITE_BASE = "https://ts15825868.github.io/xianjiawei/";
const HEROES = Object.freeze({
  recommend: `${SITE_BASE}images/brand/line-oa/recommend.jpg?v=${VERSION}`,
  combo: `${SITE_BASE}images/brand/line-oa/combo.jpg?v=${VERSION}`,
  usage: `${SITE_BASE}images/brand/line-oa/usage.jpg?v=${VERSION}`,
});

const RECOMMEND_PATTERN = /固定日常安排|固定日常|固定安排|日常安排|依日常使用方式幫你選|依日常|幫我推薦|怎麼選|產品差異/;
const COMBO_PATTERN = /搭配組合|搭配方案|日常搭配導覽|完整體驗組|料理搭配/;
const USAGE_PATTERN = /產品使用方式導覽|怎麼使用|使用方式|沖泡方式|燉湯方式/;

function collectContentText(node, out = []) {
  if (!node || typeof node !== "object") return out;
  if (Array.isArray(node)) {
    for (const item of node) collectContentText(item, out);
    return out;
  }
  if (node.type === "text" && node.text) out.push(String(node.text));
  for (const [key, value] of Object.entries(node)) {
    if (key === "action" || /^xjw/i.test(key)) continue;
    collectContentText(value, out);
  }
  return out;
}

function landscapeHero(url) {
  return {
    type: "image",
    url,
    size: "full",
    aspectRatio: "4:3",
    aspectMode: "fit",
    backgroundColor: "#EFE4D2",
  };
}

function fillMissingHero(bubble) {
  if (!bubble || bubble.type !== "bubble" || bubble.hero) return bubble;
  const text = collectContentText([bubble.header, bubble.body].filter(Boolean), []).join("\n");
  if (COMBO_PATTERN.test(text)) bubble.hero = landscapeHero(HEROES.combo);
  else if (USAGE_PATTERN.test(text)) bubble.hero = landscapeHero(HEROES.usage);
  else if (RECOMMEND_PATTERN.test(text)) bubble.hero = landscapeHero(HEROES.recommend);
  return bubble;
}

function walk(node) {
  if (!node || typeof node !== "object") return node;
  if (Array.isArray(node)) {
    for (const item of node) walk(item);
    return node;
  }
  if (node.type === "bubble") fillMissingHero(node);
  for (const value of Object.values(node)) walk(value);
  return node;
}

const Client = line?.messagingApi?.MessagingApiClient;
if (Client?.prototype?.replyMessage && !Client.prototype.__xjwFinalCardHeroGuardInstalled) {
  const previous = Client.prototype.replyMessage;
  Client.prototype.replyMessage = function xjwFinalCardHeroReply(payload) {
    walk(payload?.messages);
    return previous.call(this, payload);
  };
  Object.defineProperty(Client.prototype, "__xjwFinalCardHeroGuardInstalled", { value: true, enumerable: false });
}

module.exports = { VERSION, HEROES, RECOMMEND_PATTERN, COMBO_PATTERN, USAGE_PATTERN, collectContentText, landscapeHero, fillMissingHero, walk };
