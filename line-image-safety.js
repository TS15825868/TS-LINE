"use strict";

/**
 * LINE OA image safety.
 *
 * Approved independent artwork is enabled for recommend, combo, usage and faq.
 * Remaining damaged or retired mascot scenes stay blocked until replaced.
 * Product cards continue to use real product photos only.
 */
const line = require("@line/bot-sdk");

const LEGACY_MASCOT_PATH = "/public/mascot/";
const LEGACY_MASCOT_NAMES = [
  "welcome.jpg",
  "service.jpg",
  "brand.jpg",
  "products.jpg",
  "cart.jpg",
];

const BLOCKED_MASCOT_ASSETS = [LEGACY_MASCOT_PATH, ...LEGACY_MASCOT_NAMES];
const MASCOT_RULES = [];

function isBlockedMascotUrl(value) {
  const url = String(value || "");
  if (!url) return false;
  if (["recommend.jpg", "combo.jpg", "usage.jpg", "faq.jpg"].some((name) => url.includes(`/mascot/${name}`))) {
    return false;
  }
  return BLOCKED_MASCOT_ASSETS.some((asset) => url.includes(asset));
}

function applyImageSafety(node) {
  if (!node || typeof node !== "object") return node;

  if (Array.isArray(node)) {
    for (const item of node) applyImageSafety(item);
    return node;
  }

  if (node.type === "bubble" && node.hero?.type === "image" && isBlockedMascotUrl(node.hero.url)) {
    delete node.hero;
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
  BLOCKED_MASCOT_ASSETS,
  MASCOT_RULES,
  isBlockedMascotUrl,
  applyImageSafety,
};
