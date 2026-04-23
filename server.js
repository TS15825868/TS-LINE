"use strict";

const line = require("@line/bot-sdk");
const express = require("express");
const fs = require("fs");
const path = require("path");

const config = {
  channelAccessToken: process.env.CHANNEL_ACCESS_TOKEN || "",
  channelSecret: process.env.CHANNEL_SECRET || "",
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

const MEDICAL_RE = /(懷孕|孕婦|哺乳|高血壓|糖尿病|心臟|腎臟|肝|癌|化療|慢性病|過敏|體質|中藥|西藥|服藥|吃藥|藥物|手術|月經|經期|感冒|發燒|兒童|小孩|寶寶|老人|長輩|失眠|睡不著|副作用|禁忌|醫師|醫生|診斷)/;

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

  if (event.type === "follow") {
    state.welcomed = true;
    return replyFlex(event.replyToken, buildWelcomeFlex());
  }

  if (!event.message || event.message.type !== "text") return null;

  const raw = String(event.message.text || "").trim();
  const msg = normalize(raw);
  state.history.push(raw);

  if (!state.welcomed) {
    state.welcomed = true;
    return replyFlex(event.replyToken, buildWelcomeFlex());
  }

  if (handleCancel(state, raw, msg)) {
    return replyFlex(event.replyToken, buildWelcomeFlex());
  }

  if (handleResume(state, raw, msg)) {
    return replyTextWithQuickReply(
      event.replyToken,
      buildCurrentStepPrompt(state),
      buildOrderFlowQuickReplies(state)
    );
  }

  const pendingSwitchAction = handlePendingSwitch(state, raw, msg);
  if (pendingSwitchAction === "resume") {
    return replyTextWithQuickReply(
      event.replyToken,
      buildCurrentStepPrompt(state),
      buildOrderFlowQuickReplies(state)
    );
  }
  if (pendingSwitchAction === "switched") {
    return replyTextWithQuickReply(
      event.replyToken,
      `好的，已改成登記「${state.order.product}」。
請先回覆收件姓名。`,
      buildOrderFlowQuickReplies(state)
    );
  }

  const product = findProduct(msg);
  const combo = findCombo(msg);
  const intent = detectIntent(msg);

  if (MEDICAL_RE.test(raw)) {
    return replyTextWithQuickReply(
      event.replyToken,
      DATA.doctorReferral,
      DATA.quickReplies.main
    );
  }

  if (intent === "payment_select") {
    state.order.payment = raw.replace(/^付款\s*/, "").trim();
    state.order.step = 5;
    return replyTextWithQuickReply(
      event.replyToken,
      "請選擇配送方式：",
      shippingQuickReplies()
    );
  }

  if (intent === "shipping_select") {
    state.order.shipping = raw.replace(/^配送\s*/, "").trim();
    return finishOrder(event.replyToken, state, userId);
  }

  if (state.order.step) {
    const switchTarget = combo ? combo.name : product ? product.name : "";
    if (intent === "order" && switchTarget && switchTarget !== state.order.product) {
      state.pendingSwitch = switchTarget;
      return replyTextWithQuickReply(
        event.replyToken,
        `你目前正在登記「${state.order.product}」，要改成「${switchTarget}」嗎？`,
        [
          { label: `改成${switchTarget}`, text: `改成 ${switchTarget}` },
          { label: `繼續${state.order.product}`, text: "繼續原本下單" },
          { label: "取消全部", text: "取消" },
        ]
      );
    }

    if (shouldShowContentDuringOrder(intent, product, combo)) {
      if (combo) {
        return replyFlexWithQuickReply(
          event.replyToken,
          buildSingleComboFlex(combo, true),
          buildOrderFlowQuickReplies(state)
        );
      }
      if (product && intent === "price") {
        return replyFlexWithQuickReply(
          event.replyToken,
          buildSingleProductPriceFlex(product),
          buildOrderFlowQuickReplies(state)
        );
      }
      if (product && intent === "usage") {
        return replyFlexWithQuickReply(
          event.replyToken,
          buildSingleProductUsageFlex(product),
          buildOrderFlowQuickReplies(state)
        );
      }
      if (product && intent === "ingredients") {
        return replyFlexWithQuickReply(
          event.replyToken,
          buildSingleProductIngredientsFlex(product),
          buildOrderFlowQuickReplies(state)
        );
      }
      if (product) {
        return replyFlexWithQuickReply(
          event.replyToken,
          buildSingleProductFlex(product),
          buildOrderFlowQuickReplies(state)
        );
      }
      if (intent === "products") {
        return replyFlexWithQuickReply(
          event.replyToken,
          buildProductsCarousel(),
          buildOrderFlowQuickReplies(state)
        );
      }
      if (intent === "offer") {
        return replyFlexWithQuickReply(
          event.replyToken,
          buildOfferCarousel(),
          buildOrderFlowQuickReplies(state)
        );
      }
      if (intent === "recommend") {
        return replyFlexWithQuickReply(
          event.replyToken,
          buildRecommendCarousel(),
          buildOrderFlowQuickReplies(state)
        );
      }
      if (intent === "payment") {
        return replyTextWithQuickReply(
          event.replyToken,
          buildPaymentText(),
          buildOrderFlowQuickReplies(state)
        );
      }
      if (intent === "shipping") {
        return replyTextWithQuickReply(
          event.replyToken,
          buildShippingText(),
          buildOrderFlowQuickReplies(state)
        );
      }
    }

    return continueOrder(event.replyToken, state, raw, userId);
  }

  if (intent === "welcome") return replyFlex(event.replyToken, buildWelcomeFlex());
  if (intent === "products") return replyFlex(event.replyToken, buildProductsCarousel());
  if (intent === "recommend") return replyFlex(event.replyToken, buildRecommendCarousel());
  if (intent === "offer") {
    if (combo) return replyFlex(event.replyToken, buildSingleComboFlex(combo, true));
    if (product) return replyFlex(event.replyToken, buildSingleProductOfferFlex(product));
    return replyFlex(event.replyToken, buildOfferCarousel());
  }
  if (intent === "payment") {
    return replyTextWithQuickReply(
      event.replyToken,
      buildPaymentText(),
      DATA.quickReplies.main
    );
  }
  if (intent === "shipping") {
    return replyTextWithQuickReply(
      event.replyToken,
      buildShippingText(),
      DATA.quickReplies.main
    );
  }
  if (intent === "faq") {
    return replyTextWithQuickReply(
      event.replyToken,
      buildFaqText(),
      DATA.quickReplies.main
    );
  }
  if (intent === "hesitate") {
    if (product) return replyFlex(event.replyToken, buildRetentionFlex(product));
    return replyFlex(event.replyToken, buildGeneralRetentionFlex());
  }
  if (intent === "price") {
    if (combo) return replyFlex(event.replyToken, buildSingleComboFlex(combo, true));
    if (product) return replyFlex(event.replyToken, buildSingleProductPriceFlex(product));
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
  if (combo) {
    return replyFlex(event.replyToken, buildSingleComboFlex(combo, true));
  }
  if (intent === "order") {
    if (combo) {
      startOrder(state, combo.name, "combo");
      return replyTextWithQuickReply(
        event.replyToken,
        `好的，我幫你登記 ${combo.name}。\n請先回覆收件姓名。`,
        buildOrderFlowQuickReplies(state)
      );
    }
    if (product) {
      startOrder(state, product.name, "product");
      return replyTextWithQuickReply(
        event.replyToken,
        `好的，我幫你登記 ${product.name}。\n請先回覆收件姓名。`,
        buildOrderFlowQuickReplies(state)
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
      order: emptyOrder(),
      pendingSwitch: "",
    };
  }
  return users[userId];
}

function emptyOrder() {
  return {
    step: 0,
    type: "",
    product: "",
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
    state.order = emptyOrder();
    state.pendingSwitch = "";
    return true;
  }
  return false;
}

function handleResume(state, raw, msg) {
  return state.order.step > 0 && (raw === "繼續原本下單" || msg === normalize("繼續原本下單"));
}

function handlePendingSwitch(state, raw, msg) {
  if (!state.pendingSwitch) return "";
  if (raw.startsWith("改成 ")) {
    const target = raw.replace(/^改成\s*/, "").trim();
    if (target === state.pendingSwitch) {
      startOrder(state, target, COMBO_MAP[target] ? "combo" : "product");
      state.pendingSwitch = "";
      return "switched";
    }
  }
  if (raw === "繼續原本下單" || msg === normalize("繼續原本下單")) {
    state.pendingSwitch = "";
    return "resume";
  }
  return "";
}

function shouldShowContentDuringOrder(intent, product, combo) {
  return Boolean(
    combo ||
      product ||
      ["products", "offer", "recommend", "payment", "shipping", "price", "usage", "ingredients"].includes(intent)
  );
}

function detectIntent(msg) {
  if (/^付款/.test(msg)) return "payment_select";
  if (/^配送/.test(msg)) return "shipping_select";
  if (/(歡迎|你好|hi|hello)/.test(msg)) return "welcome";
  if (/(看產品|產品|商品|產品介紹|看商品)/.test(msg)) return "products";
  if (/(幫我推薦|推薦|怎麼選|選哪個|哪個適合|第一次怎麼買|第一次)/.test(msg)) return "recommend";
  if (/(下單|訂購|我要買|購買|我要訂|直接買|我要這個|我要這組)/.test(msg)) return "order";
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

function buildOrderFlowQuickReplies(state) {
  const items = [...(DATA.quickReplies.orderFlow || DATA.quickReplies.main || [])];
  if (state.order.step > 0) {
    items.unshift({ label: "繼續原本", text: "繼續原本下單" });
  }
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
        ...bodyLines.filter(Boolean).map((line, idx) => ({
          type: "text",
          text: line,
          wrap: true,
          size: idx === 1 && /建議售價|建議安排/.test(line) ? "md" : "sm",
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
          {
            type: "text",
            text: "直接點下面按鈕就可以，不用自己打字。",
            wrap: true,
            size: "sm",
          },
        ],
      },
      footer: {
        type: "box",
        layout: "vertical",
        spacing: "sm",
        contents: [
          btn("看產品", "看產品", "primary"),
          btn("幫我推薦", "幫我推薦"),
          btn("我要買", "我要買"),
        ],
      },
    },
  };
}

function buildProductsCarousel() {
  return {
    type: "flex",
    altText: "看產品",
    contents: {
      type: "carousel",
      contents: DATA.products.map((p) => buildProductBubble(p)),
    },
  };
}

function buildProductBubble(product) {
  return bubble(
    product.name,
    [
      product.description,
      `規格：${product.size}`,
      `建議售價：${money(product.price)}`,
    ],
    [
      btn("我要這個", `我要買 ${product.name}`, "primary"),
      btn("怎麼使用", `${product.name} 使用方式`),
      btn("看價格", `${product.name} 價格`),
    ]
  );
}

function buildPriceSelectorFlex() {
  return {
    type: "flex",
    altText: "選擇產品價格",
    contents: {
      type: "carousel",
      contents: DATA.products.map((p) =>
        bubble(p.name, [`規格：${p.size}`], [btn("看價格", `${p.name} 價格`, "primary")])
      ),
    },
  };
}

function buildUsageSelectorFlex() {
  return {
    type: "flex",
    altText: "選擇產品使用方式",
    contents: {
      type: "carousel",
      contents: DATA.products.map((p) =>
        bubble(p.name, ["點下面看這一項的使用方式"], [btn("怎麼使用", `${p.name} 使用方式`, "primary")])
      ),
    },
  };
}

function buildIngredientsSelectorFlex() {
  return {
    type: "flex",
    altText: "選擇產品成分",
    contents: {
      type: "carousel",
      contents: DATA.products.map((p) =>
        bubble(p.name, ["點下面看這一項的成分"], [btn("看成分", `${p.name} 成分`, "primary")])
      ),
    },
  };
}

function buildOrderSelectorFlex() {
  const comboBubbles = (DATA.offers?.comboOffers || []).map((o) => buildComboBubble(o));
  return {
    type: "flex",
    altText: "選擇要買的商品或套餐",
    contents: {
      type: "carousel",
      contents: [...DATA.products.map((p) => buildProductBubble(p)), ...comboBubbles].slice(0, 12),
    },
  };
}

function buildSingleProductFlex(product) {
  return {
    type: "flex",
    altText: product.name,
    contents: bubble(
      product.name,
      [
        product.description,
        `規格：${product.size}`,
        `建議售價：${money(product.price)}`,
        `建議：${product.suitable || "可依日常節奏安排"}`,
      ],
      [
        btn("我要這個", `我要買 ${product.name}`, "primary"),
        btn("怎麼使用", `${product.name} 使用方式`),
        btn("看價格", `${product.name} 價格`),
      ]
    ),
  };
}

function buildSingleProductPriceFlex(product) {
  return {
    type: "flex",
    altText: `${product.name} 價格`,
    contents: bubble(
      `${product.name}`,
      [
        `規格：${product.size}`,
        `建議售價：${money(product.price)}`,
        "如果這項可以，我可以直接幫你安排🙂",
      ],
      [
        btn("我要這個", `我要買 ${product.name}`, "primary"),
        btn("看搭配組合", `${product.name} 搭配組合`),
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
      [
        btn("我要這個", `我要買 ${product.name}`, "primary"),
        btn("看價格", `${product.name} 價格`),
      ]
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
      [
        btn("我要這個", `我要買 ${product.name}`, "primary"),
        btn("看價格", `${product.name} 價格`),
        btn("怎麼使用", `${product.name} 使用方式`),
      ]
    ),
  };
}

function buildComboBubble(combo) {
  return bubble(
    combo.name,
    [
      `內容：${combo.items.join("＋")}`,
      combo.gift ? `附贈：${combo.gift}` : "",
      `建議安排：${money(combo.price)}${combo.priceNote ? `（${combo.priceNote}）` : ""}`,
      combo.desc,
    ],
    [
      btn("我要這組", `我要買 ${combo.name}`, "primary"),
      btn("付款方式", "付款方式"),
      btn("配送方式", "配送方式"),
    ]
  );
}

function buildOfferCarousel() {
  return {
    type: "flex",
    altText: "搭配組合",
    contents: {
      type: "carousel",
      contents: (DATA.offers?.comboOffers || []).map((o) => buildComboBubble(o)),
    },
  };
}

function buildSingleComboFlex(combo, showActionText = false) {
  return {
    type: "flex",
    altText: combo.name,
    contents: bubble(
      combo.name,
      [
        `內容：${combo.items.join("＋")}`,
        combo.gift ? `附贈：${combo.gift}` : "",
        `建議安排：${money(combo.price)}${combo.priceNote ? `（${combo.priceNote}）` : ""}`,
        combo.desc,
        showActionText ? "這組如果你可以，我可以直接幫你安排🙂" : "",
      ],
      [
        btn("我要這組", `我要買 ${combo.name}`, "primary"),
        btn("付款方式", "付款方式"),
        btn("配送方式", "配送方式"),
      ]
    ),
  };
}

function buildSingleProductOfferFlex(product) {
  const related = (DATA.offers?.comboOffers || []).filter((o) =>
    (o.items || []).some((item) => item.includes(product.name))
  );

  if (!related.length) {
    return {
      type: "flex",
      altText: `${product.name} 搭配組合`,
      contents: bubble(
        `${product.name} 搭配組合`,
        ["目前這一項沒有另外設定組合方式。"],
        [
          btn("我要這個", `我要買 ${product.name}`, "primary"),
          btn("看價格", `${product.name} 價格`),
        ]
      ),
    };
  }

  return {
    type: "flex",
    altText: `${product.name} 搭配組合`,
    contents: {
      type: "carousel",
      contents: related.map((o) => buildComboBubble(o)),
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
          [btn("看這個產品", r.result, "primary"), btn("我要這個", `我要買 ${r.result}`)]
        )
      ),
    },
  };
}

function buildRetentionFlex(product) {
  const triggerText = DATA.retentionOffers?.triggerText || "如果您是第一次想試，這邊可以幫您安排成比較好入手的方式🙂";
  const extra = DATA.retentionOffers?.products?.[product.name] || "";
  return {
    type: "flex",
    altText: "如果在評估價格",
    contents: bubble(
      "如果在評估價格",
      [
        "仙加味這邊比較重視原料、型態與日常安排方式，所以平常不會做太多大幅促銷。",
        triggerText,
        extra ? `可協助安排：${extra}` : "",
      ],
      [
        btn("我要這個", `我要買 ${product.name}`, "primary"),
        btn("看搭配組合", `${product.name} 搭配組合`),
      ]
    ),
  };
}

function buildGeneralRetentionFlex() {
  return {
    type: "flex",
    altText: "如果在評估價格",
    contents: bubble(
      "如果在評估價格",
      [
        "仙加味這邊比較重視原料、型態與日常安排方式，所以平常不會做太多大幅促銷。",
        DATA.retentionOffers?.triggerText || "如果您是第一次想試，這邊可以幫您安排成比較好入手的方式🙂",
      ],
      [
        btn("先看產品", "看產品", "primary"),
        btn("看搭配組合", "看搭配組合"),
        btn("幫我推薦", "幫我推薦"),
      ]
    ),
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

function startOrder(state, targetName, type) {
  state.order = {
    step: 1,
    type,
    product: targetName,
    name: "",
    phone: "",
    address: "",
    payment: "",
    shipping: "",
  };
  state.pendingSwitch = "";
}

function buildCurrentStepPrompt(state) {
  switch (state.order.step) {
    case 1:
      return `目前正在登記「${state.order.product}」。\n請先回覆收件姓名。`;
    case 2:
      return `目前正在登記「${state.order.product}」。\n請回覆收件電話。`;
    case 3:
      return `目前正在登記「${state.order.product}」。\n請回覆收件地址或 7-11 門市資訊。`;
    case 4:
      return "請選擇付款方式：";
    case 5:
      return "請選擇配送方式：";
    default:
      return "如果還需要其他安排，也可以再跟我說🙂";
  }
}

async function continueOrder(replyToken, state, raw, userId) {
  if (state.order.step === 1) {
    state.order.name = raw;
    state.order.step = 2;
    return replyTextWithQuickReply(replyToken, "收到。請回覆收件電話。", buildOrderFlowQuickReplies(state));
  }

  if (state.order.step === 2) {
    state.order.phone = raw;
    state.order.step = 3;
    return replyTextWithQuickReply(replyToken, "收到。請回覆收件地址或 7-11 門市資訊。", buildOrderFlowQuickReplies(state));
  }

  if (state.order.step === 3) {
    state.order.address = raw;
    state.order.step = 4;
    return replyTextWithQuickReply(replyToken, "請選擇付款方式：", paymentQuickReplies());
  }

  if (state.order.step === 4) {
    return replyTextWithQuickReply(replyToken, "請直接點下面付款方式按鈕🙂", paymentQuickReplies());
  }

  if (state.order.step === 5) {
    return replyTextWithQuickReply(replyToken, "請直接點下面配送方式按鈕🙂", shippingQuickReplies());
  }

  return replyTextWithQuickReply(replyToken, "請重新輸入一次，或輸入「取消」結束目前流程。", buildOrderFlowQuickReplies(state));
}

async function finishOrder(replyToken, state, userId) {
  const order = {
    userId,
    product: state.order.product,
    name: state.order.name,
    phone: state.order.phone,
    address: state.order.address,
    payment: state.order.payment,
    shipping: state.order.shipping,
    createdAt: new Date().toISOString(),
  };

  state.order = emptyOrder();
  state.pendingSwitch = "";

  await saveToCRM(order);

  return replyTextWithQuickReply(
    replyToken,
    `已收到你的資料。\n\n產品：${order.product}\n姓名：${order.name}\n電話：${order.phone}\n地址 / 門市：${order.address}\n付款：${order.payment}\n配送：${order.shipping}\n\n我們會再為你確認。`,
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

function replyTextWithQuickReply(replyToken, text, quickReplyItems) {
  return client.replyMessage(replyToken, {
    type: "text",
    text,
    quickReply: buildQuickReply(quickReplyItems),
  });
}

function replyFlex(replyToken, flexPayload) {
  return client.replyMessage(replyToken, flexPayload);
}

function replyFlexWithQuickReply(replyToken, flexPayload, quickReplyItems) {
  return client.replyMessage(replyToken, {
    ...flexPayload,
    quickReply: buildQuickReply(quickReplyItems),
  });
}

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`TS-LINE bot listening on ${port}`));
