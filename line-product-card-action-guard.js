"use strict";

/**
 * LINE OA 產品卡片動作守門
 * - 移除「看實際產品照片」等額外圖片跳轉：卡片本身已顯示正式產品圖。
 * - 「完整介紹」改為「官網完整介紹」，讓顧客清楚知道會開啟官網完整頁。
 * - 「看產品」六張產品卡維持相同高度；試喝不插入產品 carousel，避免30cc單卡把整組拉長。
 * - 試喝入口由 LINE 歡迎第一層、官網／FB／IG 試喝入口承接。
 * - 不修改產品圖、價格、規格、用法或購物車計價。
 */
const line = require("@line/bot-sdk");
const data = require("./data.json");

const VERSION = "20260821-product-card-actions-v2-separated-trial";
const SITE_BASE = String(data.siteUrl || "https://ts15825868.github.io/xianjiawei/").replace(/\/?$/, "/");
const PRODUCTS = Object.freeze(Object.fromEntries((data.products || []).map((product) => [product.id, product])));
const PHOTO_LABEL = /看實際產品照片|看正式產品照片|看正確產品圖|產品大圖|看產品照片/;
const COMPLETE_LABEL = /^(?:完整介紹|官網完整介紹)$/;
const TRIAL_LABEL = /申請試喝|試喝申請|我要試喝/;

const PRODUCT_PATTERNS = Object.freeze({
  "guilu-drink-30": [/龜鹿飲\s*30\s*cc/i, /30\s*cc.*(?:玻璃罐|小玻璃罐)/i],
  "guilu-drink-180": [/龜鹿飲\s*180\s*cc/i, /180\s*cc.*鋁袋/i],
  "guilu-gao": [/龜鹿膏/],
  "guilu-tangkuai": [/龜鹿湯塊/],
  "guilu-jiao": [/龜鹿膠/],
  "luerong-fen": [/鹿茸粉/],
});

function absoluteUrl(asset = "") {
  const value = String(asset || "");
  if (/^https?:\/\//i.test(value)) return encodeURI(value);
  return encodeURI(`${SITE_BASE}${value.replace(/^\/+/, "")}`);
}

function collectContentText(node, out = []) {
  if (!node || typeof node !== "object") return out;
  if (Array.isArray(node)) {
    for (const item of node) collectContentText(item, out);
    return out;
  }
  if (node.type === "text" && node.text) out.push(String(node.text));
  for (const [key, value] of Object.entries(node)) {
    if (key === "action" || /^xjw/i.test(key)) continue;
    collectContentText(value, out);
  }
  return out;
}

function detectProductId(bubble) {
  const text = collectContentText([bubble?.header, bubble?.body].filter(Boolean), []).join("\n");
  const matched = Object.entries(PRODUCT_PATTERNS)
    .filter(([, patterns]) => patterns.some((pattern) => pattern.test(text)))
    .map(([id]) => id);
  return matched.length === 1 ? matched[0] : "";
}

function findTitle(bubble) {
  const texts = [];
  (function walk(node) {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) return node.forEach(walk);
    if (node.type === "text" && node.text) texts.push(node);
    for (const [key, value] of Object.entries(node)) if (key !== "action" && !/^xjw/i.test(key)) walk(value);
  })(bubble?.body);
  const title = texts.find((node) => node.weight === "bold" || ["xl", "xxl", "3xl", "4xl", "5xl"].includes(String(node.size || ""))) || texts[0];
  return String(title?.text || "").trim();
}

function productPage(productId) {
  const product = PRODUCTS[productId] || {};
  return absoluteUrl(product.page || "products.html");
}

function button(label, action, style = "secondary") {
  return { type: "button", style, action: { ...action, label } };
}

function isSummaryCard(bubble, productId) {
  if (!productId || !bubble?.footer || bubble.footer.layout !== "vertical") return false;
  const title = findTitle(bubble);
  if (/選擇數量|第一步|第二步|第三步|確認訂單|加入購物車|購物車/.test(title)) return false;
  const labels = (bubble.footer.contents || []).map((item) => String(item?.action?.label || ""));
  return labels.some((label) => /選擇數量|完整介紹|看實際產品照片|使用方式|看產品/.test(label));
}

function normalizeActions(bubble) {
  if (!bubble || bubble.type !== "bubble" || !bubble.footer || bubble.footer.layout !== "vertical") return bubble;
  const productId = detectProductId(bubble);
  const items = Array.isArray(bubble.footer.contents) ? bubble.footer.contents : [];

  // 卡片 hero 已是正式產品圖，不再提供額外圖片跳轉。
  // 試喝也不插入產品 carousel；即使舊層曾加過，這裡一律清掉以維持六張等高。
  let next = items.filter((item) => {
    const label = String(item?.action?.label || "");
    return !PHOTO_LABEL.test(label) && !TRIAL_LABEL.test(label);
  });

  // 清楚標示官網跳轉。
  for (const item of next) {
    if (COMPLETE_LABEL.test(String(item?.action?.label || "")) && item?.action) {
      item.action.label = "官網完整介紹";
      if (productId) {
        item.action.type = "uri";
        item.action.uri = productPage(productId);
        delete item.action.text;
      }
    }
  }

  if (isSummaryCard({ ...bubble, footer: { ...bubble.footer, contents: next } }, productId)) {
    const labels = next.map((item) => String(item?.action?.label || ""));

    // 價格卡等若原本沒有完整介紹，補上官網入口取代已移除的圖片跳轉。
    if (productId && !labels.some((label) => COMPLETE_LABEL.test(label))) {
      const insertAt = Math.min(1, next.length);
      next.splice(insertAt, 0, button("官網完整介紹", { type: "uri", uri: productPage(productId) }));
    }
  }

  // 正常產品摘要卡最多三顆核心按鈕，避免任何單一卡片把整組 carousel 拉高。
  bubble.footer.contents = next.slice(0, 3);
  return bubble;
}

function walk(node) {
  if (!node || typeof node !== "object") return node;
  if (Array.isArray(node)) {
    for (const item of node) walk(item);
    return node;
  }
  if (node.type === "bubble") normalizeActions(node);
  for (const [key, value] of Object.entries(node)) {
    if (key === "action" || /^xjw/i.test(key)) continue;
    walk(value);
  }
  return node;
}

const Client = line?.messagingApi?.MessagingApiClient;
if (Client?.prototype?.replyMessage && !Client.prototype.__xjwProductCardActionGuardInstalled) {
  const previous = Client.prototype.replyMessage;
  Client.prototype.replyMessage = function xjwProductCardActionReply(payload) {
    walk(payload?.messages);
    return previous.call(this, payload);
  };
  Object.defineProperty(Client.prototype, "__xjwProductCardActionGuardInstalled", { value: true, enumerable: false });
}

module.exports = { VERSION, PHOTO_LABEL, COMPLETE_LABEL, TRIAL_LABEL, detectProductId, isSummaryCard, normalizeActions, walk };
