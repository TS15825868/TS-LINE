"use strict";

/**
 * 2026-08-08 新錄影 LINE OA 畫面修正
 * - 六項產品卡送出前一律使用官網 products-v2 實際產品照片，不使用DM/海報版面。
 * - 「看產品DM」一律改成「看正式產品圖」，連結同一張實際產品照片。
 * - 怎麼選／使用方向卡片如 hero 空白或舊圖失效，固定補網站同款Q版小老闆乾淨圖。
 */
const line = require("@line/bot-sdk");

const VERSION = "20260808-recording-ui-v1";
const SITE_BASE = "https://ts15825868.github.io/xianjiawei/";
const PUBLIC_BASE_URL = String(process.env.PUBLIC_BASE_URL || process.env.RENDER_EXTERNAL_URL || "https://ts-line.onrender.com").replace(/\/$/, "");
const RECOMMEND_HERO = `${PUBLIC_BASE_URL}/assets/mascot-clean/recommend.jpg?v=${VERSION}`;

const PRODUCTS = Object.freeze({
  "guilu-drink-30": {
    patterns: [/龜鹿飲\s*30\s*cc/i, /30\s*cc.*(?:玻璃罐|小玻璃罐)/i],
    image: `${SITE_BASE}images/products-v2/guilu-drink-30.jpeg?v=${VERSION}`,
  },
  "guilu-drink-180": {
    patterns: [/龜鹿飲\s*180\s*cc/i, /180\s*cc.*鋁袋/i],
    image: `${SITE_BASE}images/products-v2/guilu-drink-180.jpeg?v=${VERSION}`,
  },
  "guilu-gao": {
    patterns: [/龜鹿膏/],
    image: `${SITE_BASE}images/products-v2/guilu-gao.jpeg?v=${VERSION}`,
  },
  "guilu-tangkuai": {
    patterns: [/龜鹿湯塊/],
    image: `${SITE_BASE}images/products-v2/guilu-tangkuai.jpeg?v=${VERSION}`,
  },
  "guilu-jiao": {
    patterns: [/龜鹿膠/],
    image: `${SITE_BASE}images/products-v2/guilu-jiao-open-new.jpg?v=${VERSION}`,
  },
  "luerong-fen": {
    patterns: [/鹿茸粉/],
    image: `${SITE_BASE}images/products-v2/luerong-fen.jpeg?v=${VERSION}`,
  },
});

const RECOMMEND_PATTERN = /怎麼選|幫你選|幫我推薦|產品差異|固定節奏|方便快速|沖泡[、，,\s]*燉湯|家庭使用|自己搭配|依日常|依生活|搭配方案|選擇適合|使用型態/;

function collectTexts(node, output = []) {
  if (!node || typeof node !== "object") return output;
  if (Array.isArray(node)) {
    for (const item of node) collectTexts(item, output);
    return output;
  }
  if (node.type === "text" && node.text) output.push(String(node.text));
  if (node.action && typeof node.action === "object") {
    if (node.action.label) output.push(String(node.action.label));
    if (node.action.text) output.push(String(node.action.text));
  }
  for (const [key, value] of Object.entries(node)) {
    if (key === "action") continue;
    collectTexts(value, output);
  }
  return output;
}

function uniqueProductKey(bubble) {
  const text = collectTexts(bubble, []).join("\n");
  const found = [];
  for (const [key, product] of Object.entries(PRODUCTS)) {
    if (product.patterns.some((pattern) => pattern.test(text))) found.push(key);
  }
  return found.length === 1 ? found[0] : "";
}

function productHero(key) {
  return {
    type: "image",
    url: PRODUCTS[key].image,
    size: "full",
    aspectRatio: "1:1",
    aspectMode: "fit",
    backgroundColor: "#EFE4D2",
  };
}

function rewriteProductImageActions(node, key) {
  if (!node || typeof node !== "object") return;
  if (Array.isArray(node)) {
    for (const item of node) rewriteProductImageActions(item, key);
    return;
  }
  if (node.action && typeof node.action === "object") {
    const label = String(node.action.label || "");
    if (/看產品DM|看正確產品圖|看正式產品圖|產品大圖/.test(label)) {
      node.action.label = "看正式產品圖";
      node.action.type = "uri";
      node.action.uri = PRODUCTS[key].image;
      delete node.action.text;
    }
  }
  for (const [name, value] of Object.entries(node)) {
    if (name === "action") continue;
    rewriteProductImageActions(value, key);
  }
}

function isRecommendationBubble(bubble) {
  return RECOMMEND_PATTERN.test(collectTexts(bubble, []).join("\n"));
}

function applyBubbleFix(bubble) {
  if (!bubble || bubble.type !== "bubble") return bubble;
  const key = uniqueProductKey(bubble);
  if (key) {
    const oldAction = bubble.hero?.action;
    bubble.hero = productHero(key);
    if (oldAction && oldAction.type === "uri" && oldAction.uri && !/\.(?:jpe?g|png|webp)(?:[?#]|$)/i.test(oldAction.uri)) {
      bubble.hero.action = oldAction;
    }
    rewriteProductImageActions(bubble, key);
    bubble.xjwProductPhoto = key;
    return bubble;
  }
  if (isRecommendationBubble(bubble)) {
    bubble.hero = {
      type: "image",
      url: RECOMMEND_HERO,
      size: "full",
      aspectRatio: "1:1",
      aspectMode: "fit",
      backgroundColor: "#EFE4D2",
    };
    bubble.xjwRecommendationHero = true;
  }
  return bubble;
}

function applyVisualFix(node) {
  if (!node || typeof node !== "object") return node;
  if (Array.isArray(node)) {
    for (const item of node) applyVisualFix(item);
    return node;
  }
  if (node.type === "bubble") applyBubbleFix(node);
  for (const value of Object.values(node)) applyVisualFix(value);
  return node;
}

const Client = line?.messagingApi?.MessagingApiClient;
if (Client?.prototype?.replyMessage && !Client.prototype.__xjwRecordingUiFixInstalled) {
  const previous = Client.prototype.replyMessage;
  Client.prototype.replyMessage = function patchedRecordingUiReply(payload) {
    applyVisualFix(payload?.messages);
    return previous.call(this, payload);
  };
  Object.defineProperty(Client.prototype, "__xjwRecordingUiFixInstalled", { value: true, enumerable: false });
}

module.exports = {
  VERSION,
  PRODUCTS,
  RECOMMEND_HERO,
  collectTexts,
  uniqueProductKey,
  productHero,
  rewriteProductImageActions,
  isRecommendationBubble,
  applyBubbleFix,
  applyVisualFix,
};
