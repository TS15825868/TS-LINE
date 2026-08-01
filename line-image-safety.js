"use strict";

/**
 * LINE OA image safety and Issue #146 scene routing.
 * Approved purpose-specific scenes are injected at reply time so Render and
 * LINE caches always receive the current independent 1200×1200 artwork.
 * Product-card hero images are never replaced.
 */
const line = require("@line/bot-sdk");

const VERSION = "401.7-20260801-issue146";
const BASE = "https://raw.githubusercontent.com/TS15825868/TS-LINE/main/public/mascot";
const APPROVED_MASCOT_NAMES = ["recommend", "combo", "usage", "faq"];
const LEGACY_MASCOT_NAMES = ["welcome.jpg", "service.jpg", "brand.jpg", "products.jpg", "cart.jpg"];
const BLOCKED_MASCOT_ASSETS = [...LEGACY_MASCOT_NAMES];
const MASCOT_RULES = APPROVED_MASCOT_NAMES.map((name) => ({
  name,
  url: `${BASE}/${name}.jpg?v=${VERSION}`,
}));

function approvedUrl(name) {
  return `${BASE}/${name}.jpg?v=${VERSION}`;
}

function isBlockedMascotUrl(value) {
  const url = String(value || "");
  if (!url) return false;
  if (APPROVED_MASCOT_NAMES.some((name) => url.includes(`/mascot/${name}.jpg`))) return false;
  return BLOCKED_MASCOT_ASSETS.some((asset) => url.includes(asset));
}

function bubbleTitle(bubble) {
  const contents = bubble?.body?.contents;
  if (!Array.isArray(contents)) return "";
  const title = contents.find((item) => item?.type === "text" && item?.weight === "bold");
  return String(title?.text || "");
}

function sceneForTitle(title) {
  if (/常見問題|FAQ/.test(title)) return "faq";
  if (/搭配|組合/.test(title)) return "combo";
  if (/使用|沖泡|燉湯|料理/.test(title)) return "usage";
  if (/推薦|幫你選|怎麼選|產品差異/.test(title)) return "recommend";
  return "";
}

function approvedHero(scene) {
  return {
    type: "image",
    url: approvedUrl(scene),
    size: "full",
    aspectRatio: "1:1",
    aspectMode: "cover",
  };
}

function applyImageSafety(node) {
  if (!node || typeof node !== "object") return node;

  if (Array.isArray(node)) {
    for (const item of node) applyImageSafety(item);
    return node;
  }

  if (node.type === "bubble") {
    const scene = sceneForTitle(bubbleTitle(node));
    if (scene) {
      node.hero = approvedHero(scene);
    } else if (node.hero?.type === "image" && isBlockedMascotUrl(node.hero.url)) {
      delete node.hero;
    }
  }

  for (const value of Object.values(node)) applyImageSafety(value);
  return node;
}

const Client = line?.messagingApi?.MessagingApiClient;
if (Client?.prototype?.replyMessage && !Client.prototype.__xjwImageSafetyInstalled) {
  const originalReplyMessage = Client.prototype.replyMessage;

  Client.prototype.replyMessage = function patchedReplyMessage(payload) {
    applyImageSafety(payload?.messages);
    return originalReplyMessage.call(this, payload);
  };

  Object.defineProperty(Client.prototype, "__xjwImageSafetyInstalled", {
    value: true,
    enumerable: false,
  });
}

module.exports = {
  VERSION,
  APPROVED_MASCOT_NAMES,
  BLOCKED_MASCOT_ASSETS,
  MASCOT_RULES,
  approvedUrl,
  isBlockedMascotUrl,
  sceneForTitle,
  applyImageSafety,
};
