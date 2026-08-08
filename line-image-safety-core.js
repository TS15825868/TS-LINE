"use strict";

/**
 * LINE OA outbound safety layer.
 * - 小老闆 hero 一律改寫到 xianjiawei 官網 repo 內的 LINE OA 專用 JPEG 集合；不再使用用途錯配的 TS-LINE/public/mascot 舊圖。
 * - 30cc一律使用目前正式裸小玻璃罐原圖，不從舊DM裁切、不改成瓶型。
 * - 5～7個工作天只套用龜鹿飲30cc與180cc。
 * - 龜鹿膏、龜鹿湯塊、龜鹿膠、鹿茸粉只顯示預先備貨說明。
 * - 不變更未核准貼文不得發布、LINE VOOM人工等安全規則。
 */
const line = require("@line/bot-sdk");

const VERSION = "20260808-line-oa-approved-mascot-v3";
const BASE = "https://raw.githubusercontent.com/TS15825868/xianjiawei/main/images/brand/line-oa";
const APPROVED_MASCOT_NAMES = ["welcome", "products", "recommend", "combo", "usage", "faq", "service", "brand"];
const LEGACY_MASCOT_NAMES = ["welcome.jpg", "service.jpg", "brand.jpg", "products.jpg", "cart.jpg", "recommend.jpg", "combo.jpg", "usage.jpg", "faq.jpg"];
const BLOCKED_MASCOT_ASSETS = [...LEGACY_MASCOT_NAMES];
const MASCOT_RULES = APPROVED_MASCOT_NAMES.map((name) => ({ name, url: `${BASE}/${name}.jpg?v=${VERSION}` }));

const DRINK_PRODUCT_PATTERN = /龜鹿飲|30\s*cc|180\s*cc/i;
const STOCK_PRODUCT_PATTERN = /龜鹿膏|龜鹿湯塊|龜鹿膠|鹿茸粉/;
const DRINK_30_PATTERN = /龜鹿飲\s*30\s*cc|30\s*cc.*(?:小玻璃罐|玻璃罐)/i;
const LEGACY_IMAGE_PATTERN = /(?:images\/guilu-drink-30cc-glass\.jpg|images\/dm-final\/02_guilu-drink-30cc-dm\.jpg|images\/products-v3\/guilu-drink-30-clean\.svg)/i;
const LEGACY_ORDER_NOTICE_PATTERN = /(?:訂單資料與付款方式|資料及運費)確認後安排製作加工[，,；;\s]*製作加工約需\s*5\s*[～~〜－-]\s*7\s*個工作天[；;，,\s]*完成後才安排出貨[，,；;\s]*物流配送時間另計[。.]?/g;

const DRINK_FULFILLMENT_NOTICE = "龜鹿飲為接單後安排製作加工；訂單資料與付款方式確認後，製作加工約需5～7個工作天，完成後才安排出貨，物流配送時間另計。";
const STOCK_FULFILLMENT_NOTICE = "本產品為預先製作備貨商品；訂單資料與付款方式確認後，依現貨狀況安排出貨，物流配送時間另計。";
const MIXED_FULFILLMENT_NOTICE = `${DRINK_FULFILLMENT_NOTICE}\n${STOCK_FULFILLMENT_NOTICE}`;
const GENERAL_FULFILLMENT_NOTICE = "龜鹿飲30cc與180cc為接單後安排製作加工；龜鹿膏、龜鹿湯塊、龜鹿膠與鹿茸粉為預先製作備貨商品。實際出貨時間依訂單品項與現貨狀況確認，物流配送時間另計。";

const PUBLIC_BASE_URL = String(process.env.PUBLIC_BASE_URL || process.env.RENDER_EXTERNAL_URL || "https://ts-line.onrender.com").replace(/\/$/, "");
const CLEAN_DRINK_IMAGE_PATH = "/assets/guilu-drink-30-clean.jpg";
const CLEAN_DRINK_IMAGE_URL = `${PUBLIC_BASE_URL}${CLEAN_DRINK_IMAGE_PATH}?v=${VERSION}`;
const OFFICIAL_DRINK_SOURCE = "https://ts15825868.github.io/xianjiawei/images/products-v3/guilu-drink-30.jpg?v=20260805";
let cleanDrinkImagePromise = null;

function approvedUrl(name) {
  return `${BASE}/${name}.jpg?v=${VERSION}`;
}

function mascotNameFromUrl(value) {
  const url = String(value || "");
  const match = url.match(/\/(?:mascot|line-oa)\/(welcome|products|recommend|combo|usage|faq|service|brand|cart)\.jpg(?:[?#]|$)/i);
  if (!match) return "";
  const name = match[1].toLowerCase();
  return name === "cart" ? "welcome" : name;
}

function isBlockedMascotUrl(value) {
  const url = String(value || "");
  if (!url) return false;
  const name = mascotNameFromUrl(url);
  if (name && APPROVED_MASCOT_NAMES.includes(name) && url.includes("/images/brand/line-oa/")) return false;
  return /TS15825868\/TS-LINE\/main\/public\/mascot\//i.test(url) || BLOCKED_MASCOT_ASSETS.some((asset) => url.includes(asset));
}

function collectBodyTexts(node, output = []) {
  if (!node || typeof node !== "object") return output;
  if (Array.isArray(node)) {
    for (const item of node) collectBodyTexts(item, output);
    return output;
  }
  if (node.type === "text") {
    const text = String(node.text || "").trim();
    if (text) output.push(text);
  }
  for (const [key, value] of Object.entries(node)) {
    if (key === "action" || key === "hero" || key === "footer") continue;
    if (key === "text" && node.type === "text") continue;
    collectBodyTexts(value, output);
  }
  return output;
}

function collectAllTexts(node, output = []) {
  if (!node || typeof node !== "object") return output;
  if (Array.isArray(node)) {
    for (const item of node) collectAllTexts(item, output);
    return output;
  }
  if (node.type === "text") {
    const text = String(node.text || "").trim();
    if (text) output.push(text);
  }
  for (const value of Object.values(node)) collectAllTexts(value, output);
  return output;
}

function bubbleTexts(bubble) {
  return collectBodyTexts(bubble?.body, []);
}

function sceneForBubble(bubble) {
  const text = bubbleTexts(bubble).join("\n");
  if (!text) return "";
  if (/常見問題|FAQ/.test(text)) return "faq";
  if (/搭配組合|日常搭配導覽|組合推薦/.test(text)) return "combo";
  if (/幫我推薦|幫你選|怎麼選|產品差異/.test(text)) return "recommend";
  if (/怎麼使用|使用方式|沖泡方式|燉湯方式/.test(text)) return "usage";
  if (/品牌故事|四代傳承|鹿角伯|萬華開始/.test(text)) return "brand";
  if (/人工客服|門市資訊|確認訂單|結帳/.test(text)) return "service";
  if (/歡迎來到仙加味/.test(text)) return "welcome";
  return "";
}

function approvedHero(scene) {
  return { type: "image", url: approvedUrl(scene), size: "full", aspectRatio: "4:3", aspectMode: "fit", backgroundColor: "#EFE4D2" };
}

function rewriteMascotHero(bubble) {
  if (!bubble || bubble.type !== "bubble") return;
  const semanticScene = sceneForBubble(bubble);
  if (semanticScene) {
    bubble.hero = approvedHero(semanticScene);
    return;
  }
  const legacyName = mascotNameFromUrl(bubble.hero?.url);
  if (legacyName && APPROVED_MASCOT_NAMES.includes(legacyName)) {
    bubble.hero = approvedHero(legacyName);
  } else if (bubble.hero?.type === "image" && isBlockedMascotUrl(bubble.hero.url)) {
    delete bubble.hero;
  }
}

function fulfillmentKind(bubble) {
  const text = collectAllTexts(bubble, []).join("\n");
  const hasDrink = DRINK_PRODUCT_PATTERN.test(text);
  const hasStock = STOCK_PRODUCT_PATTERN.test(text);
  if (hasDrink && hasStock) return "mixed";
  if (hasDrink) return "drink";
  if (hasStock) return "stock";
  return "general";
}

function fulfillmentNotice(kind) {
  if (kind === "drink") return DRINK_FULFILLMENT_NOTICE;
  if (kind === "stock") return STOCK_FULFILLMENT_NOTICE;
  if (kind === "mixed") return MIXED_FULFILLMENT_NOTICE;
  return GENERAL_FULFILLMENT_NOTICE;
}

function replaceLegacyOrderNotice(node, replacement) {
  if (!node || typeof node !== "object") return;
  if (Array.isArray(node)) {
    for (const item of node) replaceLegacyOrderNotice(item, replacement);
    return;
  }
  if (node.type === "text" && typeof node.text === "string") {
    LEGACY_ORDER_NOTICE_PATTERN.lastIndex = 0;
    if (LEGACY_ORDER_NOTICE_PATTERN.test(node.text)) {
      LEGACY_ORDER_NOTICE_PATTERN.lastIndex = 0;
      node.text = node.text.replace(LEGACY_ORDER_NOTICE_PATTERN, replacement);
    }
  }
  for (const value of Object.values(node)) replaceLegacyOrderNotice(value, replacement);
}

function isDrink30Bubble(bubble) {
  return DRINK_30_PATTERN.test(collectAllTexts(bubble, []).join("\n"));
}

function rewriteDrink30Artwork(node) {
  if (!node || typeof node !== "object") return;
  if (Array.isArray(node)) {
    for (const item of node) rewriteDrink30Artwork(item);
    return;
  }
  if (node.type === "image" && typeof node.url === "string" && LEGACY_IMAGE_PATTERN.test(node.url)) {
    node.url = CLEAN_DRINK_IMAGE_URL;
    node.aspectMode = "fit";
    node.backgroundColor = "#EFE4D2";
  }
  if (node.action && typeof node.action === "object" && typeof node.action.uri === "string" && LEGACY_IMAGE_PATTERN.test(node.action.uri)) {
    node.action.uri = CLEAN_DRINK_IMAGE_URL;
    if (node.action.label === "看產品DM") node.action.label = "看正確產品圖";
  }
  for (const value of Object.values(node)) rewriteDrink30Artwork(value);
}

function applyImageSafety(node) {
  if (!node || typeof node !== "object") return node;
  if (Array.isArray(node)) {
    for (const item of node) applyImageSafety(item);
    return node;
  }
  if (node.type === "bubble") {
    rewriteMascotHero(node);
    replaceLegacyOrderNotice(node, fulfillmentNotice(fulfillmentKind(node)));
    if (isDrink30Bubble(node)) rewriteDrink30Artwork(node);
  }
  for (const value of Object.values(node)) applyImageSafety(value);
  return node;
}

async function buildCleanDrinkImage() {
  if (cleanDrinkImagePromise) return cleanDrinkImagePromise;
  cleanDrinkImagePromise = (async () => {
    const sharp = require("sharp");
    const response = await fetch(OFFICIAL_DRINK_SOURCE, {
      headers: { "user-agent": "xianjiawei-line-image-safety" },
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) throw new Error(`official drink image fetch failed: ${response.status}`);
    const input = Buffer.from(await response.arrayBuffer());
    return sharp(input)
      .resize(900, 900, { fit: "contain", background: "#EFE4D2", withoutEnlargement: false })
      .flatten({ background: "#EFE4D2" })
      .jpeg({ quality: 92, progressive: true })
      .toBuffer();
  })().catch((error) => {
    cleanDrinkImagePromise = null;
    throw error;
  });
  return cleanDrinkImagePromise;
}

function installCleanDrinkRoute() {
  let express;
  try {
    express = require("express");
  } catch (_) {
    return;
  }
  const appPrototype = express?.application;
  if (!appPrototype?.listen || appPrototype.__xjwCleanDrinkRouteInstalled) return;
  const originalListen = appPrototype.listen;
  appPrototype.listen = function patchedListen(...args) {
    if (!this.locals.__xjwCleanDrinkRouteRegistered) {
      this.get(CLEAN_DRINK_IMAGE_PATH, async (_req, res) => {
        try {
          const image = await buildCleanDrinkImage();
          res.set({
            "Content-Type": "image/jpeg",
            "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
            "X-Content-Type-Options": "nosniff",
            "X-XJW-Image-Source": "official-original-no-crop",
          });
          res.status(200).send(image);
        } catch (error) {
          console.error("30cc正式產品圖產生失敗：", error?.message || error);
          res.status(503).type("text/plain").send("image temporarily unavailable");
        }
      });
      this.locals.__xjwCleanDrinkRouteRegistered = true;
    }
    return originalListen.apply(this, args);
  };
  Object.defineProperty(appPrototype, "__xjwCleanDrinkRouteInstalled", { value: true, enumerable: false });
}

installCleanDrinkRoute();

const Client = line?.messagingApi?.MessagingApiClient;
if (Client?.prototype?.replyMessage && !Client.prototype.__xjwImageSafetyInstalled) {
  const originalReplyMessage = Client.prototype.replyMessage;
  Client.prototype.replyMessage = function patchedReplyMessage(payload) {
    applyImageSafety(payload?.messages);
    return originalReplyMessage.call(this, payload);
  };
  Object.defineProperty(Client.prototype, "__xjwImageSafetyInstalled", { value: true, enumerable: false });
}

module.exports = {
  VERSION,
  BASE,
  APPROVED_MASCOT_NAMES,
  BLOCKED_MASCOT_ASSETS,
  MASCOT_RULES,
  DRINK_FULFILLMENT_NOTICE,
  STOCK_FULFILLMENT_NOTICE,
  MIXED_FULFILLMENT_NOTICE,
  GENERAL_FULFILLMENT_NOTICE,
  CLEAN_DRINK_IMAGE_PATH,
  CLEAN_DRINK_IMAGE_URL,
  OFFICIAL_DRINK_SOURCE,
  approvedUrl,
  mascotNameFromUrl,
  isBlockedMascotUrl,
  bubbleTexts,
  collectAllTexts,
  sceneForBubble,
  approvedHero,
  rewriteMascotHero,
  fulfillmentKind,
  fulfillmentNotice,
  replaceLegacyOrderNotice,
  isDrink30Bubble,
  rewriteDrink30Artwork,
  applyImageSafety,
  buildCleanDrinkImage,
  installCleanDrinkRoute,
};