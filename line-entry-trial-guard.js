"use strict";

/**
 * LINE OA 入口試喝守門 v2
 * - 新好友 Webhook 歡迎卡第一層固定為：申請試喝／看產品／幫我推薦。
 * - 優先以 Flex altText「歡迎來到仙加味」辨識，不再只依賴 bubble 內文。
 * - 不修改 Rich Menu、不更動產品價格、產品圖或試喝規格。
 * - 歡迎卡只保留 3 顆核心按鈕，避免卡片被額外入口拉長。
 */
const line = require("@line/bot-sdk");

const VERSION = "20260822-entry-trial-v2";
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

function button(label, text, primary = false) {
  return {
    type: "button",
    style: primary ? "primary" : "secondary",
    ...(primary ? { color: "#7B1E1E" } : {}),
    action: { type: "message", label, text },
  };
}

function welcomeButtons() {
  return [
    button("申請試喝", "申請試喝", true),
    button("看產品", "看產品"),
    button("幫我推薦", "幫我推薦"),
  ];
}

function normalizeWelcomeBubble(bubble, force = false) {
  if (!bubble || bubble.type !== "bubble") return bubble;
  const text = collectText([bubble.header, bubble.body].filter(Boolean)).join("\n");
  if (!force && !WELCOME_PATTERN.test(text)) return bubble;

  if (!bubble.footer || bubble.footer.type !== "box") {
    bubble.footer = { type: "box", layout: "vertical", spacing: "sm", contents: [] };
  }
  bubble.footer.layout = "vertical";
  bubble.footer.spacing = "sm";
  bubble.footer.contents = welcomeButtons();
  return bubble;
}

function normalizeWelcomeMessage(message) {
  if (!message || typeof message !== "object") return message;
  if (message.type === "flex" && WELCOME_PATTERN.test(String(message.altText || ""))) {
    const contents = message.contents;
    if (contents?.type === "bubble") normalizeWelcomeBubble(contents, true);
  }
  return message;
}

function walk(node) {
  if (!node || typeof node !== "object") return node;
  if (Array.isArray(node)) {
    for (const item of node) walk(item);
    return node;
  }
  normalizeWelcomeMessage(node);
  if (node.type === "bubble") normalizeWelcomeBubble(node);
  for (const [key, value] of Object.entries(node)) {
    if (key === "action" || /^xjw/i.test(key)) continue;
    walk(value);
  }
  return node;
}

const Client = line?.messagingApi?.MessagingApiClient;
if (Client?.prototype?.replyMessage && !Client.prototype.__xjwEntryTrialGuardInstalledV2) {
  const previous = Client.prototype.replyMessage;
  Client.prototype.replyMessage = function xjwEntryTrialReplyV2(payload) {
    walk(payload?.messages);
    return previous.call(this, payload);
  };
  Object.defineProperty(Client.prototype, "__xjwEntryTrialGuardInstalledV2", { value: true, enumerable: false });
}

module.exports = {
  VERSION,
  WELCOME_PATTERN,
  collectText,
  button,
  welcomeButtons,
  normalizeWelcomeBubble,
  normalizeWelcomeMessage,
  walk,
};
