"use strict";

/**
 * LINE OA image safety layer.
 *
 * The current recommend/usage mascot images are known collage drafts and are not
 * approved for production. Remove those hero images at send time regardless of
 * whether Render starts through npm or directly with `node server.js`.
 */

const line = require("@line/bot-sdk");

const BLOCKED_MASCOT_ASSETS = [
  "/mascot/recommend.jpg",
  "/mascot/usage.jpg",
];

function isBlockedMascotUrl(value) {
  const url = String(value || "");
  return BLOCKED_MASCOT_ASSETS.some((asset) => url.includes(asset));
}

function removeBlockedHeroes(node) {
  if (!node || typeof node !== "object") return node;

  if (Array.isArray(node)) {
    for (const item of node) removeBlockedHeroes(item);
    return node;
  }

  if (node.type === "bubble" && node.hero?.type === "image" && isBlockedMascotUrl(node.hero.url)) {
    delete node.hero;
  }

  for (const value of Object.values(node)) removeBlockedHeroes(value);
  return node;
}

const Client = line?.messagingApi?.MessagingApiClient;
if (Client?.prototype?.replyMessage && !Client.prototype.__xjwImageSafetyInstalled) {
  const originalReplyMessage = Client.prototype.replyMessage;

  Client.prototype.replyMessage = function patchedReplyMessage(payload) {
    removeBlockedHeroes(payload?.messages);
    return originalReplyMessage.call(this, payload);
  };

  Object.defineProperty(Client.prototype, "__xjwImageSafetyInstalled", {
    value: true,
    enumerable: false,
  });
}

module.exports = {
  BLOCKED_MASCOT_ASSETS,
  isBlockedMascotUrl,
  removeBlockedHeroes,
};
