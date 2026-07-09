"use strict";

/**
 * 仙加味 LINE OA Bot v298.5
 * 產品、價格、購物車、結帳、品牌故事與客服分流。
 * LINE 憑證僅從部署環境變數讀取。
 */

const line = require("@line/bot-sdk");
const express = require("express");
const fs = require("fs");
const path = require("path");

const VERSION = "v298.5";
const ORDER_NOTICE = "全系列已開放詢問與下單；實際庫存與出貨時間由客服確認。";
const SITE_URL = "https://ts15825868.github.io/xianjiawei/";
const CRM_URL = process.env.CRM_URL || "";

const config = {
  channelAccessToken: process.env.CHANNEL_ACCESS_TOKEN || "",
  channelSecret: process.env.CHANNEL_SECRET || "",
};

const app = express();
const states = new Map();
const DATA = loadData();
const client = config.channelAccessToken && config.channelSecret ? new line.Client(config) : null;

function loadData() {
  const file = path.join(__dirname, "data.json");
  const data = JSON.parse(fs.readFileSync(file, "utf8"));
  data.siteUrl = data.siteUrl || SITE_URL;
  data.products = (data.products || []).map((p) => ({
    ...p,
    displayName: p.displayName || p.name,
    spec: p.spec || p.size || "",
    offers: p.offers || [],
    orderStatus: "開放下單",
    shippingNotice: "實際庫存與出貨時間由客服確認。",
  }));
  return data;
}

function money(value) {
  return `$${Number(value || 0).toLocaleString("zh-TW")}`;
}

function absoluteUrl(asset = "") {
  if (/^https?:\/\//i.test(asset)) return encodeURI(asset);
  return encodeURI(`${DATA.siteUrl.replace(/\/?$/, "/")}${String(asset).replace(/^\/+/, "")}`);
}

function getProduct(id) {
  return DATA.products.find((p) => p.id === id) || null;
}

function getState(userId) {
  if (!states.has(userId)) states.set(userId, { cart: [], checkout: null });
  return states.get(userId);
}

function pb(action, params = {}) {
  return new URLSearchParams({ action, ...params }).toString();
}

function parsePB(data = "") {
  const p = new URLSearchParams(data);
  return {
    action: p.get("action") || "",
    productId: p.get("productId") || "",
    qty: Number(p.get("qty") || 0),
  };
}

function quick(items) {
  return {
    items: items.slice(0, 13).map((item) => ({
      type: "action",
      action: item.uri
        ? { type: "uri", label: item.label, uri: item.uri }
        : item.data
          ? { type: "postback", label: item.label, data: item.data }
          : { type: "message", label: item.label, text: item.text },
    })),
  };
}

function textMsg(text, items = []) {
  const msg = { type: "text", text };
  if (items.length) msg.quickReply = quick(items);
  return msg;
}

function mainQuick() {
  return [
    { label: "看產品", data: pb("products") },
    { label: "價格方案", data: pb("prices") },
    { label: "怎麼選", data: pb("recommend") },
    { label: "品牌故事", text: "品牌故事" },
    { label: "購物車", data: pb("cart") },
    { label: "人工客服", text: "我要人工客服" },
  ];
}

function flexCard(title, desc, buttons = []) {
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
          { type: "text", text: desc, size: "sm", color: "#555555", wrap: true },
        ],
      },
      footer: {
        type: "box",
        layout: "vertical",
        spacing: "sm",
        contents: buttons.slice(0, 5).map((b, index) => ({
          type: "button",
          style: index === 0 ? "primary" : "secondary",
          color: index === 0 ? "#7B1E1E" : undefined,
          action: b.uri
            ? { type: "uri", label: b.label, uri: b.uri }
            : b.data
              ? { type: "postback", label: b.label, data: b.data }
              : { type: "message", label: b.label, text: b.text },
        })),
      },
    },
  };
}

function reply(token, messages) {
  if (!client) return Promise.resolve();
  return client.replyMessage(token, Array.isArray(messages) ? messages : [messages]);
}

function productBubble(p) {
  const priceLine = p.originalPrice && p.originalPrice > p.price
    ? `售價 ${money(p.originalPrice)}\n優惠價 ${money(p.price)}`
    : `售價 ${money(p.price)}`;
  const offers = p.offers.length
    ? `\n${p.offers.map((o) => `${o.label}：${money(o.total)}`).join("\n")}`
    : "";

  return {
    type: "bubble",
    size: "mega",
    hero: {
      type: "image",
      url: absoluteUrl(p.image || "images/logo.png"),
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
        { type: "text", text: p.displayName, weight: "bold", size: "xl", wrap: true },
        { type: "text", text: `規格：${p.spec}\n${p.purpose ? `用途方向：${p.purpose}\n` : ""}${priceLine}${offers}`, size: "sm", color: "#555555", wrap: true },
        { type: "text", text: ORDER_NOTICE, size: "sm", color: "#7B1E1E", weight: "bold", wrap: true },
      ],
    },
    footer: {
      type: "box",
      layout: "vertical",
      spacing: "sm",
      contents: [
        { type: "button", style: "primary", color: "#7B1E1E", action: { type: "postback", label: "選擇數量", data: pb("qty", { productId: p.id }) } },
        { type: "button", style: "secondary", action: { type: "uri", label: "完整介紹", uri: absoluteUrl(p.page || "products.html") } },
        { type: "button", style: "secondary", action: { type: "postback", label: "使用方式", data: pb("usage", { productId: p.id }) } },
      ],
    },
  };
}

function productCarousel() {
  return { type: "flex", altText: "仙加味產品", contents: { type: "carousel", contents: DATA.products.map(productBubble) } };
}

function priceCarousel() {
  return {
    type: "flex",
    altText: "仙加味價格方案",
    contents: {
      type: "carousel",
      contents: DATA.products.map((p) => {
        const original = p.originalPrice && p.originalPrice > p.price
          ? `售價：${money(p.originalPrice)}\n優惠價：${money(p.price)}`
          : `售價：${money(p.price)}`;
        const offers = p.offers.length
          ? `\n\n活動：\n${p.offers.map((o) => `・${o.label} ${money(o.total)}`).join("\n")}`
          : "";
        return flexCard(p.displayName, `規格：${p.spec}\n${original}${offers}\n\n${ORDER_NOTICE}`, [
          { label: "選擇數量", data: pb("qty", { productId: p.id }) },
          { label: "看產品", data: pb("products") },
        ]).contents;
      }),
    },
  };
}

function qtyMenu(p) {
  const buttons = [
    { label: `1${p.unit || "件"}｜${money(p.price)}`.slice(0, 20), data: pb("add", { productId: p.id, qty: 1 }) },
    ...p.offers.map((o) => ({ label: `${o.label}｜${money(o.total)}`.slice(0, 20), data: pb("add", { productId: p.id, qty: o.qty }) })),
    { label: "返回產品", data: pb("products") },
  ];
  return flexCard(`${p.displayName}｜選擇數量`, `${ORDER_NOTICE}\n\n請選擇要加入購物車的數量。`, buttons);
}

function calcItem(p, qty) {
  const offers = [...p.offers].sort((a, b) => Number(b.qty) - Number(a.qty));
  let remain = qty;
  let total = 0;
  const labels = [];
  for (const o of offers) {
    const count = Math.floor(remain / Number(o.qty));
    if (count) {
      remain -= count * Number(o.qty);
      total += count * Number(o.total);
      labels.push(`${o.label}×${count}`);
    }
  }
  if (remain) {
    total += remain * Number(p.price || 0);
    labels.push(`單${p.unit || "件"}×${remain}`);
  }
  return { total, label: labels.join("＋") || `${qty}${p.unit || "件"}` };
}

function addCart(state, p, qty) {
  const found = state.cart.find((i) => i.id === p.id);
  if (found) found.qty += qty;
  else state.cart.push({ id: p.id, name: p.displayName, qty, unit: p.unit || "件" });
  const item = state.cart.find((i) => i.id === p.id);
  const calc = calcItem(p, item.qty);
  item.total = calc.total;
  item.label = calc.label;
}

function cartTotal(cart) {
  return cart.reduce((sum, item) => sum + Number(item.total || 0), 0);
}

function cartFlex(state) {
  if (!state.cart.length) return flexCard("購物車", `目前購物車是空的。\n\n${ORDER_NOTICE}`, [
    { label: "看產品", data: pb("products") },
    { label: "價格方案", data: pb("prices") },
  ]);

  const lines = state.cart.map((i, index) => `${index + 1}. ${i.name}\n數量：${i.qty}${i.unit}\n方案：${i.label}\n小計：${money(i.total)}`).join("\n\n");
  return flexCard("購物車", `${lines}\n\n合計：${money(cartTotal(state.cart))}\n\n${ORDER_NOTICE}`, [
    { label: "直接結帳", data: pb("checkout") },
    { label: "繼續選購", data: pb("products") },
    { label: "清空購物車", text: "清空購物車" },
  ]);
}

function recommendReply() {
  return textMsg(
    `可依平常使用方式比較：\n\n・固定日常食補：龜鹿膏\n・輕巧或較大容量即飲：龜鹿飲\n・沖泡與燉湯：龜鹿湯塊\n・家庭大規格：龜鹿膠\n・自行搭配飲品：鹿茸粉\n\n${ORDER_NOTICE}`,
    mainQuick()
  );
}

function brandStoryReply() {
  return flexCard(
    "仙加味｜四代傳承",
    "仙加味的故事從台北萬華開始。\n\n第一代曾祖父從行口與山產買賣起步。\n\n祖父『鹿角伯』為民國28年次，國小畢業後，十幾歲便跟著曾祖父在老店學習山產原料，以及鹿角、鹿茸、鹿鞭等鹿類原料與產品的處理、代工與加工，包含生鮮原料與乾品。\n\n父親出生於1964年，長期在祖父身邊協助相關鹿類原料與產品的生鮮、乾品處理、代工加工與日常營運；約2000年前後鹿角伯辭世後，第三代正式承接。\n\n重要歷程：\n・1974年開始獨立經營\n・1976年正式成立獨立事業\n・1978年完成公司化經營\n\n2008年，『仙加味』品牌完成註冊，成為面向消費者的正式品牌名稱。第四代延續這個品牌，將家族累積的原料、工序與使用經驗，整理成更清楚的產品資訊與日常使用方式。",
    [
      { label: "查看完整品牌故事", uri: absoluteUrl("brand.html") },
      { label: "查看產品系列", data: pb("products") },
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
  const c = state.checkout;
  return flexCard("確認訂單", `姓名：${c.name}\n電話：${c.phone}\n付款：${c.payment}\n配送：${c.shipping}\n地址／門市：${c.address}\n訂單金額：${money(cartTotal(state.cart))}\n\n${ORDER_NOTICE}`, [
    { label: "確認送出", text: "確認送出" },
    { label: "取消", text: "取消" },
  ]);
}

async function saveCRM(payload) {
  if (!CRM_URL) return {};
  try {
    const response = await fetch(CRM_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    return await response.json().catch(() => ({}));
  } catch (error) {
    console.error("CRM 寫入失敗：", error.message);
    return {};
  }
}

async function continueCheckout(event, state, text) {
  const c = state.checkout;
  if (text === "取消") {
    state.checkout = null;
    return reply(event.replyToken, textMsg("已取消結帳。", mainQuick()));
  }
  if (c.step === "name") {
    c.name = text;
    c.step = "phone";
    return reply(event.replyToken, flexCard("第二步｜收件電話", "請直接回覆收件人電話。", [{ label: "取消", text: "取消" }]));
  }
  if (c.step === "phone") {
    c.phone = text;
    c.step = "payment";
    return reply(event.replyToken, textMsg("請選擇付款方式。", [
      { label: "現金付款", text: "現金付款" },
      { label: "匯款", text: "匯款" },
      { label: "貨到付款", text: "貨到付款" },
      { label: "取消", text: "取消" },
    ]));
  }
  if (c.step === "payment") {
    if (!/現金|匯款|貨到付款/.test(text)) return reply(event.replyToken, textMsg("請選擇現金付款、匯款或貨到付款。"));
    c.payment = /貨到付款/.test(text) ? "貨到付款" : /匯款/.test(text) ? "匯款" : "現金付款";
    c.step = "shipping";
    return reply(event.replyToken, textMsg("請選擇配送方式。", [
      { label: "宅配", text: "宅配" },
      { label: "7-11賣貨便", text: "7-11賣貨便" },
      { label: "門市自取", text: "門市自取" },
      { label: "雙北親送", text: "雙北親送" },
      { label: "取消", text: "取消" },
    ]));
  }
  if (c.step === "shipping") {
    if (!/宅配|7-11|賣貨便|門市自取|自取|雙北|親送/.test(text)) return reply(event.replyToken, textMsg("請選擇宅配、7-11賣貨便、門市自取或雙北親送。"));
    c.shipping = /7-11|賣貨便/.test(text) ? "7-11賣貨便" : /自取/.test(text) ? "門市自取" : /雙北|親送/.test(text) ? "雙北親送" : "宅配";
    if (c.shipping === "門市自取") {
      c.address = "萬華門市自取，客服確認時間";
      c.step = "confirm";
      return reply(event.replyToken, orderSummary(state));
    }
    c.step = "address";
    return reply(event.replyToken, flexCard("第五步｜地址或門市", c.shipping === "7-11賣貨便" ? "請回覆 7-11 門市名稱或門市地址。" : "請回覆完整收件地址。", [{ label: "取消", text: "取消" }]));
  }
  if (c.step === "address") {
    c.address = text;
    c.step = "confirm";
    return reply(event.replyToken, orderSummary(state));
  }
  if (c.step === "confirm") {
    if (!/確認送出|確認|送出/.test(text)) return reply(event.replyToken, orderSummary(state));
    const payload = {
      userId: event.source.userId || "",
      cart: state.cart,
      total: cartTotal(state.cart),
      ...c,
      createdAt: new Date().toISOString(),
    };
    const result = await saveCRM(payload);
    const orderId = result.orderId || result.order_id || "";
    state.cart = [];
    state.checkout = null;
    return reply(event.replyToken, flexCard("訂單已送出", `${orderId ? `訂單編號：${orderId}\n` : ""}客服會確認商品、付款、配送與出貨順序。\n\n${ORDER_NOTICE}`, [
      { label: "再次選購", data: pb("products") },
      { label: "人工客服", text: "我要人工客服" },
    ]));
  }
}

async function handlePostback(event) {
  const state = getState(event.source.userId || "anonymous");
  const data = parsePB(event.postback.data);
  if (data.action === "products") return reply(event.replyToken, productCarousel());
  if (data.action === "prices") return reply(event.replyToken, priceCarousel());
  if (data.action === "recommend") return reply(event.replyToken, recommendReply());
  if (data.action === "cart") return reply(event.replyToken, cartFlex(state));
  if (data.action === "checkout") return reply(event.replyToken, state.cart.length ? startCheckout(state) : cartFlex(state));
  const p = getProduct(data.productId);
  if (data.action === "qty" && p) return reply(event.replyToken, qtyMenu(p));
  if (data.action === "usage" && p) return reply(event.replyToken, flexCard(`${p.displayName}｜使用方式`, `${(p.usage || []).join("\n\n")}\n\n成分：${(p.ingredients || []).join("、")}\n\n${ORDER_NOTICE}`, [
    { label: "選擇數量", data: pb("qty", { productId: p.id }) },
    { label: "完整介紹", uri: absoluteUrl(p.page || "products.html") },
  ]));
  if (data.action === "add" && p && data.qty > 0) {
    addCart(state, p, data.qty);
    return reply(event.replyToken, cartFlex(state));
  }
  return reply(event.replyToken, textMsg("請重新選擇。", mainQuick()));
}

async function handleMessage(event) {
  if (event.message.type !== "text") return reply(event.replyToken, textMsg("目前請使用文字訊息詢問。", mainQuick()));
  const text = String(event.message.text || "").trim();
  const state = getState(event.source.userId || "anonymous");
  if (state.checkout) return continueCheckout(event, state, text);

  if (/清空購物車|清空清單/.test(text)) {
    state.cart = [];
    return reply(event.replyToken, cartFlex(state));
  }
  if (/到貨|現貨|上架|可以買|能買|開放下單|何時出貨|出貨時間|盒子|盒裝/.test(text)) {
    return reply(event.replyToken, textMsg(`${ORDER_NOTICE}\n\n可先選擇產品與數量完成訂購安排；實際出貨時間、配送方式與優惠由客服再協助確認。`, mainQuick()));
  }
  if (/看產品|直接下單|我要買/.test(text)) return reply(event.replyToken, productCarousel());
  if (/價格|售價|價錢|多少錢|優惠/.test(text)) return reply(event.replyToken, priceCarousel());
  if (/購物車|購買清單/.test(text)) return reply(event.replyToken, cartFlex(state));
  if (/結帳/.test(text)) return reply(event.replyToken, state.cart.length ? startCheckout(state) : cartFlex(state));
  if (/不知道|怎麼選|推薦|適合哪個/.test(text)) return reply(event.replyToken, recommendReply());
  if (/品牌故事|四代|鹿角伯|家族傳承|曾祖父|祖父|第三代|第四代/.test(text)) return reply(event.replyToken, brandStoryReply());
  if (/人工|客服|聯絡/.test(text)) return reply(event.replyToken, textMsg("請直接留下想詢問的內容，我們會由人工協助回覆。", mainQuick()));
  if (/功效|效果|改善|治療|預防|疾病|服藥|孕婦|懷孕|哺乳|兒童|小孩|慢性病/.test(text)) {
    return reply(event.replyToken, textMsg("仙加味提供產品成分、規格與一般使用方式。若有疾病、持續不適、孕哺、兒童、正在服藥或其他特殊狀況，請先詢問醫師、中醫師或藥師。", mainQuick()));
  }

  const p = detectProduct(text);
  if (p) {
    if (/怎麼用|使用方式|食用方式|成分/.test(text)) return reply(event.replyToken, flexCard(`${p.displayName}｜產品資料`, `${p.description}\n\n規格：${p.spec}\n成分：${(p.ingredients || []).join("、")}\n\n使用方式：\n${(p.usage || []).join("\n")}\n\n${ORDER_NOTICE}`, [
      { label: "選擇數量", data: pb("qty", { productId: p.id }) },
      { label: "完整介紹", uri: absoluteUrl(p.page || "products.html") },
      { label: "看產品DM", uri: absoluteUrl(p.dmImage || p.image || "images/logo.png") },
    ]));
    return reply(event.replyToken, { type: "flex", altText: p.displayName, contents: productBubble(p) });
  }

  return reply(event.replyToken, textMsg(`您好，歡迎來到仙加味。\n\n${ORDER_NOTICE}\n\n您可以直接輸入產品名稱、價格、怎麼選、品牌故事、購物車或人工客服。`, mainQuick()));
}

async function handleEvent(event) {
  if (event.type === "follow") return reply(event.replyToken, textMsg(`您好，歡迎來到仙加味。\n\n${ORDER_NOTICE}\n\n可以先查看產品、品牌故事，或告訴我們偏好的使用方式。`, mainQuick()));
  if (event.type === "postback") return handlePostback(event);
  if (event.type === "message") return handleMessage(event);
  return Promise.resolve();
}

app.get("/", (_req, res) => res.json({ ok: true, service: "仙加味 LINE OA", version: VERSION, orderOpen: true }));
app.get("/healthz", (_req, res) => res.json({ ok: true, version: VERSION, orderOpen: true, credentialsConfigured: Boolean(config.channelAccessToken && config.channelSecret) }));

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
  app.post("/webhook", express.json(), (_req, res) => res.status(503).json({ ok: false, error: "LINE credentials are not configured" }));
}

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`仙加味 LINE OA ${VERSION} running on ${port}`));
