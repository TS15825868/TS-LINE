"use strict";

/**
 * LINE OA 顧客畫面修正｜目前正式媒體角色版
 * - 產品 hero 使用目前核准產品圖的 LINE 相容 JPEG route。
 * - 「看實際產品照片」連到 products-v3 身份原圖，不拿 DM 取代產品本體。
 * - 真正的試喝內容卡固定使用 2026-08-14 使用者核准試喝海報 JPEG route。
 * - 試喝辨識只讀卡片正文，不讀 footer 按鈕；「申請試喝」按鈕不得把30cc產品卡誤判成試喝卡。
 * - 非產品說明卡使用 LINE OA 專用 Q 版小老闆情境圖。
 * - 推薦／搭配／使用三組卡片 hero 統一 16:9、fit、不裁切；carousel 不再刪除重複 hero 造成大片空白。
 * - 產品辨識優先只讀卡片正文，不讓「看30cc／看180cc」等切換按鈕污染產品判斷。
 * - xjw* 欄位僅供內部視覺判斷，送入 LINE Messaging API 前必須完整移除。
 */
const line = require("@line/bot-sdk");
const currentAuthority = require("./assets/data/official-products.json");
const photoAuthority = require("./line-product-photo-authority.json");

const VERSION = "current-recording-ui-product-trial-separated-v20260821";
const PRODUCT_IMAGE_VERSION = String(currentAuthority.version || "current-formal-media");
const HERO_ASPECT_RATIO = "16:9";
const SITE_BASE = "https://ts15825868.github.io/xianjiawei/";
const PUBLIC_BASE_URL = String(process.env.PUBLIC_BASE_URL || process.env.RENDER_EXTERNAL_URL || "https://ts-line.onrender.com").replace(/\/$/, "");
const currentById = Object.freeze(Object.fromEntries((currentAuthority.products || []).map((item) => [item.id, item])));

const MASCOT_HEROES = Object.freeze({
  welcome: `${SITE_BASE}images/brand/line-oa/welcome.jpg?v=${VERSION}`,
  products: `${SITE_BASE}images/brand/line-oa/products.jpg?v=${VERSION}`,
  recommend: `${SITE_BASE}images/brand/line-oa/recommend.jpg?v=${VERSION}`,
  combo: `${SITE_BASE}images/brand/line-oa/combo.jpg?v=${VERSION}`,
  usage: `${SITE_BASE}images/brand/line-oa/usage.jpg?v=${VERSION}`,
  faq: `${SITE_BASE}images/brand/line-oa/faq.jpg?v=${VERSION}`,
  service: `${SITE_BASE}images/brand/line-oa/service.jpg?v=${VERSION}`,
  brand: `${SITE_BASE}images/brand/line-oa/brand.jpg?v=${VERSION}`,
});
const GENERIC_MASCOT_HERO = MASCOT_HEROES.welcome;
const RECOMMEND_HERO = MASCOT_HEROES.recommend;
const TRIAL_PATTERN = /試喝|3\s*罐試喝|先試喝/;
const MASCOT_CARD_PATTERN = /怎麼選|幫你選|幫我推薦|產品差異|固定節奏|方便快速|沖泡[、，,\s]*燉湯|家庭使用|自己搭配|依日常|依生活|搭配方案|搭配組合|日常搭配導覽|選擇適合|使用型態|怎麼使用|使用方式|沖泡方式|燉湯方式|常見問題|FAQ|品牌故事|四代傳承|萬華開始|人工客服|門市資訊|歡迎來到仙加味|配送與付款/;

const PATTERNS = Object.freeze({
  "guilu-drink-30": [/龜鹿飲\s*30\s*cc/i, /30\s*cc.*(?:玻璃罐|小玻璃罐)/i],
  "guilu-drink-180": [/龜鹿飲\s*180\s*cc/i, /180\s*cc.*鋁袋/i],
  "guilu-gao": [/龜鹿膏/],
  "guilu-tangkuai": [/龜鹿湯塊/],
  "guilu-jiao": [/龜鹿膠/],
  "luerong-fen": [/鹿茸粉/],
});
const PRODUCTS = Object.freeze(Object.fromEntries(Object.keys(PATTERNS).map((id) => [id, Object.freeze({
  patterns: PATTERNS[id],
  image: `${PUBLIC_BASE_URL}/assets/formal-product/${id}.jpg?v=${encodeURIComponent(PRODUCT_IMAGE_VERSION)}`,
  source: currentById[id]?.approvedProductImage || "",
  original: photoAuthority.products?.[id] || "",
  dm: `${PUBLIC_BASE_URL}/assets/formal-dm/${id}.jpg?v=${encodeURIComponent(PRODUCT_IMAGE_VERSION)}`,
})])));
const TRIAL_IMAGE = `${PUBLIC_BASE_URL}/assets/formal-trial/trial.jpg?v=${encodeURIComponent(PRODUCT_IMAGE_VERSION)}`;

function rewriteVisibleText(value) {
  return String(value || "")
    .replaceAll("每組售價：", "商品合計：")
    .replaceAll("每組價格", "商品合計")
    .replaceAll("查看產品DM", "查看詳細DM")
    .replaceAll("看產品DM", "看詳細DM")
    .replaceAll("產品DM", "詳細DM");
}
function normalizeVisibleText(node) {
  if (!node || typeof node !== "object") return node;
  if (Array.isArray(node)) { for (const item of node) normalizeVisibleText(item); return node; }
  if (node.type === "text" && typeof node.text === "string") node.text = rewriteVisibleText(node.text);
  if (node.action && typeof node.action === "object") {
    if (typeof node.action.label === "string") node.action.label = rewriteVisibleText(node.action.label);
    if (typeof node.action.text === "string") node.action.text = rewriteVisibleText(node.action.text);
  }
  for (const [key, value] of Object.entries(node)) if (key !== "action") normalizeVisibleText(value);
  return node;
}
function collectTexts(node, output = []) {
  if (!node || typeof node !== "object") return output;
  if (Array.isArray(node)) { for (const item of node) collectTexts(item, output); return output; }
  if (node.type === "text" && node.text) output.push(String(node.text));
  if (node.action && typeof node.action === "object") {
    if (node.action.label) output.push(String(node.action.label));
    if (node.action.text) output.push(String(node.action.text));
  }
  for (const [key, value] of Object.entries(node)) if (key !== "action") collectTexts(value, output);
  return output;
}
function collectContentTexts(node, output = []) {
  if (!node || typeof node !== "object") return output;
  if (Array.isArray(node)) { for (const item of node) collectContentTexts(item, output); return output; }
  if (node.type === "text" && node.text) output.push(String(node.text));
  for (const [key, value] of Object.entries(node)) if (key !== "action" && !/^xjw/i.test(key)) collectContentTexts(value, output);
  return output;
}
function matchedProductKeys(text) {
  const source = String(text || "");
  return Object.entries(PRODUCTS)
    .filter(([, product]) => product.patterns.some((pattern) => pattern.test(source)))
    .map(([key]) => key);
}
function uniqueProductKey(bubble) {
  // 產品使用卡常帶有「看30cc／看180cc」等切換按鈕；那些不是本卡產品身份。
  // 優先只看 header/body 的正文，再看整張卡不含 action 的文字，避免被按鈕污染。
  const primary = [bubble?.header, bubble?.body].filter(Boolean);
  const primaryFound = matchedProductKeys(collectContentTexts(primary, []).join("\n"));
  if (primaryFound.length === 1) return primaryFound[0];

  const contentFound = matchedProductKeys(collectContentTexts(bubble, []).join("\n"));
  return contentFound.length === 1 ? contentFound[0] : "";
}
function productHero(key) {
  return { type: "image", url: PRODUCTS[key].image, size: "full", aspectRatio: HERO_ASPECT_RATIO, aspectMode: "fit", backgroundColor: "#EFE4D2" };
}
function trialHero() {
  return { type: "image", url: TRIAL_IMAGE, size: "full", aspectRatio: "1:1", aspectMode: "fit", backgroundColor: "#F7F1E6", action: { type: "uri", uri: `${SITE_BASE}trial.html` } };
}
function mascotSceneForText(value = "") {
  const text = String(value || "");
  if (/常見問題|FAQ|問題整理/.test(text)) return "faq";
  if (/客服|聯絡|訂單|結帳|門市|配送|付款|下單/.test(text)) return "service";
  if (/搭配組合|搭配方案|組合/.test(text)) return "combo";
  if (/推薦|幫你選|幫我推薦|怎麼選|產品差異|依日常|依生活/.test(text)) return "recommend";
  if (/使用|沖泡|燉湯|料理/.test(text)) return "usage";
  if (/品牌|四代|萬華|傳承|故事|漢方|資料/.test(text)) return "brand";
  if (/產品|商品/.test(text)) return "products";
  return "welcome";
}
function mascotHero(scene = "welcome") {
  return { type: "image", url: MASCOT_HEROES[scene] || MASCOT_HEROES.welcome, size: "full", aspectRatio: HERO_ASPECT_RATIO, aspectMode: "fit", backgroundColor: "#EFE4D2" };
}
function rewriteProductImageActions(node, key) {
  if (!node || typeof node !== "object") return;
  if (Array.isArray(node)) { for (const item of node) rewriteProductImageActions(item, key); return; }
  if (node.action && typeof node.action === "object") {
    const label = String(node.action.label || "");
    if (/看正確產品圖|看正式產品圖|看實際產品照片|產品大圖/.test(label)) {
      node.action.label = "看實際產品照片";
      node.action.type = "uri";
      node.action.uri = PRODUCTS[key].original;
      delete node.action.text;
    } else if (/看詳細DM|查看詳細DM/.test(label)) {
      node.action.type = "uri";
      node.action.uri = PRODUCTS[key].dm;
      delete node.action.text;
    }
  }
  for (const [name, value] of Object.entries(node)) if (name !== "action") rewriteProductImageActions(value, key);
}
function isRecommendationBubble(bubble) {
  return MASCOT_CARD_PATTERN.test(collectContentTexts([bubble?.header, bubble?.body].filter(Boolean), []).join("\n"));
}
function isTrialBubble(bubble) {
  // 只看卡片正文，絕對不看 footer 的「申請試喝」按鈕；避免30cc產品卡被誤換成試喝海報。
  const text = collectContentTexts([bubble?.header, bubble?.body].filter(Boolean), []).join("\n");
  return TRIAL_PATTERN.test(text);
}
function applyBubbleFix(bubble) {
  if (!bubble || bubble.type !== "bubble") return bubble;
  normalizeVisibleText(bubble);
  if (isTrialBubble(bubble)) {
    bubble.hero = trialHero();
    bubble.xjwTrialMedia = true;
    bubble.xjwTrialMediaAuthority = currentAuthority.trialPosterAuthority?.assetId || "20260814-user-small-boss-trial-poster";
    return bubble;
  }
  const key = uniqueProductKey(bubble);
  if (key) {
    const oldAction = bubble.hero?.action;
    bubble.hero = productHero(key);
    if (oldAction && oldAction.type === "uri" && oldAction.uri && !/\.(?:jpe?g|png|webp|avif)(?:[?#]|$)/i.test(oldAction.uri)) bubble.hero.action = oldAction;
    rewriteProductImageActions(bubble, key);
    bubble.xjwProductPhoto = key;
    bubble.xjwProductPhotoAuthority = "current-approved-product-image-line-jpeg";
    bubble.xjwProductIdentityAuthority = "products-v3-user-approved-originals";
    bubble.xjwProductScalePolicy = "landscape-fit-no-crop-no-stretch";
    return bubble;
  }
  if (isRecommendationBubble(bubble)) {
    const text = collectContentTexts([bubble?.header, bubble?.body].filter(Boolean), []).join("\n");
    const scene = mascotSceneForText(text);
    bubble.hero = mascotHero(scene);
    bubble.xjwRecommendationHero = true;
    bubble.xjwRecommendationScene = scene;
    bubble.xjwRecommendationHeroSource = "github-pages-approved-line-oa-chibi-semantic";
  }
  return bubble;
}
function pruneRepeatedMascotHeroes(carousel) {
  // 舊版為避免重複曾刪除後續 mascot hero；LINE carousel 會以最高卡片對齊高度，
  // 導致被刪 hero 的卡片留下巨大空白。現在每張情境卡都保留自己的 hero。
  return carousel;
}
function applyVisualFix(node) {
  if (!node || typeof node !== "object") return node;
  normalizeVisibleText(node);
  if (Array.isArray(node)) { for (const item of node) applyVisualFix(item); return node; }
  if (node.type === "bubble") applyBubbleFix(node);
  for (const value of Object.values(node)) applyVisualFix(value);
  if (node.type === "carousel") pruneRepeatedMascotHeroes(node);
  return node;
}
function stripInternalMetadata(node) {
  if (!node || typeof node !== "object") return node;
  if (Array.isArray(node)) {
    for (const item of node) stripInternalMetadata(item);
    return node;
  }
  for (const key of Object.keys(node)) {
    if (/^xjw/i.test(key)) {
      delete node[key];
      continue;
    }
    stripInternalMetadata(node[key]);
  }
  return node;
}

const Client = line?.messagingApi?.MessagingApiClient;
if (Client?.prototype?.replyMessage && !Client.prototype.__xjwRecordingUiFixInstalled) {
  const previous = Client.prototype.replyMessage;
  Client.prototype.replyMessage = function patchedRecordingUiReply(payload) {
    applyVisualFix(payload?.messages);
    stripInternalMetadata(payload?.messages);
    return previous.call(this, payload);
  };
  Object.defineProperty(Client.prototype, "__xjwRecordingUiFixInstalled", { value: true, enumerable: false });
}

module.exports = {
  VERSION,
  PRODUCT_IMAGE_VERSION,
  HERO_ASPECT_RATIO,
  PUBLIC_BASE_URL,
  PRODUCTS,
  TRIAL_IMAGE,
  MASCOT_HEROES,
  GENERIC_MASCOT_HERO,
  RECOMMEND_HERO,
  MASCOT_CARD_PATTERN,
  TRIAL_PATTERN,
  rewriteVisibleText,
  normalizeVisibleText,
  collectTexts,
  collectContentTexts,
  matchedProductKeys,
  uniqueProductKey,
  productHero,
  trialHero,
  mascotSceneForText,
  mascotHero,
  rewriteProductImageActions,
  isRecommendationBubble,
  isTrialBubble,
  applyBubbleFix,
  pruneRepeatedMascotHeroes,
  applyVisualFix,
  stripInternalMetadata,
};
