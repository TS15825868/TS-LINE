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
const COMBOS = (DATA.offers && DATA.offers.comboOffers) || [];
const COMBO_MAP = Object.fromEntries(COMBOS.map((c) => [c.name, c]));
const COMBO_ALIASES = Object.fromEntries(
  COMBOS.map((c) => [c.name, buildComboAliases(c)])
);

const SENSITIVE_RE =
  /(懷孕|孕婦|哺乳|高血壓|糖尿病|心臟|腎臟|肝|癌|化療|慢性病|過敏|體質|適不適合|能不能吃|可不可以吃|中藥|西藥|服藥|吃藥|藥物|手術|月經|經期|感冒|發燒|兒童|小孩|寶寶|老人|長輩|失眠|睡不著|副作用|禁忌|醫師|醫生|診斷)/;

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

  const autoLead = detectAutoLead(raw, msg);
  if (autoLead) {
    return handleAutoLead(event.replyToken, state, autoLead);
  }

  const product = findProduct(msg);
  const combo = findCombo(msg);
  const intent = detectIntent(msg);

  if (SENSITIVE_RE.test(raw)) {
    return replyTextWithQuickReply(
      event.replyToken,
      DATA.doctorReferral,
      DATA.quickReplies.main
    );
  }

  if (intent === "welcome") {
    return replyFlex(event.replyToken, buildWelcomeFlex());
  }

  if (intent === "products") {
    return replyFlex(event.replyToken, buildProductsCarousel());
  }

  if (intent === "recommend") {
    state.lastProduct = null;
    state.lastCombo = null;
    return replyFlex(event.replyToken, buildRecommendCarousel());
  }

  if (intent === "offer") {
    if (combo) {
      state.lastCombo = combo;
      return replyFlex(event.replyToken, buildSingleComboFlex(combo));
    }
    if (product) {
      state.lastProduct = product;
      return replyFlex(event.replyToken, buildSingleProductOfferFlex(product));
    }
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
    if (combo) {
      state.lastCombo = combo;
      return replyFlex(event.replyToken, buildComboRetentionFlex(combo));
    }
    if (product) {
      state.lastProduct = product;
      return replyFlex(event.replyToken, buildRetentionFlex(product));
    }
    return replyFlex(event.replyToken, buildGeneralRetentionFlex());
  }

  if (intent === "price") {
    if (product) {
      state.lastProduct = product;
      return replyFlex(event.replyToken, buildSingleProductPriceFlex(product));
    }
    return replyFlex(event.replyToken, buildPriceSelectorFlex());
  }

  if (intent === "usage") {
    if (product) {
      state.lastProduct = product;
      return replyFlex(event.replyToken, buildSingleProductUsageFlex(product));
    }
    return replyFlex(event.replyToken, buildUsageSelectorFlex());
  }

  if (intent === "ingredients") {
    if (product) {
      state.lastProduct = product;
      return replyFlex(event.replyToken, buildSingleProductIngredientsFlex(product));
    }
    return replyFlex(event.replyToken, buildIngredientsSelectorFlex());
  }

  if (intent === "order") {
    if (combo) {
      state.lastCombo = combo;
      startOrder(state, combo.name);
      return replyText(
        event.replyToken,
        `好的，我幫你登記 ${combo.name}。\n請先回覆收件姓名。`
      );
    }

    if (product) {
      state.lastProduct = product;
      startOrder(state, product.name);
      return replyText(
        event.replyToken,
        `好的，我幫你登記 ${product.name}。\n請先回覆收件姓名。`
      );
    }

    if (state.lastProduct) {
      startOrder(state, state.lastProduct.name);
      return replyText(
        event.replyToken,
        `好的，我幫你登記 ${state.lastProduct.name}。\n請先回覆收件姓名。`
      );
    }

    if (state.lastCombo) {
      startOrder(state, state.lastCombo.name);
      return replyText(
        event.replyToken,
        `好的，我幫你登記 ${state.lastCombo.name}。\n請先回覆收件姓名。`
      );
    }

    return replyFlex(event.replyToken, buildOrderSelectorFlex());
  }

  if (state.order.step) {
    return continueOrder(event.replyToken, state, raw, userId);
  }

  if (combo) {
    state.lastCombo = combo;
    return replyFlex(event.replyToken, buildSingleComboFlex(combo));
  }

  if (product) {
    state.lastProduct = product;
    return replyFlex(event.replyToken, buildSingleProductFlex(product));
  }

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
      lastProduct: null,
      lastCombo: null,
      order: emptyOrder(),
    };
  }
  return users[userId];
}

function emptyOrder() {
  return {
    step: 0,
    product: "",
    name: "",
    phone: "",
    address: "",
    payment: "",
    shipping: "",
  };
}

function normalize(text) {
  return String(text).trim().toLowerCase().replace(/[\s\u3000]+/g, "");
}

function handleCancel(state, raw, msg) {
  if (["取消", "重來", "重新開始"].includes(raw) || ["取消", "重來", "重新開始"].includes(msg)) {
    state.order = emptyOrder();
    return true;
  }
  return false;
}

function detectIntent(msg) {
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

function buildComboAliases(combo) {
  return Array.from(
    new Set([
      combo.name,
      combo.name.replace(/組/g, ""),
      combo.name.replace(/套餐/g, ""),
      ...(combo.items || []),
    ])
  );
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

function detectAutoLead(raw, msg) {
  const quoted = extractQuotedName(raw);
  const product = quoted ? PRODUCT_MAP[quoted] || findProduct(normalize(quoted)) : findProduct(msg);
  const combo = quoted ? COMBO_MAP[quoted] || findCombo(normalize(quoted)) : findCombo(msg);

  if (/適合我的龜鹿|幫我整理|看適合/.test(raw) && !product && !combo) {
    return { type: "recommend" };
  }

  if (combo && /(這組適不適合我|幫我看這組|套餐)/.test(raw)) {
    return { type: "combo", combo };
  }

  if (product && /(適不適合我|幫我看|看適合)/.test(raw)) {
    return { type: "product", product };
  }

  if (combo && /(我要這組|我想買這組|下單這組)/.test(raw)) {
    return { type: "order_combo", combo };
  }

  if (product && /(我要買|我想買|下單)/.test(raw)) {
    return { type: "order_product", product };
  }

  return null;
}

function extractQuotedName(raw) {
  const m = String(raw).match(/[「『"]([^」』"]+)[」』"]/);
  return m ? m[1].trim() : "";
}

function handleAutoLead(replyToken, state, autoLead) {
  if (autoLead.type === "recommend") {
    state.lastProduct = null;
    state.lastCombo = null;
    return replyFlex(replyToken, buildWebsiteLeadRecommendFlex());
  }

  if (autoLead.type === "product") {
    state.lastProduct = autoLead.product;
    return replyFlex(replyToken, buildWebsiteLeadProductFlex(autoLead.product));
  }

  if (autoLead.type === "combo") {
    state.lastCombo = autoLead.combo;
    return replyFlex(replyToken, buildWebsiteLeadComboFlex(autoLead.combo));
  }

  if (autoLead.type === "order_product") {
    state.lastProduct = autoLead.product;
    startOrder(state, autoLead.product.name);
    return replyText(replyToken, `好的，我幫你登記 ${autoLead.product.name}。\n請先回覆收件姓名。`);
  }

  if (autoLead.type === "order_combo") {
    state.lastCombo = autoLead.combo;
    startOrder(state, autoLead.combo.name);
    return replyText(replyToken, `好的，我幫你登記 ${autoLead.combo.name}。\n請先回覆收件姓名。`);
  }

  return replyFlex(replyToken, buildWelcomeFlex());
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
        ...bodyLines.map((line) => ({
          type: "text",
          text: line,
          wrap: true,
          size: "sm",
          color: "#444444",
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
            text: "可以直接點下面按鈕快速查看：\n・產品介紹\n・單品價格\n・搭配組合\n・付款與配送",
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
          btn("看搭配組合", "看搭配組合"),
          btn("我要買", "我要買"),
        ],
      },
    },
  };
}

function buildWebsiteLeadRecommendFlex() {
  return {
    type: "flex",
    altText: "幫你快速整理",
    contents: bubble(
      "幫你快速整理",
      [
        "如果你是第一次看，也沒關係🙂",
        "我可以直接幫你從生活方式整理比較適合的方向。",
        "你也可以直接點下面按鈕看產品或搭配組合。",
      ],
      [
        btn("幫我推薦", "幫我推薦", "primary"),
        btn("看產品", "看產品"),
        btn("看搭配組合", "看搭配組合"),
      ]
    ),
  };
}

function buildWebsiteLeadProductFlex(product) {
  return {
    type: "flex",
    altText: `${product.name} 適合怎麼看`,
    contents: bubble(
      `${product.name}`,
      [
        product.description,
        `規格：${product.size}`,
        "如果你想看這一種適不適合你，我可以直接幫你整理。",
      ],
      [
        btn("看價格", `${product.name} 價格`, "primary"),
        btn("怎麼使用", `${product.name} 使用方式`),
        btn("我要這個", `我要買 ${product.name}`),
      ]
    ),
  };
}

function buildWebsiteLeadComboFlex(combo) {
  return {
    type: "flex",
    altText: `${combo.name} 適合怎麼看`,
    contents: bubble(
      combo.name,
      [
        `內容：${combo.items.join("＋")}`,
        ...(combo.gift ? [`附贈：${combo.gift}`] : []),
        combo.desc,
        "如果你想直接看這組適不適合你，我可以接著幫你整理。",
      ],
      [
        btn("我要這組", `我要買 ${combo.name}`, "primary"),
        btn("付款方式", "付款方式"),
        btn("配送方式", "配送方式"),
      ]
    ),
  };
}

function buildProductsCarousel() {
  return {
    type: "flex",
    altText: "看產品",
    contents: {
      type: "carousel",
      contents: DATA.products.map((p) =>
        bubble(
          p.name,
          [p.description, `規格：${p.size}`],
          [
            btn("看價格", `${p.name} 價格`, "primary"),
            btn("怎麼使用", `${p.name} 使用方式`),
            btn("我要買", `我要買 ${p.name}`),
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
          [`規格：${p.size}`, "點下面查看這一項的價格"],
          [btn("看價格", `${p.name} 價格`, "primary")]
        )
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
        bubble(
          p.name,
          ["點下面查看這一項的使用方式"],
          [btn("怎麼使用", `${p.name} 使用方式`, "primary")]
        )
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
        bubble(
          p.name,
          ["點下面查看這一項的成分"],
          [btn("看成分", `${p.name} 成分`, "primary")]
        )
      ),
    },
  };
}

function buildOrderSelectorFlex() {
  return {
    type: "flex",
    altText: "選擇要買的產品",
    contents: {
      type: "carousel",
      contents: [
        ...DATA.products.map((p) =>
          bubble(
            p.name,
            [p.description, `規格：${p.size}`],
            [btn("我要這個", `我要買 ${p.name}`, "primary")]
          )
        ),
        ...COMBOS.map((c) =>
          bubble(
            c.name,
            [`內容：${c.items.join("＋")}`, ...(c.gift ? [`附贈：${c.gift}`] : []), c.desc],
            [btn("我要這組", `我要買 ${c.name}`, "primary")]
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
      [
        product.description,
        `規格：${product.size}`,
        "如果是第一次想試，我可以幫你安排比較好入手的方式🙂",
      ],
      [
        btn("看價格", `${product.name} 價格`, "primary"),
        btn("看成分", `${product.name} 成分`),
        btn("怎麼使用", `${product.name} 使用方式`),
        btn("看搭配組合", `${product.name} 搭配組合`),
        btn("我要這個", `我要買 ${product.name}`),
      ]
    ),
  };
}

function buildSingleProductPriceFlex(product) {
  return {
    type: "flex",
    altText: `${product.name} 價格`,
    contents: bubble(
      `${product.name} 價格`,
      [
        `規格：${product.size}`,
        `建議售價：${money(product.price)}`,
        "如果是第一次想試，我可以幫你安排比較好入手的方式🙂",
      ],
      [
        btn("看搭配組合", `${product.name} 搭配組合`, "primary"),
        btn("我要這個", `我要買 ${product.name}`),
        btn("幫我推薦", "幫我推薦"),
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
        btn("看價格", `${product.name} 價格`, "primary"),
        btn("我要這個", `我要買 ${product.name}`),
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
        btn("看價格", `${product.name} 價格`, "primary"),
        btn("怎麼使用", `${product.name} 使用方式`),
        btn("我要這個", `我要買 ${product.name}`),
      ]
    ),
  };
}

function buildOfferCarousel() {
  return {
    type: "flex",
    altText: "搭配組合",
    contents: {
      type: "carousel",
      contents: COMBOS.map((o) =>
        bubble(
          o.name,
          [
            `內容：${o.items.join("＋")}`,
            ...(o.gift ? [`附贈：${o.gift}`] : []),
            o.desc,
          ],
          [btn("我要這組", `我要買 ${o.name}`, "primary")]
        )
      ),
    },
  };
}

function buildSingleProductOfferFlex(product) {
  const related = COMBOS.filter((o) =>
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
          btn("看價格", `${product.name} 價格`, "primary"),
          btn("我要這個", `我要買 ${product.name}`),
        ]
      ),
    };
  }

  return {
    type: "flex",
    altText: `${product.name} 搭配組合`,
    contents: {
      type: "carousel",
      contents: related.map((o) =>
        bubble(
          o.name,
          [
            `內容：${o.items.join("＋")}`,
            ...(o.gift ? [`附贈：${o.gift}`] : []),
            o.desc,
          ],
          [btn("我要這組", `我要買 ${o.name}`, "primary")]
        )
      ),
    },
  };
}

function buildSingleComboFlex(combo) {
  const retention = DATA.retentionOffers?.combos?.[combo.name] || "";
  return {
    type: "flex",
    altText: combo.name,
    contents: bubble(
      combo.name,
      [
        `內容：${combo.items.join("＋")}`,
        ...(combo.gift ? [`附贈：${combo.gift}`] : []),
        combo.desc,
        ...(retention ? [retention] : []),
      ],
      [
        btn("我要這組", `我要買 ${combo.name}`, "primary"),
        btn("付款方式", "付款方式"),
        btn("配送方式", "配送方式"),
      ]
    ),
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
          ]
        )
      ),
    },
  };
}

function buildRetentionFlex(product) {
  const triggerText =
    DATA.retentionOffers?.triggerText ||
    "如果您是第一次想試，這邊可以幫您安排成比較好入手的方式🙂";

  const extra =
    (product && DATA.retentionOffers?.products?.[product.name]) || "";

  const lines = [
    "仙加味這邊比較重視原料、型態與日常安排方式，所以平常不會做太多大幅促銷。",
    triggerText,
  ];

  if (extra) {
    lines.push(`可協助安排：${extra}`);
  }

  return {
    type: "flex",
    altText: "如果在評估價格",
    contents: bubble(
      "如果在評估價格",
      lines,
      [
        btn("看搭配組合", product ? `${product.name} 搭配組合` : "看搭配組合", "primary"),
        btn("我要這個", product ? `我要買 ${product.name}` : "我要買"),
      ]
    ),
  };
}

function buildComboRetentionFlex(combo) {
  const text = DATA.retentionOffers?.combos?.[combo.name] || DATA.retentionOffers?.triggerText || "如果您是第一次想試，這邊可以幫您安排成比較好入手的方式🙂";
  return {
    type: "flex",
    altText: "如果在評估價格",
    contents: bubble(
      "如果在評估價格",
      [
        "仙加味這邊比較重視原料、型態與日常安排方式，所以平常不會做太多大幅促銷。",
        text,
      ],
      [
        btn("我要這組", `我要買 ${combo.name}`, "primary"),
        btn("付款方式", "付款方式"),
      ]
    ),
  };
}

function buildGeneralRetentionFlex() {
  const combos = DATA.retentionOffers?.combos || {};
  const comboLines = Object.keys(combos).map((name) => `${name}：${combos[name]}`);

  return {
    type: "flex",
    altText: "如果在評估價格",
    contents: bubble(
      "如果在評估價格",
      [
        "仙加味這邊比較重視原料、型態與日常安排方式，所以平常不會做太多大幅促銷。",
        DATA.retentionOffers?.triggerText || "如果您是第一次想試，這邊可以幫您安排成比較好入手的方式🙂",
        ...comboLines,
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
  return `付款方式目前可安排：

・匯款
・貨到付款

其中貨到付款可配合：
・宅配
・7-11 賣貨便店到店

若要直接下單，可先告訴我想買的品項與數量。`;
}

function buildShippingText() {
  return `配送方式目前可安排：

・宅配
・7-11 賣貨便店到店
・雙北親送

補充說明：
宅配：可安排宅配寄送，實際出貨與到貨時間會依訂單順序確認，也可視情況安排貨到付款。
7-11 賣貨便店到店：可店到店取貨，也可安排貨到付款。
雙北親送：雙北地區可協助親送，實際區域與時間請先私訊確認。`;
}

function buildFaqText() {
  return DATA.faqs.map((f) => `Q：${f.q}\nA：${f.a}`).join("\n\n");
}

function startOrder(state, productName) {
  state.order = {
    step: 1,
    product: productName,
    name: "",
    phone: "",
    address: "",
    payment: "",
    shipping: "",
  };
}

async function continueOrder(replyToken, state, raw, userId) {
  if (state.order.step === 1) {
    state.order.name = raw;
    state.order.step = 2;
    return replyText(replyToken, "收到。請回覆收件電話。");
  }

  if (state.order.step === 2) {
    state.order.phone = raw;
    state.order.step = 3;
    return replyText(replyToken, "收到。請回覆收件地址或 7-11 門市資訊。");
  }

  if (state.order.step === 3) {
    state.order.address = raw;
    state.order.step = 4;
    return replyText(replyToken, "收到。請回覆付款方式：匯款／貨到付款\n若選貨到付款，可配合宅配或 7-11 賣貨便店到店。");
  }

  if (state.order.step === 4) {
    state.order.payment = raw;
    state.order.step = 5;
    return replyText(replyToken, "收到。請回覆配送方式：宅配／7-11賣貨便店到店／雙北親送");
  }

  if (state.order.step === 5) {
    state.order.shipping = raw;

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

    await saveToCRM(order);

    return replyText(
      replyToken,
      `已收到你的資料。\n\n產品：${order.product}\n姓名：${order.name}\n電話：${order.phone}\n地址 / 門市：${order.address}\n付款：${order.payment}\n配送：${order.shipping}\n\n我們會再為你確認。`
    );
  }

  return replyText(replyToken, "請重新輸入一次，或輸入「取消」結束目前流程。");
}

async function saveToCRM(data) {
  if (!CRM_URL || typeof fetch !== "function") return;

  try {
    await fetch(CRM_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    });
  } catch (e) {
    console.error("CRM error", e.message);
  }
}

function replyText(replyToken, text) {
  return client.replyMessage(replyToken, {
    type: "text",
    text,
  });
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

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`TS-LINE bot listening on ${port}`));
