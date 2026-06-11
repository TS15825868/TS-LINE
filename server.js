"use strict";

const line = require("@line/bot-sdk");
const express = require("express");
const fs = require("fs");
const path = require("path");

const config = {
  channelAccessToken: process.env.CHANNEL_ACCESS_TOKEN || "",
  channelSecret: process.env.CHANNEL_SECRET || "",
};

const CRM_URL = process.env.CRM_URL || "";
const app = express();
const client = new line.Client(config);
const states = new Map();
const DATA = loadData();

const PRODUCT_QTY_OPTIONS = {
  "guilu-drink-30": [
    { qty: 1, total: 50, label: "1瓶" },
    { qty: 2, total: 100, label: "2瓶" },
    { qty: 3, total: 150, label: "3瓶" },
    { qty: 6, total: 300, label: "6瓶" },
    { qty: 12, total: 500, label: "12瓶優惠" },
    { qty: 24, total: 900, label: "24瓶優惠" }
  ],
  "guilu-drink-180": [
    { qty: 1, total: 200, label: "1包" },
    { qty: 2, total: 400, label: "2包" },
    { qty: 3, total: 600, label: "3包" },
    { qty: 6, total: 1000, label: "6包優惠" },
    { qty: 12, total: 1800, label: "12包優惠" }
  ],
  "guilu-gao": [
    { qty: 1, label: "1罐" },
    { qty: 2, label: "2罐" },
    { qty: 3, label: "3罐" },
    { qty: 5, label: "5罐" },
    { qty: 10, label: "10罐" }
  ],
  "guilu-tangkuai": [
    { qty: 1, label: "1盒" },
    { qty: 2, label: "2盒" },
    { qty: 3, label: "3盒" },
    { qty: 5, label: "5盒" },
    { qty: 10, label: "10盒" }
  ],
  "guilu-jiao": [
    { qty: 1, label: "1盒" },
    { qty: 2, label: "2盒" },
    { qty: 5, label: "5盒" },
    { qty: 10, label: "10盒" }
  ],
  "luerong-fen": [
    { qty: 1, label: "1罐" },
    { qty: 2, label: "2罐" },
    { qty: 3, label: "3罐" },
    { qty: 5, label: "5罐" },
    { qty: 10, label: "10罐" }
  ]
};

function loadData() {
  const data = JSON.parse(fs.readFileSync(path.join(__dirname, "data.json"), "utf8"));
  const siteUrl = data.siteUrl || "https://ts15825868.github.io/xianjiawei/";
  data.products = (data.products || []).map((p) => ({
    ...p,
    spec: p.spec || p.size || "",
    displayName: p.displayName || p.name,
    imageUrl: p.imageUrl || (siteUrl + (p.image || "images/logo.png"))
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
  const q = new URLSearchParams({ action, ...params });
  return q.toString();
}

function parsePB(data) {
  const p = new URLSearchParams(data || "");
  return {
    action: p.get("action") || "",
    productId: p.get("productId") || "",
    comboId: p.get("comboId") || "",
    mode: p.get("mode") || "add",
    qty: Number(p.get("qty") || 0),
    total: Number(p.get("total") || 0),
    label: p.get("label") || "",
    recommend: p.get("recommend") || ""
  };
}

function mainQuick() {
  return [
    { label: "看產品", data: pb("products") },
    { label: "價格方案", data: pb("price_menu") },
    { label: "怎麼使用", data: pb("usage_menu") },
    { label: "幫我推薦", data: pb("recommend_menu") },
    { label: "查看清單", data: pb("cart") }
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

function comboByName(text) {
  const match = String(text || "").match(/#([a-zA-Z0-9-_]+)/);
  if (match) return getCombo(match[1]);
  const raw = cleanName(text);
  return DATA.combos.find((c) => c.name === raw || String(text).includes(c.name) || (c.aliases || []).includes(raw)) || null;
}

function calcProductTotal(product, qty, totalFromButton = 0, label = "") {
  const options = PRODUCT_QTY_OPTIONS[product.id] || [];
  const exact = options.find((o) => Number(o.qty) === Number(qty) && o.total);
  const total = totalFromButton || (exact ? exact.total : (product.price || 0) * qty);
  const promoLabel = label || (exact ? exact.label : `${qty}${product.unit || "件"}`);
  return { total, label: promoLabel };
}

function addProductToCart(state, product, qty, totalFromButton = 0, label = "") {
  const calc = calcProductTotal(product, qty, totalFromButton, label);
  const found = state.cart.find((x) => x.type === "product" && x.id === product.id && x.label === calc.label && x.total === calc.total);
  if (found) {
    found.qty += qty;
    found.total += calc.total;
  } else {
    state.cart.push({
      type: "product",
      id: product.id,
      name: product.displayName || product.name,
      qty,
      unit: product.unit || "件",
      total: calc.total,
      label: calc.label
    });
  }
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
    label: combo.price ? "套餐" : "客服確認"
  });
}

function cartTotal(cart) {
  return cart.reduce((sum, item) => sum + Number(item.total || 0), 0);
}

function cartText(cart) {
  if (!cart.length) return "目前購買清單是空的。";
  return cart.map((i, idx) => {
    const label = i.label && i.label !== `${i.qty}${i.unit || ""}` ? `\n方案：${i.label}` : "";
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
        contents: buttons.map((b, idx) => ({
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
  if (!state.cart.length) return flexCard("目前購買清單", "目前購買清單是空的。", [
    { label: "看產品", data: pb("products") },
    { label: "價格方案", data: pb("price_menu") }
  ]);

  const total = cartTotal(state.cart);
  return flexCard("目前購買清單", `${cartText(state.cart)}\n\n預估合計：${money(total)}\n\n實際金額、活動與配送方式會由客服再協助確認。`, [
    { label: "繼續選購", data: pb("products") },
    { label: "移除商品", text: "移除商品" },
    { label: "清空清單", text: "清空購買清單" },
    { label: "直接結帳", data: pb("checkout") }
  ]);
}

function qtyMenuFlex(product, mode = "add") {
  const options = PRODUCT_QTY_OPTIONS[product.id] || [{ qty: 1, label: `1${product.unit || "件"}` }];
  const actionText = mode === "buy" ? "立即下單" : "加入清單";
  const buttons = options.map((o) => {
    const calc = calcProductTotal(product, o.qty, o.total || 0, o.label);
    const priceText = calc.total ? `${o.label}｜${money(calc.total)}` : o.label;
    return {
      label: priceText.slice(0, 20),
      data: pb("set_qty", {
        productId: product.id,
        qty: String(o.qty),
        total: String(calc.total),
        label: o.label,
        mode
      })
    };
  });
  buttons.push({ label: "自行輸入數量", data: pb("custom_qty", { productId: product.id, mode }) });
  return flexCard(`${product.displayName || product.name}｜選擇數量`, `請選擇要${actionText}的數量。\n若數量符合活動方案，系統會自動套用活動售價。`, buttons);
}

function productPriceText(p) {
  const activity = p.activity && p.activity.length ? `\n\n活動優惠：\n${p.activity.map((x) => `・${x}`).join("\n")}` : "";
  return `【${p.displayName || p.name}】\n\n規格：${p.spec || p.size || ""}\n建議售價：${money(p.price)} / ${p.unit || "件"}${activity}\n\n實際優惠、配送與數量會由客服協助確認。`;
}

function productUsageText(p) {
  const ing = p.ingredients && p.ingredients.length ? `\n\n成分：${p.ingredients.join("、")}` : "";
  return `【${p.displayName || p.name}｜食用方式】\n\n${(p.usage || []).join("\n\n")}${ing}`;
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
        { type: "text", text: "可選數量，符合活動數量會自動套用優惠售價。", wrap: true, weight: "bold", color: "#7B1E1E" }
      ]
    },
    footer: {
      type: "box",
      layout: "vertical",
      spacing: "sm",
      contents: [
        { type: "button", style: "primary", color: "#7B1E1E", action: { type: "postback", label: "選數量加入", data: pb("qty_menu", { productId: p.id, mode: "add" }) } },
        { type: "button", style: "secondary", action: { type: "postback", label: "選數量下單", data: pb("qty_menu", { productId: p.id, mode: "buy" }) } },
        { type: "button", style: "link", action: { type: "postback", label: "價格方案", data: pb("price", { productId: p.id }) } },
        { type: "button", style: "link", action: { type: "postback", label: "怎麼使用", data: pb("usage", { productId: p.id }) } },
        { type: "button", style: "link", action: { type: "postback", label: "查看清單", data: pb("cart") } }
      ]
    }
  };
}

function productCarousel() {
  return { type: "flex", altText: "仙加味產品", contents: { type: "carousel", contents: DATA.products.map(productFlex) } };
}

function priceMenuFlex() {
  return flexCard("仙加味｜價格方案", "可查看單品售價、活動優惠與套餐搭配。活動數量加入清單時，會自動套用對應售價。", [
    { label: "單品售價", data: pb("single_price") },
    { label: "活動優惠", data: pb("activity_menu") },
    { label: "套餐搭配", data: pb("combo") },
    { label: "看產品", data: pb("products") }
  ]);
}

function singlePriceFlex() {
  return {
    type: "flex",
    altText: "仙加味單品售價",
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
            { type: "text", text: `規格：${p.spec || p.size || ""}\n建議售價：${money(p.price)} / ${p.unit || "件"}${p.activity ? "\n\n活動：\n" + p.activity.map(x => "・" + x).join("\n") : ""}`, wrap: true, size: "sm", color: "#555555" }
          ]
        },
        footer: {
          type: "box",
          layout: "vertical",
          spacing: "sm",
          contents: [
            { type: "button", style: "primary", color: "#7B1E1E", action: { type: "postback", label: "選數量加入", data: pb("qty_menu", { productId: p.id, mode: "add" }) } },
            { type: "button", style: "secondary", action: { type: "postback", label: "選數量下單", data: pb("qty_menu", { productId: p.id, mode: "buy" }) } }
          ]
        }
      }))
    }
  };
}

function activityFlex() {
  const bubbles = [
    {
      title: "龜鹿飲30cc玻璃瓶",
      desc: "12瓶優惠：500元\n24瓶優惠：900元",
      productId: "guilu-drink-30",
      options: [
        { label: "加入12瓶", qty: 12, total: 500, promo: "12瓶優惠" },
        { label: "加入24瓶", qty: 24, total: 900, promo: "24瓶優惠" },
        { label: "直接下單12瓶", qty: 12, total: 500, promo: "12瓶優惠", mode: "buy" },
        { label: "直接下單24瓶", qty: 24, total: 900, promo: "24瓶優惠", mode: "buy" }
      ]
    },
    {
      title: "龜鹿飲180cc鋁袋",
      desc: "6包優惠：1000元\n12包優惠：1800元",
      productId: "guilu-drink-180",
      options: [
        { label: "加入6包", qty: 6, total: 1000, promo: "6包優惠" },
        { label: "加入12包", qty: 12, total: 1800, promo: "12包優惠" },
        { label: "直接下單6包", qty: 6, total: 1000, promo: "6包優惠", mode: "buy" },
        { label: "直接下單12包", qty: 12, total: 1800, promo: "12包優惠", mode: "buy" }
      ]
    }
  ].map((b) => ({
    type: "bubble",
    body: {
      type: "box",
      layout: "vertical",
      spacing: "md",
      contents: [
        { type: "text", text: b.title, weight: "bold", size: "xl", color: "#7B1E1E", wrap: true },
        { type: "text", text: b.desc + "\n\n實際配送與活動內容由客服協助確認。", wrap: true, size: "sm", color: "#555555" }
      ]
    },
    footer: {
      type: "box",
      layout: "vertical",
      spacing: "sm",
      contents: b.options.map((o, idx) => ({
        type: "button",
        style: idx === 0 ? "primary" : "secondary",
        color: idx === 0 ? "#7B1E1E" : undefined,
        action: {
          type: "postback",
          label: o.label,
          data: pb("set_qty", {
            productId: b.productId,
            qty: String(o.qty),
            total: String(o.total),
            label: o.promo,
            mode: o.mode || "add"
          })
        }
      })).concat([
        { type: "button", style: "link", action: { type: "postback", label: "看產品", data: pb("products") } }
      ])
    }
  }));

  return { type: "flex", altText: "仙加味活動優惠", contents: { type: "carousel", contents: bubbles } };
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
        { type: "text", text: `內容：${(c.items || []).join("＋")}\n\n${c.desc || ""}\n\n${c.priceNote || "套餐優惠依數量與配送方式由客服確認。"}`, wrap: true, size: "sm", color: "#555555" }
      ]
    },
    footer: {
      type: "box",
      layout: "vertical",
      spacing: "sm",
      contents: [
        { type: "button", style: "primary", color: "#7B1E1E", action: { type: "postback", label: "加入清單", data: pb("add_combo", { comboId: c.id }) } },
        { type: "button", style: "secondary", action: { type: "postback", label: "直接購買", data: pb("buy_combo", { comboId: c.id }) } },
        { type: "button", style: "secondary", action: { type: "postback", label: "查看清單", data: pb("cart") } }
      ]
    }
  };
}

function comboCarousel() {
  return { type: "flex", altText: "仙加味套餐搭配", contents: { type: "carousel", contents: DATA.combos.map(comboFlex) } };
}

function usageMenuFlex() {
  return flexCard("仙加味｜怎麼使用", "請選擇想了解的產品，我們會整理對應的使用方式。", [
    { label: "龜鹿膏", data: pb("usage", { productId: "guilu-gao" }) },
    { label: "龜鹿湯塊", data: pb("usage", { productId: "guilu-tangkuai" }) },
    { label: "龜鹿膠", data: pb("usage", { productId: "guilu-jiao" }) },
    { label: "龜鹿飲", data: pb("usage", { productId: "guilu-drink-30" }) },
    { label: "鹿茸粉", data: pb("usage", { productId: "luerong-fen" }) }
  ]);
}

function recommendFlex() {
  return flexCard("仙加味｜產品建議", "依平常使用習慣選擇，先從最容易持續的方式開始。", [
    { label: "固定補養", data: pb("recommend", { recommend: "固定補養" }) },
    { label: "方便飲用", data: pb("recommend", { recommend: "方便飲用" }) },
    { label: "料理燉湯", data: pb("recommend", { recommend: "料理燉湯" }) },
    { label: "固定使用", data: pb("recommend", { recommend: "固定使用" }) },
    { label: "自行搭配", data: pb("recommend", { recommend: "自行搭配" }) }
  ]);
}

function recommendationText(msg) {
  if (/固定補養/.test(msg)) return "推薦：龜鹿膏\n\n適合希望建立固定補養節奏的人。可直接食用，也可加入熱飲或料理使用。";
  if (/方便飲用/.test(msg)) return "推薦：龜鹿飲\n\n開封即可飲用，適合外出、上班與日常安排。可依需求選擇30cc玻璃瓶或180cc鋁袋。";
  if (/料理燉湯/.test(msg)) return "推薦：龜鹿湯塊\n\n適合燉雞湯、排骨湯與日常料理。75g精品小包裝，方便安排。";
  if (/固定使用/.test(msg)) return "推薦：龜鹿膠\n\n600g一斤裝，適合家庭使用、固定安排與通路合作。";
  if (/自行搭配/.test(msg)) return "推薦：鹿茸粉\n\n可搭配熱飲、牛奶與豆漿使用，適合習慣自己調整的人。";
  return "可以先從生活方式選擇：固定補養、方便飲用、料理燉湯、固定使用或自行搭配。";
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
    { label: "價格方案", data: pb("price_menu") }
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

  if (p.action === "price") return reply(event.replyToken, textMsg(product ? productPriceText(product) : "請先選擇產品。", mainQuick()));
  if (p.action === "usage") return reply(event.replyToken, textMsg(product ? productUsageText(product) : "請先選擇產品。", mainQuick()));
  if (p.action === "recommend") return reply(event.replyToken, textMsg(recommendationText(p.recommend), mainQuick()));

  if (p.action === "qty_menu") {
    if (!product) return reply(event.replyToken, textMsg("找不到產品，請再點一次。", mainQuick()));
    return reply(event.replyToken, qtyMenuFlex(product, p.mode));
  }

  if (p.action === "custom_qty") {
    if (!product) return reply(event.replyToken, textMsg("找不到產品，請再點一次。", mainQuick()));
    state.customQty = { productId: product.id, mode: p.mode || "add" };
    return reply(event.replyToken, flexCard(`${product.displayName || product.name}｜自行輸入數量`, `請直接輸入數量，例如：\n12\n\n若數量剛好符合活動方案，系統會自動套用活動售價。`, [
      { label: "取消", text: "取消" }
    ]));
  }

  if (p.action === "set_qty") {
    if (!product || !p.qty) return reply(event.replyToken, textMsg("找不到產品或數量，請再點一次。", mainQuick()));
    if (p.mode === "buy") {
      state.cart = [];
      addProductToCart(state, product, p.qty, p.total, p.label);
      return startCheckout(event, state);
    }
    addProductToCart(state, product, p.qty, p.total, p.label);
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

app.get("/", (req, res) => res.send("仙加味 LINE Bot is running"));
app.get("/healthz", (req, res) => res.json({ ok: true, time: new Date().toISOString() }));

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
    const calc = calcProductTotal(product, qty);
    if (mode === "buy") {
      state.cart = [];
      addProductToCart(state, product, qty, calc.total, calc.label);
      return startCheckout(event, state);
    }
    addProductToCart(state, product, qty, calc.total, calc.label);
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
  if (msg === "查看購買清單" || msg === "查看清單") return reply(event.replyToken, cartFlex(state));
  if (msg === "直接結帳") return startCheckout(event, state);

  if (/^(清空購買清單|清空清單|清空購物清單)$/.test(msg)) {
    state.cart = [];
    return reply(event.replyToken, cartFlex(state));
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

  if (/龜鹿膠|湯塊跟膠|湯塊.*膠|膠.*湯塊|差別/.test(msg)) {
    return reply(event.replyToken, textMsg("龜鹿湯塊與龜鹿膠使用相同原料與製程，內容物相同，差異在包裝方式與規格。\n\n龜鹿湯塊：75g（2兩／8塊，每塊約9.375g）\n\n龜鹿膠：600g（一斤裝／32塊，每塊約18.75g）", mainQuick()));
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

  if (ck.step === "name") {
    ck.name = text;
    ck.step = "phone";
    return reply(event.replyToken, flexCard("第二步｜收件電話", "請直接回覆收件人電話。", [{ label: "取消", text: "取消" }]));
  }

  if (ck.step === "phone") {
    ck.phone = text;
    ck.step = "address";
    return reply(event.replyToken, flexCard("第三步｜地址或門市資訊", "請回覆收件地址、7-11門市資訊，或門市自取備註。", [{ label: "取消", text: "取消" }]));
  }

  if (ck.step === "address") {
    ck.address = text;
    ck.step = "payment";
    return reply(event.replyToken, flexCard("第四步｜付款方式", "請選擇付款方式。", [
      { label: "匯款", text: "匯款" },
      { label: "貨到付款", text: "貨到付款" },
      { label: "取消", text: "取消" }
    ]));
  }

  if (ck.step === "payment") {
    if (/匯款/.test(text)) ck.payment = "匯款";
    else if (/貨到付款|貨付|到付/.test(text)) ck.payment = "貨到付款";
    else return reply(event.replyToken, flexCard("第四步｜付款方式", "請選擇付款方式。", [
      { label: "匯款", text: "匯款" },
      { label: "貨到付款", text: "貨到付款" },
      { label: "取消", text: "取消" }
    ]));

    ck.step = "shipping";
    return reply(event.replyToken, flexCard("第五步｜配送方式", "請選擇配送方式。", [
      { label: "宅配", text: "宅配" },
      { label: "7-11賣貨便", text: "7-11賣貨便" },
      { label: "門市自取", text: "門市自取" },
      { label: "雙北親送", text: "雙北親送" },
      { label: "取消", text: "取消" }
    ]));
  }

  if (ck.step === "shipping") {
    if (/宅配/.test(text)) ck.shipping = "宅配";
    else if (/7-11|711|賣貨便|超商/.test(text)) ck.shipping = "7-11賣貨便";
    else if (/自取|門市/.test(text)) ck.shipping = "門市自取";
    else if (/雙北|親送/.test(text)) ck.shipping = "雙北親送";
    else return reply(event.replyToken, flexCard("第五步｜配送方式", "請選擇配送方式。", [
      { label: "宅配", text: "宅配" },
      { label: "7-11賣貨便", text: "7-11賣貨便" },
      { label: "門市自取", text: "門市自取" },
      { label: "雙北親送", text: "雙北親送" },
      { label: "取消", text: "取消" }
    ]));

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
app.listen(port, () => console.log(`仙加味 LINE Bot running on ${port}`));
