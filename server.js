"use strict";

// Always install the LINE image safety layer, even when Render overrides npm start.
require("./line-image-safety");

/**
 * 仙加味 LINE OA Bot v401.5
 * 單一正式主程式：產品、價格、購物車、結帳、品牌故事、古籍資料與健康問題轉介。
 * LINE 憑證僅從部署環境變數讀取；CRM 可由環境變數覆蓋預設網址。
 */

const line = require("@line/bot-sdk");
const express = require("express");
const fs = require("fs");
const path = require("path");
const { isSensitiveHealthQuestion, isExplicitDoctorReferralRequest, isEmergencyHealthQuestion } = require("./medical-referral-policy");
const ownerAlert = require("./line-owner-alert-runtime");

const VERSION = "v401.9";
const SITE_URL = "https://ts15825868.github.io/xianjiawei/";
const DRINK_ORDER_NOTICE = "龜鹿飲30cc與180cc為接單後安排製作；訂單資料與付款方式確認後，製作加工約需5～7個工作天，完成後才安排出貨，物流配送時間另計。";
const READY_STOCK_ORDER_NOTICE = "本產品為預先製作備貨商品；訂單資料與付款方式確認後，依現貨狀況安排出貨，物流配送時間另計。";
const MIXED_ORDER_NOTICE = "龜鹿飲30cc與180cc為接單後安排製作，約需5～7個工作天；龜鹿膏與鹿茸粉依現貨狀況安排。物流配送時間另計。";
const CRM_URL = process.env.CRM_URL || "https://script.google.com/macros/s/AKfycbwAFBxeROd2ZYGJ_h0O7_H2MMxptOMoj3EXIErZpbKuTYFOzOVwQkrk8X1MoxapkHVGSA/exec";
const CRM_TIMEOUT_MS = Number(process.env.CRM_TIMEOUT_MS || 8000);
const STATE_TTL_MS = Number(process.env.STATE_TTL_MS || 24 * 60 * 60 * 1000);
const STATE_CLEANUP_INTERVAL_MS = Number(process.env.STATE_CLEANUP_INTERVAL_MS || 60 * 60 * 1000);
const MAX_STATE_ENTRIES = Number(process.env.MAX_STATE_ENTRIES || 10000);

const config = {
  channelAccessToken: process.env.CHANNEL_ACCESS_TOKEN || "",
  channelSecret: process.env.CHANNEL_SECRET || "",
};

const app = express();
const PUBLIC_BASE_URL = (process.env.PUBLIC_BASE_URL || process.env.RENDER_EXTERNAL_URL || "").replace(/\/$/, "");
const MASCOT_VERSION = "401.7-20260801-issue146";
// LINE fetches images independently from the webhook. Use GitHub's CDN instead of
// the sleeping Render instance so image cards appear faster and cache busting is reliable.
const mascotAssetUrl = (name) =>
  `https://raw.githubusercontent.com/TS15825868/TS-LINE/main/public/mascot/${name}.jpg?v=${MASCOT_VERSION}`;
app.use("/mascot", express.static(path.join(__dirname, "public", "mascot"), {
  maxAge: "1h",
  immutable: false,
  etag: true,
}));
const client = config.channelAccessToken
  ? new line.messagingApi.MessagingApiClient({ channelAccessToken: config.channelAccessToken })
  : null;
let lastWebhookAt = "";
let lastReplySuccessAt = "";
let lastReplyError = "";
const states = new Map();
const processedWebhookEvents = new Map();
const processingWebhookEvents = new Set();
const WEBHOOK_EVENT_TTL_MS = 10 * 60 * 1000;

function cleanupWebhookEventCache(now = Date.now()) {
  for (const [key, createdAt] of processedWebhookEvents) {
    if (now - createdAt > WEBHOOK_EVENT_TTL_MS) processedWebhookEvents.delete(key);
  }
}

function beginWebhookEvent(event) {
  const id = String(event?.webhookEventId || "");
  cleanupWebhookEventCache();
  if (!id) return true;
  if (processedWebhookEvents.has(id) || processingWebhookEvents.has(id)) return false;
  processingWebhookEvents.add(id);
  return true;
}

function finishWebhookEvent(event, success) {
  const id = String(event?.webhookEventId || "");
  if (!id) return;
  processingWebhookEvents.delete(id);
  if (success) processedWebhookEvents.set(id, Date.now());
}
const DATA = loadData();
const PARTNER_CAROUSEL = require("./line-partner-public-carousel.json").products.filter(p => p && p.id && p.name && p.image && p.page);

function validateData(data) {
  if (!data || typeof data !== "object") throw new Error("data.json 必須是 JSON 物件");
  if (!Array.isArray(data.products) || !data.products.length) throw new Error("data.json 缺少 products");
  for (const product of data.products) {
    for (const field of ["id", "name", "unit", "image", "usage", "ingredients"]) {
      if (product[field] === undefined || product[field] === null || product[field] === "") {
        throw new Error((product.id || "unknown") + " 缺少 " + field);
      }
    }
  }
  return data;
}

function loadData() {
  const file = path.join(__dirname, "data.json");
  try {
    const data = validateData(JSON.parse(fs.readFileSync(file, "utf8")));
    data.siteUrl = data.siteUrl || SITE_URL;
    data.products = data.products.map((product) => ({
      ...product,
      displayName: product.displayName || product.name,
      spec: product.spec || product.size || "",
      offers: product.offers || [],
      orderStatus: "開放下單",
      shippingNotice: "實際庫存與出貨時間由客服確認。",
    }));
    return data;
  } catch (error) {
    console.error("data.json 載入失敗：" + error.message);
    throw error;
  }
}

function money(value) {
  return `$${Number(value || 0).toLocaleString("zh-TW")}`;
}

function productSpecText(product){const spec=String(product?.spec||product?.size||product?.specification||"").trim();const detail=String(product?.detailUnitApprox||"").trim();if(!detail||spec.includes(detail))return spec;return `${spec}，${detail}`;}

function absoluteUrl(asset = "") {
  if (/^https?:\/\//i.test(asset)) return encodeURI(asset);
  return encodeURI(`${DATA.siteUrl.replace(/\/?$/, "/")}${String(asset).replace(/^\/+/, "")}`);
}

function getProduct(id) {
  return DATA.products.find((product) => product.id === id) || null;
}

function orderNoticeForProduct(product) {
  if (!product) return MIXED_ORDER_NOTICE;
  if (String(product.fulfillmentNotice || "").trim()) return String(product.fulfillmentNotice).trim();
  return product.fulfillmentType === "made-to-order-drink" || product.readyStock === false
    ? DRINK_ORDER_NOTICE
    : READY_STOCK_ORDER_NOTICE;
}

function orderNoticeForCombo(combo) {
  const products = (combo?.products || []).map((item) => getProduct(item.productId)).filter(Boolean);
  if (!products.length) return MIXED_ORDER_NOTICE;
  const hasDrink = products.some((product) => product.fulfillmentType === "made-to-order-drink" || product.readyStock === false);
  const hasReady = products.some((product) => product.fulfillmentType !== "made-to-order-drink" && product.readyStock !== false);
  if (hasDrink && hasReady) return MIXED_ORDER_NOTICE;
  return hasDrink ? DRINK_ORDER_NOTICE : READY_STOCK_ORDER_NOTICE;
}

function orderNoticeForCart(cart = []) {
  if (!cart.length) return MIXED_ORDER_NOTICE;
  if (cart.some((item) => item.trial)) return String(DATA.trialCampaign?.fulfillmentRule || DRINK_ORDER_NOTICE);
  const products = [];
  for (const item of cart) {
    if (Number.isInteger(item.comboIndex)) {
      const combo = getCombo(item.comboIndex);
      for (const component of combo?.products || []) {
        const product = getProduct(component.productId);
        if (product) products.push(product);
      }
    } else {
      const product = getProduct(item.id);
      if (product) products.push(product);
    }
  }
  if (!products.length) return MIXED_ORDER_NOTICE;
  const hasDrink = products.some((product) => product.fulfillmentType === "made-to-order-drink" || product.readyStock === false);
  const hasReady = products.some((product) => product.fulfillmentType !== "made-to-order-drink" && product.readyStock !== false);
  if (hasDrink && hasReady) return MIXED_ORDER_NOTICE;
  return hasDrink ? DRINK_ORDER_NOTICE : READY_STOCK_ORDER_NOTICE;
}

function cleanupExpiredStates(now = Date.now()) {
  for (const [userId, state] of states) {
    if (now - Number(state.lastActivity || 0) > STATE_TTL_MS) states.delete(userId);
  }
}

function getState(userId) {
  const now = Date.now();
  cleanupExpiredStates(now);
  if (!states.has(userId)) {
    if (states.size >= MAX_STATE_ENTRIES) {
      const oldest = [...states.entries()].sort((a, b) => (a[1].lastActivity || 0) - (b[1].lastActivity || 0))[0];
      if (oldest) states.delete(oldest[0]);
    }
    states.set(userId, { cart: [], checkout: null, lastActivity: now });
  }
  const state = states.get(userId);
  state.lastActivity = now;
  return state;
}

const cleanupTimer = setInterval(cleanupExpiredStates, STATE_CLEANUP_INTERVAL_MS);
cleanupTimer.unref?.();

function sanitizeUserText(value, maxLength = 500) {
  return String(value || "")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function pb(action, params = {}) {
  return new URLSearchParams({ action, ...params }).toString();
}

function parsePB(data = "") {
  const params = new URLSearchParams(data);
  return {
    action: params.get("action") || "",
    productId: params.get("productId") || "",
    qty: Number(params.get("qty") || 0),
  };
}

function quick(items) {
  return {
    items: items.slice(0, 13).map((item) => ({
      type: "action",
      action: item.uri
        ? { type: "uri", label: item.label, uri: item.uri }
        : { type: "message", label: item.label, text: item.text || item.label },
    })),
  };
}

function textMsg(text, items = []) {
  const message = { type: "text", text };
  if (items.length) message.quickReply = quick(items);
  return message;
}

function buttonAction(button) {
  if (button.uri) return { type: "uri", label: button.label, uri: button.uri };
  return {
    type: "message",
    label: button.label,
    text: button.text || button.label,
  };
}

function mainQuick() {
  return [
    { label: "申請試喝", text: "申請試喝" },
    { label: "看產品", text: "看產品" },
    { label: "商品分類", text: "商品分類" },
    { label: "價格方案", text: "價格方案" },
    { label: "幫我推薦", text: "幫我推薦" },
    { label: "搭配組合", text: "搭配組合" },
    { label: "怎麼使用", text: "怎麼使用" },
    { label: "常見問題", text: "常見問題" },
    { label: "購物車", text: "查看購買清單" },
    { label: "人工客服", text: "我要人工客服" },
  ];
}

function storeServiceText() {
  const store = DATA.store || {};
  return `門市地址：${store.address || "台北市萬華區西昌街52號"}。
營業時間：${store.hours || "週一至週五 10:30－20:00；週六、週日休息"}。
${store.holidayNote || "官方 LINE 可隨時留言；店休及非營業時間的訊息，將依實際情況回覆。週末如有配送、自取需求，也可先透過 LINE 詢問安排。"}
官網：24 小時可瀏覽產品、品牌、使用方式與常見問題。

請直接留下想詢問的產品、規格、數量、配送或取貨需求，我們會由人工協助回覆。`;
}

function flexCard(title, description, buttons = []) {
  const footerButtons = buttons.slice(0, 5).map((button, index) => ({
    type: "button",
    style: index === 0 ? "primary" : "secondary",
    ...(index === 0 ? { color: "#7B1E1E" } : {}),
    action: buttonAction(button),
  }));

  return {
    type: "flex",
    altText: title,
    contents: {
      type: "bubble",
      body: {
        type: "box",
        layout: "vertical",
        spacing: "md",
        contents: [
          { type: "text", text: title, weight: "bold", size: "xl", color: "#7B1E1E", wrap: true },
          { type: "text", text: description, size: "sm", color: "#555555", wrap: true },
        ],
      },
      ...(footerButtons.length
        ? {
            footer: {
              type: "box",
              layout: "vertical",
              spacing: "sm",
              contents: footerButtons,
            },
          }
        : {}),
    },
  };
}

function fallbackReplyText(messages) {
  const list = Array.isArray(messages) ? messages : [messages];
  for (const message of list) {
    if (message?.type === "text" && message.text) return String(message.text).slice(0, 5000);
    if (message?.type === "flex" && message.altText) return String(message.altText).slice(0, 5000);
  }
  return "仙加味已收到您的訊息，請稍候再試一次，或輸入「人工客服」。";
}

async function reply(token, messages) {
  if (!client) {
    lastReplyError = "LINE credentials are not configured";
    console.warn("LINE credentials are not configured; reply skipped.");
    return false;
  }

  const normalized = Array.isArray(messages) ? messages : [messages];
  try {
    await client.replyMessage({ replyToken: token, messages: normalized });
    lastReplySuccessAt = new Date().toISOString();
    lastReplyError = "";
    return true;
  } catch (error) {
    const detail = error?.body || error?.originalError?.response?.data || error?.response?.data || error.message || error;
    lastReplyError = typeof detail === "object" ? JSON.stringify(detail).slice(0, 1000) : String(detail).slice(0, 1000);
    console.error("LINE 回覆失敗：", lastReplyError);

    if (normalized.some((message) => message?.type !== "text")) {
      try {
        await client.replyMessage({
          replyToken: token,
          messages: [{
            type: "text",
            text: fallbackReplyText(normalized),
            quickReply: {
              items: mainQuick().slice(0, 13).map((item) => ({
                type: "action",
                action: { type: "message", label: item.label, text: item.text },
              })),
            },
          }],
        });
        lastReplySuccessAt = new Date().toISOString();
        return true;
      } catch (fallbackError) {
        const fallbackDetail = fallbackError?.body || fallbackError?.message || fallbackError;
        lastReplyError += ` | fallback: ${typeof fallbackDetail === "object" ? JSON.stringify(fallbackDetail) : String(fallbackDetail)}`;
        console.error("LINE 純文字備援回覆失敗：", lastReplyError);
      }
    }
    return false;
  }
}

function productBubble(product) {
  const retailPrice = Number(product.price);
  const priceLine = Number.isFinite(retailPrice) && retailPrice > 0 && product.quoteOnly !== true
    ? `末端售價：${money(retailPrice)}` : "售價請洽 LINE 客服確認";
  const productUrl = absoluteUrl(product.page || "products.html");
  const productImage = absoluteUrl(product.image || "images/logo.png");

  return {
    type: "bubble",
    size: "kilo",
    hero: {
      type: "image",
      url: productImage,
      size: "full",
      aspectRatio: "4:3",
      aspectMode: "fit",
      backgroundColor: "#EFE4D2",
      action: { type: "uri", uri: productUrl },
    },
    body: {
      type: "box",
      layout: "vertical",
      spacing: "md",
      contents: [
        { type: "text", text: product.displayName, weight: "bold", size: "xl", color: "#7B1E1E", wrap: true },
        {
          type: "text",
          text: `規格：${productSpecText(product)}\n${product.purpose ? `用途方向：${product.purpose}\n` : ""}${priceLine}`,
          size: "sm",
          color: "#555555",
          wrap: true,
        },
        { type: "text", text: product.fulfillmentType === "made-to-order-drink" ? "接單製作，約 5～7 個工作天出貨；配送時間另計。" : "依現貨安排出貨，配送時間另計。", size: "xs", color: "#666666", wrap: true },
      ],
    },
    footer: {
      type: "box",
      layout: "vertical",
      spacing: "sm",
      contents: [
        {
          type: "button",
          style: "primary",
          color: "#7B1E1E",
          action: { type: "message", label: "選擇數量", text: `選擇數量｜${product.id}` },
        },
        {
          type: "button",
          style: "secondary",
          action: { type: "uri", label: "商品詳細介紹", uri: productUrl },
        },
        {
          type: "button",
          style: "secondary",
          action: { type: "message", label: "使用方式", text: `使用方式｜${product.id}` },
        },
      ],
    },
  };
}

function partnerProductBubble(product) {
  const productUrl = absoluteUrl(product.page);
  return {
    type: "bubble",
    size: "kilo",
    hero: {
      type: "image",
      url: absoluteUrl(product.image),
      size: "full",
      aspectRatio: "4:3",
      aspectMode: "fit",
      backgroundColor: "#EFE4D2",
      action: { type: "uri", uri: productUrl },
    },
    body: {
      type: "box",
      layout: "vertical",
      spacing: "md",
      contents: [
        { type: "text", text: product.name, weight: "bold", size: "xl", color: "#7B1E1E", wrap: true },
        { type: "text", text: `規格：${product.specification}\n售價與供貨請洽 LINE 客服確認`, size: "sm", color: "#555555", wrap: true },
      ],
    },
    footer: {
      type: "box",
      layout: "vertical",
      spacing: "sm",
      contents: [
        { type: "button", style: "primary", color: "#7B1E1E",
          action: { type: "message", label: "詢問這項商品", text: `詢問商品｜${product.id}` } },
        { type: "button", style: "secondary",
          action: { type: "uri", label: "商品詳細介紹", uri: productUrl } },
        { type: "button", style: "secondary",
          action: { type: "message", label: "人工客服", text: "我要人工客服" } },
      ],
    },
  };
}

function productCarousel() {
  const allPublicProducts = [
    ...DATA.products.map(productBubble),
    ...PARTNER_CAROUSEL.map(partnerProductBubble),
  ];
  // LINE Flex carousel 每次最多 12 張 bubble；超過時由後續版本分組，不可無聲截斷。
  if (allPublicProducts.length > 12) throw new Error("LINE 全部商品超過 12 張，需依正式分類分組展示");
  return {
    type: "flex",
    altText: "仙加味全部商品｜左右滑動查看",
    contents: { type: "carousel", contents: allPublicProducts },
  };
}

function productMenuReply() {
  return productCarousel();
}

function priceCarousel() {
  return textMsg("已核准商品的末端售價請查看商品卡；優惠、供貨與其他商品價格請由仙加味 LINE 人工客服確認。", [{ label: "看產品", text: "看產品" }, { label: "人工客服", text: "我要人工客服" }]);
}

function qtyMenu(product) {
  const options = Array.isArray(product.quantityOptions) && product.quantityOptions.length
    ? product.quantityOptions.slice(0, 4) : [1, 2, 3, 5];
  const retailPrice = Number(product.price);
  const canOrder = product.quoteOnly !== true && Number.isFinite(retailPrice) && retailPrice > 0;
  const buttons = options.map(qty => {
    const quantity = Number(qty);
    const validQuantity = Number.isInteger(quantity) && quantity > 0 && quantity <= 99;
    if (!validQuantity) return null;
    const total = canOrder ? calcItem(product, quantity).total : 0;
    return {
      label: canOrder ? `${quantity}${product.unit || "件"}｜${money(total)}`.slice(0, 20) : `${quantity}${product.unit || "件"}`,
      text: `${canOrder ? "加入購物車" : "詢價數量"}｜${product.id}｜${quantity}`
    };
  }).filter(Boolean);
  buttons.push({ label: "人工客服", text: "我要人工客服" });
  return flexCard(
    `${product.displayName}｜${canOrder ? "選擇數量" : "詢問數量"}`,
    `${productSpecText(product)}\n${orderNoticeForProduct(product)}\n${canOrder ? "以下為目前核准末端售價；活動優惠請向客服確認。" : "售價、供貨及優惠由人工客服確認。"}`,
    buttons
  );
}

function calcItem(product, qty) {
  const offers = [...product.offers].sort((a, b) => Number(b.qty) - Number(a.qty));
  let remain = qty;
  let total = 0;
  const labels = [];

  for (const offer of offers) {
    const count = Math.floor(remain / Number(offer.qty));
    if (count) {
      remain -= count * Number(offer.qty);
      total += count * Number(offer.total);
      labels.push(`${offer.label}×${count}`);
    }
  }

  if (remain) {
    total += remain * Number(product.price || 0);
    labels.push(`單${product.unit || "件"}×${remain}`);
  }

  return { total, label: labels.join("＋") || `${qty}${product.unit || "件"}` };
}

function addCart(state, product, qty) {
  if (product.quoteOnly) return false;
  const existing = state.cart.find((item) => item.id === product.id);
  if (existing) existing.qty += qty;
  else state.cart.push({ id: product.id, name: product.displayName, qty, unit: product.unit || "件" });

  const item = state.cart.find((cartItem) => cartItem.id === product.id);
  const calculated = calcItem(product, item.qty);
  item.total = calculated.total;
  item.label = calculated.label;
}

function cartTotal(cart) {
  return cart.reduce((sum, item) => sum + Number(item.total || 0), 0);
}

function cartFlex(state) {
  const buildCartCard = (description, buttons) => {
    const message = flexCard("購物車｜小老闆幫你整理", description, buttons);
    message.contents.size = "mega";
    return message;
  };

  if (!state.cart.length) {
    return buildCartCard(`目前購物車是空的。\n\n${MIXED_ORDER_NOTICE}`, [
      { label: "看產品", text: "看產品" },
      { label: "價格方案", text: "價格方案" },
    ]);
  }

  const lines = state.cart
    .map((item, index) => `${index + 1}. ${item.name}\n數量：${item.qty}${item.unit}\n方案：${item.label}\n小計：${money(item.total)}`)
    .join("\n\n");

  return buildCartCard(`${lines}\n\n合計：${money(cartTotal(state.cart))}\n\n${orderNoticeForCart(state.cart)}`, [
    { label: "直接結帳", text: "開始結帳" },
    { label: "繼續選購", text: "看產品" },
    { label: "清空購物車", text: "清空購物車" },
  ]);
}

const MASCOT_PATHS = {
  welcome: mascotAssetUrl("welcome"),
  recommend: mascotAssetUrl("recommend"),
  usage: mascotAssetUrl("usage"),
  faq: mascotAssetUrl("faq"),
  service: mascotAssetUrl("service"),
  brand: mascotAssetUrl("brand"),
};

function mascotPoseForTitle(title = "") {
  if (/常見問題|FAQ/.test(title)) return "faq";
  if (/客服|聯絡|確認|訂單|結帳|門市/.test(title)) return "service";
  if (/使用|沖泡|燉湯|料理/.test(title)) return "usage";
  if (/推薦|幫你選|怎麼選/.test(title)) return "recommend";
  if (/傳承|故事|品牌|漢方|百科|資料/.test(title)) return "brand";
  return "welcome";
}

function mascotBubble(title, description, buttons, pose = "") {
  const bubble = flexCard(title, description, buttons).contents;
  bubble.size = "mega";
  const imagePath = MASCOT_PATHS[pose || mascotPoseForTitle(title)] || MASCOT_PATHS.welcome;
  bubble.hero = {
    type: "image",
    url: absoluteUrl(imagePath),
    size: "full",
    aspectRatio: "1:1",
    aspectMode: "fit",
    backgroundColor: "#EFE4D2",
    action: { type: "uri", uri: absoluteUrl("brand.html") },
  };
  return bubble;
}

function mascotWelcomeReply() {
  return {
    type: "flex",
    altText: "歡迎來到仙加味",
    contents: mascotBubble(
      "歡迎來到仙加味",
      `您好，歡迎來到仙加味。\n\n仙加味提供自有品牌與其他廠牌商品。可先到官網查看圖片、規格與介紹，再由官方 LINE 協助詢問、確認供貨及適用的交易方式。\n\n${MIXED_ORDER_NOTICE}`,
      [
        { label: "看產品", text: "看產品" },
        { label: "幫我推薦", text: "幫我推薦" },
        { label: "人工客服", text: "我要人工客服" },
      ]
    ),
  };
}
function recommendReply() {
  const cards = [
    mascotBubble(
      "依日常使用方式幫你選",
      "先依固定安排、方便即飲、沖泡燉湯、家庭規格或自行搭配飲品來比較。產品規格與價格仍以正式產品卡為準。",
      [
        { label: "看產品", text: "看產品" },
        { label: "搭配組合", text: "搭配組合" },
        { label: "人工客服", text: "我要人工客服" },
      ]
    ),
    flexCard(
      "固定日常安排",
      "想建立固定日常安排可從龜鹿膏開始；需要輕巧攜帶可看龜鹿飲30cc，偏好較完整即飲份量可看龜鹿飲180cc鋁袋。",
      [
        { label: "看龜鹿膏", text: "產品詳情｜guilu-gao" },
        { label: "看30cc", text: "產品詳情｜guilu-drink-30" },
        { label: "看180cc", text: "產品詳情｜guilu-drink-180" },
      ]
    ).contents,
    flexCard(
      "自行搭配飲品",
      "喜歡依自己的飲食習慣加入溫水、牛奶、豆漿或其他飲品，可查看鹿茸粉。個人體質、疾病與用藥問題會轉介中醫師協助判斷。",
      [
        { label: "看鹿茸粉", text: "產品詳情｜luerong-fen" },
        { label: "怎麼使用", text: "怎麼使用" },
        { label: "人工客服", text: "我要人工客服" },
      ]
    ).contents,
  ];

  return {
    type: "flex",
    altText: "仙加味怎麼選",
    contents: { type: "carousel", contents: cards },
  };
}

function comboReply() {
  return flexCard(
    "搭配組合｜依日常使用方式選擇",
    `搭配組合以產品型態、使用方式與生活情境為主：

・固定日常安排：龜鹿膏
・方便即飲：龜鹿飲30cc小玻璃罐／180cc鋁袋
・自行搭配飲品：鹿茸粉

若涉及個人體質、疾病、用藥或適不適合食用，會轉介合作中醫師協助判斷。`,
    [
      { label: "查看搭配組合", text: "搭配組合" },
      { label: "查看產品", text: "看產品" },
      { label: "人工客服", text: "我要人工客服" },
    ]
  );
}

function getCombo(index) {
  return (DATA.offers?.comboOffers || [])[Number(index)] || null;
}

function comboUnitPrice(combo) {
  if (!combo) return 0;
  return (combo.products || []).reduce((sum, component) => {
    const product = getProduct(component.productId);
    if (!product) return sum;
    return sum + calcItem(product, Number(component.qty || 0)).total;
  }, 0);
}

function comboPromotionLines(combo) {
  const lines = [];
  for (const component of combo?.products || []) {
    const product = getProduct(component.productId);
    if (!product) continue;
    const qty = Number(component.qty || 0);
    const exactOffer = product.offers.find((offer) => Number(offer.qty) === qty);
    if (exactOffer) {
      lines.push(`${product.displayName}：${exactOffer.label} ${money(exactOffer.total)}`);
    } else if (product.originalPrice && product.originalPrice > product.price) {
      lines.push(`${product.displayName}：已套用優惠價 ${money(product.price)}`);
    }
  }
  return lines;
}

function comboQtyMenu(index) {
  const combo = getCombo(index);
  if (!combo) return comboMenuReply();
  const unitPrice = comboUnitPrice(combo);
  const quantities = Array.isArray(combo.quantityOptions) && combo.quantityOptions.length
    ? combo.quantityOptions.slice(0, 4)
    : [1, 2, 3, 5];
  const promotionLines = comboPromotionLines(combo);
  const description = [
    ...(combo.items || []).map((item) => `・${item}`),
    "",
    `每組售價：${money(unitPrice)}`,
    `可選組數：${quantities.join("、")}組`,
    ...(promotionLines.length ? ["", "已套用活動／優惠：", ...promotionLines.map((line) => `・${line}`)] : []),
    "",
    orderNoticeForCombo(combo),
  ].join("\n");
  const buttons = quantities.map((qty) => ({
    label: `${qty}組｜${money(unitPrice * qty)}`.slice(0, 20),
    text: `加入組合｜${index}｜${qty}`,
  }));
  buttons.push({ label: "其他搭配方案", text: "搭配組合" });
  return flexCard(`${combo.name}｜選擇組數`, description, buttons);
}

function addComboCart(state, combo, index, qty) {
  const id = `combo-${index}`;
  const existing = state.cart.find((item) => item.id === id);
  if (existing) existing.qty += qty;
  else state.cart.push({ id, name: combo.name, qty, unit: combo.unit || "組", comboIndex: Number(index) });
  const item = state.cart.find((cartItem) => cartItem.id === id);
  const unitPrice = comboUnitPrice(combo);
  item.total = unitPrice * item.qty;
  item.label = `每組 ${money(unitPrice)} × ${item.qty}`;
}

function comboMenuReply() {
  const combos = DATA.offers?.comboOffers || [];
  if (!combos.length) {
    return flexCard("搭配組合", "目前搭配組合由客服依需求協助整理。", [
      { label: "看產品", text: "看產品" },
      { label: "人工客服", text: "我要人工客服" },
    ]);
  }
  return {
    type: "flex",
    altText: "仙加味搭配組合",
    contents: {
      type: "carousel",
      contents: [
        flexCard(
          "日常搭配導覽",
          "依日常節奏查看搭配組合。每組價格、可選組數、活動與加入購物車功能都保留在各方案卡中。",
          [
            { label: "看產品", text: "看產品" },
            { label: "怎麼使用", text: "怎麼使用" },
            { label: "人工客服", text: "我要人工客服" },
          ]
        ).contents,
        ...combos.slice(0, 9).map((combo, index) => {
          const unitPrice = comboUnitPrice(combo);
          const quantities = combo.quantityOptions || [1, 2, 3, 5];
          const promotions = comboPromotionLines(combo);
          const description = [
            ...(combo.items || []).map((item) => `・${item}`),
            "",
            combo.desc || "",
            "",
            `每組售價：${money(unitPrice)}`,
            `可選組數：${quantities.join("、")}組`,
            ...(promotions.length ? ["", "活動／優惠已套用：", ...promotions.map((line) => `・${line}`)] : []),
            "",
            orderNoticeForCombo(combo),
          ].join("\n");
          return flexCard(combo.name, description, [
            { label: "選擇組數", text: `搭配組數｜${index}` },
            { label: "看全部產品", text: "看產品" },
            { label: "人工客服", text: "我要人工客服" },
          ]).contents;
        }),
      ],
    },
  };
}

function comboDetailReply(index) {
  return comboQtyMenu(index);
}

function usageChooserReply() {
  return {
    type: "flex",
    altText: "仙加味產品使用方式",
    contents: {
      type: "carousel",
      contents: [
        mascotBubble(
          "產品使用方式導覽",
          "先選擇想了解的產品，再查看正式使用方式、成分、完整介紹與實際產品照片。",
          [
            { label: "看產品", text: "看產品" },
            { label: "幫我推薦", text: "幫我推薦" },
            { label: "人工客服", text: "我要人工客服" },
          ]
        ),
        ...DATA.products.map((product) => usageReply(product).contents),
      ],
    },
  };
}

function usageReply(product) {
  return flexCard(
    `${product.displayName}｜使用方式`,
    `${(product.usage || []).join("\n\n")}\n\n成分：${(product.ingredients || []).join("、")}\n\n${orderNoticeForProduct(product)}`,
    [
      { label: "選擇數量", text: `選擇數量｜${product.id}` },
      { label: "完整介紹", uri: absoluteUrl(product.page || "products.html") },
      { label: "看實際產品照片", uri: absoluteUrl(product.officialOriginalImage || product.image || "images/logo.png") },
    ]
  );
}

function healthQuestionIntakeReply() {
  return flexCard(
    "仙加味｜先由人工客服協助",
    `您詢問的商品，我們可以先協助確認名稱、原料、包裝規格、價格及供貨方式。

至於個人體質、疾病、正在服用的藥物、禁忌或是否適合食用，因每個人的情況不同，仙加味不會自行做醫療判斷。

請先由仙加味人工客服接續。若需要醫療專業評估，我們可提供合作中醫師的諮詢資訊，由您自行決定是否聯絡。

若您已決定需要聯絡中醫師，也可回覆「轉介中醫師」。`,
    [
      { label: "仙加味人工客服", text: "我要人工客服" },
      { label: "查看商品資訊", text: "看產品" },
    ]
  );
}

function doctorReferralReply() {
  const referral = DATA.medicalReferral || {};
  const doctor = referral.doctor || "章無忌中醫師";
  const lineId = referral.lineId || "@changwuchi";
  const url = referral.url || "https://lin.ee/1MK4NR9";
  return flexCard(
    "仙加味轉介｜中醫師專業諮詢",
    `這部分會因每個人的身體狀況不同，建議由中醫師了解您的個人情況後再提供專業說明。

若您決定聯絡合作中醫師，可主動告知：
「您好，我是由仙加味介紹，想詢問【商品名稱】是否適合我的個人情況。」

➤ 中醫師：${doctor}
➤ LINE ID：${lineId}
➤ 中醫師 LINE：${url}

醫療及用藥資訊請直接向醫師說明，不需先提供給仙加味。是否適合使用由醫師獨立判斷。

後續一般食品及依法可由仙加味販售商品的價格、供貨和售後，仍可返回仙加味官方 LINE 詢問；須由醫療機構處理的藥品，依合法程序取得。`,
    [
      { label: "前往中醫師諮詢", uri: url },
      { label: "回仙加味詢問", text: "我要人工客服" },
      { label: "查看商品資訊", text: "看產品" },
    ]
  );
}

function huangdiNeijingReply() {
  const classic = DATA.classics?.huangdiNeijing || {};
  return flexCard(
    classic.title || "《黃帝內經》｜日常生活觀點",
    `${classic.usage || "仙加味以生活文化方式整理《黃帝內經》的飲食、作息與四時觀點。"}

這一層用來理解日常補養的節奏；《本草綱目》用於理解成分名稱與本草文化，現代藥典則用於理解正式品名與品質規格。產品資訊仍以實際成分、規格、保存與使用方式為準。`,
    [
      { label: "查看資料來源", uri: classic.sourceUrl || absoluteUrl("sources.html") },
      { label: "查看漢方百科", uri: absoluteUrl("hanfang-baike.html") },
      { label: "詢問日常安排", text: "幫我推薦" },
    ]
  );
}

function brandStoryReply() {
  return mascotBubble(
    "仙加味｜四代傳承",
    "仙加味的故事從台北萬華開始。\n\n第一代曾祖父從行口與山產買賣起步。祖父『鹿角伯』自十幾歲起學習山產原料，以及鹿角、鹿茸、鹿鞭等鹿類原料與產品的生鮮、乾品處理與加工。父親長期協助並於約2000年前後正式承接第三代工作。\n\n重要歷程：\n・1974年開始獨立經營\n・1976年正式成立獨立事業\n・1978年完成公司化經營\n・2008年『仙加味』品牌完成註冊\n\n第四代將家族經驗整理成更清楚的產品資訊與日常使用方式。",
    [
      { label: "完整品牌故事", uri: absoluteUrl("brand.html") },
      { label: "查看產品", text: "看產品" },
      { label: "人工客服", text: "我要人工客服" },
    ]
  );
}

const APPROVED_FAQ = require("./data/approved-sales-faq-20261018.json");
const FAQ_TOPICS = [
  ["商品與規格", "FAQ｜商品與規格", "可查詢龜鹿膏、龜鹿飲30cc／180cc、鹿茸粉及其他正式商品規格。"],
  ["價格與優惠", "FAQ｜價格與優惠", "標準售價可在 LINE 查詢；優惠價請提供品項與數量，由客服確認。"],
  ["配送與付款", "FAQ｜配送與付款", "龜鹿飲接單後製作約5～7個工作天出貨；其他品項依現貨及配送方式確認。"],
  ["其他品牌商品", "FAQ｜其他品牌商品", "其他廠牌保留原廠商品名稱，不代表仙加味自製或代理。"],
];
function faqTopicReply(topic) {
  const row = FAQ_TOPICS.find(x => x[0] === topic);
  if (!row) return faqReply();
  const entries = Array.isArray(APPROVED_FAQ.entries) ? APPROVED_FAQ.entries : [];
  const buttons = topic === "商品與規格"
    ? [{label:"看產品",text:"看產品"},{label:"丹參茶包",text:"丹參茶包系列"},{label:"人工客服",text:"我要人工客服"}]
    : topic === "價格與優惠"
    ? [{label:"價格方案",text:"價格方案"},{label:"詢問優惠",text:"優惠"},{label:"人工客服",text:"我要人工客服"}]
    : topic === "配送與付款"
    ? [{label:"配送付款",text:"配送付款"},{label:"人工客服",text:"我要人工客服"}]
    : [{label:"其他商品",text:"其他廠牌"},{label:"人工客服",text:"我要人工客服"}];
  const examples = topic === "商品與規格" ? "可輸入：龜鹿膏、龜鹿飲30cc、鹿茸粉、丹參茶包系列。"
    : topic === "價格與優惠" ? "丹參系列六款均為 NT$480／盒；其餘商品請用「價格方案」查看。"
    : topic === "配送與付款" ? "實際付款、運費、到貨時間由客服依訂單確認。"
    : "可輸入原廠正式商品名稱，例如參仲四物飲、二珍寶、四珍寶。";
  return {type:"flex",altText:row[1],contents:mascotBubble(row[1],row[2]+"\\n"+examples,buttons,"faq")};
}
function faqAnswerReply(query) {
  const entries = Array.isArray(APPROVED_FAQ.entries) ? APPROVED_FAQ.entries : [];
  const normalized = String(query||"").replace(/\\s/g,"").toLowerCase();
  const found = entries.find(e => (e.keywords||[]).some(k=>String(k).replace(/\\s/g,"").toLowerCase()===normalized));
  if (!found) return faqReply();
  return {type:"flex",altText:"常見問題｜"+found.product,contents:mascotBubble(found.product,found.answer,[{label:"其他常見問題",text:"常見問題"},{label:"人工客服",text:"我要人工客服"}],"faq")};
}

function faqReply() {
  return {
    type: "flex",
    altText: "仙加味常見問題",
    contents: mascotBubble(
      "常見問題｜小老闆幫你整理",
      "可先查看產品規格、價格方案、使用方式、配送付款與門市資訊。若仍有問題，直接留言即可由人工協助。",
      [
        { label: "商品與規格", text: "FAQ｜商品與規格" },
        { label: "價格與優惠", text: "FAQ｜價格與優惠" },
        { label: "配送與付款", text: "FAQ｜配送與付款" },
        { label: "其他品牌商品", text: "FAQ｜其他品牌商品" },
        { label: "人工客服", text: "我要人工客服" },
      ],
      "faq"
    ),
  };
}

function detectProduct(text) {
  const raw = String(text || "").replace(/[【】\[\]（）()「」『』\s]/g, "");
  if (/龜鹿飲.*180|180cc|鋁袋/.test(raw)) return getProduct("guilu-drink-180");
  if (/龜鹿飲.*30|30cc|玻璃罐|玻璃瓶/.test(raw)) return getProduct("guilu-drink-30");
  if (/龜鹿膏/.test(raw)) return getProduct("guilu-gao");
  if (/鹿茸粉/.test(raw)) return getProduct("luerong-fen");
  return null;
}

function trialShippingOptions() {
  return (DATA.trialCampaign?.shippingOptions || [])
    .map((option) => ({
      id: String(option.id || "").trim(),
      label: String(option.label || "").trim(),
      fee: Number(option.fee),
    }))
    .filter((option) => option.id && option.label && Number.isFinite(option.fee) && option.fee >= 0);
}

function trialShippingOption(choice) {
  const value = String(choice || "");
  const options = trialShippingOptions();
  return options.find((option) => value.includes(option.id) || value.includes(option.label) || (/7-11/.test(value) && /7-11/.test(option.label)) || (/宅配/.test(value) && /宅配/.test(option.label))) || null;
}

function trialCampaignReply() {
  const trial = DATA.trialCampaign || {};
  const shippingOptions = trialShippingOptions();
  const shippingLines = shippingOptions.length
    ? shippingOptions.map((option) => `${option.label}運費${money(option.fee)}`)
    : ["配送費用由客服確認"];
  const buttons = shippingOptions.slice(0, 2).map((option) => ({
    label: `${option.label}${money(option.fee)}`.slice(0, 20),
    text: `試喝配送｜${option.id}`,
  }));
  buttons.push({ label: "詢問商品價格", text: "價格方案" });
  return {
    type: "flex",
    altText: trial.title || "龜鹿飲30cc試喝組",
    contents: mascotBubble(
      trial.title || "龜鹿飲30cc試喝組",
      [
        "內容：" + (trial.contents || "30cc小玻璃罐×3罐"),
        trial.productFeeText || "試喝品免費",
        ...shippingLines,
        "",
        trial.limitRule || "每位顧客、聯絡電話及收件地址限申請一次",
        trial.paymentRule || "試喝運費需先確認並完成付款，試喝組不使用貨到付款",
        trial.fulfillmentRule || DRINK_ORDER_NOTICE,
        "",
        "正式商品售價與活動資訊由 LINE 人工客服確認並回覆。",
      ].join("\n"),
      buttons,
      "service"
    ),
  };
}

function startTrialCheckout(state, shippingChoice) {
  const trial = DATA.trialCampaign || {};
  const option = trialShippingOption(shippingChoice);
  if (!option) {
    return flexCard(
      "試喝配送待確認",
      "目前無法讀取正式試喝配送費用，請先由人工客服協助確認，不會自行猜測運費。",
      [{ label: "人工客服", text: "我要人工客服" }, { label: "重新申請", text: "申請試喝" }]
    );
  }
  const shipping = option.label;
  const fee = option.fee;
  const trialName = String(trial.title || "龜鹿飲30cc試喝組");
  const trialContents = String(trial.contents || "30cc小玻璃罐×3罐");
  state.cart = [{
    id: "guilu-drink-30-trial",
    name: `${trialName}（${trialContents.replace(/^30cc小玻璃罐×/, "").replace(/罐$/, "罐")}）`,
    qty: 1,
    unit: "組",
    total: fee,
    label: `試喝品免費｜${shipping}運費${fee}元`,
    trial: true,
  }];
  state.checkout = {
    step: "name",
    name: "",
    phone: "",
    payment: "匯款",
    shipping,
    address: "",
    trial: true,
    trialFee: fee,
  };
  return flexCard(
    "申請試喝｜第一步",
    `${trialContents}，${trial.productFeeText || "試喝品免費"}；本次僅收${shipping}運費${fee}元。\n\n請直接回覆收件人姓名。`,
    [{ label: "取消", text: "取消" }]
  );
}

function startCheckout(state) {
  state.checkout = { step: "name", name: "", phone: "", payment: "", shipping: "", address: "" };
  return flexCard("第一步｜收件姓名", "請直接回覆收件人姓名。", [{ label: "取消", text: "取消" }]);
}

function orderSummary(state) {
  const checkout = state.checkout;
  return flexCard(
    "確認訂單",
    `姓名：${checkout.name}\n電話：${checkout.phone}\n付款：${checkout.payment}\n配送：${checkout.shipping}\n地址／門市：${checkout.address}\n訂單金額：${money(cartTotal(state.cart))}\n\n${orderNoticeForCart(state.cart)}`,
    [
      { label: "確認送出", text: "確認送出" },
      { label: "取消", text: "取消" },
    ]
  );
}

async function saveCRM(payload) {
  if (!CRM_URL) return { ok: false, error: "CRM_URL is not configured" };
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), CRM_TIMEOUT_MS);
  try {
    const response = await fetch(CRM_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) return { ok: false, error: "CRM HTTP " + response.status, ...result };
    return typeof result.ok === "boolean" ? result : { ok: true, ...result };
  } catch (error) {
    const message = error.name === "AbortError" ? "CRM timeout after " + CRM_TIMEOUT_MS + "ms" : error.message;
    console.error("CRM 寫入失敗：" + message);
    return { ok: false, error: message || "CRM request failed" };
  } finally {
    clearTimeout(timeout);
  }
}

async function continueCheckout(event, state, text) {
  const checkout = state.checkout;

  if (text === "取消") {
    state.checkout = null;
    return reply(event.replyToken, textMsg("已取消結帳。", mainQuick()));
  }

  if (checkout.step === "name") {
    const name = sanitizeUserText(text, 40);
    if (!name) return reply(event.replyToken, textMsg("請輸入收件人姓名。"));
    checkout.name = name;
    checkout.step = "phone";
    return reply(event.replyToken, flexCard("第二步｜收件電話", "請直接回覆收件人電話。", [{ label: "取消", text: "取消" }]));
  }

  if (checkout.step === "phone") {
    const phone = text.replace(/[^0-9]/g, "");
    if (!/^(09\d{8}|0\d{8,10})$/.test(phone)) {
      return reply(event.replyToken, textMsg("電話格式不完整，請輸入台灣手機或市內電話，例如 0912345678。", [{ label: "取消", text: "取消" }]));
    }
    checkout.phone = phone;
    if (checkout.trial) {
      checkout.step = "address";
      return reply(event.replyToken, flexCard(
        "第三步｜地址或門市",
        /7-11/.test(checkout.shipping) ? "請回覆7-11門市名稱或門市地址。" : "請回覆完整收件地址。",
        [{ label: "取消", text: "取消" }]
      ));
    }
    checkout.step = "payment";
    return reply(event.replyToken, textMsg("請選擇付款方式。", [
      { label: "現金付款", text: "現金付款" },
      { label: "匯款", text: "匯款" },
      { label: "貨到付款", text: "貨到付款" },
      { label: "取消", text: "取消" },
    ]));
  }

  if (checkout.step === "payment") {
    if (!/現金|匯款|貨到付款/.test(text)) {
      return reply(event.replyToken, textMsg("請選擇現金付款、匯款或貨到付款。"));
    }
    checkout.payment = /貨到付款/.test(text) ? "貨到付款" : /匯款/.test(text) ? "匯款" : "現金付款";
    checkout.step = "shipping";
    return reply(event.replyToken, textMsg("請選擇配送方式。", [
      { label: "宅配", text: "宅配" },
      { label: "7-11賣貨便", text: "7-11賣貨便" },
      { label: "門市自取", text: "門市自取" },
      { label: "雙北親送", text: "雙北親送" },
      { label: "取消", text: "取消" },
    ]));
  }

  if (checkout.step === "shipping") {
    if (!/宅配|7-11|賣貨便|門市自取|自取|雙北|親送/.test(text)) {
      return reply(event.replyToken, textMsg("請選擇宅配、7-11賣貨便、門市自取或雙北親送。"));
    }
    checkout.shipping = /7-11|賣貨便/.test(text)
      ? "7-11賣貨便"
      : /自取/.test(text)
        ? "門市自取"
        : /雙北|親送/.test(text)
          ? "雙北親送"
          : "宅配";

    if (checkout.shipping === "門市自取") {
      checkout.address = "萬華門市自取，客服確認時間";
      checkout.step = "confirm";
      return reply(event.replyToken, orderSummary(state));
    }

    checkout.step = "address";
    return reply(
      event.replyToken,
      flexCard(
        "第五步｜地址或門市",
        checkout.shipping === "7-11賣貨便" ? "請回覆 7-11 門市名稱或門市地址。" : "請回覆完整收件地址。",
        [{ label: "取消", text: "取消" }]
      )
    );
  }

  if (checkout.step === "address") {
    const address = sanitizeUserText(text, 160);
    if (address.length < 2) return reply(event.replyToken, textMsg("請輸入完整地址或 7-11 門市資料。"));
    checkout.address = address;
    checkout.step = "confirm";
    return reply(event.replyToken, orderSummary(state));
  }

  if (checkout.step === "confirm") {
    if (!/確認送出|確認|送出/.test(text)) return reply(event.replyToken, orderSummary(state));

    const finalNotice = orderNoticeForCart(state.cart);
    const payload = {
      userId: event.source.userId || "",
      cart: state.cart,
      total: cartTotal(state.cart),
      ...checkout,
      orderType: checkout.trial ? "trial" : "purchase",
      campaignId: checkout.trial ? "guilu-drink-30-evergreen-trial" : "",
      createdAt: new Date().toISOString(),
    };

    const result = await saveCRM(payload);
    if (!result.ok) {
      return reply(
        event.replyToken,
        flexCard(
          "訂單暫未送出",
          "訂單資料已保留，但系統目前無法寫入訂單。請稍後再按確認送出，或選擇人工客服協助。",
          [
            { label: "再次送出", text: "確認送出" },
            { label: "人工客服", text: "我要人工客服" },
            { label: "取消", text: "取消" },
          ]
        )
      );
    }
    const orderId = result.orderId || result.order_id || "";
    state.cart = [];
    state.checkout = null;

    return reply(
      event.replyToken,
      flexCard(
        "訂單已送出",
        `${orderId ? `訂單編號：${orderId}\n` : ""}客服會確認商品、付款、配送與出貨順序。\n\n${finalNotice}`,
        [
          { label: "再次選購", text: "看產品" },
          { label: "人工客服", text: "我要人工客服" },
        ]
      )
    );
  }
}

async function handleLegacyPostback(event) {
  const state = getState(event.source.userId || "anonymous");
  const data = parsePB(event.postback?.data || "");

  if (data.action === "products") return reply(event.replyToken, productMenuReply());
  if (data.action === "prices") return reply(event.replyToken, priceCarousel());
  if (data.action === "recommend") return reply(event.replyToken, recommendReply());
  if (data.action === "cart") return reply(event.replyToken, cartFlex(state));
  if (data.action === "checkout") return reply(event.replyToken, state.cart.length ? startCheckout(state) : cartFlex(state));

  const product = getProduct(data.productId);
  if (data.action === "qty" && product) return reply(event.replyToken, qtyMenu(product));
  if (data.action === "usage" && product) return reply(event.replyToken, usageReply(product));
  if (data.action === "add" && product && data.qty > 0) {
    if (product.quoteOnly) return reply(event.replyToken, qtyMenu(product));
    addCart(state, product, data.qty);
    return reply(event.replyToken, cartFlex(state));
  }

  return reply(event.replyToken, textMsg("請重新選擇。", mainQuick()));
}

function detectWebsiteIntent(text) {
  const value = String(text || "").trim();
  if (!value) return "";

  if (/試喝|體驗龜鹿飲/.test(value)) return "trial";
  if (/我看了產品整理|幫我比較產品|產品差異|規格比較|想請你幫我比較|哪一種比較適合|適合我的|我目前是/.test(value)) return "recommend";
  if (/官網套餐|套餐搭配|搭配組合|搭配方式|料理搭配|熱飲.*燉湯|燉湯.*調飲/.test(value)) return "combo";
  if (/官網怎麼使用|產品使用方式|想了解.*使用方式|怎麼使用頁/.test(value)) return "usage";
  if (/價格|售價|價錢|多少錢|活動方案|優惠/.test(value)) return "price";
  if (/官網品牌|品牌頁|萬華門市|想了解仙加味|四代傳承/.test(value)) return "brand";
  if (/官網FAQ|FAQ頁|常見問題|幾個問題想詢問/.test(value)) return "faq";
  if (/官網聯絡|聯絡頁|通路合作|診所|中藥店/.test(value)) return "human";
  if (/官網產品頁|網站看到產品|產品資訊|想了解產品/.test(value)) return "products";
  return "";
}

async function handleMessage(event) {
  if (event.message.type !== "text") {
    return reply(event.replyToken, textMsg("目前請使用文字訊息詢問。", mainQuick()));
  }

  const text = sanitizeUserText(event.message.text, 500);
  const state = getState(event.source.userId || "anonymous");

  const partnerInquiryMatch = text.match(/^詢問商品｜([^｜]+)$/);
  if (partnerInquiryMatch) {
    const product = PARTNER_CAROUSEL.find(item => item.id === partnerInquiryMatch[1]);
    if (!product) return reply(event.replyToken, textMsg("找不到這項商品，請重新查看產品。", mainQuick()));
    return reply(event.replyToken, textMsg(
      `已選擇：${product.name}\n規格：${product.specification}\n請由仙加味人工客服確認末端售價、供貨與訂購方式。`,
      [{ label: "人工客服", text: "我要人工客服" }, { label: "商品詳細介紹", uri: absoluteUrl(product.page) }, { label: "全部商品", text: "看產品" }]
    ));
  }

  const productDetailMatch = text.match(/^產品詳情｜([^｜]+)$/);
  if (productDetailMatch) {
    const product = getProduct(productDetailMatch[1]);
    return reply(event.replyToken, product ? { type: "flex", altText: product.displayName, contents: productBubble(product) } : productMenuReply());
  }

  const comboDetailMatch = text.match(/^(?:搭配方案|搭配組數)｜(\d+)$/);
  if (comboDetailMatch) return reply(event.replyToken, comboQtyMenu(comboDetailMatch[1]));

  const trialShippingMatch = text.match(/^試喝配送｜(.+)$/);
  if (trialShippingMatch) return reply(event.replyToken, startTrialCheckout(state, trialShippingMatch[1]));

  if (/^(申請試喝|我要試喝|試喝|試喝組|龜鹿飲試喝)$/.test(text)) {
    return reply(event.replyToken, trialCampaignReply());
  }

  // 優先分流個人健康／藥物問題；不覆蓋一般商品詢價、試喝及配送。
  // 危急症狀不能等待 LINE 醫師諮詢或一般客服訊息。
  if (isEmergencyHealthQuestion(text)) {
    return reply(event.replyToken, textMsg(
      "若您現在出現胸痛、呼吸困難、意識不清、大量出血或其他急迫危險狀況，請立即撥打 119 或前往急診，不要等待 LINE 訊息回覆。",
      [{ label: "中醫師諮詢", text: "醫師諮詢" }, { label: "人工客服", text: "我要人工客服" }]
    ));
  }
  // 顧客明確要求中醫師資訊時才開啟外部轉介；一般個人健康疑問先留在仙加味人工客服。
  if (isExplicitDoctorReferralRequest(text)) {
    return reply(event.replyToken, doctorReferralReply());
  }
  if (isSensitiveHealthQuestion(text)) {
    // 僅送內部「待人工查看」提醒，不推送顧客病史、用藥或健康問題內文。
    // 限制同一顧客 30 分鐘內重複通知；未設定 OWNER_LINE_USER_ID 時不影響顧客回覆。
    const now = Date.now();
    if (now - Number(state.lastHealthIntakeAlertAt || 0) >= 30 * 60 * 1000) {
      state.lastHealthIntakeAlertAt = now;
      void ownerAlert.pushOwnerAlert(event, "個人適用性詢問，請至仙加味 LINE OA 收件匣查看")
        .catch(error => console.error("[XJW_OWNER_ALERT] sensitive-intake failed", error?.message || error));
    }
    return reply(event.replyToken, healthQuestionIntakeReply());
  }

  if (state.checkout) return continueCheckout(event, state, text);

  const teaVariants = {
    '臺灣丹參玫瑰果茶': 'jianfeng-rose-fruit-tea',
    '臺灣丹參懈悠活養生茶': 'jianfeng-leisure-tea',
    '武大漢丹參茶': 'jianfeng-wudahan-tea',
    '臺灣丹參纖體茶': 'jianfeng-fiber-tea',
    '臺灣白茶丹參飲': 'jianfeng-white-tea',
    '臺灣丹參舒活茶': 'jianfeng-refresh-tea',
  };
  if (/^(丹參茶|丹參茶包|丹參茶包系列)$/.test(text) || teaVariants[text]) {
    const section = teaVariants[text] ? '#' + teaVariants[text] : '';
    return reply(event.replyToken, flexCard(text in teaVariants ? text : '丹參茶包系列',
      '丹參系列六款茶包，每款 3g×10包／盒，標準售價均為 NT$480／盒。可查看各款實物照片、規格與原料；如需確認優惠活動及現貨，請洽人工客服。', [
        { label: '查看茶包介紹', uri: absoluteUrl('product-danshen-tea.html' + section) },
        { label: '人工商品諮詢', text: '我要人工客服' }
      ]));
  }

  // 優惠價不在自動回覆中揭露，交由客服核對活動資格及購買數量。
  if (/^(有優惠嗎|有沒有優惠|優惠|活動優惠|優惠活動|折扣|優惠價|有特價嗎)$/.test(text)) {
    return reply(event.replyToken, flexCard('優惠與活動諮詢',
      '商品標準售價可在 LINE 商品介紹查看。活動內容及適用優惠價依商品、購買數量與當期條件確認，請告訴我們商品名稱及預計購買數量，由客服協助確認。',
      [{ label: '詢問人工客服', text: '我要人工客服' }, { label: '查看商品', text: '看產品' }]
    ));
  }

  const partnerInquiry = require('./partner-inquiry.js').findPartnerInquiry(text);
  if (partnerInquiry) {
    const license = partnerInquiry.medicine?.classification === 'licensed-traditional-medicine'
      ? partnerInquiry.medicine : null;
    if (license) {
      // 成藥許可證 ≠ 乙類成藥網售資格；有相應藥商營業項目時仍可提供實體店面服務。
      // 不宣傳療效、不顯示網路結帳，不把一般詢價直接轉給中醫師。
      return reply(event.replyToken, flexCard(license.licensedName || partnerInquiry.name,
        '本品經衛福部登記為中藥成藥（許可證：' + license.licenseNo + '）。可先由人工客服確認門市供貨及合法取得方式；此處不提供本品網路結帳。如涉及個人體質、疾病、正在服藥或是否適合使用，才另外由專業中醫師評估。',
        [{ label: '詢問人工客服', text: '我要人工客服' }]
      ));
    }
    if (partnerInquiry.food?.classification === 'merchant-confirmed-food') {
      const food = partnerInquiry.food;
      const name = partnerInquiry.name === '龜鹿活力飲'
        ? '龜鹿活力飲（葡萄糖胺）' : partnerInquiry.name;
      const ingredients = Array.isArray(food.ingredients) && food.ingredients.length
        ? '\n原廠包裝所列原料：' + food.ingredients.join('、') + '。' : '';
      return reply(event.replyToken, flexCard(name,
        '這款為其他廠牌食品，可先查看原廠商品資訊。' +
        (food.size ? '\n包裝規格：' + food.size + '。' : '') +
        ingredients +
        '\n售價、現貨批次、購買及配送請由人工客服確認。此處不提供療效或個人醫療判斷。',
        [
          ...(partnerInquiry.publicPage && food.websitePublic
            ? [{ label: '查看商品介紹', uri: absoluteUrl(partnerInquiry.publicPage) }] : []),
          { label: '商品及購買諮詢', text: '我要人工客服' }
        ]
      ));
    }
    return reply(event.replyToken, flexCard(partnerInquiry.name,
      partnerInquiry.publicPage
        ? '可先查看正式商品介紹；價格與供貨由人工客服確認。'
        : '已收到您的商品詢問，請由人工客服確認商品標示、門市服務及適用的服務方式。', [
        ...(partnerInquiry.publicPage ? [{ label: '查看商品介紹', uri: absoluteUrl(partnerInquiry.publicPage) }] : []),
        { label: '人工商品諮詢', text: '我要人工客服' }
      ]));
  }

  if (/^(商品分類|其他廠牌|其他品牌|全部商品|商品總覽)$/.test(text)) {
    return reply(event.replyToken, flexCard('仙加味｜商品分類', '仙加味自有品牌與其他廠牌商品分開標示。先到官網查看正式圖片、規格與介紹；價格、供貨及適用的服務方式由 LINE 人工確認，部分商品僅提供門市諮詢。', [
      { label: '全部商品', uri: absoluteUrl('products.html') },
      { label: '其他廠牌商品', uri: absoluteUrl('products.html#partner-brand-catalog') },
      { label: '人工客服', text: '我要人工客服' }
    ]));
  }

  const quoteQtyMatch = text.match(/^詢價數量｜([^｜]+)｜(\d+)$/);
  if (quoteQtyMatch) {
    const product = getProduct(quoteQtyMatch[1]);
    const qty = Number(quoteQtyMatch[2]);
    if (!product || !Number.isInteger(qty) || qty < 1 || qty > 99) return reply(event.replyToken, textMsg("請重新選擇商品及數量。", mainQuick()));
    const message = "已選擇：" + product.displayName + "｜" + productSpecText(product) + "\n數量：" + qty + (product.unit || "件") + "\n請點選人工客服確認最新售價、優惠及訂購方式。";
    return reply(event.replyToken, textMsg(message, [{ label: "人工客服", text: "我要人工客服" }, { label: "重新選擇", text: "選擇數量｜" + product.id }, { label: "看產品", text: "看產品" }]));
  }

  const qtyMatch = text.match(/^選擇數量｜([^｜]+)$/);
  if (qtyMatch) {
    const product = getProduct(qtyMatch[1]);
    return reply(event.replyToken, product ? qtyMenu(product) : textMsg("找不到這項產品，請重新選擇。", mainQuick()));
  }

  const addComboMatch = text.match(/^加入組合｜(\d+)｜(\d+)$/);
  if (addComboMatch) {
    const combo = getCombo(addComboMatch[1]);
    const qty = Number(addComboMatch[2]);
    if (!combo || qty <= 0) return reply(event.replyToken, textMsg("加入搭配組合失敗，請重新選擇。", mainQuick()));
    addComboCart(state, combo, addComboMatch[1], qty);
    return reply(event.replyToken, cartFlex(state));
  }

  const addMatch = text.match(/^加入購物車｜([^｜]+)｜(\d+)$/);
  if (addMatch) {
    const product = getProduct(addMatch[1]);
    const qty = Number(addMatch[2]);
    if (!product || qty <= 0) return reply(event.replyToken, textMsg("加入購物車失敗，請重新選擇。", mainQuick()));
    if (product.quoteOnly) return reply(event.replyToken, qtyMenu(product));
    addCart(state, product, qty);
    return reply(event.replyToken, cartFlex(state));
  }

  const usageMatch = text.match(/^使用方式｜([^｜]+)$/);
  if (usageMatch) {
    const product = getProduct(usageMatch[1]);
    return reply(event.replyToken, product ? usageReply(product) : usageChooserReply());
  }

  if (/清空購物車|清空清單/.test(text)) {
    state.cart = [];
    return reply(event.replyToken, cartFlex(state));
  }

  if (/^(看產品|查看產品|看商品|產品|直接下單|直接購買|我要下單|立即下單|開始下單|我要買)$/.test(text)) {
    return reply(event.replyToken, productMenuReply());
  }

  if (/^(價格方案|價格|售價|價錢|多少錢|優惠)$/.test(text)) {
    return reply(event.replyToken, priceCarousel());
  }

  if (/購物車|購買清單|查看購買清單/.test(text)) {
    return reply(event.replyToken, cartFlex(state));
  }

  if (/^(開始結帳|結帳)$/.test(text)) {
    return reply(event.replyToken, state.cart.length ? startCheckout(state) : cartFlex(state));
  }

  if (/搭配組合|食補搭配|產品搭配|組合怎麼搭|搭配方式/.test(text)) {
    return reply(event.replyToken, comboMenuReply());
  }

  if (/^(怎麼使用|使用方式|食用方式|產品怎麼用)$/.test(text)) {
    return reply(event.replyToken, usageChooserReply());
  }

  if (/^(幫我推薦|怎麼選|不知道怎麼選)$/.test(text)) {
    return reply(event.replyToken, recommendReply());
  }

  if (text.startsWith("FAQ｜")) return reply(event.replyToken, faqTopicReply(text.slice(4)));
  if (text.startsWith("問答｜")) return reply(event.replyToken, faqAnswerReply(text.slice(3)));

  if (/^(常見問題|FAQ|問題整理)$/.test(text)) {
    return reply(event.replyToken, faqReply());
  }

  if (/配送付款|配送方式|付款方式|怎麼付款|怎麼配送/.test(text)) {
    return reply(event.replyToken, {
      type: "flex",
      altText: "仙加味配送與付款",
      contents: mascotBubble(
        "配送與付款｜小老闆幫你整理",
        `付款方式：${(DATA.payments || ["現金付款", "匯款", "貨到付款"]).join("、")}\n\n配送方式：${(DATA.shipping || ["宅配", "7-11賣貨便", "門市自取", "雙北親送"]).join("、")}\n\n實際費用、到貨時間與可用方式由客服依訂單確認。`,
        [
          { label: "查看購物車", text: "查看購買清單" },
          { label: "直接下單", text: "直接下單" },
          { label: "人工客服", text: "我要人工客服" },
        ],
        "service"
      ),
    });
  }

  const websiteIntent = detectWebsiteIntent(text);
  if (websiteIntent === "trial") return reply(event.replyToken, trialCampaignReply());
  if (websiteIntent === "recommend") return reply(event.replyToken, recommendReply());
  if (websiteIntent === "combo") return reply(event.replyToken, comboMenuReply());
  if (websiteIntent === "usage") return reply(event.replyToken, usageChooserReply());
  if (websiteIntent === "price") return reply(event.replyToken, priceCarousel());
  if (websiteIntent === "brand") return reply(event.replyToken, brandStoryReply());
  if (websiteIntent === "faq") return reply(event.replyToken, faqReply());
  if (websiteIntent === "human") return reply(event.replyToken, { type: "flex", altText: "仙加味人工客服", contents: mascotBubble("人工客服｜請直接留言", storeServiceText(), [{ label: "看產品", text: "看產品" }, { label: "查看購物車", text: "查看購買清單" }], "service") });
  if (websiteIntent === "products") return reply(event.replyToken, productMenuReply());

  if (/黃帝內經|內經|食飲有節|飲食有節|起居有常|四時調養|順應四時/.test(text)) {
    return reply(event.replyToken, huangdiNeijingReply());
  }

  if (/品牌故事|四代|鹿角伯|家族傳承|曾祖父|祖父|第三代|第四代/.test(text)) {
    return reply(event.replyToken, brandStoryReply());
  }

  if (/營業時間|門市時間|幾點營業|幾點關門|假日預約|預約門市/.test(text)) {
    return reply(event.replyToken, { type: "flex", altText: "仙加味門市資訊", contents: mascotBubble("門市資訊｜小老闆為你服務", storeServiceText(), [{ label: "看產品", text: "看產品" }, { label: "人工客服", text: "我要人工客服" }], "service") });
  }

  if (/人工|客服|聯絡/.test(text)) {
    return reply(event.replyToken, { type: "flex", altText: "仙加味人工客服", contents: mascotBubble("人工客服｜請直接留言", storeServiceText(), [{ label: "看產品", text: "看產品" }, { label: "查看購物車", text: "查看購買清單" }], "service") });
  }

  if (/到貨|現貨|上架|可以買|能買|開放下單|何時出貨|出貨時間|盒子|盒裝/.test(text)) {
    return reply(
      event.replyToken,
      textMsg(`${MIXED_ORDER_NOTICE}\n\n可先選擇產品與數量完成訂購安排；實際出貨時間、配送方式與優惠由客服再協助確認。`, mainQuick())
    );
  }

  const product = detectProduct(text);
  if (product) {
    if (/怎麼用|使用方式|食用方式|成分/.test(text)) return reply(event.replyToken, usageReply(product));
    return reply(event.replyToken, { type: "flex", altText: product.displayName, contents: productBubble(product) });
  }

  if (/不知道|怎麼選|推薦|適合哪個/.test(text)) {
    return reply(event.replyToken, recommendReply());
  }

  return reply(
    event.replyToken,
    textMsg(
      `您好，歡迎來到仙加味。\n\n${MIXED_ORDER_NOTICE}\n\n您可以直接輸入產品名稱、價格、怎麼選、搭配組合、怎麼使用、品牌故事、購物車或人工客服。`,
      mainQuick()
    )
  );
}

async function handleEvent(event) {
  lastWebhookAt = new Date().toISOString();
  if (!beginWebhookEvent(event)) return Promise.resolve();

  try {
    let result;
    if (event.type === "follow") {
      result = await reply(event.replyToken, mascotWelcomeReply());
    } else if (event.type === "postback") {
      result = await handleLegacyPostback(event);
    } else if (event.type === "message") {
      result = await handleMessage(event);
    } else {
      result = true;
    }

    const success = result !== false;
    finishWebhookEvent(event, success);
    return result;
  } catch (error) {
    finishWebhookEvent(event, false);
    throw error;
  }
}

app.get("/", (_req, res) => {
  res.json({ ok: true, service: "仙加味 LINE OA", version: VERSION, orderOpen: true });
});

app.get("/healthz", (_req, res) => {
  res.json({
    ok: true,
    version: VERSION,
    orderOpen: true,
    credentialsConfigured: Boolean(config.channelAccessToken && config.channelSecret),
    ownerAlertConfigured: Boolean(process.env.OWNER_LINE_USER_ID),
    crmConfigured: Boolean(CRM_URL),
    catalogVersion: DATA.catalogVersion || "",
    mascotVersion: MASCOT_VERSION,
    productCount: DATA.products.length,
    deploymentCommit: process.env.RENDER_GIT_COMMIT || null,
    publicProductAuthority: {
      version: require("./assets/data/official-products.json").publicProductMasterVersion || require("./assets/data/official-products.json").version,
      products: DATA.products.map(product => ({ id: product.id, name: product.name, specification: product.specification || product.spec || product.size, usage: product.usage || [], usageAdjustment: product.usageAdjustment || "" })),
    },
    mascotAssetsReady: Object.values(MASCOT_PATHS).every((asset) => Boolean(asset)),
    storeHours: String(DATA.store?.hours || ""),
    storeHolidayNote: String(DATA.store?.holidayNote || ""),
    activeStates: states.size,
    processedWebhookEvents: processedWebhookEvents.size,
    processingWebhookEvents: processingWebhookEvents.size,
    lastWebhookAt,
    lastReplySuccessAt,
    lastReplyError,
    replyClient: "MessagingApiClient",
  });
});

if (config.channelAccessToken && config.channelSecret) {
  app.post("/webhook", line.middleware(config), (req, res) => {
    // 先快速回覆 LINE 200，避免 Render 冷啟動或訊息處理時間造成 webhook 逾時。
    res.json({ ok: true });
    Promise.allSettled((req.body.events || []).map(handleEvent)).then((results) => {
      const failed = results.filter((result) => result.status === "rejected");
      if (failed.length) console.error("LINE 事件處理失敗數：" + failed.length);
    });
  });
} else {
  console.warn("LINE credentials are not configured. Set CHANNEL_ACCESS_TOKEN and CHANNEL_SECRET in the deployment environment.");
  app.post("/webhook", express.json(), (_req, res) => {
    res.status(503).json({ ok: false, error: "LINE credentials are not configured" });
  });
}

require("./erp-publish-bridge").mount(app);

const port = process.env.PORT || 3000;
if (require.main === module) {
  app.listen(port, () => console.log(`仙加味 LINE OA ${VERSION} running on ${port}`));
}

module.exports = {
  app,
  DATA,
  VERSION,
  DRINK_ORDER_NOTICE,
  READY_STOCK_ORDER_NOTICE,
  MIXED_ORDER_NOTICE,
  getProduct,
  orderNoticeForProduct,
  orderNoticeForCombo,
  orderNoticeForCart,
  detectProduct,
  calcItem,
  addCart,
  cartTotal,
  productCarousel,
  productMenuReply,
  priceCarousel,
  recommendReply,
  mascotWelcomeReply,
  mascotBubble,
  comboReply,
  comboMenuReply,
  comboDetailReply,
  comboQtyMenu,
  comboUnitPrice,
  comboPromotionLines,
  addComboCart,
  getCombo,
  usageChooserReply,
  usageReply,
  doctorReferralReply,
  huangdiNeijingReply,
  brandStoryReply,
  faqReply,
  trialCampaignReply,
  trialShippingOptions,
  trialShippingOption,
  startTrialCheckout,
  isSensitiveHealthQuestion,
  validateData,
  sanitizeUserText,
  cleanupExpiredStates,
  qtyMenu,
  cartFlex,
  detectWebsiteIntent,
  beginWebhookEvent,
  finishWebhookEvent,
};


