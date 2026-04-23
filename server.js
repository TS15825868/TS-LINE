"use strict";

const line = require("@line/bot-sdk");
const express = require("express");
const fs = require("fs");
const path = require("path");

const config = {
  channelAccessToken: process.env.CHANNEL_ACCESS_TOKEN || "IKjy0y2zfPOhMCp7xiJ4R4z7UkkvzoQgj7A6OH1AJjdMYpDnEzaicgz2HWy4pVz1KMSsUHzhoHoXZVztRQwibp3Q8UPfN+Dp4pBfT2k3Mzu5bBtdO1P78Cpffq+75liFPLL3ftcHMzvzr+WOgm6AEgdB04t89/1O/w1cDnyilFU=",
  channelSecret: process.env.CHANNEL_SECRET || "7c3c4740afa5a281d54afb9f8ffc1e96",
};

if (!config.channelAccessToken || !config.channelSecret) {
  console.warn("Missing CHANNEL_ACCESS_TOKEN or CHANNEL_SECRET in environment variables.");
}

const client = new line.Client(config);
const app = express();

const CRM_URL =
  process.env.CRM_URL ||
  "https://script.google.com/macros/s/AKfycbwAFBxeROd2ZYGJ_h0O7_H2MMxptOMoj3EXIErZpbKuTYFOzOVwQkrk8X1MoxapkHVGSA/exec";

const DATA = JSON.parse(
  fs.readFileSync(path.join(__dirname, "products.json"), "utf8")
);

const users = Object.create(null);

const PRODUCT_MAP = Object.fromEntries(DATA.products.map((p) => [p.name, p]));
const PRODUCT_ALIASES = Object.fromEntries(
  DATA.products.map((p) => [p.name, p.aliases || [p.name]])
);
const COMBO_MAP = Object.fromEntries(
  (DATA.offers?.comboOffers || []).map((o) => [o.name, o])
);
const COMBO_ALIASES = Object.fromEntries(
  (DATA.offers?.comboOffers || []).map((o) => [o.name, o.aliases || [o.name]])
);

const MEDICAL_RE = /(懷孕|孕婦|哺乳|高血壓|糖尿病|心臟|腎臟|肝|癌|化療|慢性病|中藥|西藥|服藥|吃藥|藥物|手術|副作用|禁忌|醫師|醫生|診斷)/;

app.get("/", (req, res) => {
  res.send("TS-LINE bot is running.");
});

app.post("/webhook", line.middleware(config), async (req, res) => {
  try {
    for (const event of req.body.events) {
      await handleEvent(event);
    }
    res.sendStatus(200);
  } catch (err) {
    console.error(err);
    res.sendStatus(500);
  }
});

async function handleEvent(event) {
  if (event.type !== "message" && event.type !== "follow") return null;

  const userId = event.source.userId || "anon";
  const state = getUserState(userId);
  state._lastUserId = userId;

  if (event.type === "follow") {
    state.welcomed = true;
    return replyFlex(event.replyToken, buildWelcomeFlex());
  }

  if (!event.message || event.message.type !== "text") return null;

  const raw = String(event.message.text || "").trim();
  const msg = normalize(raw);
  state.history.push(raw);
  if (!state.welcomed) state.welcomed = true;

  if (handleCancel(state, raw, msg)) {
    return replyFlex(event.replyToken, buildWelcomeFlex());
  }

  if (MEDICAL_RE.test(raw)) {
    return replyTextWithQuickReply(event.replyToken, DATA.doctorReferral, DATA.quickReplies.main);
  }

  const product = findProduct(msg);
  const combo = findCombo(msg);

  // 加入清單 / 查看清單 / 結帳 / 清空
  const cartAction = handleCartActions(state, raw, msg, product, combo);
  if (cartAction) {
    return dispatchCartAction(event.replyToken, state, cartAction);
  }

  // 已在結帳流程中，先優先處理填資料步驟，避免地址或門市被誤判成配送查詢
  if (state.checkout.step > 0) {
    const explicitBrowse = isExplicitBrowseCommand(raw, msg);
    const explicitOrder = detectIntent(msg) === "order" && (product || combo);

    if (!explicitBrowse && !explicitOrder && state.checkout.step <= 3) {
      return continueCheckout(event.replyToken, state, raw, userId);
    }

    const pendingSwitchAction = handlePendingSwitch(state, raw, msg);
    if (pendingSwitchAction === "resume") {
      return replyTextWithQuickReply(
        event.replyToken,
        buildCurrentStepPrompt(state),
        buildCheckoutQuickReplies(state)
      );
    }
    if (pendingSwitchAction === "switched") {
      return replyTextWithQuickReply(
        event.replyToken,
        `好的，已改成登記「${state.checkout.targetName}」。\n請先回覆收件姓名。`,
        buildCheckoutQuickReplies(state)
      );
    }

    if (explicitOrder) {
      const targetName = combo ? combo.name : product.name;
      if (targetName !== state.checkout.targetName) {
        state.pendingSwitch = targetName;
        state.pendingSwitchType = combo ? "combo" : "product";
        return replyTextWithQuickReply(
          event.replyToken,
          `你目前正在登記「${state.checkout.targetName}」，要改成「${targetName}」嗎？`,
          [
            { label: `改成${targetName}`, text: `改成 ${targetName}` },
            { label: `繼續${state.checkout.targetName}`, text: "繼續原本下單" },
            { label: "取消全部", text: "取消" },
          ]
        );
      }
    }

    const intentInCheckout = detectIntent(msg);
    if (explicitBrowse || product || combo) {
      return handleBrowseOrInfo(event.replyToken, state, intentInCheckout, product, combo, true);
    }

    if (intentInCheckout === "payment_select") {
      state.checkout.payment = raw.replace(/^付款\s*/, "").trim();
      state.checkout.step = 5;
      return replyTextWithQuickReply(event.replyToken, "請選擇配送方式：", shippingQuickReplies());
    }

    if (intentInCheckout === "shipping_select") {
      state.checkout.shipping = raw.replace(/^配送\s*/, "").trim();
      return finishCheckout(event.replyToken, state, userId);
    }

    return continueCheckout(event.replyToken, state, raw, userId);
  }

  const intent = detectIntent(msg);

  if (intent === "welcome") return replyFlex(event.replyToken, buildWelcomeFlex());
  if (intent === "products") return replyFlex(event.replyToken, buildProductsCarousel());
  if (intent === "recommend") return replyFlex(event.replyToken, buildRecommendCarousel());
  if (intent === "offer") return handleBrowseOrInfo(event.replyToken, state, intent, product, combo, false);
  if (intent === "payment") {
    return replyTextWithQuickReply(event.replyToken, buildPaymentText(), DATA.quickReplies.main);
  }
  if (intent === "shipping") {
    return replyTextWithQuickReply(event.replyToken, buildShippingText(), DATA.quickReplies.main);
  }
  if (intent === "faq") {
    return replyTextWithQuickReply(event.replyToken, buildFaqText(), DATA.quickReplies.main);
  }
  if (intent === "hesitate") {
    if (product) return replyFlex(event.replyToken, buildRetentionFlex(product));
    return replyFlex(event.replyToken, buildGeneralRetentionFlex());
  }
  if (intent === "price") {
    if (combo) return replyFlex(event.replyToken, buildSingleComboFlex(combo, true));
    if (product) return replyFlex(event.replyToken, buildSingleProductFlex(product));
    return replyFlex(event.replyToken, buildPriceSelectorFlex());
  }
  if (intent === "usage") {
    if (product) return replyFlex(event.replyToken, buildSingleProductUsageFlex(product));
    return replyFlex(event.replyToken, buildUsageSelectorFlex());
  }
  if (intent === "ingredients") {
    if (product) return replyFlex(event.replyToken, buildSingleProductIngredientsFlex(product));
    return replyFlex(event.replyToken, buildIngredientsSelectorFlex());
  }

  if (combo) return replyFlex(event.replyToken, buildSingleComboFlex(combo, true));

  if (intent === "order") {
    if (combo || product) {
      const item = combo ? makeComboCartItem(combo) : makeProductCartItem(product);
      state.cart = [item];
      startCheckout(state, item.name, item.type);
      return replyTextWithQuickReply(
        event.replyToken,
        `好的，我幫你登記 ${item.name}。\n請先回覆收件姓名。`,
        buildCheckoutQuickReplies(state)
      );
    }
    if (state.cart.length > 0) {
      return replyTextWithQuickReply(
        event.replyToken,
        buildCartText(state.cart),
        cartQuickReplies(true)
      );
    }
    return replyFlex(event.replyToken, buildOrderSelectorFlex());
  }

  if (product) return replyFlex(event.replyToken, buildSingleProductFlex(product));

  if (msg.includes("影片")) {
    return replyTextWithQuickReply(
      event.replyToken,
      "官網影片頁已整理公開影片，可直接查看：\nhttps://ts15825868.github.io/xianjiawei/videos.html",
      DATA.quickReplies.main
    );
  }

  return replyFlex(event.replyToken, buildWelcomeFlex());
}

function getUserState(userId) {
  if (!users[userId]) {
    users[userId] = {
      history: [],
      welcomed: false,
      cart: [],
      checkout: emptyCheckout(),
      pendingSwitch: "",
      pendingSwitchType: "",
    };
  }
  return users[userId];
}

function emptyCheckout() {
  return {
    step: 0,
    type: "",
    targetName: "",
    name: "",
    phone: "",
    address: "",
    payment: "",
    shipping: "",
  };
}

function normalize(text) {
  return String(text).trim().toLowerCase().replace(/\s+/g, "");
}

function handleCancel(state, raw, msg) {
  if (["取消", "重來", "重新開始"].includes(raw) || ["取消", "重來", "重新開始"].includes(msg)) {
    state.checkout = emptyCheckout();
    state.pendingSwitch = "";
    state.pendingSwitchType = "";
    return true;
  }
  return false;
}

function isExplicitBrowseCommand(raw, msg) {
  const commands = ["看產品", "看搭配組合", "幫我推薦", "查看購買清單", "購買清單", "直接結帳", "付款方式", "配送方式"];
  return commands.includes(raw) || commands.some((x) => normalize(x) === msg);
}

function handlePendingSwitch(state, raw, msg) {
  if (!state.pendingSwitch) return "";
  if (raw.startsWith("改成 ")) {
    const target = raw.replace(/^改成\s*/, "").trim();
    if (target === state.pendingSwitch) {
      startCheckout(state, target, state.pendingSwitchType || (COMBO_MAP[target] ? "combo" : "product"));
      state.pendingSwitch = "";
      state.pendingSwitchType = "";
      return "switched";
    }
  }
  if (raw === "繼續原本下單" || msg === normalize("繼續原本下單")) {
    state.pendingSwitch = "";
    state.pendingSwitchType = "";
    return "resume";
  }
  return "";
}

function detectIntent(msg) {
  if (/^付款/.test(msg)) return "payment_select";
  if (/^配送/.test(msg)) return "shipping_select";
  if (/(確認送出|送出訂單|確認下單)/.test(msg)) return "confirm_checkout";
  if (/(修改清單|回購物清單|修改訂單)/.test(msg)) return "edit_cart";
  if (/(只買這個|只買這組)/.test(msg)) return "single_buy";
  if (/(查看購買清單|購買清單|看購物車|購物車)/.test(msg)) return "cart";
  if (/(直接結帳|去結帳|結帳)/.test(msg)) return "checkout";
  if (/(清空購買清單|清空清單)/.test(msg)) return "clear_cart";
  if (/(歡迎|你好|hi|hello)/.test(msg)) return "welcome";
  if (/(看產品|產品|商品|產品介紹|看商品)/.test(msg)) return "products";
  if (/(幫我推薦|推薦|怎麼選|選哪個|哪個適合|第一次怎麼買|第一次)/.test(msg)) return "recommend";
  if (/(下單|訂購|我要買|購買|我要訂|直接買|我要這個|我要這組)/.test(msg)) return "order";
  if (/(加入購買清單|加入清單|加到清單)/.test(msg)) return "add_to_cart";
  if (/(怎麼吃|怎麼用|怎麼使用|使用方式|食用方式|使用|食用|喝法)/.test(msg)) return "usage";
  if (/(成分|內容物|原料)/.test(msg)) return "ingredients";
  if (/(價格|價錢|售價|多少錢|費用)/.test(msg)) return "price";
  if (/(搭配組合|看搭配組合|組合|搭配|套餐|搭配組|套組|買多少|送幾罐|贈送|優惠)/.test(msg)) return "offer";
  if (/(付款|匯款|貨到付款|付款方式)/.test(msg)) return "payment";
  if (/(宅配|賣貨便|7-11|711|超商|配送|運送|寄送|親送|雙北)/.test(msg)) return "shipping";
  if (/(faq|常見問題|問題)/.test(msg)) return "faq";
  if (/(貴|太貴|有點貴|便宜一點|算便宜|優惠嗎|可以便宜嗎|能不能算便宜|別家比較便宜|殺價)/.test(msg)) return "hesitate";
  return "detail";
}

function findProduct(msg) {
  for (const [name, aliases] of Object.entries(PRODUCT_ALIASES)) {
    if (aliases.some((alias) => msg.includes(normalize(alias))) || msg.includes(normalize(name))) {
      return PRODUCT_MAP[name];
    }
  }
  return null;
}

function findCombo(msg) {
  for (const [name, aliases] of Object.entries(COMBO_ALIASES)) {
    if (aliases.some((alias) => msg.includes(normalize(alias))) || msg.includes(normalize(name))) {
      return COMBO_MAP[name];
    }
  }
  return null;
}

function money(n) {
  return `$${Number(n).toLocaleString("en-US")}`;
}

function makeProductCartItem(product) {
  return { type: "product", name: product.name, qty: 1, unitPrice: product.price, subtotal: product.price };
}

function makeComboCartItem(combo) {
  return { type: "combo", name: combo.name, qty: 1, unitPrice: combo.price, subtotal: combo.price };
}

function buildPendingAddQuickReplies(name) {
  return [
    { label: "加入清單", text: `加入清單 ${name}` },
    { label: "只買這個", text: `只買這個 ${name}` },
    { label: "查看清單", text: "查看購買清單" },
  ];
}

function checkoutConfirmQuickReplies() {
  return [
    { label: "確認送出", text: "確認送出" },
    { label: "修改清單", text: "修改清單" },
    { label: "取消本次", text: "取消" },
  ];
}

function addItemToCart(state, item) {
  const found = state.cart.find((x) => x.type === item.type && x.name === item.name);
  if (found) {
    found.qty += 1;
    found.subtotal = found.qty * found.unitPrice;
  } else {
    state.cart.push(item);
  }
}

function cartTotal(cart) {
  return cart.reduce((sum, item) => sum + item.subtotal, 0);
}

function buildCartText(cart) {
  if (!cart.length) return "目前購買清單是空的。";
  const lines = ["目前購買清單：", ""];
  cart.forEach((item, idx) => {
    lines.push(`${idx + 1}. ${item.name} × ${item.qty}　${money(item.subtotal)}`);
  });
  lines.push("", `合計：${money(cartTotal(cart))}`);
  return lines.join("\n");
}

function cartQuickReplies(hasCheckout = false) {
  const items = [
    { label: "看產品", text: "看產品" },
    { label: "看搭配組合", text: "看搭配組合" },
    { label: "查看清單", text: "查看購買清單" },
    { label: "直接結帳", text: "直接結帳" },
    { label: "清空清單", text: "清空購買清單" },
  ];
  if (hasCheckout) items.unshift({ label: "繼續原本", text: "繼續原本下單" });
  return items;
}

function buildQuickReply(items) {
  return {
    items: (items || []).slice(0, 13).map((item) => ({
      type: "action",
      action: {
        type: "message",
        label: item.label,
        text: item.text,
      },
    })),
  };
}

function buildCheckoutQuickReplies(state) {
  const items = [
    { label: "看產品", text: "看產品" },
    { label: "看搭配組合", text: "看搭配組合" },
    { label: "查看清單", text: "查看購買清單" },
    { label: "取消本次", text: "取消" },
  ];
  if (state.checkout.step > 0) items.unshift({ label: "繼續原本", text: "繼續原本下單" });
  return items;
}

function paymentQuickReplies() {
  return [
    { label: "匯款", text: "付款 匯款" },
    { label: "貨到付款", text: "付款 貨到付款" },
    { label: "取消本次", text: "取消" },
  ];
}

function shippingQuickReplies() {
  return [
    { label: "宅配", text: "配送 宅配" },
    { label: "7-11賣貨便", text: "配送 7-11賣貨便店到店" },
    { label: "雙北親送", text: "配送 雙北親送" },
  ];
}

function btn(label, text = label, style = "link") {
  return {
    type: "button",
    style,
    action: {
      type: "message",
      label,
      text,
    },
  };
}

function bubble(title, bodyLines, footerButtons) {
  return {
    type: "bubble",
    body: {
      type: "box",
      layout: "vertical",
      spacing: "md",
      contents: [
        { type: "text", text: title, weight: "bold", size: "lg", wrap: true },
        ...bodyLines.filter(Boolean).map((line) => ({
          type: "text",
          text: line,
          wrap: true,
          size: /建議售價|建議安排/.test(line) ? "md" : "sm",
          weight: /建議售價|建議安排/.test(line) ? "bold" : "regular",
          color: /建議售價|建議安排/.test(line) ? "#1F4E79" : "#444444",
        })),
      ],
    },
    footer: {
      type: "box",
      layout: "vertical",
      spacing: "sm",
      contents: footerButtons,
    },
  };
}

function buildWelcomeFlex() {
  return {
    type: "flex",
    altText: "歡迎來到仙加味",
    contents: {
      type: "bubble",
      body: {
        type: "box",
        layout: "vertical",
        spacing: "md",
        contents: [
          { type: "text", text: "仙加味", weight: "bold", size: "xl" },
          { type: "text", text: "補養做得剛剛好", size: "sm", color: "#666666" },
          { type: "text", text: "直接點下面按鈕就可以，不用自己打字。", wrap: true, size: "sm" },
        ],
      },
      footer: {
        type: "box",
        layout: "vertical",
        spacing: "sm",
        contents: [
          btn("看產品", "看產品", "primary"),
          btn("幫我推薦", "幫我推薦"),
          btn("我要買", "我想直接下單"),
          btn("查看清單", "查看購買清單"),
        ],
      },
    },
  };
}

function buildProductsCarousel() {
  return {
    type: "flex",
    altText: "產品介紹",
    contents: {
      type: "carousel",
      contents: DATA.products.map((p) =>
        bubble(
          p.name,
          [p.description, `建議售價：${money(p.price)}`, `規格：${p.size}`],
          [
            btn("我要這個", `我要買 ${p.name}`, "primary"),
            btn("加入清單", `加入清單 ${p.name}`),
            btn("怎麼使用", `${p.name} 使用方式`),
          ]
        )
      ),
    },
  };
}

function buildRecommendCarousel() {
  return {
    type: "flex",
    altText: "幫我推薦",
    contents: {
      type: "carousel",
      contents: DATA.recommend.map((r) =>
        bubble(
          r.keyword,
          [`建議：${r.result}`, r.desc],
          [
            btn("看這個產品", r.result, "primary"),
            btn("我要這個", `我要買 ${r.result}`),
            btn("加入清單", `加入清單 ${r.result}`),
          ]
        )
      ),
    },
  };
}

function buildOfferCarousel() {
  const offers = DATA.offers?.comboOffers || [];
  return {
    type: "flex",
    altText: "搭配組合",
    contents: {
      type: "carousel",
      contents: offers.map((o) =>
        bubble(
          o.name,
          [
            `內容：${o.items.join("＋")}`,
            `建議安排：${money(o.price)}（${o.priceNote || "可依需求調整"}）`,
            o.gift ? `附贈：${o.gift}` : "",
            o.desc,
            "這組如果你可以，我可以直接幫你安排🙂",
          ],
          [
            btn("我要這組", `我要買 ${o.name}`, "primary"),
            btn("加入清單", `加入清單 ${o.name}`),
            btn("查看清單", "查看購買清單"),
          ]
        )
      ),
    },
  };
}

function buildPriceSelectorFlex() {
  return {
    type: "flex",
    altText: "選擇產品價格",
    contents: {
      type: "carousel",
      contents: DATA.products.map((p) =>
        bubble(
          p.name,
          [`規格：${p.size}`, `建議售價：${money(p.price)}`],
          [btn("我要這個", `我要買 ${p.name}`, "primary"), btn("加入清單", `加入清單 ${p.name}`)]
        )
      ),
    },
  };
}

function buildUsageSelectorFlex() {
  return {
    type: "flex",
    altText: "選擇使用方式",
    contents: {
      type: "carousel",
      contents: DATA.products.map((p) =>
        bubble(p.name, ["點下面查看這一項的使用方式"], [btn("怎麼使用", `${p.name} 使用方式`, "primary")])
      ),
    },
  };
}

function buildIngredientsSelectorFlex() {
  return {
    type: "flex",
    altText: "選擇成分",
    contents: {
      type: "carousel",
      contents: DATA.products.map((p) =>
        bubble(p.name, ["點下面查看這一項的成分"], [btn("看成分", `${p.name} 成分`, "primary")])
      ),
    },
  };
}

function buildOrderSelectorFlex() {
  return {
    type: "flex",
    altText: "選擇想買的商品",
    contents: {
      type: "carousel",
      contents: [
        ...DATA.products.map((p) =>
          bubble(
            p.name,
            [p.description, `規格：${p.size}`, `建議售價：${money(p.price)}`],
            [btn("我要這個", `我要買 ${p.name}`, "primary"), btn("加入清單", `加入清單 ${p.name}`)]
          )
        ),
        ...(DATA.offers?.comboOffers || []).map((o) =>
          bubble(
            o.name,
            [`內容：${o.items.join("＋")}`, `建議安排：${money(o.price)}（${o.priceNote || "可依需求調整"}）`, o.gift ? `附贈：${o.gift}` : ""],
            [btn("我要這組", `我要買 ${o.name}`, "primary"), btn("加入清單", `加入清單 ${o.name}`)]
          )
        ),
      ],
    },
  };
}

function buildSingleProductFlex(product) {
  return {
    type: "flex",
    altText: product.name,
    contents: bubble(
      product.name,
      [product.description, `建議售價：${money(product.price)}`, `規格：${product.size}`],
      [
        btn("我要這個", `我要買 ${product.name}`, "primary"),
        btn("加入清單", `加入清單 ${product.name}`),
        btn("怎麼使用", `${product.name} 使用方式`),
      ]
    ),
  };
}

function buildSingleProductUsageFlex(product) {
  return {
    type: "flex",
    altText: `${product.name} 使用方式`,
    contents: bubble(
      `${product.name} 使用方式`,
      product.usage.map((u) => `・${u}`),
      [btn("我要這個", `我要買 ${product.name}`, "primary"), btn("加入清單", `加入清單 ${product.name}`)]
    ),
  };
}

function buildSingleProductIngredientsFlex(product) {
  return {
    type: "flex",
    altText: `${product.name} 成分`,
    contents: bubble(
      `${product.name} 成分`,
      [product.ingredients.join("、")],
      [btn("我要這個", `我要買 ${product.name}`, "primary"), btn("加入清單", `加入清單 ${product.name}`)]
    ),
  };
}

function buildSingleProductOfferFlex(product) {
  const related = (DATA.offers?.comboOffers || []).filter((o) => (o.items || []).some((item) => item.includes(product.name)));
  if (!related.length) return buildSingleProductFlex(product);
  return {
    type: "flex",
    altText: `${product.name} 搭配方式`,
    contents: {
      type: "carousel",
      contents: related.map((o) =>
        bubble(
          o.name,
          [
            `內容：${o.items.join("＋")}`,
            `建議安排：${money(o.price)}（${o.priceNote || "可依需求調整"}）`,
            o.gift ? `附贈：${o.gift}` : "",
            o.desc,
          ],
          [btn("我要這組", `我要買 ${o.name}`, "primary"), btn("加入清單", `加入清單 ${o.name}`)]
        )
      ),
    },
  };
}

function buildSingleComboFlex(combo, includePrice = false) {
  return {
    type: "flex",
    altText: combo.name,
    contents: bubble(
      combo.name,
      [
        `內容：${combo.items.join("＋")}`,
        includePrice ? `建議安排：${money(combo.price)}（${combo.priceNote || "可依需求調整"}）` : "",
        combo.gift ? `附贈：${combo.gift}` : "",
        combo.desc,
        "這組如果你可以，我可以直接幫你安排🙂",
      ],
      [
        btn("我要這組", `我要買 ${combo.name}`, "primary"),
        btn("加入清單", `加入清單 ${combo.name}`),
        btn("查看清單", "查看購買清單"),
      ]
    ),
  };
}

function buildRetentionFlex(product) {
  const extra = (DATA.retentionOffers?.products || {})[product.name] || "如果您是第一次想試，這邊可以幫您安排成比較好入手的方式🙂";
  return {
    type: "flex",
    altText: `${product.name} 優惠安排`,
    contents: bubble(`${product.name} 優惠安排`, [`建議售價：${money(product.price)}`, extra], [btn("我要這個", `我要買 ${product.name}`, "primary"), btn("加入清單", `加入清單 ${product.name}`)])
  };
}

function buildGeneralRetentionFlex() {
  return {
    type: "flex",
    altText: "優惠安排",
    contents: bubble("如果您在評估價格", ["如果您是第一次想試，我可以幫您安排比較好入手的方式。"], [btn("幫我推薦", "幫我推薦", "primary"), btn("看產品", "看產品")]),
  };
}

function buildPaymentText() {
  return `付款方式目前可安排：\n\n・匯款\n・貨到付款\n\n其中貨到付款可配合：\n・宅配\n・7-11 賣貨便店到店\n\n若要直接下單，可先告訴我想買的品項與數量。`;
}

function buildShippingText() {
  return `配送方式目前可安排：\n\n・宅配\n・7-11 賣貨便店到店\n・雙北親送\n\n補充說明：\n宅配：可安排宅配寄送，實際出貨與到貨時間會依訂單順序確認，也可視情況安排貨到付款。\n7-11 賣貨便店到店：可店到店取貨，也可安排貨到付款。\n雙北親送：雙北地區可協助親送，實際區域與時間請先私訊確認。`;
}

function buildFaqText() {
  return DATA.faqs.map((f) => `Q：${f.q}\nA：${f.a}`).join("\n\n");
}

function startCheckout(state, targetName, type = "product") {
  state.checkout = { step: 1, type, targetName, name: "", phone: "", address: "", payment: "", shipping: "" };
  state.pendingSwitch = "";
  state.pendingSwitchType = "";
}

function buildCurrentStepPrompt(state) {
  if (state.checkout.step === 1) return `目前正在登記「${state.checkout.targetName}」。\n請回覆收件姓名。`;
  if (state.checkout.step === 2) return `目前正在登記「${state.checkout.targetName}」。\n請回覆收件電話。`;
  if (state.checkout.step === 3) return `目前正在登記「${state.checkout.targetName}」。\n請回覆收件地址或 7-11 門市資訊。`;
  if (state.checkout.step === 4) return "請選擇付款方式：";
  if (state.checkout.step === 5) return "請選擇配送方式：";
  return "如果還需要其他安排，也可以再跟我說🙂";
}

function currentCheckoutItem(state) {
  return state.cart.find((x) => x.name === state.checkout.targetName) || null;
}

function handleCartActions(state, raw, msg, product, combo) {
  if (raw.startsWith("加入清單 ")) {
    const name = raw.replace(/^加入清單\s*/, "").trim();
    return { type: "add_by_name", name };
  }
  if (raw.startsWith("只買這個 ") || raw.startsWith("只買這組 ")) {
    const name = raw.replace(/^只買這[個組]\s*/, "").trim();
    return { type: "single_buy_by_name", name };
  }
  const intent = detectIntent(msg);
  if (intent === "cart") return { type: "view" };
  if (intent === "checkout") return { type: "checkout" };
  if (intent === "confirm_checkout") return { type: "confirm_checkout" };
  if (intent === "edit_cart") return { type: "view" };
  if (intent === "clear_cart") return { type: "clear" };
  if (intent === "add_to_cart" && product) return { type: "add_product", product };
  if (intent === "add_to_cart" && combo) return { type: "add_combo", combo };
  return null;
}

function dispatchCartAction(replyToken, state, action) {
  if (action.type === "view") {
    return replyTextWithQuickReply(replyToken, buildCartText(state.cart), cartQuickReplies(state.checkout.step > 0));
  }
  if (action.type === "clear") {
    state.cart = [];
    if (state.checkout.step > 0) state.checkout = emptyCheckout();
    return replyTextWithQuickReply(replyToken, "已清空購買清單。", DATA.quickReplies.main);
  }
  if (action.type === "checkout") {
    if (!state.cart.length) {
      return replyTextWithQuickReply(replyToken, "目前購買清單是空的，先加入想買的商品或套餐吧🙂", DATA.quickReplies.main);
    }
    const first = state.cart[0];
    startCheckout(state, first.name, first.type);
    return replyTextWithQuickReply(replyToken, `目前購買清單如下：\n\n${buildCartText(state.cart)}\n\n請先回覆收件姓名。`, buildCheckoutQuickReplies(state));
  }

  let item = null;
  if (action.type === "add_product") item = makeProductCartItem(action.product);
  if (action.type === "add_combo") item = makeComboCartItem(action.combo);
  if (action.type === "add_by_name") {
    if (PRODUCT_MAP[action.name]) item = makeProductCartItem(PRODUCT_MAP[action.name]);
    if (COMBO_MAP[action.name]) item = makeComboCartItem(COMBO_MAP[action.name]);
  }
  if (action.type === "single_buy_by_name") {
    if (PRODUCT_MAP[action.name]) item = makeProductCartItem(PRODUCT_MAP[action.name]);
    if (COMBO_MAP[action.name]) item = makeComboCartItem(COMBO_MAP[action.name]);
    if (item) {
      state.cart = [item];
      startCheckout(state, item.name, item.type);
      return replyTextWithQuickReply(replyToken, `好的，改成直接購買「${item.name}」。
請先回覆收件姓名。`, buildCheckoutQuickReplies(state));
    }
  }
  if (item) {
    addItemToCart(state, item);
    return replyTextWithQuickReply(replyToken, `${item.name} 已加入購買清單🙂\n\n${buildCartText(state.cart)}`, cartQuickReplies(state.checkout.step > 0));
  }
  return replyTextWithQuickReply(replyToken, "找不到要加入的商品，請再點一次商品或套餐。", DATA.quickReplies.main);
}

function handleBrowseOrInfo(replyToken, state, intent, product, combo, withCheckoutQR) {
  const qr = withCheckoutQR ? buildCheckoutQuickReplies(state) : DATA.quickReplies.main;
  if (intent === "products") return replyFlexWithQuickReply(replyToken, buildProductsCarousel(), qr);
  if (intent === "recommend") return replyFlexWithQuickReply(replyToken, buildRecommendCarousel(), qr);
  if (intent === "offer") {
    if (combo) return replyFlexWithQuickReply(replyToken, buildSingleComboFlex(combo, true), qr);
    if (product) return replyFlexWithQuickReply(replyToken, buildSingleProductOfferFlex(product), qr);
    return replyFlexWithQuickReply(replyToken, buildOfferCarousel(), qr);
  }
  if (intent === "payment") return replyTextWithQuickReply(replyToken, buildPaymentText(), qr);
  if (intent === "shipping") return replyTextWithQuickReply(replyToken, buildShippingText(), qr);
  if (intent === "price") {
    if (combo) return replyFlexWithQuickReply(replyToken, buildSingleComboFlex(combo, true), qr);
    if (product) return replyFlexWithQuickReply(replyToken, buildSingleProductFlex(product), qr);
    return replyFlexWithQuickReply(replyToken, buildPriceSelectorFlex(), qr);
  }
  if (intent === "usage") {
    if (product) return replyFlexWithQuickReply(replyToken, buildSingleProductUsageFlex(product), qr);
    return replyFlexWithQuickReply(replyToken, buildUsageSelectorFlex(), qr);
  }
  if (intent === "ingredients") {
    if (product) return replyFlexWithQuickReply(replyToken, buildSingleProductIngredientsFlex(product), qr);
    return replyFlexWithQuickReply(replyToken, buildIngredientsSelectorFlex(), qr);
  }
  if (combo) return replyFlexWithQuickReply(replyToken, buildSingleComboFlex(combo, true), qr);
  if (product) return replyFlexWithQuickReply(replyToken, buildSingleProductFlex(product), qr);
  return replyFlexWithQuickReply(replyToken, buildWelcomeFlex(), qr);
}

async function continueCheckout(replyToken, state, raw, userId) {
  if (state.checkout.step === 1) {
    state.checkout.name = raw;
    state.checkout.step = 2;
    return replyTextWithQuickReply(replyToken, "收到。請回覆收件電話。", buildCheckoutQuickReplies(state));
  }
  if (state.checkout.step === 2) {
    state.checkout.phone = raw;
    state.checkout.step = 3;
    return replyTextWithQuickReply(replyToken, "收到。請回覆收件地址或 7-11 門市資訊。", buildCheckoutQuickReplies(state));
  }
  if (state.checkout.step === 3) {
    state.checkout.address = raw;
    state.checkout.step = 4;
    return replyTextWithQuickReply(replyToken, "請選擇付款方式：", paymentQuickReplies());
  }
  if (state.checkout.step === 4) {
    const msg = normalize(raw);
    if (/^付款/.test(msg)) {
      state.checkout.payment = raw.replace(/^付款\s*/, "").trim();
      state.checkout.step = 5;
      return replyTextWithQuickReply(replyToken, "請選擇配送方式：", shippingQuickReplies());
    }
    return replyTextWithQuickReply(replyToken, "請選擇付款方式：", paymentQuickReplies());
  }
  if (state.checkout.step === 5) {
    const msg = normalize(raw);
    if (/^配送/.test(msg)) {
      state.checkout.shipping = raw.replace(/^配送\s*/, "").trim();
      state.checkout.step = 6;
      const summaryLines = state.cart.map((item) => `・${item.name} × ${item.qty}　${money(item.subtotal)}`);
      return replyTextWithQuickReply(
        replyToken,
        `幫你整理一下訂單：

${summaryLines.join("
")}
合計：${money(cartTotal(state.cart))}

付款：${state.checkout.payment}
配送：${state.checkout.shipping}

這樣可以嗎？`,
        checkoutConfirmQuickReplies()
      );
    }
    return replyTextWithQuickReply(replyToken, "請選擇配送方式：", shippingQuickReplies());
  }
  if (state.checkout.step === 6) {
    if (raw === "確認送出" || normalize(raw) === normalize("確認送出")) {
      return finishCheckout(replyToken, state, userId);
    }
    if (raw === "修改清單" || normalize(raw) === normalize("修改清單")) {
      state.checkout.step = 0;
      return replyTextWithQuickReply(replyToken, buildCartText(state.cart), cartQuickReplies(false));
    }
    return replyTextWithQuickReply(replyToken, "請確認是否送出這筆訂單：", checkoutConfirmQuickReplies());
  }
  return replyTextWithQuickReply(replyToken, "如果還需要其他安排，也可以再跟我說🙂", DATA.quickReplies.main);
}

async function finishCheckout(replyToken, state, userId) {
  const order = {
    userId,
    items: state.cart.length ? [...state.cart] : [{ name: state.checkout.targetName, qty: 1, unitPrice: currentCheckoutItem(state)?.unitPrice || 0, subtotal: currentCheckoutItem(state)?.unitPrice || 0 }],
    name: state.checkout.name,
    phone: state.checkout.phone,
    address: state.checkout.address,
    payment: state.checkout.payment,
    shipping: state.checkout.shipping,
    total: state.cart.length ? cartTotal(state.cart) : (currentCheckoutItem(state)?.unitPrice || 0),
    createdAt: new Date().toISOString(),
  };

  const summaryLines = order.items.map((item) => `・${item.name} × ${item.qty}　${money(item.subtotal)}`);

  state.checkout = emptyCheckout();
  state.pendingSwitch = "";
  state.pendingSwitchType = "";
  state.cart = [];

  await saveToCRM(order);

  return replyTextWithQuickReply(
    replyToken,
    `已收到你的資料。\n\n購買內容：\n${summaryLines.join("\n")}\n合計：${money(order.total)}\n\n姓名：${order.name}\n電話：${order.phone}\n地址 / 門市：${order.address}\n付款：${order.payment}\n配送：${order.shipping}\n\n我們會再為你確認。`,
    DATA.quickReplies.main
  );
}

async function saveToCRM(data) {
  if (!CRM_URL || typeof fetch !== "function") return;
  try {
    await fetch(CRM_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
  } catch (e) {
    console.error("CRM error", e.message);
  }
}

function replyText(replyToken, text) {
  return client.replyMessage(replyToken, { type: "text", text });
}

function replyTextWithQuickReply(replyToken, text, quickItems) {
  return client.replyMessage(replyToken, {
    type: "text",
    text,
    quickReply: buildQuickReply(quickItems),
  });
}

function replyFlex(replyToken, flexPayload) {
  return client.replyMessage(replyToken, flexPayload);
}

function replyFlexWithQuickReply(replyToken, flexPayload, quickItems) {
  return client.replyMessage(replyToken, {
    ...flexPayload,
    quickReply: buildQuickReply(quickItems),
  });
}

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`TS-LINE bot listening on ${port}`));
