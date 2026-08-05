"use strict";

const line = require("@line/bot-sdk");

const LEGACY_NOTICE = /(?:訂單資料與付款方式|資料及運費)確認後安排製作加工[，,；;\s]*製作加工約需\s*5\s*[～~〜－-]\s*7\s*個工作天[；;，,\s]*完成後才安排出貨[，,；;\s]*物流配送時間另計[。.]?/g;
const DRINK_PATTERN = /龜鹿飲|30\s*cc|180\s*cc/i;
const STOCK_PATTERN = /龜鹿膏|龜鹿湯塊|龜鹿膠|鹿茸粉/;

function kindFromText(value) {
  const text = String(value || "");
  const hasDrink = DRINK_PATTERN.test(text);
  const hasStock = STOCK_PATTERN.test(text);
  if (hasDrink && hasStock) return "mixed";
  if (hasDrink) return "drink";
  if (hasStock) return "stock";
  return "general";
}

function replacePlainTextNotice(text, core) {
  const value = String(text || "");
  LEGACY_NOTICE.lastIndex = 0;
  if (!LEGACY_NOTICE.test(value)) return value;
  LEGACY_NOTICE.lastIndex = 0;
  const kind = kindFromText(value);
  return value.replace(LEGACY_NOTICE, core.fulfillmentNotice(kind));
}

function patchMessages(messages, core) {
  const list = Array.isArray(messages) ? messages : [messages];
  for (const message of list) {
    if (!message || typeof message !== "object") continue;
    if (message.type === "text" && typeof message.text === "string") {
      message.text = replacePlainTextNotice(message.text, core);
    }
  }
  return messages;
}

function install(core) {
  const Client = line?.messagingApi?.MessagingApiClient;
  if (!Client?.prototype?.replyMessage || Client.prototype.__xjwPlainTextFulfillmentSafetyInstalled) return;
  const previous = Client.prototype.replyMessage;

  Client.prototype.replyMessage = function patchedPlainTextReply(payload) {
    patchMessages(payload?.messages, core);
    return previous.call(this, payload);
  };

  Object.defineProperty(Client.prototype, "__xjwPlainTextFulfillmentSafetyInstalled", {
    value: true,
    enumerable: false,
  });
}

module.exports = {
  kindFromText,
  replacePlainTextNotice,
  patchMessages,
  install,
};
