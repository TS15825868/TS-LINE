"use strict";

/**
 * 仙加味 LINE OA Bot v300.1
 * 單一正式主程式：產品、價格、購物車、結帳、品牌故事、古籍資料與健康問題轉介。
 * LINE 憑證與 CRM URL 僅從部署環境變數讀取。
 */

const line = require("@line/bot-sdk");
const express = require("express");
const fs = require("fs");
const path = require("path");

const VERSION = "v300.1";
const SITE_URL = "https://ts15825868.github.io/xianjiawei/";
const ORDER_NOTICE = "全系列已開放詢問與下單；實際庫存與出貨時間由客服確認。";
const CRM_URL = process.env.CRM_URL || "";
const CRM_TIMEOUT_MS = Number(process.env.CRM_TIMEOUT_MS || 8000);
const STATE_TTL_MS = Number(process.env.STATE_TTL_MS || 24 * 60 * 60 * 1000);
const STATE_CLEANUP_INTERVAL_MS = Number(process.env.STATE_CLEANUP_INTERVAL_MS || 60 * 60 * 1000);
const MAX_STATE_ENTRIES = Number(process.env.MAX_STATE_ENTRIES || 10000);

const config = {
  channelAccessToken: process.env.CHANNEL_ACCESS_TOKEN || "",
  channelSecret: process.env.CHANNEL_SECRET || "",
};

const app = express();
const client = config.channelAccessToken && config.channelSecret ? new line.Client(config) : null;
const states = new Map();
const DATA = loadData();

function validateData(data) {
  if (!data || typeof data !== "object") throw new Error("data.json 必須是 JSON 物件");
  if (!Array.isArray(data.products) || !data.products.length) throw new Error("data.json 缺少 products");
  for (const product of data.products) {
    for (const field of ["id", "name", "price", "unit", "image", "usage", "ingredients"]) {
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

function absoluteUrl(asset = "") {
  if (/^https?:\/\//i.test(asset)) return encodeURI(asset);
  return encodeURI(`${DATA.siteUrl.replace(/\/?$/, "/")}${String(asset).replace(/^\/+/, "")}`);
}

function getProduct(id) {
  return DATA.products.find((product) => product.id === id) || null;
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
    { label: "看產品", text: "看產品" },
    { label: "價格方案", text: "價格方案" },
    { label: "幫我推薦", text: "幫我推薦" },
    { label: "搭配組合", text: "搭配組合" },
    { label: "怎麼使用", text: "怎麼使用" },
    { label: "購物車", text: "查看購買清單" },
    { label: "人工客服", text: "我要人工客服" },
  ];
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

async function reply(token, messages) {
  if (!client) {
    console.warn("LINE credentials are not configured; reply skipped.");
    return;
  }
  try {
    await client.replyMessage(token, Array.isArray(messages) ? messages : [messages]);
  } catch (error) {
    console.error("LINE 回覆失敗：", error?.originalError?.response?.data || error.message || error);
    throw error;
  }
}

function productBubble(product) {
  const priceLine = product.originalPrice && product.originalPrice > product.price
    ? `售價 ${money(product.originalPrice)}\n優惠價 ${money(product.price)}`
    : `售價 ${money(product.price)}`;
  const offers = product.offers.length
    ? `\n${product.offers.map((offer) => `${offer.label}：${money(offer.total)}`).join("\n")}`
    : "";

  return {
    type: "bubble",
    size: "mega",
    hero: {
      type: "image",
      url: absoluteUrl(product.image || "images/logo.png"),
      size: "full",
      aspectRatio: "4:5",
      aspectMode: "contain",
      backgroundColor: "#F7F2E8",
    },
    body: {
      type: "box",
      layout: "vertical",
      spacing: "md",
      contents: [
        { type: "text", text: product.displayName, weight: "bold", size: "xl", wrap: true },
        {
          type: "text",
          text: `規格：${product.spec}\n${product.purpose ? `用途方向：${product.purpose}\n` : ""}${priceLine}${offers}`,
          size: "sm",
          color: "#555555",
          wrap: true,
        },
        { type: "text", text: ORDER_NOTICE, size: "sm", color: "#7B1E1E", weight: "bold", wrap: true },
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
          action: { type: "uri", label: "完整介紹", uri: absoluteUrl(product.page || "products.html") },
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

function productCarousel() {
  return {
    type: "flex",
    altText: "仙加味產品",
    contents: { type: "carousel", contents: DATA.products.map(productBubble) },
  };
}

function productMenuReply() {
  const lines = DATA.products.map((product, index) =>
    (index + 1) + ". " + product.displayName + "｜" + product.spec + "｜" + (product.purpose || "日常食補")
  );
  return textMsg(
    "請選擇想了解或下單的產品：\n\n" + lines.join("\n") + "\n\n點選下方產品後，可查看規格、價格、使用方式並選擇數量。",
    DATA.products.map((product) => ({ label: product.displayName.slice(0, 20), text: "產品詳情｜" + product.id }))
  );
}

function priceCarousel() {
  return {
    type: "flex",
    altText: "仙加味價格方案",
    contents: {
      type: "carousel",
      contents: DATA.products.map((product) => {
        const original = product.originalPrice && product.originalPrice > product.price
          ? `售價：${money(product.originalPrice)}\n優惠價：${money(product.price)}`
          : `售價：${money(product.price)}`;
        const offers = product.offers.length
          ? `\n\n活動：\n${product.offers.map((offer) => `・${offer.label} ${money(offer.total)}`).join("\n")}`
          : "";
        return flexCard(product.displayName, `規格：${product.spec}\n${original}${offers}\n\n${ORDER_NOTICE}`, [
          { label: "選擇數量", text: `選擇數量｜${product.id}` },
          { label: "看產品", text: "看產品" },
        ]).contents;
      }),
    },
  };
}

function qtyMenu(product) {
  const buttons = [
    {
      label: `1${product.unit || "件"}｜${money(product.price)}`.slice(0, 20),
      text: `加入購物車｜${product.id}｜1`,
    },
    ...product.offers.map((offer) => ({
      label: `${offer.label}｜${money(offer.total)}`.slice(0, 20),
      text: `加入購物車｜${product.id}｜${offer.qty}`,
    })),
    { label: "返回產品", text: "看產品" },
  ];
  return flexCard(`${product.displayName}｜選擇數量`, `${ORDER_NOTICE}\n\n請選擇要加入購物車的數量。`, buttons);
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
  if (!state.cart.length) {
    return flexCard("購物車", `目前購物車是空的。\n\n${ORDER_NOTICE}`, [
      { label: "看產品", text: "看產品" },
      { label: "價格方案", text: "價格方案" },
    ]);
  }

  const lines = state.cart
    .map((item, index) => `${index + 1}. ${item.name}\n數量：${item.qty}${item.unit}\n方案：${item.label}\n小計：${money(item.total)}`)
    .join("\n\n");

  return flexCard("購物車", `${lines}\n\n合計：${money(cartTotal(state.cart))}\n\n${ORDER_NOTICE}`, [
    { label: "直接結帳", text: "開始結帳" },
    { label: "繼續選購", text: "看產品" },
    { label: "清空購物車", text: "清空購物車" },
  ]);
}

function recommendReply() {
  return textMsg(
    `可依平常使用方式比較：\n\n・固定日常食補：龜鹿膏\n・輕巧即飲：龜鹿飲30cc\n・較大容量即飲：龜鹿飲180cc\n・沖泡與燉湯：龜鹿湯塊\n・家庭大規格：龜鹿膠\n・自行搭配飲品：鹿茸粉\n\n若涉及個人體質、疾病、用藥或是否適合食用，會轉介合作中醫師協助判斷。\n\n${ORDER_NOTICE}`,
    [
      { label: "看產品", text: "看產品" },
      { label: "搭配組合", text: "搭配組合" },
      { label: "怎麼使用", text: "怎麼使用" },
    ]
  );
}

function comboReply() {
  return flexCard(
    "搭配組合｜依日常使用方式選擇",
    "搭配組合以產品型態、使用方式與生活情境為主：\n\n・固定日常安排：龜鹿膏\n・方便即飲：龜鹿飲30cc或180cc\n・沖泡與料理：龜鹿湯塊\n・家庭長期使用：龜鹿膠\n・自行搭配飲品：鹿茸粉\n\n若涉及個人體質、疾病、用藥或適不適合食用，會轉介合作中醫師協助判斷。",
    [
      { label: "查看搭配組合", text: "搭配組合" },
      { label: "查看產品", text: "看產品" },
      { label: "人工客服", text: "我要人工客服" },
    ]
  );
}

function comboMenuReply() {
  const combos = DATA.offers?.comboOffers || [];
  if (!combos.length) return textMsg("目前搭配方案由客服依需求協助整理。", mainQuick());
  const lines = combos.map((combo, index) =>
    (index + 1) + ". " + combo.name + "\n" + (combo.items || []).map((item) => "・" + item).join("\n") + "\n" + (combo.desc || "")
  );
  return textMsg(
    "請選擇想查看的搭配方案：\n\n" + lines.join("\n\n") + "\n\n實際價格、庫存與活動由客服確認。",
    combos.slice(0, 10).map((combo, index) => ({ label: combo.name.slice(0, 20), text: "搭配方案｜" + index }))
  );
}

function comboDetailReply(index) {
  const combo = (DATA.offers?.comboOffers || [])[Number(index)];
  if (!combo) return comboMenuReply();
  return flexCard(
    combo.name,
    (combo.items || []).map((item) => "・" + item).join("\n") + "\n\n" + (combo.desc || "") + "\n\n" + (combo.priceNote || "價格與活動由客服確認"),
    [
      { label: "看全部產品", text: "看產品" },
      { label: "其他搭配方案", text: "搭配組合" },
      { label: "人工客服", text: "我要人工客服" },
    ]
  );
}

function usageChooserReply() {
  return textMsg("請選擇想查看的產品使用方式：", [
    { label: "龜鹿膏", text: "龜鹿膏怎麼使用" },
    { label: "龜鹿飲30cc", text: "龜鹿飲30cc怎麼使用" },
    { label: "龜鹿飲180cc", text: "龜鹿飲180cc怎麼使用" },
    { label: "龜鹿湯塊", text: "龜鹿湯塊怎麼使用" },
    { label: "龜鹿膠", text: "龜鹿膠怎麼使用" },
    { label: "鹿茸粉", text: "鹿茸粉怎麼使用" },
  ]);
}

function usageReply(product) {
  return flexCard(
    `${product.displayName}｜使用方式`,
    `${(product.usage || []).join("\n\n")}\n\n成分：${(product.ingredients || []).join("、")}\n\n${ORDER_NOTICE}`,
    [
      { label: "選擇數量", text: `選擇數量｜${product.id}` },
      { label: "完整介紹", uri: absoluteUrl(product.page || "products.html") },
      { label: "看產品DM", uri: absoluteUrl(product.dmImage || product.image || "images/logo.png") },
    ]
  );
}

function doctorReferralReply() {
  const referral = DATA.medicalReferral || {};
  const doctor = referral.doctor || "章無忌中醫師";
  const lineId = referral.lineId || "@changwuchi";
  const url = referral.url || "https://lin.ee/1MK4NR9";
  return flexCard(
    "個人狀況｜轉介中醫師諮詢",
    `這部分會因每個人的身體狀況不同，為了讓您得到更準確的說明與建議，建議先由合作的中醫師了解您的情況🙂

✔ 專人一對一說明
✔ 可詢問適不適合食用
✔ 可詢問個人狀況與疑問

LINE ID：${lineId}
${doctor}`,
    [
      { label: "前往中醫師諮詢", uri: url },
      { label: "查看產品資訊", text: "看產品" },
      { label: "人工客服", text: "我要人工客服" },
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
  return flexCard(
    "仙加味｜四代傳承",
    "仙加味的故事從台北萬華開始。\n\n第一代曾祖父從行口與山產買賣起步。祖父『鹿角伯』自十幾歲起學習山產原料，以及鹿角、鹿茸、鹿鞭等鹿類原料與產品的生鮮、乾品處理與加工。父親長期協助並於約2000年前後正式承接第三代工作。\n\n重要歷程：\n・1974年開始獨立經營\n・1976年正式成立獨立事業\n・1978年完成公司化經營\n・2008年『仙加味』品牌完成註冊\n\n第四代將家族經驗整理成更清楚的產品資訊與日常使用方式。",
    [
      { label: "完整品牌故事", uri: absoluteUrl("brand.html") },
      { label: "查看產品", text: "看產品" },
      { label: "人工客服", text: "我要人工客服" },
    ]
  );
}

function detectProduct(text) {
  const raw = String(text || "").replace(/[【】\[\]（）()「」『』\s]/g, "");
  if (/龜鹿飲.*180|180cc|鋁袋/.test(raw)) return getProduct("guilu-drink-180");
  if (/龜鹿飲.*30|30cc|玻璃瓶/.test(raw)) return getProduct("guilu-drink-30");
  if (/龜鹿膏/.test(raw)) return getProduct("guilu-gao");
  if (/龜鹿湯塊|湯塊/.test(raw)) return getProduct("guilu-tangkuai");
  if (/龜鹿膠|一斤裝|600g/.test(raw)) return getProduct("guilu-jiao");
  if (/鹿茸粉/.test(raw)) return getProduct("luerong-fen");
  return null;
}

function startCheckout(state) {
  state.checkout = { step: "name", name: "", phone: "", payment: "", shipping: "", address: "" };
  return flexCard("第一步｜收件姓名", "請直接回覆收件人姓名。", [{ label: "取消", text: "取消" }]);
}

function orderSummary(state) {
  const checkout = state.checkout;
  return flexCard(
    "確認訂單",
    `姓名：${checkout.name}\n電話：${checkout.phone}\n付款：${checkout.payment}\n配送：${checkout.shipping}\n地址／門市：${checkout.address}\n訂單金額：${money(cartTotal(state.cart))}\n\n${ORDER_NOTICE}`,
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

    const payload = {
      userId: event.source.userId || "",
      cart: state.cart,
      total: cartTotal(state.cart),
      ...checkout,
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
        `${orderId ? `訂單編號：${orderId}\n` : ""}客服會確認商品、付款、配送與出貨順序。\n\n${ORDER_NOTICE}`,
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
    addCart(state, product, data.qty);
    return reply(event.replyToken, cartFlex(state));
  }

  return reply(event.replyToken, textMsg("請重新選擇。", mainQuick()));
}

function isSensitiveHealthQuestion(text) {
  return /功效|效果|有效|有沒有用|多久有效|改善|治療|預防|疾病|症狀|不舒服|疼痛|腰痠|腰酸|膝蓋|關節|睡眠|失眠|血糖|血壓|膽固醇|免疫|明目|補血|補氣|壯陽|腎虛|肝腎|眼睛|服藥|用藥|藥物|孕婦|懷孕|哺乳|兒童|小孩|慢性病|過敏|手術|化療|洗腎|適不適合吃|適不適合食用|能不能吃|可以吃嗎|我能吃嗎|體質|燥熱|上火|副作用|禁忌/.test(text);
}

async function handleMessage(event) {
  if (event.message.type !== "text") {
    return reply(event.replyToken, textMsg("目前請使用文字訊息詢問。", mainQuick()));
  }

  const text = sanitizeUserText(event.message.text, 500);
  const state = getState(event.source.userId || "anonymous");

  const productDetailMatch = text.match(/^產品詳情｜([^｜]+)$/);
  if (productDetailMatch) {
    const product = getProduct(productDetailMatch[1]);
    return reply(event.replyToken, product ? { type: "flex", altText: product.displayName, contents: productBubble(product) } : productMenuReply());
  }

  const comboDetailMatch = text.match(/^搭配方案｜(\d+)$/);
  if (comboDetailMatch) return reply(event.replyToken, comboDetailReply(comboDetailMatch[1]));

  if (state.checkout) return continueCheckout(event, state, text);

  const qtyMatch = text.match(/^選擇數量｜([^｜]+)$/);
  if (qtyMatch) {
    const product = getProduct(qtyMatch[1]);
    return reply(event.replyToken, product ? qtyMenu(product) : textMsg("找不到這項產品，請重新選擇。", mainQuick()));
  }

  const addMatch = text.match(/^加入購物車｜([^｜]+)｜(\d+)$/);
  if (addMatch) {
    const product = getProduct(addMatch[1]);
    const qty = Number(addMatch[2]);
    if (!product || qty <= 0) return reply(event.replyToken, textMsg("加入購物車失敗，請重新選擇。", mainQuick()));
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

  if (/^(看產品|查看產品|直接下單|我要下單|立即下單|開始下單|我要買)$/.test(text)) {
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

  if (/黃帝內經|內經|食飲有節|飲食有節|起居有常|四時調養|順應四時/.test(text)) {
    return reply(event.replyToken, huangdiNeijingReply());
  }

  if (/品牌故事|四代|鹿角伯|家族傳承|曾祖父|祖父|第三代|第四代/.test(text)) {
    return reply(event.replyToken, brandStoryReply());
  }

  if (isSensitiveHealthQuestion(text)) {
    return reply(event.replyToken, doctorReferralReply());
  }

  if (/人工|客服|聯絡/.test(text)) {
    return reply(event.replyToken, textMsg("請直接留下想詢問的內容，我們會由人工協助回覆。", mainQuick()));
  }

  if (/到貨|現貨|上架|可以買|能買|開放下單|何時出貨|出貨時間|盒子|盒裝/.test(text)) {
    return reply(
      event.replyToken,
      textMsg(`${ORDER_NOTICE}\n\n可先選擇產品與數量完成訂購安排；實際出貨時間、配送方式與優惠由客服再協助確認。`, mainQuick())
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
      `您好，歡迎來到仙加味。\n\n${ORDER_NOTICE}\n\n您可以直接輸入產品名稱、價格、怎麼選、搭配組合、怎麼使用、品牌故事、購物車或人工客服。`,
      mainQuick()
    )
  );
}

async function handleEvent(event) {
  if (event.type === "follow") {
    return reply(
      event.replyToken,
      textMsg(`您好，歡迎來到仙加味。\n\n${ORDER_NOTICE}\n\n可以先查看產品、品牌故事，或告訴我們偏好的使用方式。`, mainQuick())
    );
  }
  if (event.type === "postback") return handleLegacyPostback(event);
  if (event.type === "message") return handleMessage(event);
  return Promise.resolve();
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
    crmConfigured: Boolean(CRM_URL),
    activeStates: states.size,
  });
});

if (config.channelAccessToken && config.channelSecret) {
  app.post("/webhook", line.middleware(config), (req, res) => {
    Promise.all(req.body.events.map(handleEvent))
      .then(() => res.json({ ok: true }))
      .catch((error) => {
        console.error(error);
        res.status(500).json({ ok: false });
      });
  });
} else {
  console.warn("LINE credentials are not configured. Set CHANNEL_ACCESS_TOKEN and CHANNEL_SECRET in the deployment environment.");
  app.post("/webhook", express.json(), (_req, res) => {
    res.status(503).json({ ok: false, error: "LINE credentials are not configured" });
  });
}

const port = process.env.PORT || 3000;
if (require.main === module) {
  app.listen(port, () => console.log(`仙加味 LINE OA ${VERSION} running on ${port}`));
}

module.exports = {
  app,
  DATA,
  VERSION,
  getProduct,
  detectProduct,
  calcItem,
  addCart,
  cartTotal,
  productCarousel,
  productMenuReply,
  priceCarousel,
  recommendReply,
  comboReply,
  comboMenuReply,
  comboDetailReply,
  usageChooserReply,
  usageReply,
  doctorReferralReply,
  huangdiNeijingReply,
  brandStoryReply,
  isSensitiveHealthQuestion,
  validateData,
  sanitizeUserText,
  cleanupExpiredStates,
};
