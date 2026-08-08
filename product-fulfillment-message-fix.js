"use strict";

/**
 * LINE 最終訊息邊界修正：
 * 1. 龜鹿飲才顯示接單製作 5～7 個工作天。
 * 2. 龜鹿膏、龜鹿湯塊、龜鹿膠、鹿茸粉顯示預先備貨說明。
 * 3. 龜鹿湯塊唯一正式規格為75g／盒｜8塊裝｜每塊約9.375g。
 * 4. 移除歷史300g／600g湯塊文字，不再導向多規格人工確認。
 * 5. 每個 Flex bubble 獨立判斷，不讓龜鹿湯塊規則污染同一輪播的其他產品。
 */

const line = require("@line/bot-sdk");

const LEGACY_ALL_PRODUCT_NOTICE = "訂單資料與付款方式確認後安排製作加工，製作加工約需5～7個工作天；完成後才安排出貨，物流配送時間另計。";
const DRINK_NOTICE = "龜鹿飲為接單後安排製作加工；訂單資料與付款方式確認後，製作加工約需5～7個工作天，完成後才安排出貨，物流配送時間另計。";
const READY_STOCK_NOTICE = "本產品為預先製作備貨商品；訂單資料與付款方式確認後，依現貨狀況安排出貨，物流配送時間另計。";
const MIXED_NOTICE = "龜鹿飲接單後安排製作加工，約需5～7個工作天；其他產品依現貨狀況安排出貨，物流配送時間另計。";
// 保留舊匯出名稱避免其他模組中斷，但內容已改為唯一75g正式規格。
const SOUP_VARIANTS = "正式規格：75g／盒｜8塊裝｜每塊約9.375g。";

const DRINK_MARKERS = ["龜鹿飲30cc", "龜鹿飲180cc", "30cc小玻璃罐", "180cc鋁袋"];
const READY_MARKERS = ["龜鹿膏", "龜鹿湯塊", "龜鹿膠", "鹿茸粉"];

function includesAny(text, markers) { return markers.some((marker) => text.includes(marker)); }

function noticeFor(text) {
  const hasDrink = includesAny(text, DRINK_MARKERS);
  const hasReady = includesAny(text, READY_MARKERS);
  if (hasDrink && hasReady) return MIXED_NOTICE;
  if (hasDrink) return DRINK_NOTICE;
  if (hasReady) return READY_STOCK_NOTICE;
  return MIXED_NOTICE;
}

function cleanLegacySoupText(text) {
  return String(text || "")
    .replace(/正式規格[:：]\s*75g／盒｜8塊裝｜每塊約9\.375g[；;]\s*300g／盒｜16塊裝｜每塊約18\.75g[；;]\s*600g／盒｜32塊裝｜每塊約18\.75g[。.]?/g, SOUP_VARIANTS)
    .replace(/300g／盒｜16塊裝｜每塊約18\.75g[；;]?\s*/g, "")
    .replace(/600g／盒｜32塊裝｜每塊約18\.75g[；;]?\s*/g, "")
    .replace(/龜鹿湯塊\s*300g/g, "龜鹿湯塊75g")
    .replace(/龜鹿湯塊\s*600g/g, "龜鹿湯塊75g");
}

function normalizeText(value, scopeText = "") {
  if (typeof value !== "string") return value;
  const context = `${scopeText}\n${value}`;
  let text = value.replaceAll(LEGACY_ALL_PRODUCT_NOTICE, noticeFor(context));
  if (context.includes("龜鹿湯塊")) {
    text = cleanLegacySoupText(text);
    const oldSpec = "規格：75g／盒｜8塊裝｜每塊約9.375g";
    if (text === oldSpec) text = SOUP_VARIANTS;
  }
  return text;
}

function normalizeAction(action, soupScope) {
  if (!action || typeof action !== "object") return action;
  const next = { ...action };
  if (soupScope && next.type === "message") {
    const combined = `${next.label || ""} ${next.text || ""}`;
    if (/選擇規格|龜鹿湯塊75g、300g、600g|PROD-SOUP-(300|600)/.test(combined)) {
      next.label = "選擇數量";
      next.text = "選擇數量｜guilu-tangkuai";
    }
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
  const localScope = isBubble ? JSON.stringify(node) : isTextMessage ? node.text : `${inheritedScope}\n${ownText}`.trim();
  const soupScope = localScope.includes("龜鹿湯塊");
  const next = {};
  for (const [key, value] of Object.entries(node)) {
    if (key === "text" && typeof value === "string") next[key] = normalizeText(value, localScope);
    else if (key === "action") next[key] = normalizeAction(normalizeNode(value, localScope), soupScope);
    else next[key] = normalizeNode(value, localScope);
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
  const patched = function patchedProductMessage(request, ...rest) { return original.call(this, normalizeRequest(request), ...rest); };
  Object.defineProperty(patched, "__xjwFulfillmentPatched", { value: true });
  prototype[methodName] = patched;
}

const prototype = line?.messagingApi?.MessagingApiClient?.prototype;
for (const method of ["replyMessage", "pushMessage", "multicast", "broadcast"]) patchMethod(prototype, method);

module.exports = {
  LEGACY_ALL_PRODUCT_NOTICE,
  DRINK_NOTICE,
  READY_STOCK_NOTICE,
  MIXED_NOTICE,
  SOUP_VARIANTS,
  cleanLegacySoupText,
  normalizeText,
  normalizeNode,
  normalizeRequest,
};
