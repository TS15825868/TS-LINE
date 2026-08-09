"use strict";

/**
 * 2026-08-10 LINE OA 正式畫面修正 v6
 * - 六項產品卡一律使用官網 products-v3 真正產品實拍原圖，不使用舊 products-v2、DM或海報版面。
 * - 「產品DM」一律改成「實際產品照片」。
 * - 小老闆依文案語意選擇推薦／搭配／使用／FAQ／客服／品牌／歡迎正式場景。
 * - 同一 carousel 中，非產品說明卡只保留第一張必要小老闆 hero，降低重複載入。
 * - 所有小老闆與產品 hero 使用 fit；產品只允許等比例顯示，不拉寬、不拉高、不裁切。
 */
const line = require("@line/bot-sdk");

const VERSION = "20260809-recording-ui-v6-products-v3-size-lock";
const PRODUCT_IMAGE_VERSION = "20260810-products-v3-true-originals-v2";
const SITE_BASE = "https://ts15825868.github.io/xianjiawei/";

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

const PRODUCTS = Object.freeze({
  "guilu-drink-30": {
    patterns: [/龜鹿飲\s*30\s*cc/i, /30\s*cc.*(?:玻璃罐|小玻璃罐)/i],
    image: `${SITE_BASE}images/products-v3/guilu-drink-30.jpg?v=${PRODUCT_IMAGE_VERSION}`,
  },
  "guilu-drink-180": {
    patterns: [/龜鹿飲\s*180\s*cc/i, /180\s*cc.*鋁袋/i],
    image: `${SITE_BASE}images/products-v3/guilu-drink-180.jpg?v=${PRODUCT_IMAGE_VERSION}`,
  },
  "guilu-gao": {
    patterns: [/龜鹿膏/],
    image: `${SITE_BASE}images/products-v3/guilu-gao.jpg?v=${PRODUCT_IMAGE_VERSION}`,
  },
  "guilu-tangkuai": {
    patterns: [/龜鹿湯塊/],
    image: `${SITE_BASE}images/products-v3/guilu-tangkuai.jpg?v=${PRODUCT_IMAGE_VERSION}`,
  },
  "guilu-jiao": {
    patterns: [/龜鹿膠/],
    image: `${SITE_BASE}images/products-v3/guilu-jiao.jpg?v=${PRODUCT_IMAGE_VERSION}`,
  },
  "luerong-fen": {
    patterns: [/鹿茸粉/],
    image: `${SITE_BASE}images/products-v3/luerong-fen.jpg?v=${PRODUCT_IMAGE_VERSION}`,
  },
});

const MASCOT_CARD_PATTERN = /怎麼選|幫你選|幫我推薦|產品差異|固定節奏|方便快速|沖泡[、，,\s]*燉湯|家庭使用|自己搭配|依日常|依生活|搭配方案|搭配組合|日常搭配導覽|選擇適合|使用型態|怎麼使用|使用方式|沖泡方式|燉湯方式|常見問題|FAQ|品牌故事|四代傳承|萬華開始|人工客服|門市資訊|歡迎來到仙加味|配送與付款/;

function rewriteVisibleText(value) {
  return String(value || "")
    .replaceAll("每組售價：", "商品合計：")
    .replaceAll("每組價格", "商品合計")
    .replaceAll("查看產品DM", "查看實際產品照片")
    .replaceAll("看產品DM", "看實際產品照片")
    .replaceAll("產品DM", "實際產品照片");
}

function normalizeVisibleText(node) {
  if (!node || typeof node !== "object") return node;
  if (Array.isArray(node)) {
    for (const item of node) normalizeVisibleText(item);
    return node;
  }
  if (node.type === "text" && typeof node.text === "string") node.text = rewriteVisibleText(node.text);
  if (node.action && typeof node.action === "object") {
    if (typeof node.action.label === "string") node.action.label = rewriteVisibleText(node.action.label);
    if (typeof node.action.text === "string") node.action.text = rewriteVisibleText(node.action.text);
  }
  for (const [key, value] of Object.entries(node)) {
    if (key === "action") continue;
    normalizeVisibleText(value);
  }
  return node;
}

function collectTexts(node, output = []) {
  if (!node || typeof node !== "object") return output;
  if (Array.isArray(node)) {
    for (const item of node) collectTexts(item, output);
    return output;
  }
  if (node.type === "text" && node.text) output.push(String(node.text));
  if (node.action && typeof node.action === "object") {
    if (node.action.label) output.push(String(node.action.label));
    if (node.action.text) output.push(String(node.action.text));
  }
  for (const [key, value] of Object.entries(node)) {
    if (key === "action") continue;
    collectTexts(value, output);
  }
  return output;
}

function uniqueProductKey(bubble) {
  const text = collectTexts(bubble, []).join("\n");
  const found = [];
  for (const [key, product] of Object.entries(PRODUCTS)) {
    if (product.patterns.some((pattern) => pattern.test(text))) found.push(key);
  }
  return found.length === 1 ? found[0] : "";
}

function productHero(key) {
  return {
    type: "image",
    url: PRODUCTS[key].image,
    size: "full",
    aspectRatio: "1:1",
    aspectMode: "fit",
    backgroundColor: "#EFE4D2",
  };
}

function mascotSceneForText(value = "") {
  const text = String(value || "");
  if (/常見問題|FAQ|問題整理/.test(text)) return "faq";
  if (/客服|聯絡|訂單|結帳|門市|配送|付款|下單/.test(text)) return "service";
  if (/使用|沖泡|燉湯|料理/.test(text)) return "usage";
  if (/搭配組合|搭配方案|組合/.test(text)) return "combo";
  if (/推薦|幫你選|幫我推薦|怎麼選|產品差異|依日常|依生活/.test(text)) return "recommend";
  if (/品牌|四代|萬華|傳承|故事|漢方|資料/.test(text)) return "brand";
  if (/產品|商品/.test(text)) return "products";
  return "welcome";
}

function mascotHero(scene = "welcome") {
  return {
    type: "image",
    url: MASCOT_HEROES[scene] || MASCOT_HEROES.welcome,
    size: "full",
    aspectRatio: "4:3",
    aspectMode: "fit",
    backgroundColor: "#EFE4D2",
  };
}

function rewriteProductImageActions(node, key) {
  if (!node || typeof node !== "object") return;
  if (Array.isArray(node)) {
    for (const item of node) rewriteProductImageActions(item, key);
    return;
  }
  if (node.action && typeof node.action === "object") {
    const label = String(node.action.label || "");
    if (/看產品DM|看正確產品圖|看正式產品圖|看實際產品照片|產品大圖/.test(label)) {
      node.action.label = "看實際產品照片";
      node.action.type = "uri";
      node.action.uri = PRODUCTS[key].image;
      delete node.action.text;
    }
  }
  for (const [name, value] of Object.entries(node)) {
    if (name === "action") continue;
    rewriteProductImageActions(value, key);
  }
}

function isRecommendationBubble(bubble) {
  return MASCOT_CARD_PATTERN.test(collectTexts(bubble, []).join("\n"));
}

function applyBubbleFix(bubble) {
  if (!bubble || bubble.type !== "bubble") return bubble;
  normalizeVisibleText(bubble);
  const key = uniqueProductKey(bubble);
  if (key) {
    const oldAction = bubble.hero?.action;
    bubble.hero = productHero(key);
    if (oldAction && oldAction.type === "uri" && oldAction.uri && !/\.(?:jpe?g|png|webp)(?:[?#]|$)/i.test(oldAction.uri)) {
      bubble.hero.action = oldAction;
    }
    rewriteProductImageActions(bubble, key);
    bubble.xjwProductPhoto = key;
    bubble.xjwProductPhotoAuthority = "products-v3-user-approved-originals";
    bubble.xjwProductScalePolicy = "uniform-only-no-crop-no-stretch";
    return bubble;
  }
  if (isRecommendationBubble(bubble)) {
    const text = collectTexts(bubble, []).join("\n");
    const scene = mascotSceneForText(text);
    bubble.hero = mascotHero(scene);
    bubble.xjwRecommendationHero = true;
    bubble.xjwRecommendationScene = scene;
    bubble.xjwRecommendationHeroSource = "github-pages-approved-website-chibi-semantic";
  }
  return bubble;
}

function pruneRepeatedMascotHeroes(carousel) {
  if (!carousel || carousel.type !== "carousel" || !Array.isArray(carousel.contents)) return carousel;
  let mascotHeroKept = false;
  for (const bubble of carousel.contents) {
    if (!bubble || bubble.type !== "bubble" || bubble.xjwProductPhoto) continue;
    if (!bubble.xjwRecommendationHero) continue;
    if (!mascotHeroKept) {
      mascotHeroKept = true;
      continue;
    }
    delete bubble.hero;
    bubble.xjwRecommendationHero = false;
    bubble.xjwRecommendationHeroSuppressed = true;
  }
  return carousel;
}

function applyVisualFix(node) {
  if (!node || typeof node !== "object") return node;
  normalizeVisibleText(node);
  if (Array.isArray(node)) {
    for (const item of node) applyVisualFix(item);
    return node;
  }
  if (node.type === "bubble") applyBubbleFix(node);
  for (const value of Object.values(node)) applyVisualFix(value);
  if (node.type === "carousel") pruneRepeatedMascotHeroes(node);
  return node;
}

const Client = line?.messagingApi?.MessagingApiClient;
if (Client?.prototype?.replyMessage && !Client.prototype.__xjwRecordingUiFixInstalled) {
  const previous = Client.prototype.replyMessage;
  Client.prototype.replyMessage = function patchedRecordingUiReply(payload) {
    applyVisualFix(payload?.messages);
    return previous.call(this, payload);
  };
  Object.defineProperty(Client.prototype, "__xjwRecordingUiFixInstalled", { value: true, enumerable: false });
}

module.exports = {
  VERSION,
  PRODUCT_IMAGE_VERSION,
  PRODUCTS,
  MASCOT_HEROES,
  GENERIC_MASCOT_HERO,
  RECOMMEND_HERO,
  MASCOT_CARD_PATTERN,
  rewriteVisibleText,
  normalizeVisibleText,
  collectTexts,
  uniqueProductKey,
  productHero,
  mascotSceneForText,
  mascotHero,
  rewriteProductImageActions,
  isRecommendationBubble,
  applyBubbleFix,
  pruneRepeatedMascotHeroes,
  applyVisualFix,
};
