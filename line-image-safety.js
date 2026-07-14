"use strict";

/**
 * LINE OA 圖片安全層
 *
 * 暫時阻擋尚未通過正式產品驗收的「拼湊式小老闆圖」，避免它們繼續出現在
 * 幫我推薦、怎麼使用、搭配組合等功能卡片中。正式圖片完成並上傳後，只需
 * 從 BLOCKED_MASCOT_ASSETS 移除對應檔名即可恢復顯示。
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
