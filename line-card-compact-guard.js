"use strict";

/**
 * LINE OA 手機卡片高度守門
 * - 只縮短 carousel 上的公開摘要，不刪正式資料來源。
 * - 「怎麼使用」卡片保留用法重點，成分與完整出貨資訊留給完整介紹／產品頁。
 * - 「搭配組合」卡片保留商品合計、組數、優惠狀態與簡短出貨摘要。
 * - 不修改按鈕、不改產品圖、不改價格與正式規格。
 */
const line = require("@line/bot-sdk");

const VERSION = "20260821-mobile-card-compact-v1";
const USAGE_PATTERN = /怎麼使用|使用方式|產品使用方式導覽|龜鹿膏\s*[｜|]\s*使用方式|龜鹿飲\s*30\s*cc.*使用方式|龜鹿飲\s*180\s*cc.*使用方式|龜鹿湯塊.*使用方式|龜鹿膠.*使用方式|鹿茸粉.*使用方式/i;
const COMBO_PATTERN = /搭配組合|搭配方案|日常節奏組|完整體驗組|料理搭配|組合/i;
const RECOMMEND_PATTERN = /幫我推薦|固定日常安排|自行搭配飲品|沖泡、燉湯與家庭使用|依日常使用方式幫你選|怎麼選/i;

const LONG_DRINK_NOTICE = /龜鹿飲30cc與180cc為接單後安排製作；訂單資料與付款方式確認後，製作加工約需5～7個工作天，完成後才安排出貨，物流配送時間另計。?/g;
const LONG_READY_NOTICE = /本產品為預先製作備貨商品；訂單資料與付款方式確認後，依現貨狀況安排出貨，物流配送時間另計。?/g;
const LONG_MIXED_NOTICE = /龜鹿飲30cc與180cc為接單後安排製作，約需5～7個工作天；龜鹿膏、龜鹿湯塊、龜鹿膠與鹿茸粉依現貨狀況安排。物流配送時間另計。?/g;

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

function normalizeBreaks(text) {
  return String(text || "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function compactCommon(text) {
  return normalizeBreaks(String(text || "")
    .replace(LONG_DRINK_NOTICE, "龜鹿飲接單後製作約5～7個工作天，完成後安排出貨。")
    .replace(LONG_READY_NOTICE, "出貨依現貨狀況安排，物流時間另計。")
    .replace(LONG_MIXED_NOTICE, "龜鹿飲接單後製作約5～7個工作天；其他商品依現貨安排。"));
}

function compactUsageText(text) {
  let value = compactCommon(text);
  value = value
    .replace(/(?:^|\n)成分[：:].*(?=\n|$)/g, "")
    .replace(/(?:^|\n)(?:本產品為預先製作備貨商品.*|訂單資料與付款方式確認後.*|物流配送時間另計。?)(?=\n|$)/g, "")
    .replace(/龜鹿飲接單後製作約5～7個工作天，完成後安排出貨。/g, "")
    .replace(/出貨依現貨狀況安排，物流時間另計。/g, "");
  return normalizeBreaks(value);
}

function compactComboText(text) {
  let value = compactCommon(text);
  value = value.replace(/活動[／/]優惠已套用：\s*(?:\n|.)*?(?=(?:龜鹿飲接單後|龜鹿飲30cc與180cc|出貨依現貨|$))/g, "已套用目前優惠價。\n");
  value = value.replace(/(?:^|\n)•\s*龜鹿膏：已套用優惠價[^\n]*/g, "");
  return normalizeBreaks(value);
}

function walkTextNodes(node, fn, maxLines) {
  if (!node || typeof node !== "object") return;
  if (Array.isArray(node)) {
    for (const item of node) walkTextNodes(item, fn, maxLines);
    return;
  }
  if (node.type === "text" && typeof node.text === "string") {
    const isTitle = node.weight === "bold" || ["xl", "xxl", "3xl", "4xl", "5xl"].includes(String(node.size || ""));
    if (!isTitle) {
      node.text = fn(node.text);
      node.wrap = true;
      if (node.text.length > 40) node.maxLines = maxLines;
    }
  }
  for (const [key, value] of Object.entries(node)) {
    if (key === "action" || /^xjw/i.test(key)) continue;
    walkTextNodes(value, fn, maxLines);
  }
}

function compactBubble(bubble) {
  if (!bubble || bubble.type !== "bubble") return bubble;
  const text = collectText([bubble.header, bubble.body].filter(Boolean), []).join("\n");
  if (USAGE_PATTERN.test(text)) {
    walkTextNodes(bubble.body, compactUsageText, 7);
    if (bubble.body?.spacing) bubble.body.spacing = "sm";
    if (bubble.footer?.spacing) bubble.footer.spacing = "xs";
    return bubble;
  }
  if (COMBO_PATTERN.test(text)) {
    walkTextNodes(bubble.body, compactComboText, 8);
    if (bubble.body?.spacing) bubble.body.spacing = "sm";
    if (bubble.footer?.spacing) bubble.footer.spacing = "xs";
    return bubble;
  }
  if (RECOMMEND_PATTERN.test(text)) {
    walkTextNodes(bubble.body, compactCommon, 6);
    if (bubble.body?.spacing) bubble.body.spacing = "sm";
  }
  return bubble;
}

function walk(node) {
  if (!node || typeof node !== "object") return node;
  if (Array.isArray(node)) {
    for (const item of node) walk(item);
    return node;
  }
  if (node.type === "bubble") compactBubble(node);
  for (const value of Object.values(node)) walk(value);
  return node;
}

const Client = line?.messagingApi?.MessagingApiClient;
if (Client?.prototype?.replyMessage && !Client.prototype.__xjwCardCompactGuardInstalled) {
  const previous = Client.prototype.replyMessage;
  Client.prototype.replyMessage = function xjwCardCompactReply(payload) {
    walk(payload?.messages);
    return previous.call(this, payload);
  };
  Object.defineProperty(Client.prototype, "__xjwCardCompactGuardInstalled", { value: true, enumerable: false });
}

module.exports = { VERSION, USAGE_PATTERN, COMBO_PATTERN, RECOMMEND_PATTERN, compactCommon, compactUsageText, compactComboText, compactBubble, walk };
