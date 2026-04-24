"use strict";

const line = require("@line/bot-sdk");
const express = require("express");
const fs = require("fs");
const path = require("path");

const config = {
  channelAccessToken: process.env.CHANNEL_ACCESS_TOKEN || "",
  channelSecret: process.env.CHANNEL_SECRET || ""
};

if (!config.channelAccessToken || !config.channelSecret) {
  console.warn("Missing CHANNEL_ACCESS_TOKEN or CHANNEL_SECRET in environment variables.");
}

const client = new line.Client(config);
const app = express();
const CRM_URL = process.env.CRM_URL || "";
const DATA = JSON.parse(fs.readFileSync(path.join(__dirname, "products.json"), "utf8"));
const users = new Map();

const PRODUCT_MAP = Object.fromEntries(DATA.products.map((p) => [p.name, p]));
const PRODUCT_ALIASES = Object.fromEntries(DATA.products.map((p) => [p.name, p.aliases || [p.name]]));
const COMBO_MAP = Object.fromEntries((DATA.offers?.comboOffers || []).map((o) => [o.name, o]));
const COMBO_ALIASES = Object.fromEntries((DATA.offers?.comboOffers || []).map((o) => [o.name, o.aliases || [o.name]]));

// 不把「適不適合」列入敏感，避免一般成交導流被誤轉介。
const SENSITIVE_RE = /(懷孕|孕婦|哺乳|高血壓|糖尿病|心臟|腎臟|腎病|肝|肝病|癌|化療|慢性病|嚴重過敏|中藥|西藥|服藥|吃藥|藥物|手術|月經|經期|感冒|發燒|兒童|小孩|寶寶|老人|長輩|副作用|禁忌|醫師|醫生|診斷)/;

// v68 Google / 官網 / 廣告入口自動導單：安全引導，不做療效宣稱。
const LEAD_SOURCE_RULES = [
  { key: "google", re: /(google|地圖|google商家|google看到|在google看到|從google來|搜尋看到|地圖看到)/i, title: "Google 入口" },
  { key: "website", re: /(官網|網站|網頁|xianjiawei|在網站看到|官網看到)/i, title: "官網入口" },
  { key: "ad", re: /(廣告|fb|facebook|ig|instagram|貼文|粉專|社群看到|廣告看到)/i, title: "廣告入口" }
];
const GENERAL_NEED_RE = /(補身體|食補|調養|日常調養|想補|想了解龜鹿|龜鹿怎麼選|怎麼挑|第一次買|不知道怎麼選|適合哪個|幫我看)/;
const QUICK_ORDER_RE = /(直接填單|填單模板|快速填單|我要填資料|懶人填單)/;

function detectLeadSource(raw, msg) {
  const sourceText = `${raw || ""} ${msg || ""}`;
  return LEAD_SOURCE_RULES.find((r) => r.re.test(sourceText)) || null;
}
function isGeneralNeedMessage(msg) {
  return GENERAL_NEED_RE.test(msg);
}
function isQuickOrderTemplate(msg) {
  return QUICK_ORDER_RE.test(msg);
}


app.get("/", (req, res) => res.send("仙加味 LINE bot v68 is running."));
app.post("/webhook", line.middleware(config), async (req, res) => {
  try {
    await Promise.all((req.body.events || []).map(handleEvent));
    res.sendStatus(200);
  } catch (err) {
    console.error(err);
    res.sendStatus(500);
  }
});

function getState(userId) {
  if (!users.has(userId)) {
    users.set(userId, {
      welcomed: false,
      lastProduct: null,
      lastCombo: null,
      cart: [],
      checkout: null,
      pendingDirectBuy: null
    });
  }
  return users.get(userId);
}

async function handleEvent(event) {
  const userId = event.source?.userId || "anonymous";
  const state = getState(userId);

  if (event.type === "follow") {
    state.welcomed = true;
    return replyFlex(event.replyToken, buildWelcomeFlex());
  }

  if (event.type !== "message" || event.message.type !== "text") return null;

  // 第一次 message 不再被歡迎卡吃掉；直接處理該訊息。
  state.welcomed = true;
  const raw = String(event.message.text || "").trim();
  const msg = normalize(raw);
  const token = event.replyToken;

  // 最高優先：取消、清空、刪除，避免被商品判斷誤吃。
  if (isCancel(msg)) return resetFlow(token, state);
  if (isClearCart(msg)) return clearCart(token, state);
  if (msg === "移除商品" || msg === "刪除商品") return askRemoveItem(token, state);
  if (msg.startsWith("刪除") || msg.startsWith("移除")) return removeCartItem(token, state, raw);

  // 結帳確認按鈕
  if (msg === "確認送出") return finishCheckout(token, state, userId);
  if (msg === "修改購買清單" || msg === "修改內容") return showCart(token, state);
  if (msg === "修改付款配送") return askPayment(token, state);

  // 如果正在填資料，先處理明確的瀏覽 / 購物車命令；其他文字視為資料輸入。
  const product = detectProduct(msg);
  const combo = detectCombo(msg);
  const intent = detectIntent(msg);

  if (SENSITIVE_RE.test(raw)) {
    return replyTextWithQuickReply(token, DATA.doctorReferral, mainQuickReplies());
  }

  // v68：Google / 官網 / 廣告入口，先自動分流，不讓客人自己想要問什麼。
  const leadSource = detectLeadSource(raw, msg);
  if (leadSource) {
    if (product) return replyFlex(token, buildSingleProductFlex(product));
    if (combo) return replyFlex(token, buildSingleComboFlex(combo));
    return replyTextWithQuickReply(token, buildLeadEntryText(leadSource), leadEntryQuickReplies());
  }

  // v68：客人只說「食補 / 調養 / 不知道怎麼選」時，直接給安全選擇入口。
  if (isGeneralNeedMessage(msg) && !product && !combo) {
    return replyTextWithQuickReply(token, buildGeneralNeedText(), leadEntryQuickReplies());
  }

  // v68：直接填單模板入口與簡易表單解析。
  if (isQuickOrderTemplate(msg)) {
    return replyTextWithQuickReply(token, buildQuickOrderTemplateText(), quickOrderReplies());
  }
  const directForm = parseDirectOrderForm(raw);
  if (directForm) {
    return handleDirectOrderForm(token, state, directForm);
  }

  // 購物車命令
  if (msg.startsWith("加入清單") || msg.startsWith("加入購買清單") || msg.startsWith("加入購物清單") || msg.startsWith("加龜鹿飲")) {
    return handleAddToCart(token, state, raw, msg);
  }
  if (msg === "查看購買清單" || msg === "查看購物清單" || msg === "購買清單" || msg === "購物車") return showCart(token, state);
  if (msg === "直接結帳" || msg === "結帳") return beginCheckoutFromCart(token, state);
  if (msg.startsWith("只買") || msg.startsWith("直接買")) return handleDirectOnly(token, state, raw, msg);

  // 結帳中可看其他，但不亂掉。
  if (state.checkout?.step && ["products", "combo", "recommend", "usage", "payment", "shipping"].includes(intent)) {
    return handleBrowseDuringCheckout(token, state, intent, product, combo);
  }
  if (state.checkout?.step) return continueCheckout(token, state, raw, userId);

  // Rich Menu / 常用入口
  if (intent === "welcome") return replyFlex(token, buildWelcomeFlex());
  if (intent === "products") return replyFlex(token, buildProductsCarousel());
  if (intent === "recommend") return replyFlex(token, buildRecommendFlex());
  if (intent === "combo") return replyFlex(token, buildOfferCarousel());
  if (intent === "usage") {
    if (product) return replyFlex(token, buildSingleProductUsageFlex(product));
    return replyTextWithQuickReply(token, buildUsageGeneralText(), productQuickReplies("usage"));
  }
  if (intent === "ingredients") {
    if (product) return replyFlex(token, buildSingleProductIngredientsFlex(product));
    return replyTextWithQuickReply(token, "想看哪個產品的成分？", productQuickReplies("ingredients"));
  }
  if (intent === "payment") return replyTextWithQuickReply(token, buildPaymentText(), mainQuickReplies());
  if (intent === "shipping") return replyTextWithQuickReply(token, buildShippingText(), mainQuickReplies());
  if (intent === "faq") return replyTextWithQuickReply(token, buildFaqText(), mainQuickReplies());

  // 網站 deep link：我想看「龜鹿膏」適不適合我 / 我想看「日常節奏組」這組適不適合我
  if (combo) {
    state.lastCombo = combo.name;
    return replyFlex(token, buildSingleComboFlex(combo));
  }
  if (product) {
    state.lastProduct = product.name;
    return replyFlex(token, buildSingleProductFlex(product));
  }

  // 直接下單入口：用按鈕，不叫客人輸入。
  if (intent === "order") return replyFlex(token, buildOrderStartFlex());

  return replyTextWithQuickReply(
    token,
    "我可以直接幫你整理。你可以點下面按鈕開始🙂",
    mainQuickReplies()
  );
}

function normalize(text) {
  return String(text).trim().toLowerCase().replace(/\s+/g, "");
}
function isCancel(msg) { return ["取消", "取消本次", "重來", "重新開始"].includes(msg); }
function isClearCart(msg) { return msg.includes("清空購買清單") || msg.includes("清空購物清單") || msg === "清空清單"; }
function money(n) { return `$${Number(n || 0).toLocaleString("en-US")}`; }
function normalizeNameText(text) { return String(text || "").replace(/[「」]/g, "").trim(); }

function detectProduct(msg) {
  for (const [name, aliases] of Object.entries(PRODUCT_ALIASES)) {
    if ((aliases || []).some((alias) => msg.includes(String(alias).toLowerCase().replace(/\s+/g, "")))) return PRODUCT_MAP[name];
  }
  return null;
}
function detectCombo(msg) {
  for (const [name, aliases] of Object.entries(COMBO_ALIASES)) {
    if ((aliases || []).some((alias) => msg.includes(String(alias).toLowerCase().replace(/\s+/g, "")))) return COMBO_MAP[name];
  }
  return null;
}
function findItemByText(text) {
  const t = normalize(text).replace(/^(加入清單|加入購買清單|加入購物清單|我要買|只買|直接買|刪除|移除)/, "");
  const combo = detectCombo(t);
  if (combo) return makeComboCartItem(combo);
  const product = detectProduct(t);
  if (product) return makeProductCartItem(product);
  return null;
}
function detectIntent(msg) {
  if (/(歡迎|你好|hi|hello|開始)/.test(msg)) return "welcome";
  if (/(看產品|產品|商品|產品介紹|看商品)/.test(msg)) return "products";
  if (/(幫我推薦|推薦|怎麼選|選哪個|哪個適合|適合哪個)/.test(msg)) return "recommend";
  if (/(我想直接下單|下單|訂購|我要買|購買|我要訂|直接買)/.test(msg)) return "order";
  if (/(搭配組合|看搭配組合|組合|搭配|套餐|搭配組|套組|買多少|送幾罐|贈送|優惠)/.test(msg)) return "combo";
  if (/(怎麼吃|怎麼用|怎麼使用|使用方式|食用方式|使用|食用|喝法)/.test(msg)) return "usage";
  if (/(成分|內容物|原料)/.test(msg)) return "ingredients";
  if (/(付款|匯款|貨到付款|付款方式)/.test(msg)) return "payment";
  if (/(宅配|賣貨便|7-11|711|超商|配送|運送|寄送|親送|雙北)/.test(msg)) return "shipping";
  if (/(faq|常見問題|問題)/.test(msg)) return "faq";
  return "detail";
}

function makeProductCartItem(product) {
  return { type: "product", key: `product:${product.name}`, name: product.name, qty: 1, price: Number(product.price || 0) };
}
function makeComboCartItem(combo) {
  return { type: "combo", key: `combo:${combo.name}`, name: combo.name, qty: 1, price: Number(combo.price || 0) };
}
function addItemToCart(state, item) {
  const found = state.cart.find((x) => x.key === item.key);
  if (found) found.qty += 1;
  else state.cart.push({ ...item });
}
function cartTotal(cart) { return cart.reduce((sum, i) => sum + Number(i.price || 0) * Number(i.qty || 1), 0); }
function cartItemsText(cart) {
  if (!cart.length) return "目前購買清單是空的。";
  return cart.map((i, idx) => `${idx + 1}. ${i.name} × ${i.qty}　${money(i.price * i.qty)}`).join("\n");
}
function cartSummaryText(cart) {
  if (!cart.length) return "目前購買清單是空的。";
  return `目前購買清單：\n\n${cartItemsText(cart)}\n\n合計：${money(cartTotal(cart))}`;
}

function handleAddToCart(token, state, raw, msg) {
  const item = msg.startsWith("加龜鹿飲") ? makeProductCartItem(PRODUCT_MAP["龜鹿飲"]) : findItemByText(raw);
  if (!item) return replyTextWithQuickReply(token, "我找不到要加入的商品，可以點下面選擇。", productAndComboQuickReplies());

  // 正在結帳時不直接亂加，先提醒。
  if (state.checkout?.step) {
    state.pendingDirectBuy = item;
    return replyTextWithQuickReply(
      token,
      `你目前正在結帳。要把「${item.name}」加入購買清單，還是先繼續完成目前訂單？`,
      [
        { label: "加入清單", text: `加入購買清單 ${item.name}` },
        { label: "繼續結帳", text: "繼續下單" },
        { label: "查看清單", text: "查看購買清單" }
      ]
    );
  }

  addItemToCart(state, item);
  return replyTextWithQuickReply(
    token,
    `已加入購買清單：${item.name}\n\n${cartSummaryText(state.cart)}${addonHint(state, item)}`,
    cartQuickRepliesWithAddon(state, item)
  );
}

function addonHint(state, item) {
  const hasDrink = state.cart.some((x) => x.name === "龜鹿飲");
  if (item.name === "龜鹿膏" && !hasDrink) {
    return "\n\n很多人會搭配龜鹿飲一起安排，外出或忙碌時會比較方便。";
  }
  return "";
}
function cartQuickRepliesWithAddon(state, item) {
  const buttons = [
    { label: "查看清單", text: "查看購買清單" },
    { label: "繼續加商品", text: "看產品" },
    { label: "直接結帳", text: "直接結帳" },
    { label: "清空清單", text: "清空購買清單" }
  ];
  const hasDrink = state.cart.some((x) => x.name === "龜鹿飲");
  if (item.name === "龜鹿膏" && !hasDrink) buttons.unshift({ label: "加龜鹿飲", text: "加入清單 龜鹿飲" });
  return buttons;
}
function handleDirectOnly(token, state, raw, msg) {
  const item = findItemByText(raw);
  if (!item) return replyTextWithQuickReply(token, "想直接買哪一個呢？", productAndComboQuickReplies("direct"));
  state.cart = [{ ...item }];
  return startCheckout(token, state);
}
function showCart(token, state) {
  if (!state.cart.length) {
    return replyTextWithQuickReply(token, "目前購買清單是空的，可以先看產品或搭配組合。", [
      { label: "看產品", text: "看產品" },
      { label: "搭配組合", text: "看搭配組合" },
      { label: "幫我推薦", text: "幫我推薦" }
    ]);
  }
  return replyTextWithQuickReply(token, cartSummaryText(state.cart), [
    { label: "繼續加商品", text: "看產品" },
    { label: "移除商品", text: "移除商品" },
    { label: "清空清單", text: "清空購買清單" },
    { label: "直接結帳", text: "直接結帳" }
  ]);
}
function clearCart(token, state) {
  state.cart = [];
  state.checkout = null;
  state.pendingDirectBuy = null;
  return replyTextWithQuickReply(token, "購買清單已清空，可以重新挑選🙂", [
    { label: "看產品", text: "看產品" },
    { label: "搭配組合", text: "看搭配組合" },
    { label: "幫我推薦", text: "幫我推薦" }
  ]);
}
function askRemoveItem(token, state) {
  if (!state.cart.length) return replyTextWithQuickReply(token, "購買清單是空的，沒有可移除的商品。", mainQuickReplies());
  return replyTextWithQuickReply(token, "要移除哪一個？", state.cart.slice(0, 12).map((i) => ({ label: i.name.slice(0, 20), text: `刪除 ${i.name}` })));
}
function removeCartItem(token, state, raw) {
  const target = normalizeNameText(raw.replace(/^刪除\s*/i, "").replace(/^移除\s*/i, ""));
  if (!target) return askRemoveItem(token, state);
  const before = state.cart.length;
  state.cart = state.cart.filter((i) => i.name !== target);
  if (state.cart.length === before) return replyTextWithQuickReply(token, "購買清單裡沒有這個商品🙂", [{ label: "查看清單", text: "查看購買清單" }, { label: "看產品", text: "看產品" }]);
  return replyTextWithQuickReply(token, `${target} 已移除。\n\n${cartSummaryText(state.cart)}`, [
    { label: "查看清單", text: "查看購買清單" },
    { label: "繼續加商品", text: "看產品" },
    { label: "直接結帳", text: "直接結帳" }
  ]);
}

function beginCheckoutFromCart(token, state) {
  if (!state.cart.length) return replyFlex(token, buildOrderStartFlex());
  return startCheckout(token, state);
}
function startCheckout(token, state) {
  state.checkout = { step: "name", name: "", phone: "", address: "", payment: "", shipping: "", confirmed: false };
  return replyTextWithQuickReply(token, `${cartSummaryText(state.cart)}\n\n請回覆收件姓名👇`, orderQuickReplies());
}
function continueCheckout(token, state, raw, userId) {
  const c = state.checkout;
  const msg = normalize(raw);
  if (!c) return replyTextWithQuickReply(token, "目前沒有進行中的結帳流程。", mainQuickReplies());

  if (msg === "繼續下單" || msg === "繼續結帳") {
    return askCurrentCheckoutStep(token, state);
  }
  if (c.step === "name") {
    c.name = raw;
    c.step = "phone";
    return replyTextWithQuickReply(token, "收到。請回覆收件電話👇", orderQuickReplies());
  }
  if (c.step === "phone") {
    c.phone = raw;
    c.step = "address";
    return replyTextWithQuickReply(token, "收到。請回覆收件地址或 7-11 門市資訊👇", orderQuickReplies());
  }
  if (c.step === "address") {
    c.address = raw;
    c.step = "payment";
    return askPayment(token, state);
  }
  if (c.step === "payment") {
    if (msg.includes("匯款")) c.payment = "匯款";
    else if (msg.includes("貨到付款")) c.payment = "貨到付款";
    else return askPayment(token, state);
    c.step = "shipping";
    return askShipping(token, state);
  }
  if (c.step === "shipping") {
    if (msg.includes("宅配")) c.shipping = "宅配";
    else if (msg.includes("7-11") || msg.includes("711") || msg.includes("賣貨便")) c.shipping = "7-11 賣貨便店到店";
    else if (msg.includes("雙北") || msg.includes("親送")) c.shipping = "雙北親送";
    else return askShipping(token, state);
    c.step = "confirm";
    return askOrderConfirm(token, state);
  }
  if (c.step === "confirm") {
    if (msg === "確認送出") return finishCheckout(token, state, userId);
    return askOrderConfirm(token, state);
  }
  return askCurrentCheckoutStep(token, state);
}
function askCurrentCheckoutStep(token, state) {
  const step = state.checkout?.step;
  if (step === "name") return replyTextWithQuickReply(token, "請回覆收件姓名👇", orderQuickReplies());
  if (step === "phone") return replyTextWithQuickReply(token, "請回覆收件電話👇", orderQuickReplies());
  if (step === "address") return replyTextWithQuickReply(token, "請回覆收件地址或 7-11 門市資訊👇", orderQuickReplies());
  if (step === "payment") return askPayment(token, state);
  if (step === "shipping") return askShipping(token, state);
  if (step === "confirm") return askOrderConfirm(token, state);
  return replyTextWithQuickReply(token, "可以繼續選購或查看購買清單。", mainQuickReplies());
}
function askPayment(token, state) {
  if (state.checkout) state.checkout.step = "payment";
  return replyTextWithQuickReply(token, "請選擇付款方式👇", [
    { label: "匯款", text: "匯款" },
    { label: "貨到付款", text: "貨到付款" },
    { label: "查看清單", text: "查看購買清單" },
    { label: "取消本次", text: "取消" }
  ]);
}
function askShipping(token, state) {
  if (state.checkout) state.checkout.step = "shipping";
  return replyTextWithQuickReply(token, "請選擇配送方式👇", [
    { label: "宅配", text: "宅配" },
    { label: "7-11賣貨便", text: "7-11 賣貨便店到店" },
    { label: "雙北親送", text: "雙北親送" },
    { label: "查看清單", text: "查看購買清單" }
  ]);
}
function askOrderConfirm(token, state) {
  const c = state.checkout;
  return replyTextWithQuickReply(token, `幫你整理一下訂單👇\n\n${cartItemsText(state.cart)}\n\n合計：${money(cartTotal(state.cart))}\n付款：${c.payment}\n配送：${c.shipping}\n姓名：${c.name}\n電話：${c.phone}\n地址 / 門市：${c.address}\n\n這樣可以嗎？`, [
    { label: "確認送出", text: "確認送出" },
    { label: "修改清單", text: "修改購買清單" },
    { label: "修改付款配送", text: "修改付款配送" },
    { label: "取消本次", text: "取消" }
  ]);
}
async function finishCheckout(token, state, userId) {
  if (!state.checkout || !state.cart.length) return replyTextWithQuickReply(token, "目前沒有可送出的訂單。", mainQuickReplies());
  const c = state.checkout;
  const order = {
    userId,
    items: state.cart,
    itemsText: cartItemsText(state.cart),
    product: cartItemsText(state.cart),
    total: cartTotal(state.cart),
    name: c.name,
    phone: c.phone,
    address: c.address,
    payment: c.payment,
    shipping: c.shipping,
    createdAt: new Date().toISOString()
  };
  await saveToCRM(order);
  state.cart = [];
  state.checkout = null;
  state.pendingDirectBuy = null;
  return replyTextWithQuickReply(token, `已收到你的資料，我們會再為你確認🙂\n\n${order.itemsText}\n\n合計：${money(order.total)}\n付款：${order.payment}\n配送：${order.shipping}`, [
    { label: "看產品", text: "看產品" },
    { label: "看搭配", text: "看搭配組合" },
    { label: "再下一單", text: "我想直接下單" }
  ]);
}
function handleBrowseDuringCheckout(token, state, intent, product, combo) {
  if (intent === "products") return replyFlex(token, buildProductsCarousel("checkout"));
  if (intent === "combo") return replyFlex(token, buildOfferCarousel("checkout"));
  if (intent === "recommend") return replyFlex(token, buildRecommendFlex());
  if (intent === "usage") return replyTextWithQuickReply(token, buildUsageGeneralText(), orderQuickReplies());
  if (intent === "payment") return replyTextWithQuickReply(token, buildPaymentText(), orderQuickReplies());
  if (intent === "shipping") return replyTextWithQuickReply(token, buildShippingText(), orderQuickReplies());
  return askCurrentCheckoutStep(token, state);
}
function resetFlow(token, state) {
  state.checkout = null;
  state.pendingDirectBuy = null;
  return replyTextWithQuickReply(token, "已取消目前流程。購買清單若有商品會保留，可以繼續查看或清空。", [
    { label: "查看清單", text: "查看購買清單" },
    { label: "清空清單", text: "清空購買清單" },
    { label: "看產品", text: "看產品" }
  ]);
}

function buildWelcomeFlex() {
  return {
    type: "flex",
    altText: "歡迎來到仙加味",
    contents: heroBubble("仙加味", "歡迎來到官方 LINE。\n\n你可以直接點下面按鈕，我幫你整理產品、搭配與購買清單；也可以用快速填單。", [
      { label: "看產品", text: "看產品", primary: true },
      { label: "幫我推薦", text: "幫我推薦" },
      { label: "查看購買清單", text: "查看購買清單" },
      { label: "直接下單", text: "我想直接下單" },
      { label: "快速填單", text: "直接填單" }
    ])
  };
}
function buildOrderStartFlex() {
  return {
    type: "flex",
    altText: "開始下單",
    contents: heroBubble("想怎麼開始？", "可以先看產品、看搭配組合，或直接查看目前購買清單。", [
      { label: "看產品", text: "看產品", primary: true },
      { label: "看搭配組合", text: "看搭配組合" },
      { label: "查看購買清單", text: "查看購買清單" }
    ])
  };
}
function buildProductsCarousel() {
  return {
    type: "flex",
    altText: "產品介紹",
    contents: { type: "carousel", contents: DATA.products.map((p) => productBubble(p)) }
  };
}
function productBubble(p) {
  return {
    type: "bubble",
    body: { type: "box", layout: "vertical", spacing: "md", contents: [
      { type: "text", text: p.name, weight: "bold", size: "lg" },
      { type: "text", text: p.description, wrap: true, size: "sm", color: "#666666" },
      { type: "text", text: `規格：${p.size}`, size: "sm" },
      { type: "text", text: `建議售價：${money(p.price)}`, size: "md", weight: "bold", color: "#1F4E79" },
      { type: "text", text: "不確定怎麼選也沒關係，我可以幫你整理🙂", wrap: true, size: "xs", color: "#666666" }
    ]},
    footer: { type: "box", layout: "vertical", spacing: "sm", contents: [
      btn("加入清單", `加入清單 ${p.name}`, "primary"),
      btn("直接買", `直接買 ${p.name}`),
      btn("怎麼使用", `${p.name} 使用方式`)
    ]}
  };
}
function buildSingleProductFlex(p) { return { type: "flex", altText: p.name, contents: productBubble(p) }; }
function buildSingleProductUsageFlex(p) {
  return flexInfoCard(`${p.name} 使用方式`, (p.usage || []).map((u) => `・${u}`).join("\n"), [
    btn("加入清單", `加入清單 ${p.name}`, "primary"), btn("直接買", `直接買 ${p.name}`), btn("看產品", "看產品")
  ]);
}
function buildSingleProductIngredientsFlex(p) {
  return flexInfoCard(`${p.name} 成分`, (p.ingredients || []).join("、"), [
    btn("加入清單", `加入清單 ${p.name}`, "primary"), btn("怎麼使用", `${p.name} 使用方式`)
  ]);
}
function buildOfferCarousel() {
  const combos = DATA.offers?.comboOffers || [];
  return { type: "flex", altText: "搭配組合", contents: { type: "carousel", contents: combos.map((o) => comboBubble(o)) } };
}
function comboBubble(o) {
  return {
    type: "bubble",
    body: { type: "box", layout: "vertical", spacing: "md", contents: [
      { type: "text", text: o.name, weight: "bold", size: "lg" },
      { type: "text", text: `內容：${(o.items || []).join("＋")}`, wrap: true, size: "sm" },
      ...(o.gift ? [{ type: "text", text: `附贈：${o.gift}`, wrap: true, size: "sm", color: "#D35400" }] : []),
      { type: "text", text: `建議安排：${money(o.price)}${o.priceNote ? `（${o.priceNote}）` : ""}`, size: "sm", weight: "bold", color: "#1F4E79" },
      { type: "text", text: o.desc || "", wrap: true, size: "sm", color: "#666666" }
    ]},
    footer: { type: "box", layout: "vertical", spacing: "sm", contents: [
      btn("加入清單", `加入清單 ${o.name}`, "primary"),
      btn("直接買", `直接買 ${o.name}`),
      btn("查看清單", "查看購買清單")
    ]}
  };
}
function buildSingleComboFlex(o) { return { type: "flex", altText: o.name, contents: comboBubble(o) }; }
function buildRecommendFlex() {
  return { type: "flex", altText: "幫我推薦", contents: { type: "carousel", contents: DATA.recommend.map((r) => {
    const p = PRODUCT_MAP[r.result];
    return { type: "bubble", body: { type: "box", layout: "vertical", spacing: "md", contents: [
      { type: "text", text: r.keyword, weight: "bold", size: "lg" },
      { type: "text", text: `建議：${r.result}`, size: "md", color: "#1F4E79" },
      { type: "text", text: r.desc, wrap: true, size: "sm", color: "#666666" }
    ]}, footer: { type: "box", layout: "vertical", spacing: "sm", contents: [
      btn("看這個", r.result, "primary"),
      btn("加入清單", p ? `加入清單 ${p.name}` : r.result),
      btn("查看清單", "查看購買清單")
    ]} };
  }) } };
}


function buildLeadEntryText(source) {
  const sourceName = source?.title || "入口";
  return `${sourceName}收到🙂\n\n我先用「日常安排」的方式幫你整理，不談誇張效果。你可以直接選一個方向：\n\n・想固定節奏 → 看龜鹿膏\n・想方便快速 → 看龜鹿飲\n・想放進料理 → 看龜鹿湯塊\n・想自己搭配 → 看鹿茸粉\n\n也可以直接讓我幫你推薦。`;
}
function buildGeneralNeedText() {
  return "我先幫你用生活方式整理方向🙂\n\n如果你不確定怎麼選，可以先從下面幾個入口開始，我會再帶你看產品、搭配或購買清單。";
}
function leadEntryQuickReplies() {
  return [
    { label: "固定節奏", text: "看龜鹿膏" },
    { label: "方便快速", text: "看龜鹿飲" },
    { label: "放進料理", text: "看龜鹿湯塊" },
    { label: "幫我推薦", text: "幫我推薦" },
    { label: "看搭配", text: "看搭配組合" },
    { label: "快速填單", text: "直接填單" }
  ];
}
function buildQuickOrderTemplateText() {
  return `可以，若你想快速下單，也可以直接照這個格式回覆：\n\n姓名：\n電話：\n地址 / 7-11門市：\n付款：匯款 / 貨到付款\n配送：宅配 / 7-11賣貨便 / 雙北親送\n商品：龜鹿膏 × 1\n\n我收到後會幫你整理訂單確認🙂`;
}
function quickOrderReplies() {
  return [
    { label: "看產品", text: "看產品" },
    { label: "看搭配", text: "看搭配組合" },
    { label: "查看清單", text: "查看購買清單" },
    { label: "開始結帳", text: "直接結帳" }
  ];
}
function parseDirectOrderForm(raw) {
  const text = String(raw || "");
  if (!/(姓名[:：]|電話[:：]|商品[:：])/.test(text)) return null;
  const get = (label) => {
    const re = new RegExp(`${label}[:：]\\s*([^\\n]+)`, "i");
    const m = text.match(re);
    return m ? m[1].trim() : "";
  };
  return {
    name: get("姓名"),
    phone: get("電話"),
    address: get("地址") || get("門市"),
    payment: get("付款"),
    shipping: get("配送"),
    productText: get("商品")
  };
}
function handleDirectOrderForm(token, state, form) {
  const item = form.productText ? findItemByText(`加入清單 ${form.productText}`) : null;
  if (item) {
    state.cart = [];
    addItemToCart(state, item);
  }
  if (!state.cart.length) {
    return replyTextWithQuickReply(token, "我有收到你的資料，但商品品項還不夠清楚。請先選商品或搭配組合。", productAndComboQuickReplies());
  }
  state.checkout = {
    step: "confirm",
    name: form.name || "",
    phone: form.phone || "",
    address: form.address || "",
    payment: form.payment || "",
    shipping: form.shipping || "",
    confirmed: false
  };
  if (!state.checkout.name) { state.checkout.step = "name"; return replyTextWithQuickReply(token, `${cartSummaryText(state.cart)}\n\n請再補收件姓名👇`, orderQuickReplies()); }
  if (!state.checkout.phone) { state.checkout.step = "phone"; return replyTextWithQuickReply(token, `${cartSummaryText(state.cart)}\n\n請再補收件電話👇`, orderQuickReplies()); }
  if (!state.checkout.address) { state.checkout.step = "address"; return replyTextWithQuickReply(token, `${cartSummaryText(state.cart)}\n\n請再補收件地址或 7-11 門市資訊👇`, orderQuickReplies()); }
  if (!state.checkout.payment) return askPayment(token, state);
  if (!state.checkout.shipping) return askShipping(token, state);
  return askOrderConfirm(token, state);
}

function buildPaymentText() {
  return `付款方式目前可安排：\n\n・匯款\n・貨到付款\n\n貨到付款可配合宅配或 7-11 賣貨便店到店。`;
}
function buildShippingText() {
  return `配送方式目前可安排：\n\n・宅配\n・7-11 賣貨便店到店\n・雙北親送\n\n7-11 賣貨便店到店也可安排貨到付款。`;
}
function buildUsageGeneralText() {
  return "使用方式會依產品型態不同：膏可直接食用或溫水化開；飲建議溫熱；湯塊適合燉湯；鹿茸粉可加入溫熱飲。";
}
function buildFaqText() { return (DATA.faqs || []).map((f) => `Q：${f.q}\nA：${f.a}`).join("\n\n"); }

function heroBubble(title, subtitle, buttons) {
  return { type: "bubble", body: { type: "box", layout: "vertical", spacing: "md", contents: [
    { type: "text", text: title, weight: "bold", size: "xl" },
    { type: "text", text: subtitle, wrap: true, size: "sm", color: "#666666" }
  ]}, footer: { type: "box", layout: "vertical", spacing: "sm", contents: buttons.map((b, i) => btn(b.label, b.text, b.primary || i === 0 ? "primary" : "link")) } };
}
function flexInfoCard(title, bodyText, buttons) {
  return { type: "flex", altText: title, contents: { type: "bubble", body: { type: "box", layout: "vertical", spacing: "md", contents: [
    { type: "text", text: title, weight: "bold", size: "lg" },
    { type: "text", text: bodyText, wrap: true, size: "sm", color: "#333333" }
  ]}, footer: { type: "box", layout: "vertical", spacing: "sm", contents: buttons } } };
}
function btn(label, text, style = "link") {
  return { type: "button", style, action: { type: "message", label: String(label).slice(0, 20), text } };
}
function quickReply(items) {
  return { items: (items || []).slice(0, 13).map((item) => ({ type: "action", action: { type: "message", label: item.label, text: item.text } })) };
}
function mainQuickReplies() {
  return [
    { label: "看產品", text: "看產品" },
    { label: "幫我推薦", text: "幫我推薦" },
    { label: "查看清單", text: "查看購買清單" },
    { label: "搭配組合", text: "看搭配組合" },
    { label: "直接下單", text: "我想直接下單" },
    { label: "快速填單", text: "直接填單" }
  ];
}
function orderQuickReplies() {
  return [
    { label: "看產品", text: "看產品" },
    { label: "看搭配", text: "看搭配組合" },
    { label: "查看清單", text: "查看購買清單" },
    { label: "取消本次", text: "取消" }
  ];
}
function productQuickReplies(kind = "detail") {
  return DATA.products.map((p) => ({ label: p.name, text: kind === "usage" ? `${p.name} 使用方式` : kind === "ingredients" ? `${p.name} 成分` : p.name })).slice(0, 4);
}
function productAndComboQuickReplies(mode = "add") {
  const products = DATA.products.map((p) => ({ label: p.name, text: mode === "direct" ? `直接買 ${p.name}` : `加入清單 ${p.name}` }));
  const combos = (DATA.offers?.comboOffers || []).slice(0, 4).map((o) => ({ label: o.name.slice(0, 20), text: mode === "direct" ? `直接買 ${o.name}` : `加入清單 ${o.name}` }));
  return [...products, ...combos].slice(0, 13);
}

function replyText(token, text) { return client.replyMessage(token, { type: "text", text }); }
function replyTextWithQuickReply(token, text, items) { return client.replyMessage(token, { type: "text", text, quickReply: quickReply(items) }); }
function replyFlex(token, flexPayload) { return client.replyMessage(token, flexPayload); }

async function saveToCRM(data) {
  if (!CRM_URL || typeof fetch !== "function") return;
  try {
    await fetch(CRM_URL, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
  } catch (e) {
    console.error("CRM error", e.message);
  }
}

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`仙加味 LINE bot v68 listening on ${port}`));
