"use strict";

/**
 * LINE 最終訊息邊界修正：
 * 1. 龜鹿飲才顯示接單製作 5～7 個工作天。
 * 2. 龜鹿膏、龜鹿湯塊、龜鹿膠、鹿茸粉顯示預先備貨說明。
 * 3. 龜鹿湯塊固定列出 75g／300g／600g 三種正式規格，避免只顯示 75g。
 * 4. 未建立各規格獨立計價前，龜鹿湯塊不直接把 300g／600g 當成 75g 加入購物車。
 * 5. 每個 Flex bubble 獨立判斷，不讓龜鹿湯塊規則污染同一輪播的其他產品。
 */

const line = require("@line/bot-sdk");

const LEGACY_ALL_PRODUCT_NOTICE = "訂單資料與付款方式確認後安排製作加工，製作加工約需5～7個工作天；完成後才安排出貨，物流配送時間另計。";
const DRINK_NOTICE = "龜鹿飲為接單後安排製作加工；訂單資料與付款方式確認後，製作加工約需5～7個工作天，完成後才安排出貨，物流配送時間另計。";
const READY_STOCK_NOTICE = "本產品為預先製作備貨商品；訂單資料與付款方式確認後，依現貨狀況安排出貨，物流配送時間另計。";
const MIXED_NOTICE = "龜鹿飲接單後安排製作加工，約需5～7個工作天；其他產品依現貨狀況安排出貨，物流配送時間另計。";
const SOUP_VARIANTS = "正式規格：75g／盒｜8塊裝｜每塊約9.375g；300g／盒｜16塊裝｜每塊約18.75g；600g／盒｜32塊裝｜每塊約18.75g。";

const DRINK_MARKERS = ["龜鹿飲30cc", "龜鹿飲180cc", "30cc小玻璃罐", "180cc鋁袋"];
const READY_MARKERS = ["龜鹿膏", "龜鹿湯塊", "龜鹿膠", "鹿茸粉"];

function includesAny(text, markers) {
  return markers.some((marker) => text.includes(marker));
}

function noticeFor(text) {
  const hasDrink = includesAny(text, DRINK_MARKERS);
  const hasReady = includesAny(text, READY_MARKERS);
  if (hasDrink && hasReady) return MIXED_NOTICE;
  if (hasDrink) return DRINK_NOTICE;
  if (hasReady) return READY_STOCK_NOTICE;
  return MIXED_NOTICE;
}

function normalizeText(value, scopeText = "") {
  if (typeof value !== "string") return value;
  const context = `${scopeText}\n${value}`;
  let text = value.replaceAll(LEGACY_ALL_PRODUCT_NOTICE, noticeFor(context));

  if (context.includes("龜鹿湯塊") && !text.includes("300g／盒｜16塊裝")) {
    const specLine = "規格：75g／盒｜8塊裝｜每塊約9.375g";
    if (text.includes(specLine)) {
      text = text.replace(specLine, `${specLine}\n${SOUP_VARIANTS}`);
    } else if (/龜鹿湯塊/.test(text) && text.length < 4500) {
      text = `${text}\n${SOUP_VARIANTS}`;
    }
  }

  return text;
}

function normalizeAction(action, soupScope) {
  if (!action || typeof action !== "object") return action;
  const next = { ...action };
  if (soupScope && next.type === "message" && /選擇數量|加入購物車/.test(String(next.label || "") + String(next.text || ""))) {
    next.label = "選擇規格";
    next.text = "我要人工客服｜龜鹿湯塊75g、300g、600g規格與價格";
  }
  return next;
}

function directText(node) {
  if (!node || typeof node !== "object" || Array.isArray(node)) return "";
  return Object.entries(node)
    .filter(([key, value]) => ["text", "altText", "label"].includes(key) && typeof value === "string")
    .map(([, value]) => value)
    .join("\n");
}

function normalizeNode(node, inheritedScope = "") {
  if (Array.isArray(node)) return node.map((item) => normalizeNode(item, inheritedScope));
  if (!node || typeof node !== "object") return node;

  const ownText = directText(node);
  const isBubble = node.type === "bubble";
  const isTextMessage = node.type === "text" && typeof node.text === "string";
  const localScope = isBubble
    ? JSON.stringify(node)
    : isTextMessage
      ? node.text
      : `${inheritedScope}\n${ownText}`.trim();
  const soupScope = localScope.includes("龜鹿湯塊");
  const next = {};

  for (const [key, value] of Object.entries(node)) {
    if (key === "text" && typeof value === "string") {
      next[key] = normalizeText(value, localScope);
    } else if (key === "action") {
      next[key] = normalizeAction(normalizeNode(value, localScope), soupScope);
    } else {
      next[key] = normalizeNode(value, localScope);
    }
  }

  return next;
}

function normalizeRequest(request = {}) {
  if (!request || typeof request !== "object") return request;
  const next = { ...request };
  if (Array.isArray(next.messages)) next.messages = normalizeNode(next.messages);
  return next;
}

function patchMethod(prototype, methodName) {
  const original = prototype?.[methodName];
  if (typeof original !== "function" || original.__xjwFulfillmentPatched) return;

  const patched = function patchedProductMessage(request, ...rest) {
    return original.call(this, normalizeRequest(request), ...rest);
  };
  Object.defineProperty(patched, "__xjwFulfillmentPatched", { value: true });
  prototype[methodName] = patched;
}

const prototype = line?.messagingApi?.MessagingApiClient?.prototype;
for (const method of ["replyMessage", "pushMessage", "multicast", "broadcast"]) {
  patchMethod(prototype, method);
}

module.exports = {
  LEGACY_ALL_PRODUCT_NOTICE,
  DRINK_NOTICE,
  READY_STOCK_NOTICE,
  MIXED_NOTICE,
  SOUP_VARIANTS,
  normalizeText,
  normalizeNode,
  normalizeRequest,
};
