"use strict";

/**
 * LINE OA 圖片政策 v401.2
 * - 產品卡僅保留官網真實產品原圖。
 * - 移除「小老闆介紹產品」多產品拼湊卡。
 * - 歡迎、推薦、使用方式、FAQ、客服與品牌故事可保留一張獨立小老闆情境圖。
 * - 搭配組合與購物車目前缺少符合標準的獨立圖，維持乾淨文字卡。
 * - 不重畫產品包裝，不使用九宮格、截圖或舊圖拼貼。
 */

const line = require("@line/bot-sdk");

const originalReplyMessage = line.Client.prototype.replyMessage;
const PRESERVE_MASCOT_TITLES = /歡迎|幫你選|推薦|怎麼選|使用方式|怎麼使用|常見問題|FAQ|客服服務|人工客服|品牌故事|品牌傳承/;
const REMOVE_MASCOT_TITLES = /小老闆介紹產品|產品介紹|價格方案|搭配|組合|購物車|購買清單/;

function collectText(node, output = []) {
  if (!node || typeof node !== "object") return output;
  if (node.type === "text" && typeof node.text === "string") output.push(node.text);
  if (Array.isArray(node)) {
    for (const item of node) collectText(item, output);
  } else {
    for (const value of Object.values(node)) collectText(value, output);
  }
  return output;
}

function bubbleTitle(bubble) {
  return collectText(bubble?.body || {}).join("\n");
}

function isRealProductHero(hero) {
  const url = String(hero?.url || "");
  return /\/xianjiawei\/images\/products-v3\//.test(url);
}

function isMascotHero(hero) {
  const url = String(hero?.url || "");
  return /\/mascot\//.test(url) || /TS-LINE\/main\/public\/mascot\//.test(url);
}

function cleanBubble(bubble) {
  if (!bubble || bubble.type !== "bubble") return bubble;

  const title = bubbleTitle(bubble);
  if (bubble.hero && !isRealProductHero(bubble.hero)) {
    const mascot = isMascotHero(bubble.hero);
    const keepApprovedSingleScene = mascot && PRESERVE_MASCOT_TITLES.test(title);
    const removeMissingOrNoncompliant = mascot && REMOVE_MASCOT_TITLES.test(title);

    if (removeMissingOrNoncompliant && !keepApprovedSingleScene) {
      delete bubble.hero;
    }
  }

  return bubble;
}

function isProductIntroCollage(bubble) {
  if (!bubble || bubble.type !== "bubble") return false;
  const title = bubbleTitle(bubble);
  return /小老闆介紹產品/.test(title) && isMascotHero(bubble.hero);
}

function cleanFlexMessage(message) {
  if (!message || message.type !== "flex" || !message.contents) return message;

  if (message.contents.type === "carousel" && Array.isArray(message.contents.contents)) {
    message.contents.contents = message.contents.contents
      .filter((bubble) => !isProductIntroCollage(bubble))
      .map(cleanBubble);
  } else if (message.contents.type === "bubble") {
    cleanBubble(message.contents);
  }

  return message;
}

function cleanOutgoingMessages(messages) {
  const list = Array.isArray(messages) ? messages : [messages];
  const cleaned = list.map((message) => cleanFlexMessage(message));
  return Array.isArray(messages) ? cleaned : cleaned[0];
}

line.Client.prototype.replyMessage = function patchedReplyMessage(replyToken, messages, notificationDisabled) {
  return originalReplyMessage.call(this, replyToken, cleanOutgoingMessages(messages), notificationDisabled);
};

module.exports = {
  cleanOutgoingMessages,
  cleanFlexMessage,
  cleanBubble,
};
