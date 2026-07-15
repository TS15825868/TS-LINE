"use strict";

/**
 * LINE OA approved mascot-image routing.
 *
 * Product cards keep the real product photographs from the website catalog.
 * Only service and guidance cards are assigned purpose-specific mascot scenes.
 */
const line = require("@line/bot-sdk");

const ASSET_VERSION = "20260715-lineoa-4";
const RAW_BASE = "https://raw.githubusercontent.com/TS15825868/TS-LINE/main/public/mascot";
const approvedAssetUrl = (name) => `${RAW_BASE}/${name}.jpg?v=${ASSET_VERSION}`;

const BLOCKED_MASCOT_ASSETS = [];

const MASCOT_RULES = [
  { pattern: /搭配組合|搭配方案|日常搭配導覽/, asset: "combo" },
  { pattern: /幫我推薦|依日常使用方式幫你選|怎麼選|推薦/, asset: "recommend" },
  { pattern: /怎麼使用|使用方式|日常節奏安排|沖泡|燉湯|料理/, asset: "usage" },
  { pattern: /常見問題|FAQ|小老闆幫你整理/, asset: "faq" },
  { pattern: /品牌故事|四代傳承|仙加味的故事|漢方百科|古籍資料/, asset: "brand" },
  { pattern: /客服|聯絡|確認|訂單|結帳|購物車|門市/, asset: "service" },
  { pattern: /歡迎來到仙加味|歡迎/, asset: "welcome" },
];

function isBlockedMascotUrl(value) {
  const url = String(value || "");
  return BLOCKED_MASCOT_ASSETS.some((asset) => url.includes(asset));
}

function bubbleTitle(node) {
  const bodyContents = node?.body?.contents;
  if (!Array.isArray(bodyContents)) return "";

  const preferred = bodyContents.find(
    (item) => item?.type === "text" && item?.text && (item?.weight === "bold" || item?.size === "xl")
  );
  const fallback = bodyContents.find((item) => item?.type === "text" && item?.text);
  return String(preferred?.text || fallback?.text || "");
}

function approvedImageForTitle(title = "") {
  const rule = MASCOT_RULES.find(({ pattern }) => pattern.test(String(title || "")));
  return rule ? approvedAssetUrl(rule.asset) : "";
}

function installApprovedHero(node) {
  if (node?.type !== "bubble") return;
  const imageUrl = approvedImageForTitle(bubbleTitle(node));
  if (!imageUrl) return;

  const previousAction = node.hero?.action;
  node.hero = {
    type: "image",
    url: imageUrl,
    size: "full",
    aspectRatio: "1:1",
    aspectMode: "fit",
    backgroundColor: "#F7F4ED",
    action: previousAction || {
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
  MASCOT_RULES,
  isBlockedMascotUrl,
  approvedImageForTitle,
  applyImageSafety,
};
