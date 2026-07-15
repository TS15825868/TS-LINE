"use strict";

/**
 * LINE OA image safety.
 *
 * The previous public/mascot JPG set was an older stitched/composited set and is
 * intentionally blocked. Product cards continue to use the real product photos.
 * Purpose-specific mascot scenes will only be re-enabled after the approved
 * independent LINE OA artwork files are installed.
 */
const line = require("@line/bot-sdk");

const LEGACY_MASCOT_PATH = "/public/mascot/";
const LEGACY_MASCOT_NAMES = [
  "welcome.jpg",
  "recommend.jpg",
  "combo.jpg",
  "usage.jpg",
  "faq.jpg",
  "service.jpg",
  "brand.jpg",
];

const BLOCKED_MASCOT_ASSETS = [LEGACY_MASCOT_PATH, ...LEGACY_MASCOT_NAMES];
const MASCOT_RULES = [];

function isBlockedMascotUrl(value) {
  const url = String(value || "");
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
