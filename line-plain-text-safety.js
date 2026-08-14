"use strict";

const line = require("@line/bot-sdk");

const POLICY_VERSION = "2026-08-15-current-authority-2li-1jin-health";
const HEALTH_PATH = "/internal/api/v2/fulfillment-policy/healthz";
const DRINK_PRODUCT_IDS = ["guilu-drink-30", "guilu-drink-180"];
const READY_STOCK_PRODUCT_IDS = ["guilu-gao", "guilu-tangkuai", "guilu-jiao", "luerong-fen"];
const LEGACY_NOTICE = /(?:訂單資料與付款方式|資料及運費)確認後安排製作加工[，,；;\s]*製作加工約需\s*5\s*[～~〜－-]\s*7\s*個工作天[；;，,\s]*完成後才安排出貨[，,；;\s]*物流配送時間另計[。.]?/g;
const DRINK_PATTERN = /龜鹿飲|30\s*cc|180\s*cc/i;
const STOCK_PATTERN = /龜鹿膏|龜鹿湯塊|龜鹿膠|鹿茸粉/;
const NOTICE_MARKER = /製作加工約需|接單後安排製作加工|預先製作備貨商品|實際出貨時間依訂單品項|依現貨狀況安排出貨/;

function normalizePublicCopy(value) {
  return String(value || "")
    .replaceAll("每組售價：", "商品合計：")
    .replaceAll("每組價格", "商品合計");
}

function kindFromText(value) {
  const text = String(value || "");
  const hasDrink = DRINK_PATTERN.test(text);
  const hasStock = STOCK_PATTERN.test(text);
  if (hasDrink && hasStock) return "mixed";
  if (hasDrink) return "drink";
  if (hasStock) return "stock";
  return "general";
}

function collectContextText(node, output = []) {
  if (!node || typeof node !== "object") return output;
  if (Array.isArray(node)) { for (const item of node) collectContextText(item, output); return output; }
  if (node.type === "text" && typeof node.text === "string" && !NOTICE_MARKER.test(node.text)) output.push(normalizePublicCopy(node.text));
  for (const value of Object.values(node)) collectContextText(value, output);
  return output;
}

function replaceKnownNotices(text, replacement, core) {
  let value = normalizePublicCopy(text);
  LEGACY_NOTICE.lastIndex = 0;
  value = value.replace(LEGACY_NOTICE, replacement);
  for (const known of [core.DRINK_FULFILLMENT_NOTICE,core.STOCK_FULFILLMENT_NOTICE,core.MIXED_FULFILLMENT_NOTICE,core.GENERAL_FULFILLMENT_NOTICE]) {
    if (known && value.includes(known)) value = value.split(known).join(replacement);
  }
  return value;
}

function replacePlainTextNotice(text, core) {
  const value = normalizePublicCopy(text);
  const context = replaceKnownNotices(value, "", core);
  return replaceKnownNotices(value, core.fulfillmentNotice(kindFromText(context)), core);
}

function patchTextNodes(node, replacement, core) {
  if (!node || typeof node !== "object") return;
  if (Array.isArray(node)) { for (const item of node) patchTextNodes(item, replacement, core); return; }
  if (node.type === "text" && typeof node.text === "string") node.text = replaceKnownNotices(node.text, replacement, core);
  if (node.action && typeof node.action === "object") {
    if (typeof node.action.label === "string") node.action.label = normalizePublicCopy(node.action.label);
    if (typeof node.action.text === "string") node.action.text = normalizePublicCopy(node.action.text);
  }
  for (const [key, value] of Object.entries(node)) if (key !== "action") patchTextNodes(value, replacement, core);
}

function patchMessages(messages, core) {
  const list = Array.isArray(messages) ? messages : [messages];
  for (const message of list) {
    if (!message || typeof message !== "object") continue;
    if (message.type === "text" && typeof message.text === "string") { message.text = replacePlainTextNotice(message.text, core); continue; }
    const bubbles = message.type === "flex" ? (message.contents?.type === "carousel" ? message.contents.contents || [] : [message.contents]) : message.type === "bubble" ? [message] : [];
    for (const bubble of bubbles) {
      if (!bubble || typeof bubble !== "object") continue;
      const context = collectContextText(bubble, []).join("\n");
      patchTextNodes(bubble, core.fulfillmentNotice(kindFromText(context)), core);
    }
  }
  return messages;
}

function healthPayload(core) {
  return {
    ok: true,
    service: "仙加味 LINE OA fulfillment and image safety",
    policyVersion: POLICY_VERSION,
    serviceMode: "standalone-line-oa",
    productCount: 6,
    sellableSpecificationCount: 6,
    drinkProductIds: DRINK_PRODUCT_IDS,
    readyStockProductIds: READY_STOCK_PRODUCT_IDS,
    drinkNotice: core.DRINK_FULFILLMENT_NOTICE,
    readyStockNotice: core.STOCK_FULFILLMENT_NOTICE,
    generalNotice: core.GENERAL_FULFILLMENT_NOTICE,
    productMainImageSource: "current-approved-product-image-line-compatible-jpeg",
    detailedDmImageSource: "current-approved-dm-line-compatible-jpeg",
    trialImageSource: "20260814-user-approved-trial-line-compatible-jpeg",
    productIdentitySource: "products-v3-user-approved-originals",
    productsV2Use: "legacy-reference-only-forbidden-in-live-cards",
    imagePolicy: "product-dm-trial-identity-separated; contain-no-crop-no-stretch-no-ai-redraw",
    customerDisplayPolicy: "current-approved-product-image; separate-dm; separate-trial; products-v3-identity-only",
    cleanDrinkImagePath: core.CLEAN_DRINK_IMAGE_PATH,
    cleanDrinkImageUrl: core.CLEAN_DRINK_IMAGE_URL,
    cleanDrinkImageSource: core.OFFICIAL_DRINK_SOURCE,
    cleanDrinkImagePolicy: "legacy-compatibility-route-only-products-v3-identity-contain-no-crop",
    mascotImagePathPrefix: core.CLEAN_MASCOT_PATH_PREFIX,
    mascotPolicy: "approved-website-chibi-character-clean-jpeg-route",
    guiluDrink30Specification: "30cc／罐（小玻璃罐）",
    guiluDrink30PhysicalScale: "約Ø42×H51mm；小玻璃裸罐；不得稱瓶、不得放大成接近100g罐",
    guiluDrink180Specification: "180cc／包（鋁袋）",
    guiluDrink180PhysicalScale: "狹長直立鋁袋；寬高比目標約0.64（0.60～0.68）",
    guiluGaoSpecification: "100g／罐",
    guiluGaoUsagePrimary: "可依個人使用習慣與作息時間安排",
    guiluGaoIngredients: ["鹿角萃取物", "龜板萃取物", "枸杞", "紅棗", "黃耆", "粉光蔘"],
    guiluDrinkIngredients: ["水", "龜板萃取物", "鹿角萃取物", "粉光蔘", "枸杞", "紅棗", "黃耆"],
    guiluTangkuaiSpecification: "75g （2兩）／盒｜8塊裝",
    guiluTangkuaiDetailUnitApprox: "每塊約9.375g（顧客文字可顯示）",
    guiluTangkuaiPackage: "深藍正式盒裝",
    guiluTangkuaiIngredients: ["龜板萃取物", "鹿角萃取物"],
    guiluJiaoSpecification: "600g （1斤）／盒｜32塊裝",
    guiluJiaoDetailUnitApprox: "每塊約18.75 g（顧客文字可顯示）",
    guiluJiaoPackage: "淡紫色正式盒裝",
    guiluJiaoIngredients: ["龜板萃取物", "鹿角萃取物"],
    luerongFenSpecification: "75g／罐",
    luerongFenIngredients: ["鹿茸"],
    guardPolicy: "current-authority-capability-based-no-legacy-copy-version-lock"
  };
}

function installHealthRoute(core) {
  let express;
  try { express = require("express"); } catch (_) { return; }
  const appPrototype = express?.application;
  if (!appPrototype?.listen || appPrototype.__xjwFulfillmentHealthInstalled) return;
  const previousListen = appPrototype.listen;
  appPrototype.listen = function patchedFulfillmentHealthListen(...args) {
    if (!this.locals.__xjwFulfillmentHealthRegistered) {
      this.get(HEALTH_PATH, (_req, res) => {
        res.set({"Cache-Control":"no-store","X-Content-Type-Options":"nosniff","X-XJW-Fulfillment-Policy":POLICY_VERSION,"X-XJW-Product-Image-Authority":"current-approved-product-image-line-jpeg"});
        res.status(200).json(healthPayload(core));
      });
      this.locals.__xjwFulfillmentHealthRegistered = true;
    }
    return previousListen.apply(this, args);
  };
  Object.defineProperty(appPrototype, "__xjwFulfillmentHealthInstalled", { value: true, enumerable: false });
}

function install(core) {
  installHealthRoute(core);
  const Client = line?.messagingApi?.MessagingApiClient;
  if (!Client?.prototype?.replyMessage || Client.prototype.__xjwPlainTextFulfillmentSafetyInstalled) return;
  const previous = Client.prototype.replyMessage;
  Client.prototype.replyMessage = function patchedPlainTextReply(payload) { patchMessages(payload?.messages, core); return previous.call(this, payload); };
  Object.defineProperty(Client.prototype, "__xjwPlainTextFulfillmentSafetyInstalled", { value: true, enumerable: false });
}

module.exports = {POLICY_VERSION,HEALTH_PATH,DRINK_PRODUCT_IDS,READY_STOCK_PRODUCT_IDS,normalizePublicCopy,kindFromText,collectContextText,replaceKnownNotices,replacePlainTextNotice,patchTextNodes,patchMessages,healthPayload,installHealthRoute,install};
