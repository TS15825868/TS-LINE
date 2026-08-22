"use strict";

/**
 * LINE OA 手機卡片高度守門 v3
 * - 卡片只保留手機上最重要的摘要，不刪除正式資料來源。
 * - 幫我推薦：使用明確短摘要，不靠硬截斷。
 * - 怎麼使用：只留用法重點；成分、保存、出貨資訊由完整介紹承接。
 * - 搭配組合：保留商品、價格、優惠與必要出貨摘要。
 * - 試喝：維持正式試喝海報，改成清楚的獨立試喝下單入口。
 * - 情境卡 Hero 採 16:9 + fit 與較緊湊內距；不裁切、不拉伸、不改產品卡與試喝海報。
 * - 不改產品圖、包裝、價格與正式規格。
 */
const line = require("@line/bot-sdk");

const VERSION = "20260822-mobile-card-compact-v3";
const USAGE_PATTERN = /怎麼使用|使用方式|產品使用方式導覽|龜鹿膏\s*[｜|]\s*使用方式|龜鹿飲\s*30\s*cc.*使用方式|龜鹿飲\s*180\s*cc.*使用方式|龜鹿湯塊.*使用方式|龜鹿膠.*使用方式|鹿茸粉.*使用方式/i;
const COMBO_PATTERN = /搭配組合|搭配方案|日常節奏組|完整體驗組|料理搭配|組合/i;
const RECOMMEND_PATTERN = /幫我推薦|固定日常安排|方便即飲|自行搭配飲品|沖泡、燉湯與家庭使用|依日常使用方式幫你選|怎麼選/i;
const TRIAL_PATTERN = /龜鹿飲試喝組|30cc.*3罐|試喝品免費|先試喝/i;

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
    .replace(/\r/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{2,}/g, "\n")
    .trim();
}

function compactCommon(text) {
  return normalizeBreaks(String(text || "")
    .replace(LONG_DRINK_NOTICE, "龜鹿飲接單後製作約5～7個工作天。")
    .replace(LONG_READY_NOTICE, "出貨依現貨狀況安排。")
    .replace(LONG_MIXED_NOTICE, "龜鹿飲接單後製作約5～7個工作天；其他商品依現貨安排。"));
}

function compactUsageText(text) {
  let value = compactCommon(text)
    .replace(/(?:^|\n)成分[：:].*(?=\n|$)/g, "")
    .replace(/(?:^|\n)(?:本產品為預先製作備貨商品.*|訂單資料與付款方式確認後.*|物流配送時間另計。?)(?=\n|$)/g, "")
    .replace(/龜鹿飲接單後製作約5～7個工作天。/g, "")
    .replace(/出貨依現貨狀況安排。/g, "");
  const lines = normalizeBreaks(value).split("\n").map((line) => line.trim()).filter(Boolean);
  return lines.slice(0, 5).join("\n");
}

function compactComboText(text) {
  let value = compactCommon(text)
    .replace(/活動[／/]優惠已套用：\s*(?:\n|.)*?(?=(?:龜鹿飲接單後|龜鹿飲30cc與180cc|出貨依現貨|$))/g, "已套用目前優惠價。\n")
    .replace(/(?:^|\n)•\s*龜鹿膏：已套用優惠價[^\n]*/g, "");
  const lines = normalizeBreaks(value).split("\n").map((line) => line.trim()).filter(Boolean);
  const important = [];
  for (const line of lines) {
    if (important.length >= 6) break;
    if (!important.includes(line)) important.push(line);
  }
  return important.join("\n");
}

function findTitle(bubble) {
  const nodes = [];
  (function walk(node) {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) return node.forEach(walk);
    if (node.type === "text" && node.text) nodes.push(node);
    for (const [key, value] of Object.entries(node)) if (key !== "action" && !/^xjw/i.test(key)) walk(value);
  })(bubble?.body);
  const titleNode = nodes.find((node) => node.weight === "bold" || ["xl", "xxl", "3xl", "4xl", "5xl"].includes(String(node.size || ""))) || nodes[0];
  return String(titleNode?.text || "").trim();
}

function firstDescriptionNode(bubble) {
  const nodes = [];
  (function walk(node) {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) return node.forEach(walk);
    if (node.type === "text" && typeof node.text === "string") nodes.push(node);
    for (const [key, value] of Object.entries(node)) if (key !== "action" && !/^xjw/i.test(key)) walk(value);
  })(bubble?.body);
  const titleNode = nodes.find((node) => node.weight === "bold" || ["xl", "xxl", "3xl", "4xl", "5xl"].includes(String(node.size || ""))) || nodes[0];
  return nodes.find((node) => node !== titleNode) || null;
}

function setDescription(bubble, text, maxLines = 5) {
  const node = firstDescriptionNode(bubble);
  if (!node) return false;
  node.text = normalizeBreaks(text);
  node.wrap = true;
  node.maxLines = maxLines;
  node.size = node.size || "sm";
  return true;
}

function usageSummary(title, fallback) {
  if (/產品使用方式導覽/.test(title)) return "先選產品看重點用法；完整成分、保存與出貨資訊請點「完整介紹」。";
  if (/龜鹿膏/.test(title)) return "食用時間依個人習慣與作息安排\n初次可先從半匙開始\n可直接食用或加入約100～300mL熱水化開";
  if (/30\s*cc/i.test(title)) return "每日 1–2 罐\n開罐即可飲用\n可隔水加熱或溫熱後飲用\n避免冰飲";
  if (/180\s*cc/i.test(title)) return "每日一包\n撕開包裝即可飲用\n可隔水加熱或溫熱後飲用\n避免冰飲";
  if (/龜鹿湯塊/.test(title)) return "取1塊加入約300～500mL熱水沖泡\n可放入保溫壺悶泡\n也可加入雞湯或排骨湯燉煮";
  if (/龜鹿膠/.test(title)) return "取適量加入約300～500mL熱水化開\n也可加入雞湯或排骨湯燉煮";
  if (/鹿茸粉/.test(title)) return "依個人習慣取適量\n可加入溫開水、牛奶、豆漿或其他飲品攪拌均勻";
  return compactUsageText(fallback);
}

function recommendationSummary(title, fallback) {
  if (/依日常使用方式幫你選/.test(title)) return "固定安排看龜鹿膏；方便即飲看30cc／180cc；沖泡料理看湯塊／膠；飲品搭配看鹿茸粉。";
  if (/固定日常安排/.test(title)) return "居家固定安排可看龜鹿膏；外出攜帶看30cc；較完整即飲份量看180cc。";
  if (/方便即飲/.test(title)) return "想輕巧攜帶可看30cc；想要較完整即飲份量可看180cc鋁袋。";
  if (/沖泡、燉湯與家庭使用/.test(title)) return "沖泡或料理可看龜鹿湯塊；家庭較大規格可看龜鹿膠。";
  if (/自行搭配飲品/.test(title)) return "鹿茸粉可依個人飲食習慣加入溫水、牛奶、豆漿或其他飲品。";
  return compactCommon(fallback);
}

function compactTrialText() {
  return "30cc小玻璃罐×3罐｜試喝品免費\n7-11店到店60元｜郵局宅配100元\n每位顧客、電話及地址限申請一次\n接單後製作約5～7個工作天";
}

function relabelTrialButtons(bubble) {
  const items = bubble?.footer?.contents || [];
  for (const item of items) {
    const action = item?.action;
    if (!action) continue;
    const text = String(action.text || "");
    if (/^試喝配送｜store/.test(text) || /7-11/.test(String(action.label || ""))) action.label = "7-11試喝｜$60";
    else if (/^試喝配送｜.*(?:post|home|宅配)/i.test(text) || /宅配/.test(String(action.label || ""))) action.label = "宅配試喝｜$100";
  }
}

function walkTextNodes(node, fn, maxLines) {
  if (!node || typeof node !== "object") return;
  if (Array.isArray(node)) return node.forEach((item) => walkTextNodes(item, fn, maxLines));
  if (node.type === "text" && typeof node.text === "string") {
    const isTitle = node.weight === "bold" || ["xl", "xxl", "3xl", "4xl", "5xl"].includes(String(node.size || ""));
    if (!isTitle) {
      node.text = fn(node.text);
      node.wrap = true;
      node.maxLines = maxLines;
    }
  }
  for (const [key, value] of Object.entries(node)) {
    if (key === "action" || /^xjw/i.test(key)) continue;
    walkTextNodes(value, fn, maxLines);
  }
}

function compactSceneLayout(bubble) {
  if (!bubble || bubble.type !== "bubble") return;
  if (bubble.hero?.type === "image") {
    bubble.hero.aspectRatio = "16:9";
    bubble.hero.aspectMode = "fit";
    bubble.hero.backgroundColor = bubble.hero.backgroundColor || "#F7F4ED";
  }
  if (bubble.body?.type === "box") {
    bubble.body.spacing = "xs";
    bubble.body.paddingAll = "16px";
  }
  if (bubble.footer?.type === "box") {
    bubble.footer.spacing = "xs";
    bubble.footer.paddingAll = "12px";
  }
}

function compactBubble(bubble) {
  if (!bubble || bubble.type !== "bubble") return bubble;
  const text = collectText([bubble.header, bubble.body].filter(Boolean), []).join("\n");
  const title = findTitle(bubble);

  if (TRIAL_PATTERN.test(text)) {
    setDescription(bubble, compactTrialText(), 4);
    relabelTrialButtons(bubble);
    if (bubble.body?.spacing) bubble.body.spacing = "sm";
    if (bubble.footer?.spacing) bubble.footer.spacing = "xs";
    return bubble;
  }

  if (USAGE_PATTERN.test(text)) {
    const original = String(firstDescriptionNode(bubble)?.text || "");
    if (!setDescription(bubble, usageSummary(title, original), 5)) walkTextNodes(bubble.body, compactUsageText, 5);
    compactSceneLayout(bubble);
    return bubble;
  }

  if (COMBO_PATTERN.test(text)) {
    walkTextNodes(bubble.body, compactComboText, 6);
    compactSceneLayout(bubble);
    return bubble;
  }

  if (RECOMMEND_PATTERN.test(text)) {
    const original = String(firstDescriptionNode(bubble)?.text || "");
    if (!setDescription(bubble, recommendationSummary(title, original), 4)) walkTextNodes(bubble.body, compactCommon, 4);
    compactSceneLayout(bubble);
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

module.exports = {
  VERSION,
  USAGE_PATTERN,
  COMBO_PATTERN,
  RECOMMEND_PATTERN,
  TRIAL_PATTERN,
  compactCommon,
  compactUsageText,
  compactComboText,
  usageSummary,
  recommendationSummary,
  compactTrialText,
  compactSceneLayout,
  compactBubble,
  walk,
};
