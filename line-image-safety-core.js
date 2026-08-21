"use strict";

/**
 * LINE OA outbound safety layer.
 * - 小老闆 hero 使用官網已核准的 LINE OA 完整情境圖，不裁切、不拉伸、不只截角色。
 * - 「幫我推薦／搭配組合／怎麼使用」依卡片語意選對應情境；推薦與搭配不共用同一張圖。
 * - 若前一層已判定為目前正式產品 hero，安全層不得再用通用情境圖覆蓋。
 * - 30cc 一律使用目前正式裸小玻璃罐原圖，不從舊DM裁切、不改成瓶型。
 * - 5～7個工作天只套用龜鹿飲30cc與180cc。
 * - 龜鹿膏、龜鹿湯塊、龜鹿膠、鹿茸粉只顯示預先備貨說明。
 */
const line = require("@line/bot-sdk");

const VERSION = "20260821-line-oa-full-scene-v6";
const PRODUCT_IMAGE_VERSION = "20260810-products-v3-latest-originals-v3";
const SOURCE_BASE = "https://raw.githubusercontent.com/TS15825868/xianjiawei/main/images/brand/line-oa";
const BASE = SOURCE_BASE;
const APPROVED_MASCOT_NAMES = ["welcome", "products", "recommend", "combo", "usage", "faq", "service", "brand"];
const MASCOT_SOURCE_MAP = Object.freeze({
  welcome: "welcome",
  products: "products",
  recommend: "recommend",
  combo: "combo",
  usage: "usage",
  faq: "faq",
  service: "service",
  brand: "brand",
});
const LEGACY_MASCOT_NAMES = ["welcome.jpg", "service.jpg", "brand.jpg", "products.jpg", "cart.jpg", "recommend.jpg", "combo.jpg", "usage.jpg", "faq.jpg"];
const BLOCKED_MASCOT_ASSETS = [...LEGACY_MASCOT_NAMES];

const DRINK_PRODUCT_PATTERN = /龜鹿飲|30\s*cc|180\s*cc/i;
const STOCK_PRODUCT_PATTERN = /龜鹿膏|龜鹿湯塊|龜鹿膠|鹿茸粉/;
const DRINK_30_PATTERN = /龜鹿飲\s*30\s*cc|30\s*cc.*(?:小玻璃罐|玻璃罐)/i;
const LEGACY_IMAGE_PATTERN = /(?:images\/guilu-drink-30cc-glass\.jpg|images\/dm-final\/02_guilu-drink-30cc-dm\.jpg|images\/products-v3\/guilu-drink-30-clean\.svg)/i;
const LEGACY_ORDER_NOTICE_PATTERN = /(?:訂單資料與付款方式|資料及運費)確認後安排製作加工[，,；;\s]*製作加工約需\s*5\s*[～~〜－-]\s*7\s*個工作天[；;，,\s]*完成後才安排出貨[，,；;\s]*物流配送時間另計[。.]?/g;
const CURRENT_FORMAL_PRODUCT_HERO_PATTERN = /\/assets\/formal-product\/(?:guilu-gao|guilu-drink-30|guilu-drink-180|guilu-tangkuai|guilu-jiao|luerong-fen)\.jpg(?:[?#]|$)/i;
const CURRENT_DIRECT_PRODUCT_HERO_PATTERN = /\/images\/(?:customer-display-v20260812|products-v3)\//i;

const DRINK_FULFILLMENT_NOTICE = "龜鹿飲為接單後安排製作加工；訂單資料與付款方式確認後，製作加工約需5～7個工作天，完成後才安排出貨，物流配送時間另計。";
const STOCK_FULFILLMENT_NOTICE = "本產品為預先製作備貨商品；訂單資料與付款方式確認後，依現貨狀況安排出貨，物流配送時間另計。";
const MIXED_FULFILLMENT_NOTICE = `${DRINK_FULFILLMENT_NOTICE}\n${STOCK_FULFILLMENT_NOTICE}`;
const GENERAL_FULFILLMENT_NOTICE = "龜鹿飲30cc與180cc為接單後安排製作加工；龜鹿膏、龜鹿湯塊、龜鹿膠與鹿茸粉為預先製作備貨商品。實際出貨時間依訂單品項與現貨狀況確認，物流配送時間另計。";

const PUBLIC_BASE_URL = String(process.env.PUBLIC_BASE_URL || process.env.RENDER_EXTERNAL_URL || "https://ts-line.onrender.com").replace(/\/$/, "");
const CLEAN_DRINK_IMAGE_PATH = "/assets/guilu-drink-30-clean.jpg";
const CLEAN_DRINK_IMAGE_URL = `${PUBLIC_BASE_URL}${CLEAN_DRINK_IMAGE_PATH}?v=${PRODUCT_IMAGE_VERSION}`;
const CLEAN_MASCOT_PATH_PREFIX = "/assets/mascot-clean";
const OFFICIAL_DRINK_SOURCE = `https://ts15825868.github.io/xianjiawei/images/products-v3/guilu-drink-30.jpg?v=${PRODUCT_IMAGE_VERSION}`;
let cleanDrinkImagePromise = null;
const cleanMascotImagePromises = new Map();

function normalizeMascotName(value) {
  const name = String(value || "").trim().toLowerCase();
  if (name === "cart") return "welcome";
  return APPROVED_MASCOT_NAMES.includes(name) ? name : "";
}
function approvedUrl(name) {
  const safe = normalizeMascotName(name) || "brand";
  return `${PUBLIC_BASE_URL}${CLEAN_MASCOT_PATH_PREFIX}/${safe}.jpg?v=${VERSION}`;
}
function mascotSourceUrl(name) {
  const safe = normalizeMascotName(name) || "brand";
  const sourceName = MASCOT_SOURCE_MAP[safe] || "brand";
  return `${SOURCE_BASE}/${sourceName}.jpg?v=${VERSION}`;
}
const MASCOT_RULES = APPROVED_MASCOT_NAMES.map((name) => ({ name, url: approvedUrl(name), source: mascotSourceUrl(name) }));

function mascotNameFromUrl(value) {
  const url = String(value || "");
  const match = url.match(/\/(?:mascot|line-oa|mascot-clean)\/(welcome|products|recommend|combo|usage|faq|service|brand|cart)\.jpg(?:[?#]|$)/i);
  if (!match) return "";
  return normalizeMascotName(match[1]);
}
function isBlockedMascotUrl(value) {
  const url = String(value || "");
  if (!url) return false;
  if (url.includes(`${CLEAN_MASCOT_PATH_PREFIX}/`)) return false;
  if (/TS15825868\/TS-LINE\/main\/public\/mascot\//i.test(url)) return true;
  if (/TS15825868\/xianjiawei\/main\/images\/brand\/line-oa\//i.test(url)) return true;
  return BLOCKED_MASCOT_ASSETS.some((asset) => url.includes(`/mascot/${asset}`));
}
function isCurrentProductHero(value) {
  const url = String(value || "");
  return CURRENT_FORMAL_PRODUCT_HERO_PATTERN.test(url) || CURRENT_DIRECT_PRODUCT_HERO_PATTERN.test(url);
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
  // 前一層已經辨識出單一正式產品時，這裡只能保護，不得再被「使用方式」等語意改回通用情境圖。
  if (isCurrentProductHero(bubble.hero?.url)) return;
  const semanticScene = sceneForBubble(bubble);
  if (semanticScene) {
    bubble.hero = approvedHero(semanticScene);
    return;
  }
  const legacyName = mascotNameFromUrl(bubble.hero?.url);
  if (legacyName) {
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
    if (node.action.label === "看產品DM") node.action.label = "看產品圖";
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

async function fetchImageBuffer(url, label) {
  const response = await fetch(url, {
    headers: { "user-agent": "xianjiawei-line-image-safety" },
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error(`${label} fetch failed: ${response.status}`);
  return Buffer.from(await response.arrayBuffer());
}
async function buildCleanDrinkImage() {
  if (cleanDrinkImagePromise) return cleanDrinkImagePromise;
  cleanDrinkImagePromise = (async () => {
    const sharp = require("sharp");
    const input = await fetchImageBuffer(OFFICIAL_DRINK_SOURCE, "official drink image");
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
async function buildCleanMascotImage(name) {
  const safe = normalizeMascotName(name);
  if (!safe) throw new Error("unsupported mascot scene");
  if (cleanMascotImagePromises.has(safe)) return cleanMascotImagePromises.get(safe);
  const promise = (async () => {
    const sharp = require("sharp");
    const input = await fetchImageBuffer(mascotSourceUrl(safe), `mascot ${safe}`);
    return sharp(input)
      .rotate()
      .resize({ width: 1200, height: 900, fit: "inside", withoutEnlargement: true })
      .flatten({ background: "#EFE4D2" })
      .jpeg({ quality: 91, progressive: true })
      .toBuffer();
  })().catch((error) => {
    cleanMascotImagePromises.delete(safe);
    throw error;
  });
  cleanMascotImagePromises.set(safe, promise);
  return promise;
}

function installImageRoutes() {
  let express;
  try {
    express = require("express");
  } catch (_) {
    return;
  }
  const appPrototype = express?.application;
  if (!appPrototype?.listen || appPrototype.__xjwImageRoutesInstalled) return;
  const originalListen = appPrototype.listen;
  appPrototype.listen = function patchedListen(...args) {
    if (!this.locals.__xjwImageRoutesRegistered) {
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
      this.get(`${CLEAN_MASCOT_PATH_PREFIX}/:name.jpg`, async (req, res) => {
        const name = normalizeMascotName(req.params.name);
        if (!name) return res.status(404).type("text/plain").send("Not Found");
        try {
          const image = await buildCleanMascotImage(name);
          res.set({
            "Content-Type": "image/jpeg",
            "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
            "X-Content-Type-Options": "nosniff",
            "X-XJW-Image-Source": "approved-website-chibi-full-scene-no-crop",
          });
          return res.status(200).send(image);
        } catch (error) {
          console.error(`小老闆完整情境圖產生失敗 ${name}：`, error?.message || error);
          return res.status(503).type("text/plain").send("image temporarily unavailable");
        }
      });
      this.locals.__xjwImageRoutesRegistered = true;
    }
    return originalListen.apply(this, args);
  };
  Object.defineProperty(appPrototype, "__xjwImageRoutesInstalled", { value: true, enumerable: false });
}

installImageRoutes();

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
  PRODUCT_IMAGE_VERSION,
  BASE,
  SOURCE_BASE,
  PUBLIC_BASE_URL,
  APPROVED_MASCOT_NAMES,
  MASCOT_SOURCE_MAP,
  BLOCKED_MASCOT_ASSETS,
  MASCOT_RULES,
  DRINK_FULFILLMENT_NOTICE,
  STOCK_FULFILLMENT_NOTICE,
  MIXED_FULFILLMENT_NOTICE,
  GENERAL_FULFILLMENT_NOTICE,
  CLEAN_DRINK_IMAGE_PATH,
  CLEAN_DRINK_IMAGE_URL,
  CLEAN_MASCOT_PATH_PREFIX,
  OFFICIAL_DRINK_SOURCE,
  normalizeMascotName,
  approvedUrl,
  mascotSourceUrl,
  mascotNameFromUrl,
  isBlockedMascotUrl,
  isCurrentProductHero,
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
  buildCleanMascotImage,
  installImageRoutes,
};
