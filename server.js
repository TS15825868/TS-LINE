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

function loadData() {
  const data = JSON.parse(fs.readFileSync(path.join(__dirname, "data.json"), "utf8"));
  const siteUrl = data.siteUrl || "https://ts15825868.github.io/xianjiawei/";
  data.products = (data.products || []).map((p) => ({
    ...p,
    spec: p.spec || p.size || "",
    displayName: p.displayName || p.name,
    imageUrl: p.imageUrl || (siteUrl + (p.image || "images/logo.png")),
  }));
  data.combos = data.combos || [];
  data.payments = data.payments || ["匯款", "貨到付款"];
  data.shipping = data.shipping || ["宅配", "7-11賣貨便", "門市自取", "雙北親送"];
  return data;
}

const DATA = loadData();

function money(n) {
  return `$${Number(n || 0).toLocaleString("zh-TW")}`;
}

function getState(userId) {
  if (!states.has(userId)) states.set(userId, { cart: [], checkout: null });
  return states.get(userId);
}

function qr(items) {
  return {
    items: items.slice(0, 13).map((i) => ({
      type: "action",
      action: i.data
        ? { type: "postback", label: i.label, data: i.data }
        : { type: "message", label: i.label, text: i.text },
    })),
  };
}

function textMsg(text, quick) {
  const m = { type: "text", text };
  if (quick) m.quickReply = qr(quick);
  return m;
}

function reply(token, messages) {
  return client.replyMessage(token, Array.isArray(messages) ? messages : [messages]);
}

function mainQuick() {
  return [
    { label: "看產品", text: "看產品" },
    { label: "價格方案", text: "價格方案" },
    { label: "怎麼使用", text: "怎麼使用" },
    { label: "幫我推薦", text: "幫我推薦" },
    { label: "查看清單", text: "查看購買清單" },
  ];
}

function parsePostbackData(data) {
  const p = new URLSearchParams(data || "");
  return {
    action: p.get("action") || "",
    productId: p.get("productId") || "",
    comboId: p.get("comboId") || "",
    recommend: p.get("recommend") || "",
  };
}

function getProductById(id) {
  return DATA.products.find((p) => p.id === id) || null;
}

function getComboById(id) {
  return DATA.combos.find((c) => c.id === id) || null;
}

function cleanName(text) {
  return String(text || "")
    .replace(/我要買|我要|加入清單|加入購買清單|直接買|只買|建議售價|活動優惠|食用方式|價格方案|怎麼使用|看|了解|刪除|移除/g, "")
    .trim();
}

function productByName(text) {
  const match = String(text || "").match(/#([a-zA-Z0-9-_]+)/);
  if (match) return getProductById(match[1]);
  const raw = cleanName(text);
  return DATA.products.find((p) => p.name === raw || p.displayName === raw || (p.aliases || []).includes(raw)) || null;
}

function comboByName(text) {
  const match = String(text || "").match(/#([a-zA-Z0-9-_]+)/);
  if (match) return getComboById(match[1]);
  const raw = cleanName(text);
  return DATA.combos.find((c) => c.name === raw || String(text).includes(c.name) || (c.aliases || []).includes(raw)) || null;
}

function cartItemFromProduct(p) {
  return { type: "product", id: p.id, name: p.displayName || p.name, qty: 1, price: p.price || 0 };
}

function cartItemFromCombo(c) {
  return { type: "combo", id: c.id || c.name, name: c.name, qty: 1, price: c.price || 0 };
}

function addToCart(state, item) {
  const found = state.cart.find((x) => x.type === item.type && x.id === item.id);
  if (found) found.qty += 1;
  else state.cart.push(item);
}

function cartTotal(cart) {
  return cart.reduce((s, i) => s + (i.price || 0) * (i.qty || 1), 0);
}

function cartText(cart) {
  if (!cart.length) return "目前購買清單是空的。";
  const lines = cart.map((i, idx) => `${idx + 1}. ${i.name} × ${i.qty}\n${money((i.price || 0) * (i.qty || 1))}`);
  return `目前購買清單：\n\n${lines.join("\n\n")}\n\n預估合計：${money(cartTotal(cart))}\n\n實際金額、活動與配送方式會由客服再協助確認。`;
}

function checkoutCard(title, desc, buttons) {
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
        contents: buttons.map((b, idx) => ({
          type: "button",
          style: idx === 0 ? "primary" : "secondary",
          color: idx === 0 ? "#7B1E1E" : undefined,
          action: b.data
            ? { type: "postback", label: b.label, data: b.data }
            : { type: "message", label: b.label, text: b.text },
        })),
      },
    },
  };
}

function cartFlex(state) {
  if (!state.cart.length) return textMsg("目前購買清單是空的。", mainQuick());
  return {
    type: "flex",
    altText: "目前購買清單",
    contents: {
      type: "bubble",
      body: {
        type: "box",
        layout: "vertical",
        spacing: "md",
        contents: [
          { type: "text", text: "目前購買清單", weight: "bold", size: "xl", color: "#7B1E1E" },
          { type: "text", text: cartText(state.cart), wrap: true, size: "sm", color: "#555555" },
          { type: "separator" },
          { type: "text", text: `預估合計：${money(cartTotal(state.cart))}`, weight: "bold", size: "md", color: "#111111" },
        ],
      },
      footer: {
        type: "box",
        layout: "vertical",
        spacing: "sm",
        contents: [
          { type: "button", style: "primary", color: "#7B1E1E", action: { type: "postback", label: "繼續選購", data: "action=products" } },
          { type: "button", style: "secondary", action: { type: "message", label: "移除商品", text: "移除商品" } },
          { type: "button", style: "secondary", action: { type: "message", label: "清空清單", text: "清空購買清單" } },
          { type: "button", style: "secondary", action: { type: "postback", label: "直接結帳", data: "action=checkout" } },
        ],
      },
    },
  };
}

function productPriceText(p) {
  const activity = p.activity && p.activity.length ? `\n\n活動優惠：\n${p.activity.map((x) => `・${x}`).join("\n")}` : "";
  return `【${p.displayName || p.name}】\n\n規格：${p.spec || p.size || ""}\n建議售價：${money(p.price)} / ${p.unit || "件"}${activity}\n\n配送方式：\n✓ 宅配\n✓ 7-11賣貨便\n✓ 門市自取\n✓ 雙北親送`;
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
        { type: "text", text: "價格、活動與搭配方案可點下方按鈕查看", wrap: true, weight: "bold", color: "#7B1E1E" },
      ],
    },
    footer: {
      type: "box",
      layout: "vertical",
      spacing: "sm",
      contents: [
        { type: "button", style: "primary", color: "#7B1E1E", action: { type: "postback", label: "加入清單", data: `action=add_cart&productId=${p.id}` } },
        { type: "button", style: "secondary", action: { type: "postback", label: "立即下單", data: `action=buy_now&productId=${p.id}` } },
        { type: "button", style: "link", action: { type: "postback", label: "價格方案", data: `action=price&productId=${p.id}` } },
        { type: "button", style: "link", action: { type: "postback", label: "怎麼使用", data: `action=usage&productId=${p.id}` } },
        { type: "button", style: "link", action: { type: "postback", label: "查看清單", data: "action=cart" } },
      ],
    },
  };
}

function productCarousel() {
  return { type: "flex", altText: "仙加味產品", contents: { type: "carousel", contents: DATA.products.map(productFlex) } };
}

function comboFlex(c) {
  const body = [`內容：${(c.items || []).join("＋")}`, c.desc || "", c.priceNote || "套餐優惠依數量與配送方式，由客服協助確認。"].filter(Boolean).join("\n");
  return checkoutCard(c.name, body, [
    { label: "加入清單", data: `action=add_cart&comboId=${c.id}` },
    { label: "立即下單", data: `action=buy_now&comboId=${c.id}` },
    { label: "查看清單", data: "action=cart" },
  ]).contents;
}

function comboCarousel() {
  return { type: "flex", altText: "仙加味搭配組合", contents: { type: "carousel", contents: DATA.combos.map(comboFlex) } };
}

function priceMenuFlex() {
  return checkoutCard("仙加味｜價格方案", "可查看單品售價、活動優惠與套餐搭配。實際優惠會依數量、配送方式與活動內容由客服協助確認。", [
    { label: "單品售價", text: "單品售價" },
    { label: "活動優惠", text: "活動優惠" },
    { label: "套餐搭配", text: "套餐搭配" },
    { label: "看產品", text: "看產品" },
  ]);
}

function singlePriceReply() {
  return `【仙加味｜單品售價】\n\n龜鹿飲 30cc玻璃瓶\n單瓶 50元\n12瓶 500元\n24瓶 900元\n\n龜鹿飲 180cc鋁袋\n單包 200元\n6包 1000元\n12包 1800元\n\n龜鹿膏 100g\n單罐 2000元\n\n龜鹿湯塊 75g（2兩／8塊）\n單盒 2000元\n\n鹿茸粉 75g\n單罐 2000元\n\n龜鹿膠 600g（一斤裝／32塊）\n單盒 15000元`;
}

function activityReply() {
  return `【仙加味｜活動優惠】\n\n龜鹿飲 30cc玻璃瓶\n12瓶 500元\n24瓶 900元\n\n龜鹿飲 180cc鋁袋\n6包 1000元\n12包 1800元\n\n其他品項多入優惠、套餐優惠與配送方式，會由客服協助確認。`;
}

function usageMenuFlex() {
  return checkoutCard("仙加味｜怎麼使用", "請選擇想了解的產品，我們會整理對應的使用方式。", [
    { label: "龜鹿膏", data: "action=usage&productId=guilu-gao" },
    { label: "龜鹿湯塊", data: "action=usage&productId=guilu-tangkuai" },
    { label: "龜鹿膠", data: "action=usage&productId=guilu-jiao" },
    { label: "龜鹿飲", data: "action=usage&productId=guilu-drink-30" },
    { label: "鹿茸粉", data: "action=usage&productId=luerong-fen" },
  ]);
}

function recommendFlex() {
  return checkoutCard("仙加味｜產品建議", "依平常使用習慣選擇，先從最容易持續的方式開始。", [
    { label: "固定補養", data: "action=recommend&recommend=固定補養" },
    { label: "方便飲用", data: "action=recommend&recommend=方便飲用" },
    { label: "料理燉湯", data: "action=recommend&recommend=料理燉湯" },
    { label: "固定使用", data: "action=recommend&recommend=固定使用" },
    { label: "自行搭配", data: "action=recommend&recommend=自行搭配" },
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
  return checkoutCard("請確認訂單", `${cartText(state.cart)}\n\n姓名：${ck.name}\n電話：${ck.phone}\n地址／門市：${ck.address}\n付款：${ck.payment}\n配送：${ck.shipping}`, [
    { label: "確認送出", text: "確認送出" },
    { label: "取消", text: "取消" },
  ]);
}

function orderSuccessFlex(orderId, summary) {
  const productText = (summary.cart || []).map((i) => `${i.name} × ${i.qty}`).join("\n");
  return checkoutCard("訂單建立成功", `訂單編號：${orderId || "客服確認中"}\n\n商品：\n${productText}\n\n預估金額：${money(summary.total)}\n\n付款：${summary.payment}\n配送：${summary.shipping}\n\n我們會再為你確認金額、活動與配送安排。`, [
    { label: "再次選購", data: "action=products" },
    { label: "價格方案", data: "action=price_menu" },
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
  const pb = parsePostbackData(event.postback.data);
  const p = pb.productId ? getProductById(pb.productId) : null;
  const c = pb.comboId ? getComboById(pb.comboId) : null;

  if (pb.action === "add_cart") {
    if (!p && !c) return reply(event.replyToken, textMsg("找不到要加入的品項，請再點一次。", mainQuick()));
    addToCart(state, c ? cartItemFromCombo(c) : cartItemFromProduct(p));
    return reply(event.replyToken, cartFlex(state));
  }
  if (pb.action === "buy_now") {
    if (!p && !c) return reply(event.replyToken, textMsg("找不到要下單的品項，請再點一次。", mainQuick()));
    state.cart = [c ? cartItemFromCombo(c) : cartItemFromProduct(p)];
    return startCheckout(event, state);
  }
  if (pb.action === "price") return reply(event.replyToken, textMsg(p ? productPriceText(p) : "請先選擇產品。", mainQuick()));
  if (pb.action === "usage") return reply(event.replyToken, textMsg(p ? productUsageText(p) : "請先選擇產品。", mainQuick()));
  if (pb.action === "price_menu") return reply(event.replyToken, priceMenuFlex());
  if (pb.action === "products") return reply(event.replyToken, productCarousel());
  if (pb.action === "cart") return reply(event.replyToken, cartFlex(state));
  if (pb.action === "checkout") return startCheckout(event, state);
  if (pb.action === "combo") return reply(event.replyToken, comboCarousel());
  if (pb.action === "recommend") return reply(event.replyToken, textMsg(recommendationText(pb.recommend), mainQuick()));
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

  if (msg === "價格方案" || /價格|售價|價錢|多少錢/.test(msg)) return reply(event.replyToken, priceMenuFlex());
  if (/單項售價|單品售價|單品價格|單項價格/.test(msg)) return reply(event.replyToken, textMsg(singlePriceReply(), mainQuick()));
  if (/套餐售價|套餐價格|套餐搭配|搭配售價|搭配價格/.test(msg)) return reply(event.replyToken, [textMsg("以下是目前常見搭配方向："), comboCarousel()]);
  if (/活動|優惠|折扣|比較便宜|便宜一點|買多|方案|有比較划算|有沒有優惠|能不能便宜/.test(msg)) return reply(event.replyToken, textMsg(activityReply(), mainQuick()));
  if (/怎麼使用|使用方式|怎麼吃|食用方式/.test(msg)) return reply(event.replyToken, usageMenuFlex());
  if (/幫我推薦|推薦|怎麼選|適合哪個|不知道/.test(msg)) return reply(event.replyToken, recommendFlex());
  if (msg.startsWith("推薦 ")) return reply(event.replyToken, textMsg(recommendationText(msg), mainQuick()));
  if (/龜鹿膠|湯塊跟膠|湯塊.*膠|膠.*湯塊|差別/.test(msg)) return reply(event.replyToken, textMsg("龜鹿湯塊與龜鹿膠使用相同原料與製程，內容物相同，差異在包裝方式與規格。\n\n龜鹿湯塊：75g（2兩／8塊，每塊約9.375g）\n\n龜鹿膠：600g（一斤裝／32塊，每塊約18.75g）", mainQuick()));
  if (/^(清空購買清單|清空清單|清空購物清單)$/.test(msg)) {
    state.cart = [];
    state.checkout = null;
    return reply(event.replyToken, textMsg("購買清單已清空，可以重新挑選🙂", mainQuick()));
  }
  if (msg === "移除商品") {
    if (!state.cart.length) return reply(event.replyToken, textMsg("目前購買清單是空的。", mainQuick()));
    return reply(event.replyToken, textMsg("要移除哪一個？", state.cart.map((i) => ({ label: i.name.slice(0, 20), text: `刪除 ${i.name}` }))));
  }
  if (msg.startsWith("刪除 ") || msg.startsWith("移除 ")) {
    const name = msg.replace(/^刪除\s*|^移除\s*/, "").trim();
    state.cart = state.cart.filter((i) => i.name !== name);
    return reply(event.replyToken, cartFlex(state));
  }
  if (state.checkout && !["看產品", "看搭配組合", "查看購買清單", "取消"].includes(msg)) return continueCheckout(event, state, msg);
  if (msg === "取消" || msg === "取消訂單") {
    state.checkout = null;
    return reply(event.replyToken, textMsg("已取消本次下單流程。", mainQuick()));
  }
  if (msg === "看產品" || msg === "直接下單" || msg === "我想直接下單") return reply(event.replyToken, productCarousel());
  if (msg === "看搭配組合" || msg === "搭配組合") return reply(event.replyToken, comboCarousel());
  if (msg === "查看購買清單" || msg === "查看清單") return reply(event.replyToken, cartFlex(state));
  if (msg === "直接結帳") return startCheckout(event, state);
  if (msg.startsWith("加入清單") || msg.startsWith("加入購買清單")) {
    const p = productByName(msg);
    const c = comboByName(msg);
    if (!p && !c) return reply(event.replyToken, textMsg("找不到要加入的品項，請再點一次商品或套餐。", mainQuick()));
    addToCart(state, c ? cartItemFromCombo(c) : cartItemFromProduct(p));
    return reply(event.replyToken, cartFlex(state));
  }
  if (msg.startsWith("直接買") || msg.startsWith("我要買") || msg.startsWith("我要 ")) {
    const p = productByName(msg);
    const c = comboByName(msg);
    if (!p && !c) return reply(event.replyToken, textMsg("可以先看產品或搭配組合，再點按鈕直接加入。", mainQuick()));
    state.cart = [c ? cartItemFromCombo(c) : cartItemFromProduct(p)];
    return startCheckout(event, state);
  }
  if (/懷孕|哺乳|高血壓|糖尿病|心臟|腎臟|肝|癌|化療|服藥|吃藥|藥物|手術|禁忌|副作用|診斷|醫師|醫生/.test(msg)) return reply(event.replyToken, textMsg("這部分會因每個人的身體狀況不同，建議先由合作中醫師協助了解，會比較準確🙂\n\n章無忌中醫師 LINE：@changwuchi\nhttps://lin.ee/1MK4NR9", mainQuick()));

  const p = productByName(msg);
  if (p) return reply(event.replyToken, { type: "flex", altText: p.displayName, contents: productFlex(p) });
  return reply(event.replyToken, textMsg("可以直接點下面按鈕，我幫你整理🙂", mainQuick()));
}

function startCheckout(event, state) {
  if (!state.cart.length) return reply(event.replyToken, textMsg("目前購買清單是空的，先看產品或搭配組合。", mainQuick()));
  state.checkout = { step: "name", name: "", phone: "", address: "", payment: "", shipping: "" };
  return reply(event.replyToken, [cartFlex(state), checkoutCard("第一步｜收件姓名", "請直接回覆收件人姓名。", [{ label: "取消", text: "取消" }])]);
}

async function continueCheckout(event, state, msg) {
  const ck = state.checkout;
  const text = msg.trim();

  if (ck.step === "name") {
    ck.name = text;
    ck.step = "phone";
    return reply(event.replyToken, checkoutCard("第二步｜收件電話", "請直接回覆收件人電話。", [{ label: "取消", text: "取消" }]));
  }
  if (ck.step === "phone") {
    ck.phone = text;
    ck.step = "address";
    return reply(event.replyToken, checkoutCard("第三步｜地址或門市資訊", "請回覆收件地址、7-11門市資訊，或門市自取備註。", [{ label: "取消", text: "取消" }]));
  }
  if (ck.step === "address") {
    ck.address = text;
    ck.step = "payment";
    return reply(event.replyToken, checkoutCard("第四步｜付款方式", "請選擇付款方式。", [{ label: "匯款", text: "匯款" }, { label: "貨到付款", text: "貨到付款" }, { label: "取消", text: "取消" }]));
  }
  if (ck.step === "payment") {
    if (/匯款/.test(text)) ck.payment = "匯款";
    else if (/貨到付款|貨付|到付/.test(text)) ck.payment = "貨到付款";
    else return reply(event.replyToken, checkoutCard("第四步｜付款方式", "請選擇付款方式。", [{ label: "匯款", text: "匯款" }, { label: "貨到付款", text: "貨到付款" }, { label: "取消", text: "取消" }]));

    ck.step = "shipping";
    return reply(event.replyToken, checkoutCard("第五步｜配送方式", "請選擇配送方式。", [{ label: "宅配", text: "宅配" }, { label: "7-11賣貨便", text: "7-11賣貨便" }, { label: "門市自取", text: "門市自取" }, { label: "雙北親送", text: "雙北親送" }, { label: "取消", text: "取消" }]));
  }
  if (ck.step === "shipping") {
    if (/宅配/.test(text)) ck.shipping = "宅配";
    else if (/7-11|711|賣貨便|超商/.test(text)) ck.shipping = "7-11賣貨便";
    else if (/自取|門市/.test(text)) ck.shipping = "門市自取";
    else if (/雙北|親送/.test(text)) ck.shipping = "雙北親送";
    else return reply(event.replyToken, checkoutCard("第五步｜配送方式", "請選擇配送方式。", [{ label: "宅配", text: "宅配" }, { label: "7-11賣貨便", text: "7-11賣貨便" }, { label: "門市自取", text: "門市自取" }, { label: "雙北親送", text: "雙北親送" }, { label: "取消", text: "取消" }]));

    ck.step = "confirm";
    return reply(event.replyToken, orderConfirmFlex(state, ck));
  }
  if (ck.step === "confirm") {
    if (!/確認送出|確認|送出/.test(text)) return reply(event.replyToken, orderConfirmFlex(state, ck));
    const summary = { cart: state.cart, total: cartTotal(state.cart), ...ck, userId: event.source.userId || "", createdAt: new Date().toISOString() };
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
