"use strict";

/**
 * LINE OA 入口試喝守門
 * - 一般從官網／FB／IG 進入 LINE OA 時，歡迎卡第一層直接顯示「申請試喝」。
 * - 不修改 Rich Menu 圖片、不更動產品價格或試喝規格。
 * - 僅調整「歡迎來到仙加味」卡片按鈕順序，避免顧客還要自己找試喝入口。
 */
const line = require("@line/bot-sdk");

const VERSION = "20260821-entry-trial-v1";
const WELCOME_PATTERN = /歡迎來到仙加味/;

function collectText(node, out = []) {
  if (!node || typeof node !== "object") return out;
  if (Array.isArray(node)) {
    for (const item of node) collectText(item, out);
    return out;
  }
  if (node.type === "text" && node.text) out.push(String(node.text));
  for (const [key, value] of Object.entries(node)) {
    if (key === "action" || /^xjw/i.test(key)) continue;
    collectText(value, out);
  }
  return out;
}

function trialButton() {
  return {
    type: "button",
    style: "primary",
    color: "#7B1E1E",
    action: { type: "message", label: "申請試喝", text: "申請試喝" },
  };
}

function normalizeWelcomeBubble(bubble) {
  if (!bubble || bubble.type !== "bubble") return bubble;
  const text = collectText([bubble.header, bubble.body].filter(Boolean)).join("\n");
  if (!WELCOME_PATTERN.test(text)) return bubble;
  const footer = bubble.footer;
  if (!footer || footer.layout !== "vertical" || !Array.isArray(footer.contents)) return bubble;

  const withoutTrial = footer.contents.filter((item) => !/申請試喝/.test(String(item?.action?.label || "")));
  for (const item of withoutTrial) {
    if (item?.type === "button") {
      item.style = "secondary";
      delete item.color;
    }
  }
  footer.contents = [trialButton(), ...withoutTrial].slice(0, 4);
  footer.spacing = "sm";
  return bubble;
}

function walk(node) {
  if (!node || typeof node !== "object") return node;
  if (Array.isArray(node)) {
    for (const item of node) walk(item);
    return node;
  }
  if (node.type === "bubble") normalizeWelcomeBubble(node);
  for (const [key, value] of Object.entries(node)) {
    if (key === "action" || /^xjw/i.test(key)) continue;
    walk(value);
  }
  return node;
}

const Client = line?.messagingApi?.MessagingApiClient;
if (Client?.prototype?.replyMessage && !Client.prototype.__xjwEntryTrialGuardInstalled) {
  const previous = Client.prototype.replyMessage;
  Client.prototype.replyMessage = function xjwEntryTrialReply(payload) {
    walk(payload?.messages);
    return previous.call(this, payload);
  };
  Object.defineProperty(Client.prototype, "__xjwEntryTrialGuardInstalled", { value: true, enumerable: false });
}

module.exports = { VERSION, WELCOME_PATTERN, normalizeWelcomeBubble, walk };
