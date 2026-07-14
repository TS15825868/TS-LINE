"use strict";

/**
 * LINE OA image safety and approved mascot-image routing.
 *
 * Approved production assets:
 * - public/mascot/recommend.jpg
 * - public/mascot/combo.jpg
 *
 * The old usage image remains blocked until its final approved replacement is
 * uploaded. This layer runs regardless of whether Render starts through npm or
 * directly with `node server.js`.
 */
const line = require("@line/bot-sdk");

const ASSET_VERSION = "20260714-approved-1";
const RAW_BASE = "https://raw.githubusercontent.com/TS15825868/TS-LINE/main/public/mascot";
const approvedAssetUrl = (name) => `${RAW_BASE}/${name}.jpg?v=${ASSET_VERSION}`;

const BLOCKED_MASCOT_ASSETS = [
  "/mascot/usage.jpg",
];

function isBlockedMascotUrl(value) {
  const url = String(value || "");
  return BLOCKED_MASCOT_ASSETS.some((asset) => url.includes(asset));
}

function bubbleTitle(node) {
  const bodyContents = node?.body?.contents;
  if (!Array.isArray(bodyContents)) return "";
  const title = bodyContents.find((item) => item?.type === "text" && item?.text);
  return String(title?.text || "");
}

function approvedImageForTitle(title = "") {
  if (/搭配組合|搭配方案|日常搭配導覽/.test(title)) return approvedAssetUrl("combo");
  if (/幫我推薦|依日常使用方式幫你選|怎麼選|推薦/.test(title)) return approvedAssetUrl("recommend");
  return "";
}

function installApprovedHero(node) {
  if (node?.type !== "bubble") return;
  const imageUrl = approvedImageForTitle(bubbleTitle(node));
  if (!imageUrl) return;

  node.hero = {
    type: "image",
    url: imageUrl,
    size: "full",
    aspectRatio: "4:3",
    aspectMode: "fit",
    backgroundColor: "#1D120A",
    action: {
      type: "uri",
      uri: "https://ts15825868.github.io/xianjiawei/",
    },
  };
}

function applyImageSafety(node) {
  if (!node || typeof node !== "object") return node;

  if (Array.isArray(node)) {
    for (const item of node) applyImageSafety(item);
    return node;
  }

  if (node.type === "bubble") {
    if (node.hero?.type === "image" && isBlockedMascotUrl(node.hero.url)) {
      delete node.hero;
    }
    installApprovedHero(node);
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
  isBlockedMascotUrl,
  approvedImageForTitle,
  applyImageSafety,
};
