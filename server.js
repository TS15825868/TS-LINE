"use strict";

const line = require("@line/bot-sdk");
const express = require("express");
const fs = require("fs");
const path = require("path");

const config = {
  channelAccessToken: process.env.CHANNEL_ACCESS_TOKEN || "IKjy0y2zfPOhMCp7xiJ4R4z7UkkvzoQgj7A6OH1AJjdMYpDnEzaicgz2HWy4pVz1KMSsUHzhoHoXZVztRQwibp3Q8UPfN+Dp4pBfT2k3Mzu5bBtdO1P78Cpffq+75liFPLL3ftcHMzvzr+WOgm6AEgdB04t89/1O/w1cDnyilFU=",
  channelSecret: process.env.CHANNEL_SECRET || "7c3c4740afa5a281d54afb9f8ffc1e96",
};

const CRM_URL = process.env.CRM_URL || "https://script.google.com/macros/s/AKfycbwAFBxeROd2ZYGJ_h0O7_H2MMxptOMoj3EXIErZpbKuTYFOzOVwQkrk8X1MoxapkHVGSA/exec";
const app = express();
const client = new line.Client(config);
const states = new Map();
const DATA = loadData();

function loadData() {
  const data = JSON.parse(fs.readFileSync(path.join(__dirname, "data.json"), "utf8"));
  const siteUrl = data.siteUrl || "https://ts15825868.github.io/xianjiawei/";
  data.products = (data.products || []).map((p) => ({
    ...p,
    spec: p.spec || p.size || "",
    displayName: p.displayName || p.name,
    imageUrl: p.imageUrl || (siteUrl + (p.image || "images/logo.png")),
    offers: p.offers || []
  }));
  data.combos = data.combos || [];
  data.payments = data.payments || ["匯款", "貨到付款"];
  data.shipping = data.shipping || ["宅配", "7-11賣貨便", "門市自取", "雙北親送"];
  return data;
}

function money(n) {
  return `$${Number(n || 0).toLocaleString("zh-TW")}`;
}

function getState(userId) {
  if (!states.has(userId)) states.set(userId, { cart: [], checkout: null, customQty: null });
  return states.get(userId);
}

function reply(token, messages) {
  return client.replyMessage(token, Array.isArray(messages) ? messages : [messages]);
}

function textMsg(text, quick) {
  const m = { type: "text", text };
  if (quick) m.quickReply = qr(quick);
  return m;
}

function qr(items) {
  return {
    items: items.slice(0, 13).map((i) => ({
      type: "action",
      action: i.data
        ? { type: "postback", label: i.label, data: i.data }
        : { type: "message", label: i.label, text: i.text }
    }))
  };
}

function pb(action, params = {}) {
  return new URLSearchParams({ action, ...params }).toString();
}

function parsePB(data) {
  const p = new URLSearchParams(data || "");
  return {
    action: p.get("action") || "",
    productId: p.get("productId") || "",
    comboId: p.get("comboId") || "",
    mode: p.get("mode") || "add",
    qty: Number(p.get("qty") || 0),
    recommend: p.get("recommend") || ""
  };
}

function mainQuick() {
  return [
    { label: "看產品", data: pb("products") },
    { label: "價格方案", data: pb("price_menu") },
    { label: "推薦商品", data: pb("recommend_menu") },
    { label: "購物車", data: pb("cart") },
    { label: "聯絡客服", text: "聯絡客服" }
  ];
}

function getProduct(id) {
  return DATA.products.find((p) => p.id === id) || null;
}

function getCombo(id) {
  return DATA.combos.find((c) => c.id === id) || null;
}

function cleanName(text) {
  return String(text || "")
    .replace(/我要買|我要|加入清單|加入購買清單|直接買|只買|建議售價|活動優惠|食用方式|價格方案|怎麼使用|看|了解|刪除|移除/g, "")
    .trim();
}

function productByName(text) {
  const match = String(text || "").match(/#([a-zA-Z0-9-_]+)/);
  if (match) return getProduct(match[1]);
  const raw = cleanName(text);
  return DATA.products.find((p) => p.name === raw || p.displayName === raw || (p.aliases || []).includes(raw)) || null;
}

function bestTier(product, qty) {
  const offers = (product.offers || []).slice().sort((a, b) => Number(b.qty) - Number(a.qty));
  let remain = Number(qty || 0);
  let total = 0;
  const parts = [];

  for (const offer of offers) {
    const offerQty = Number(offer.qty || 0);
    const offerTotal = Number(offer.total || 0);
    if (!offerQty || !offerTotal) continue;
    const count = Math.floor(remain / offerQty);
    if (count > 0) {
      remain -= count * offerQty;
      total += count * offerTotal;
      parts.push(`${offer.label || offerQty + (product.unit || "件") + "優惠"}×${count}`);
    }
  }

  if (remain > 0) {
    total += remain * Number(product.price || 0);
    parts.push(`單${product.unit || "件"}×${remain}`);
  }

  return {
    total,
    label: parts.join("＋") || `${qty}${product.unit || "件"}`
  };
}

function calcProductTotal(product, qty) {
  return bestTier(product, qty);
}

function addProductToCart(state, product, qty, replace = false) {
  if (replace) {
    state.cart = state.cart.filter((x) => !(x.type === "product" && x.id === product.id));
  }

  const found = state.cart.find((x) => x.type === "product" && x.id === product.id);
  if (found) {
    found.qty += qty;
    const calc = calcProductTotal(product, found.qty);
    found.total = calc.total;
    found.label = calc.label;
    found.unit = product.unit || "件";
    return found;
  }

  const calc = calcProductTotal(product, qty);
  const item = {
    type: "product",
    id: product.id,
    name: product.displayName || product.name,
    qty,
    unit: product.unit || "件",
    total: calc.total,
    label: calc.label
  };
  state.cart.push(item);
  return item;
}

function addComboToCart(state, combo) {
  const found = state.cart.find((x) => x.type === "combo" && x.id === combo.id);
  if (found) found.qty += 1;
  else state.cart.push({
    type: "combo",
    id: combo.id || combo.name,
    name: combo.name,
    qty: 1,
    unit: "組",
    total: combo.price || 0,
    label: combo.priceNote || "套餐優惠"
  });
}

function cartTotal(cart) {
  return cart.reduce((sum, item) => sum + Number(item.total || 0), 0);
}

function cartText(cart) {
  if (!cart.length) return "目前購物車是空的。";
  return cart.map((i, idx) => {
    const label = i.label ? `\n方案：${i.label}` : "";
    const total = i.total ? `\n小計：${money(i.total)}` : "\n金額：客服確認";
    return `${idx + 1}. ${i.name}\n數量：${i.qty}${i.unit || ""}${label}${total}`;
  }).join("\n\n");
}

function flexCard(title, desc, buttons) {
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
          { type: "text", text: desc, size: "sm", color: "#555555", wrap: true }
        ]
      },
      footer: {
        type: "box",
        layout: "vertical",
        spacing: "sm",
        contents: buttons.slice(0, 5).map((b, idx) => ({
          type: "button",
          style: idx === 0 ? "primary" : "secondary",
          color: idx === 0 ? "#7B1E1E" : undefined,
          action: b.data
            ? { type: "postback", label: b.label, data: b.data }
            : { type: "message", label: b.label, text: b.text }
        }))
      }
    }
  };
}

function cartFlex(state) {
  if (!state.cart.length) return flexCard("購物車", "目前購物車是空的。", [
    { label: "看產品", data: pb("products") },
    { label: "價格方案", data: pb("price_menu") },
    { label: "推薦商品", data: pb("recommend_menu") }
  ]);

  return flexCard("購物車", `${cartText(state.cart)}\n\n預估合計：${money(cartTotal(state.cart))}\n\n實際配送、活動與付款方式會由客服再協助確認。`, [
    { label: "繼續選購", data: pb("products") },
    { label: "修改數量", text: "修改數量" },
    { label: "移除商品", text: "移除商品" },
    { label: "直接結帳", data: pb("checkout") }
  ]);
}

function qtyMenuFlex(product, mode = "add") {
  const buttons = [
    { label: `1${product.unit}｜${money(product.price)}`.slice(0, 20), data: pb("set_qty", { productId: product.id, qty: "1", mode }) },
    ...(product.offers || []).map((o) => ({
      label: `${o.label}｜${money(o.total)}`.slice(0, 20),
      data: pb("set_qty", { productId: product.id, qty: String(o.qty), mode })
    })),
    { label: "自訂數量", data: pb("custom_qty", { productId: product.id, mode }) },
    { label: "返回產品", data: pb("products") }
  ];

  return flexCard(`${product.displayName || product.name}｜選擇數量`, `請選擇數量加入購物車。\n數量累積到優惠方案會自動套用優惠價；超過部分以單價計算，除非又累積到下一個優惠方案。`, buttons);
}

function productPriceText(p) {
  const offers = (p.offers || []).length
    ? "\n\n優惠方案：\n" + p.offers.map((o) => `・${o.label} ${money(o.total)}`).join("\n")
    : "";
  return `規格：${p.spec || p.size || ""}\n單品：${money(p.price)} / ${p.unit || "件"}${offers}`;
}

function productUsageText(p) {
  const ing = p.ingredients && p.ingredients.length ? `\n\n成分：${p.ingredients.join("、")}` : "";
  return `${(p.usage || []).join("\n\n")}${ing}`;
}

function productUsageFlex(p) {
  return flexCard(`${p.displayName || p.name}｜食用方式`, productUsageText(p), [
    { label: "選擇數量", data: pb("qty_menu", { productId: p.id, mode: "add" }) },
    { label: "價格方案", data: pb("price", { productId: p.id }) },
    { label: "返回產品", data: pb("products") },
    { label: "購物車", data: pb("cart") }
  ]);
}

function productFlex(p) {
  return {
    type: "bubble",
    size: "mega",
    hero: { type: "image", url: p.imageUrl, size: "full", aspectRatio: "1:1", aspectMode: "cover" },
    body: {
      type: "box",
      layout: "vertical",
      spacing: "md",
      contents: [
        { type: "text", text: p.displayName || p.name, weight: "bold", size: "xl", wrap: true },
        { type: "text", text: p.description || "", wrap: true, size: "sm", color: "#555555" },
        { type: "text", text: `規格：${p.spec || p.size || ""}`, wrap: true, size: "sm", color: "#555555" },
        { type: "text", text: "可直接選擇數量，系統會自動套用階梯優惠。", wrap: true, weight: "bold", color: "#7B1E1E" }
      ]
    },
    footer: {
      type: "box",
      layout: "vertical",
      spacing: "sm",
      contents: [
        { type: "button", style: "primary", color: "#7B1E1E", action: { type: "postback", label: "選擇數量", data: pb("qty_menu", { productId: p.id, mode: "add" }) } },
        { type: "button", style: "secondary", action: { type: "postback", label: "價格方案", data: pb("price", { productId: p.id }) } },
        { type: "button", style: "secondary", action: { type: "postback", label: "怎麼使用", data: pb("usage", { productId: p.id }) } },
        { type: "button", style: "secondary", action: { type: "postback", label: "購物車", data: pb("cart") } }
      ]
    }
  };
}

function productCarousel() {
  return { type: "flex", altText: "仙加味產品", contents: { type: "carousel", contents: DATA.products.map(productFlex) } };
}

function priceMenuFlex() {
  return flexCard("仙加味｜價格方案", "請選擇要查看的方案。LINE OA 會自動計算階梯優惠與購物車金額。", [
    { label: "單品優惠", data: pb("single_price") },
    { label: "活動優惠", data: pb("activity_menu") },
    { label: "套餐搭配", data: pb("combo") },
    { label: "看產品", data: pb("products") }
  ]);
}

function singlePriceFlex() {
  return {
    type: "flex",
    altText: "仙加味單品優惠",
    contents: {
      type: "carousel",
      contents: DATA.products.map((p) => ({
        type: "bubble",
        body: {
          type: "box",
          layout: "vertical",
          spacing: "md",
          contents: [
            { type: "text", text: p.displayName || p.name, weight: "bold", size: "xl", color: "#7B1E1E", wrap: true },
            { type: "text", text: productPriceText(p), wrap: true, size: "sm", color: "#555555" }
          ]
        },
        footer: {
          type: "box",
          layout: "vertical",
          spacing: "sm",
          contents: [
            { type: "button", style: "primary", color: "#7B1E1E", action: { type: "postback", label: "選擇數量", data: pb("qty_menu", { productId: p.id, mode: "add" }) } },
            { type: "button", style: "secondary", action: { type: "postback", label: "怎麼使用", data: pb("usage", { productId: p.id }) } }
          ]
        }
      }))
    }
  };
}

function activityFlex() {
  const productsWithOffers = DATA.products.filter((p) => (p.offers || []).length);
  return {
    type: "flex",
    altText: "仙加味活動優惠",
    contents: {
      type: "carousel",
      contents: productsWithOffers.map((p) => ({
        type: "bubble",
        body: {
          type: "box",
          layout: "vertical",
          spacing: "md",
          contents: [
            { type: "text", text: p.displayName || p.name, weight: "bold", size: "xl", color: "#7B1E1E", wrap: true },
            { type: "text", text: `單品：${money(p.price)} / ${p.unit}\n\n${p.offers.map((o) => `${o.label}：${money(o.total)}`).join("\n")}\n\n超過方案的數量會依階梯規則自動計算。`, wrap: true, size: "sm", color: "#555555" }
          ]
        },
        footer: {
          type: "box",
          layout: "vertical",
          spacing: "sm",
          contents: [
            { type: "button", style: "primary", color: "#7B1E1E", action: { type: "postback", label: "選擇數量", data: pb("qty_menu", { productId: p.id, mode: "add" }) } },
            { type: "button", style: "secondary", action: { type: "postback", label: "加入最大優惠", data: pb("set_qty", { productId: p.id, qty: String(p.offers[p.offers.length - 1].qty), mode: "add" }) } },
            { type: "button", style: "secondary", action: { type: "postback", label: "購物車", data: pb("cart") } }
          ]
        }
      }))
    }
  };
}

function comboFlex(c) {
  return {
    type: "bubble",
    body: {
      type: "box",
      layout: "vertical",
      spacing: "md",
      contents: [
        { type: "text", text: c.name, weight: "bold", size: "xl", color: "#7B1E1E", wrap: true },
        { type: "text", text: `內容：${(c.items || []).join("＋")}\n\n${c.desc || ""}\n\n優惠價：${money(c.price)}`, wrap: true, size: "sm", color: "#555555" }
      ]
    },
    footer: {
      type: "box",
      layout: "vertical",
      spacing: "sm",
      contents: [
        { type: "button", style: "primary", color: "#7B1E1E", action: { type: "postback", label: "加入清單", data: pb("add_combo", { comboId: c.id }) } },
        { type: "button", style: "secondary", action: { type: "postback", label: "直接購買", data: pb("buy_combo", { comboId: c.id }) } },
        { type: "button", style: "secondary", action: { type: "postback", label: "購物車", data: pb("cart") } }
      ]
    }
  };
}

function comboCarousel() {
  return { type: "flex", altText: "仙加味套餐搭配", contents: { type: "carousel", contents: DATA.combos.map(comboFlex) } };
}

function usageMenuFlex() {
  return flexCard("仙加味｜怎麼使用", "請選擇想了解的產品。", DATA.products.slice(0, 5).map((p) => ({ label: (p.name || p.displayName).slice(0, 20), data: pb("usage", { productId: p.id }) })));
}

function recommendFlex() {
  return flexCard("仙加味｜推薦商品", "依平常使用習慣選擇，先從最容易持續的方式開始。", [
    { label: "固定補養", data: pb("recommend", { recommend: "固定補養" }) },
    { label: "方便飲用", data: pb("recommend", { recommend: "方便飲用" }) },
    { label: "料理燉湯", data: pb("recommend", { recommend: "料理燉湯" }) },
    { label: "固定使用", data: pb("recommend", { recommend: "固定使用" }) },
    { label: "自行搭配", data: pb("recommend", { recommend: "自行搭配" }) }
  ]);
}

function recommendationText(msg) {
  if (/固定補養/.test(msg)) return ["guilu-gao", "推薦：龜鹿膏\n\n適合希望建立固定補養節奏的人。可直接食用，也可加入熱飲或料理使用。"];
  if (/方便飲用/.test(msg)) return ["guilu-drink-30", "推薦：龜鹿飲\n\n開封即可飲用，適合外出、上班與日常安排。可依需求選擇30cc玻璃瓶或180cc鋁袋。"];
  if (/料理燉湯/.test(msg)) return ["guilu-tangkuai", "推薦：龜鹿湯塊\n\n適合燉雞湯、排骨湯與日常料理。75g精品小包裝，方便安排。"];
  if (/固定使用/.test(msg)) return ["guilu-jiao", "推薦：龜鹿膠\n\n600g一斤裝，適合家庭使用、固定安排與通路合作。"];
  if (/自行搭配/.test(msg)) return ["luerong-fen", "推薦：鹿茸粉\n\n可搭配熱飲、牛奶與豆漿使用，適合習慣自己調整的人。"];
  return ["guilu-gao", "可以先從生活方式選擇：固定補養、方便飲用、料理燉湯、固定使用或自行搭配。"];
}

function recommendResultFlex(keyword) {
  const [id, desc] = recommendationText(keyword);
  return flexCard(`推薦商品`, desc, [
    { label: "選擇數量", data: pb("qty_menu", { productId: id, mode: "add" }) },
    { label: "查看產品", data: pb("products") },
    { label: "價格方案", data: pb("price", { productId: id }) },
    { label: "購物車", data: pb("cart") }
  ]);
}

function orderConfirmFlex(state, ck) {
  return flexCard("請確認訂單", `${cartText(state.cart)}\n\n姓名：${ck.name}\n\n電話：${ck.phone}\n\n地址／門市：${ck.address}\n\n付款：${ck.payment}\n\n配送：${ck.shipping}`, [
    { label: "確認送出", text: "確認送出" },
    { label: "取消", text: "取消" }
  ]);
}

function orderSuccessFlex(orderId, summary) {
  const productText = (summary.cart || []).map((i) => `${i.name} × ${i.qty}${i.unit || ""}${i.label ? "（" + i.label + "）" : ""}`).join("\n");
  return flexCard("訂單建立成功", `訂單編號：${orderId || "客服確認中"}\n\n商品：\n${productText}\n\n預估金額：${money(summary.total)}\n\n付款：${summary.payment}\n配送：${summary.shipping}\n\n客服將盡快與您聯繫確認。如需修改訂單，請直接回覆訊息。`, [
    { label: "再次選購", data: pb("products") },
    { label: "熱門搭配", data: pb("combo") },
    { label: "價格方案", data: pb("price_menu") },
    { label: "聯絡客服", text: "聯絡客服" }
  ]);
}

async function saveCRM(data) {
  if (!CRM_URL) return { ok: false };
  try {
    const res = await fetch(CRM_URL, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
    const text = await res.text();
    try { return JSON.parse(text); } catch { return { ok: res.ok }; }
  } catch (e) {
    console.error("CRM error", e);
    return { ok: false, error: String(e) };
  }
}

async function handlePostback(event) {
  const state = getState(event.source.userId);
  const p = parsePB(event.postback.data);
  const product = p.productId ? getProduct(p.productId) : null;
  const combo = p.comboId ? getCombo(p.comboId) : null;

  if (p.action === "products") return reply(event.replyToken, productCarousel());
  if (p.action === "price_menu") return reply(event.replyToken, priceMenuFlex());
  if (p.action === "single_price") return reply(event.replyToken, singlePriceFlex());
  if (p.action === "activity_menu") return reply(event.replyToken, activityFlex());
  if (p.action === "combo") return reply(event.replyToken, comboCarousel());
  if (p.action === "usage_menu") return reply(event.replyToken, usageMenuFlex());
  if (p.action === "recommend_menu") return reply(event.replyToken, recommendFlex());
  if (p.action === "cart") return reply(event.replyToken, cartFlex(state));
  if (p.action === "checkout") return startCheckout(event, state);

  if (p.action === "price") return reply(event.replyToken, product ? flexCard(`${product.displayName || product.name}｜價格方案`, productPriceText(product), [
    { label: "選擇數量", data: pb("qty_menu", { productId: product.id, mode: "add" }) },
    { label: "看活動優惠", data: pb("activity_menu") },
    { label: "購物車", data: pb("cart") }
  ]) : textMsg("請先選擇產品。", mainQuick()));

  if (p.action === "usage") return reply(event.replyToken, product ? productUsageFlex(product) : textMsg("請先選擇產品。", mainQuick()));
  if (p.action === "recommend") return reply(event.replyToken, recommendResultFlex(p.recommend));

  if (p.action === "qty_menu") {
    if (!product) return reply(event.replyToken, textMsg("找不到產品，請再點一次。", mainQuick()));
    return reply(event.replyToken, qtyMenuFlex(product, p.mode));
  }

  if (p.action === "custom_qty") {
    if (!product) return reply(event.replyToken, textMsg("找不到產品，請再點一次。", mainQuick()));
    state.customQty = { productId: product.id, mode: p.mode || "add" };
    return reply(event.replyToken, flexCard(`${product.displayName || product.name}｜自訂數量`, "請直接輸入數量，例如：\n7\n\n系統會自動依階梯優惠計算。", [
      { label: "取消", text: "取消" }
    ]));
  }

  if (p.action === "set_qty") {
    if (!product || !p.qty) return reply(event.replyToken, textMsg("找不到產品或數量，請再點一次。", mainQuick()));
    addProductToCart(state, product, p.qty, p.mode === "replace");
    return reply(event.replyToken, cartFlex(state));
  }

  if (p.action === "add_combo") {
    if (!combo) return reply(event.replyToken, textMsg("找不到套餐，請再點一次。", mainQuick()));
    addComboToCart(state, combo);
    return reply(event.replyToken, cartFlex(state));
  }

  if (p.action === "buy_combo") {
    if (!combo) return reply(event.replyToken, textMsg("找不到套餐，請再點一次。", mainQuick()));
    state.cart = [];
    addComboToCart(state, combo);
    return startCheckout(event, state);
  }

  return reply(event.replyToken, textMsg("可以直接點下面按鈕，我幫你整理🙂", mainQuick()));
}

app.get("/", (req, res) => res.send("仙加味 LINE Bot v122 running"));
app.get("/healthz", (req, res) => res.json({ ok: true, version: "v122", time: new Date().toISOString() }));

app.post("/webhook", line.middleware(config), async (req, res) => {
  try {
    await Promise.all((req.body.events || []).map(handleEvent));
    res.sendStatus(200);
  } catch (e) {
    console.error(e);
    res.sendStatus(500);
  }
});

async function handleEvent(event) {
  if (event.type === "follow") return reply(event.replyToken, textMsg("歡迎來到仙加味・龜鹿🙂\n可以直接點下面按鈕，不用自己打字。", mainQuick()));
  if (event.type === "postback") return handlePostback(event);
  if (event.type !== "message" || event.message.type !== "text") return;

  const state = getState(event.source.userId);
  const msg = event.message.text.trim();

  if (state.customQty && /^\d+$/.test(msg)) {
    const product = getProduct(state.customQty.productId);
    const qty = Number(msg);
    const mode = state.customQty.mode || "add";
    state.customQty = null;
    if (!product || qty <= 0) return reply(event.replyToken, textMsg("數量格式不正確，請重新操作。", mainQuick()));
    addProductToCart(state, product, qty, mode === "replace");
    return reply(event.replyToken, cartFlex(state));
  }

  if (msg === "取消" || msg === "取消訂單") {
    state.checkout = null;
    state.customQty = null;
    return reply(event.replyToken, textMsg("已取消本次流程。", mainQuick()));
  }

  if (state.checkout && !["看產品", "看搭配組合", "查看購買清單"].includes(msg)) {
    return continueCheckout(event, state, msg);
  }

  if (msg === "看產品" || msg === "直接下單" || msg === "我想直接下單") return reply(event.replyToken, productCarousel());
  if (msg === "價格方案" || /價格|售價|價錢|多少錢/.test(msg)) return reply(event.replyToken, priceMenuFlex());
  if (/單項售價|單品售價|單品價格|單項價格/.test(msg)) return reply(event.replyToken, singlePriceFlex());
  if (/活動|優惠|折扣|比較便宜|買多|方案/.test(msg)) return reply(event.replyToken, activityFlex());
  if (/套餐|搭配組合|搭配/.test(msg)) return reply(event.replyToken, comboCarousel());
  if (/怎麼使用|使用方式|怎麼吃|食用方式/.test(msg)) return reply(event.replyToken, usageMenuFlex());
  if (/幫我推薦|推薦|怎麼選|適合哪個|不知道/.test(msg)) return reply(event.replyToken, recommendFlex());
  if (msg === "查看購買清單" || msg === "查看清單" || msg === "購物車") return reply(event.replyToken, cartFlex(state));
  if (msg === "直接結帳") return startCheckout(event, state);

  if (/^(清空購買清單|清空清單|清空購物清單)$/.test(msg)) {
    state.cart = [];
    return reply(event.replyToken, cartFlex(state));
  }

  if (msg === "修改數量") {
    const productItems = state.cart.filter((i) => i.type === "product");
    if (!productItems.length) return reply(event.replyToken, cartFlex(state));
    return reply(event.replyToken, textMsg("要修改哪一個商品的數量？", productItems.map((i) => ({ label: i.name.slice(0, 20), data: pb("qty_menu", { productId: i.id, mode: "replace" }) }))));
  }

  if (msg === "移除商品") {
    if (!state.cart.length) return reply(event.replyToken, cartFlex(state));
    return reply(event.replyToken, textMsg("要移除哪一個？", state.cart.map((i) => ({ label: i.name.slice(0, 20), text: `刪除 ${i.name}` }))));
  }

  if (msg.startsWith("刪除 ") || msg.startsWith("移除 ")) {
    const name = msg.replace(/^刪除\s*|^移除\s*/, "").trim();
    state.cart = state.cart.filter((i) => i.name !== name);
    return reply(event.replyToken, cartFlex(state));
  }

  if (/查詢訂單|訂單查詢|查看訂單/.test(msg)) {
    return reply(event.replyToken, flexCard("訂單查詢", "請直接回覆訂單編號，例如：XJW20260611171618。\n客服會協助確認訂單狀態、付款與出貨進度。", [
      { label: "聯絡客服", text: "聯絡客服" },
      { label: "再次選購", data: pb("products") },
      { label: "購物車", data: pb("cart") }
    ]));
  }

  if (/聯絡客服|客服|人工/.test(msg)) {
    return reply(event.replyToken, flexCard("聯絡客服", "請直接留下想詢問的內容，我們會由人工協助回覆。", [
      { label: "看產品", data: pb("products") },
      { label: "購物車", data: pb("cart") },
      { label: "價格方案", data: pb("price_menu") }
    ]));
  }

  if (/龜鹿膠|湯塊跟膠|湯塊.*膠|膠.*湯塊|差別/.test(msg)) {
    return reply(event.replyToken, flexCard("龜鹿湯塊與龜鹿膠差異", "龜鹿湯塊與龜鹿膠使用相同原料與製程，內容物相同，差異在包裝方式與規格。\n\n龜鹿湯塊：75g（2兩／8塊，每塊約9.375g）\n\n龜鹿膠：600g（一斤裝／32塊，每塊約18.75g）", [
      { label: "看龜鹿湯塊", data: pb("qty_menu", { productId: "guilu-tangkuai", mode: "add" }) },
      { label: "看龜鹿膠", data: pb("qty_menu", { productId: "guilu-jiao", mode: "add" }) },
      { label: "返回產品", data: pb("products") }
    ]));
  }

  if (/懷孕|哺乳|高血壓|糖尿病|心臟|腎臟|肝|癌|化療|服藥|吃藥|藥物|手術|禁忌|副作用|診斷|醫師|醫生/.test(msg)) {
    return reply(event.replyToken, textMsg("這部分會因每個人的身體狀況不同，建議先由合作中醫師協助了解，會比較準確🙂\n\n章無忌中醫師 LINE：@changwuchi\nhttps://lin.ee/1MK4NR9", mainQuick()));
  }

  const product = productByName(msg);
  if (product) return reply(event.replyToken, { type: "flex", altText: product.displayName, contents: productFlex(product) });

  return reply(event.replyToken, textMsg("可以直接點下面按鈕，我幫你整理🙂", mainQuick()));
}

function startCheckout(event, state) {
  if (!state.cart.length) return reply(event.replyToken, cartFlex(state));
  state.checkout = { step: "name", name: "", phone: "", address: "", payment: "", shipping: "" };
  return reply(event.replyToken, [cartFlex(state), flexCard("第一步｜收件姓名", "請直接回覆收件人姓名。", [{ label: "取消", text: "取消" }])]);
}

async function continueCheckout(event, state, msg) {
  const ck = state.checkout;
  const text = msg.trim();

  if (text === "返回付款方式") {
    ck.step = "payment";
    return reply(event.replyToken, flexCard("第三步｜付款方式", "請選擇付款方式。", [
      { label: "現金付款", text: "現金付款" },
      { label: "匯款", text: "匯款" },
      { label: "貨到付款", text: "貨到付款" },
      { label: "TWQR建置中", text: "TWQR（建置中）" },
      { label: "取消", text: "取消" }
    ]));
  }

  if (ck.step === "name") {
    ck.name = text;
    ck.step = "phone";
    return reply(event.replyToken, flexCard("第二步｜收件電話", "請直接回覆收件人電話。", [{ label: "取消", text: "取消" }]));
  }

  if (ck.step === "phone") {
    ck.phone = text;
    ck.step = "payment";
    return reply(event.replyToken, flexCard("第三步｜付款方式", "請選擇付款方式。", [
      { label: "現金付款", text: "現金付款" },
      { label: "匯款", text: "匯款" },
      { label: "貨到付款", text: "貨到付款" },
      { label: "TWQR建置中", text: "TWQR（建置中）" },
      { label: "取消", text: "取消" }
    ]));
  }

  if (ck.step === "payment") {
    if (/TWQR|台灣Pay|台灣支付/.test(text)) {
      return reply(event.replyToken, flexCard("仙加味｜TWQR付款", "TWQR付款功能建置中，請先選擇其他付款方式。\n\n目前可先選擇：\n・現金付款\n・匯款\n・貨到付款", [
        { label: "返回付款方式", text: "返回付款方式" },
        { label: "聯絡客服", text: "聯絡客服" }
      ]));
    }
    if (/現金|現金付款|付現/.test(text)) ck.payment = "現金付款";
    else if (/匯款/.test(text)) ck.payment = "匯款";
    else if (/貨到付款|貨付|到付/.test(text)) ck.payment = "貨到付款";
    else return reply(event.replyToken, flexCard("第三步｜付款方式", "請選擇付款方式。", [
      { label: "現金付款", text: "現金付款" },
      { label: "匯款", text: "匯款" },
      { label: "貨到付款", text: "貨到付款" },
      { label: "TWQR建置中", text: "TWQR（建置中）" },
      { label: "取消", text: "取消" }
    ]));

    ck.step = "shipping";
    return reply(event.replyToken, flexCard("第四步｜配送方式", "請選擇配送方式。", [
      { label: "宅配", text: "宅配" },
      { label: "7-11賣貨便", text: "7-11賣貨便" },
      { label: "門市自取", text: "門市自取" },
      { label: "雙北親送", text: "雙北親送" },
      { label: "取消", text: "取消" }
    ]));
  }

  if (ck.step === "shipping") {
    if (/宅配/.test(text)) {
      ck.shipping = "宅配";
      ck.step = "address";
      return reply(event.replyToken, flexCard("第五步｜收件地址", "請回覆完整收件地址。", [{ label: "取消", text: "取消" }]));
    }

    if (/7-11|711|賣貨便|超商/.test(text)) {
      ck.shipping = "7-11賣貨便";
      ck.step = "address";
      return reply(event.replyToken, flexCard("第五步｜7-11門市資訊", "請回覆 7-11 門市名稱或門市地址。\n例如：內江門市、台北市萬華區⋯⋯", [{ label: "取消", text: "取消" }]));
    }

    if (/自取|門市/.test(text)) {
      ck.shipping = "門市自取";
      ck.address = "門市自取，客服確認取貨時間";
      ck.step = "confirm";
      return reply(event.replyToken, orderConfirmFlex(state, ck));
    }

    if (/雙北|親送/.test(text)) {
      ck.shipping = "雙北親送";
      ck.step = "address";
      return reply(event.replyToken, flexCard("第五步｜親送地址", "請回覆雙北親送地址與方便聯繫時間。", [{ label: "取消", text: "取消" }]));
    }

    return reply(event.replyToken, flexCard("第四步｜配送方式", "請選擇配送方式。", [
      { label: "宅配", text: "宅配" },
      { label: "7-11賣貨便", text: "7-11賣貨便" },
      { label: "門市自取", text: "門市自取" },
      { label: "雙北親送", text: "雙北親送" },
      { label: "取消", text: "取消" }
    ]));
  }

  if (ck.step === "address") {
    ck.address = text;
    ck.step = "confirm";
    return reply(event.replyToken, orderConfirmFlex(state, ck));
  }

  if (ck.step === "confirm") {
    if (!/確認送出|確認|送出/.test(text)) return reply(event.replyToken, orderConfirmFlex(state, ck));

    const summary = {
      cart: state.cart,
      total: cartTotal(state.cart),
      ...ck,
      userId: event.source.userId || "",
      createdAt: new Date().toISOString()
    };

    const result = await saveCRM(summary);
    const orderId = result.orderId || result.order_id || "";
    state.cart = [];
    state.checkout = null;
    return reply(event.replyToken, orderSuccessFlex(orderId, summary));
  }

  return reply(event.replyToken, textMsg("請依照按鈕或提示回覆。", mainQuick()));
}

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`仙加味 LINE Bot v122 running on ${port}`));
