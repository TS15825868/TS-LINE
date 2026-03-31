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

const LINE_URL = DATA.lineUrl || "https://lin.ee/sHZW7NkR";
const LINE_ID = DATA.lineId || "@762jybnm";
const users = Object.create(null);

const PRODUCT_MAP = Object.fromEntries(DATA.products.map((p) => [p.name, p]));
const PRODUCT_ALIASES = Object.fromEntries(
  DATA.products.map((p) => [p.name, p.aliases || [p.name]])
);

const SENSITIVE_RE =
  /(懷孕|孕婦|哺乳|高血壓|糖尿病|心臟|腎臟|肝|癌|化療|慢性病|過敏|體質|適不適合|能不能吃|可不可以吃|中藥|西藥|服藥|吃藥|藥物|手術|月經|經期|感冒|發燒|兒童|小孩|寶寶|老人|長輩|失眠|睡不著|副作用|禁忌|醫師|醫生|診斷)/;

app.get("/", (req, res) => {
  res.send("TS-LINE bot is running.");
});

app.post("/webhook", line.middleware(config), async (req, res) => {
  try {
    await Promise.all(req.body.events.map(handleEvent));
    res.sendStatus(200);
  } catch (err) {
    console.error(err);
    res.sendStatus(500);
  }
});

async function handleEvent(event) {
  const userId = event.source.userId || "anonymous";
  const state = getUserState(userId);

  if (event.type === "follow") {
    state.hasSeenWelcome = true;
    return replyFlex(event.replyToken, buildWelcomeFlex());
  }

  if (event.type !== "message" || event.message.type !== "text") return null;

  const raw = String(event.message.text || "").trim();
  const msg = normalize(raw);
  state.history.push(raw);

  if (!state.hasSeenWelcome) {
    state.hasSeenWelcome = true;
    return replyFlex(event.replyToken, buildWelcomeFlex());
  }

  const product = detectProduct(msg);
  const intent = detectIntent(msg);

  if (handleCancel(state, raw, msg)) {
    return replyFlex(event.replyToken, buildWelcomeFlex());
  }

  if (SENSITIVE_RE.test(raw)) {
    return replyTextWithQuickReply(
      event.replyToken,
      DATA.doctorReferral,
      DATA.quickReplies.main
    );
  }

  // 全域功能優先，避免被下單流程吃掉
  if (intent === "welcome") return replyFlex(event.replyToken, buildWelcomeFlex());
  if (intent === "products") return replyFlex(event.replyToken, buildProductsCarousel());
  if (intent === "recommend") return replyFlex(event.replyToken, buildRecommendFlex());
  if (intent === "offer") {
    if (product) return replyFlex(event.replyToken, buildSingleProductOfferFlex(product));
    return replyFlex(event.replyToken, buildOfferCarousel());
  }
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
    const orderProduct = product || state.lastProduct;
    if (!orderProduct) {
      return replyFlex(event.replyToken, buildOrderSelectorFlex());
    }
    startOrder(state, orderProduct.name);
    return replyText(event.replyToken, `好的，我幫你登記 ${orderProduct.name}。\n請先回覆收件姓名。`);
  }

  if (state.order.step) {
    return continueOrder(event, state, raw, userId);
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
      hasSeenWelcome: false,
      lastProduct: null,
      order: {
        step: 0,
        product: "",
        name: "",
        phone: "",
        address: "",
        payment: "",
        shipping: ""
      }
    };
  }
  return users[userId];
}

function normalize(text) {
  return String(text).trim().toLowerCase().replace(/\s+/g, "");
}

function handleCancel(state, raw, msg) {
  if (["取消", "重來", "重新開始"].includes(raw) || ["取消", "重來", "重新開始"].includes(msg)) {
    state.order = {
      step: 0,
      product: "",
      name: "",
      phone: "",
      address: "",
      payment: "",
      shipping: ""
    };
    return true;
  }
  return false;
}

function detectIntent(msg) {
  if (/(歡迎|你好|hi|hello)/.test(msg)) return "welcome";
  if (/(看產品|產品|商品|產品介紹|看商品)/.test(msg)) return "products";
  if (/(幫我推薦|推薦|怎麼選|選哪個|哪個適合)/.test(msg)) return "recommend";
  if (/(下單|訂購|我要買|購買|我要訂|直接買)/.test(msg)) return "order";
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

function detectProduct(msg) {
  for (const [name, aliases] of Object.entries(PRODUCT_ALIASES)) {
    if (aliases.some((alias) => msg.includes(alias.toLowerCase().replace(/\s+/g, "")))) {
      return PRODUCT_MAP[name];
    }
  }
  return null;
}

function money(n) {
  return `$${Number(n).toLocaleString("en-US")}`;
}

function quickReply(items) {
  return {
    items: (items || []).slice(0, 13).map((item) => ({
      type: "action",
      action: {
        type: "message",
        label: item.label,
        text: item.text
      }
    }))
  };
}

function heroBubble(title, subtitle, buttons) {
  return {
    type: "bubble",
    body: {
      type: "box",
      layout: "vertical",
      spacing: "md",
      contents: [
        { type: "text", text: title, weight: "bold", size: "xl" },
        { type: "text", text: subtitle, wrap: true, size: "sm", color: "#666666" }
      ]
    },
    footer: {
      type: "box",
      layout: "vertical",
      spacing: "sm",
      contents: buttons.map((b, i) => ({
        type: "button",
        style: i === 0 ? "primary" : "link",
        action: {
          type: "message",
          label: b.label,
          text: b.text
        }
      }))
    }
  };
}

function buildWelcomeFlex() {
  return {
    type: "flex",
    altText: "歡迎來到仙加味",
    contents: heroBubble(
      "仙加味",
      "歡迎來到官方 LINE\n\n可以直接點下面按鈕快速查看：\n・產品介紹\n・單品價格\n・搭配組合\n・付款與配送",
      [
        { label: "看產品", text: "看產品" },
        { label: "幫我推薦", text: "幫我推薦" },
        { label: "看搭配組合", text: "看搭配組合" },
        { label: "我要買", text: "我要買" }
      ]
    )
  };
}

function buildProductsCarousel() {
  return {
    type: "flex",
    altText: "產品介紹",
    contents: {
      type: "carousel",
      contents: DATA.products.map((p) => ({
        type: "bubble",
        body: {
          type: "box",
          layout: "vertical",
          spacing: "md",
          contents: [
            { type: "text", text: p.name, weight: "bold", size: "lg" },
            { type: "text", text: p.description, wrap: true, size: "sm", color: "#666666" },
            { type: "text", text: `規格：${p.size}`, size: "sm" }
          ]
        },
        footer: {
          type: "box",
          layout: "vertical",
          spacing: "sm",
          contents: [
            btn("看價格", `${p.name} 價格`, "primary"),
            btn("怎麼使用", `${p.name} 使用方式`),
            btn("我要買", `我要買 ${p.name}`)
          ]
        }
      }))
    }
  };
}

function buildPriceSelectorFlex() {
  return {
    type: "flex",
    altText: "選擇價格產品",
    contents: {
      type: "carousel",
      contents: DATA.products.map((p) => singleActionBubble(p.name, `查看 ${p.name} 的價格`, "看價格", `${p.name} 價格`))
    }
  };
}

function buildUsageSelectorFlex() {
  return {
    type: "flex",
    altText: "選擇使用方式產品",
    contents: {
      type: "carousel",
      contents: DATA.products.map((p) => singleActionBubble(p.name, `查看 ${p.name} 的使用方式`, "怎麼使用", `${p.name} 使用方式`))
    }
  };
}

function buildIngredientsSelectorFlex() {
  return {
    type: "flex",
    altText: "選擇成分產品",
    contents: {
      type: "carousel",
      contents: DATA.products.map((p) => singleActionBubble(p.name, `查看 ${p.name} 的成分`, "看成分", `${p.name} 成分`))
    }
  };
}

function buildOrderSelectorFlex() {
  return {
    type: "flex",
    altText: "選擇購買產品",
    contents: {
      type: "carousel",
      contents: DATA.products.map((p) => singleActionBubble(p.name, `開始下單 ${p.name}`, "我要買", `我要買 ${p.name}`))
    }
  };
}

function buildOfferCarousel() {
  return {
    type: "flex",
    altText: "搭配組合",
    contents: {
      type: "carousel",
      contents: (DATA.offers.comboOffers || []).map((o) => ({
        type: "bubble",
        body: {
          type: "box",
          layout: "vertical",
          spacing: "md",
          contents: [
            { type: "text", text: o.name, weight: "bold", size: "lg" },
            { type: "text", text: `內容：${o.items.join("＋")}`, wrap: true, size: "sm" },
            ...(o.gift ? [{ type: "text", text: `附贈：${o.gift}`, wrap: true, size: "sm", color: "#D35400" }] : []),
            { type: "text", text: o.desc, wrap: true, size: "sm", color: "#666666" }
          ]
        },
        footer: {
          type: "box",
          layout: "vertical",
          spacing: "sm",
          contents: [
            btn("我要這組", `我要買 ${o.name}` , "primary"),
            btn("幫我推薦", "幫我推薦")
          ]
        }
      }))
    }
  };
}

function buildRecommendFlex() {
  return {
    type: "flex",
    altText: "幫我推薦",
    contents: {
      type: "carousel",
      contents: DATA.recommend.map((r) => ({
        type: "bubble",
        body: {
          type: "box",
          layout: "vertical",
          spacing: "md",
          contents: [
            { type: "text", text: r.keyword, weight: "bold", size: "lg" },
            { type: "text", text: `建議：${r.result}`, size: "md", color: "#1F4E79" },
            { type: "text", text: r.desc, wrap: true, size: "sm", color: "#666666" }
          ]
        },
        footer: {
          type: "box",
          layout: "vertical",
          spacing: "sm",
          contents: [
            btn("看這個產品", r.result, "primary"),
            btn("我要買", `我要買 ${r.result}`)
          ]
        }
      }))
    }
  };
}

function buildSingleProductFlex(product) {
  return {
    type: "flex",
    altText: product.name,
    contents: {
      type: "bubble",
      body: {
        type: "box",
        layout: "vertical",
        spacing: "md",
        contents: [
          { type: "text", text: product.name, weight: "bold", size: "xl" },
          { type: "text", text: product.description, wrap: true, size: "sm", color: "#666666" },
          { type: "text", text: `規格：${product.size}`, size: "sm" }
        ]
      },
      footer: {
        type: "box",
        layout: "vertical",
        spacing: "sm",
        contents: [
          btn("看價格", `${product.name} 價格`, "primary"),
          btn("看成分", `${product.name} 成分`),
          btn("怎麼使用", `${product.name} 使用方式`),
          btn("看搭配組合", `${product.name} 搭配組合`),
          btn("我要買", `我要買 ${product.name}`)
        ]
      }
    }
  };
}

function buildSingleProductPriceFlex(product) {
  return flexInfoCard(
    `${product.name} 價格`,
    `規格：${product.size}\n建議售價：${money(product.price)}`,
    [
      btn("看成分", `${product.name} 成分`, "primary"),
      btn("怎麼使用", `${product.name} 使用方式`),
      btn("我要買", `我要買 ${product.name}`)
    ]
  );
}

function buildSingleProductUsageFlex(product) {
  return flexInfoCard(
    `${product.name} 使用方式`,
    product.usage.map((u) => `・${u}`).join("\n"),
    [
      btn("看價格", `${product.name} 價格`, "primary"),
      btn("看成分", `${product.name} 成分`),
      btn("我要買", `我要買 ${product.name}`)
    ]
  );
}

function buildSingleProductIngredientsFlex(product) {
  return flexInfoCard(
    `${product.name} 成分`,
    product.ingredients.join("、"),
    [
      btn("看價格", `${product.name} 價格`, "primary"),
      btn("怎麼使用", `${product.name} 使用方式`),
      btn("我要買", `我要買 ${product.name}`)
    ]
  );
}

function buildSingleProductOfferFlex(product) {
  const related = (DATA.offers.comboOffers || []).filter((o) =>
    (o.items || []).some((item) => item.includes(product.name))
  );

  if (!related.length) {
    return flexInfoCard(
      `${product.name} 搭配方式`,
      "目前這項沒有另外設定組合方式。",
      [
        btn("看價格", `${product.name} 價格`, "primary"),
        btn("怎麼使用", `${product.name} 使用方式`),
        btn("我要買", `我要買 ${product.name}`)
      ]
    );
  }

  return {
    type: "flex",
    altText: `${product.name} 搭配方式`,
    contents: {
      type: "carousel",
      contents: related.map((o) => ({
        type: "bubble",
        body: {
          type: "box",
          layout: "vertical",
          spacing: "md",
          contents: [
            { type: "text", text: o.name, weight: "bold", size: "lg" },
            { type: "text", text: `內容：${o.items.join("＋")}`, wrap: true, size: "sm" },
            ...(o.gift ? [{ type: "text", text: `附贈：${o.gift}`, wrap: true, size: "sm", color: "#D35400" }] : []),
            { type: "text", text: o.desc, wrap: true, size: "sm", color: "#666666" }
          ]
        },
        footer: {
          type: "box",
          layout: "vertical",
          spacing: "sm",
          contents: [
            btn("我要這組", `我要買 ${o.name}`, "primary"),
            btn("看價格", `${product.name} 價格`)
          ]
        }
      }))
    }
  };
}

function buildRetentionFlex(product) {
  const extra = (DATA.retentionOffers.products || {})[product.name] || "如果您是第一次想試，我可以再幫您安排比較好入手的方式🙂";
  return flexInfoCard(
    "如果您在評估價格",
    `仙加味這邊比較重視原料、型態與日常安排方式，所以平常不會做太多大幅促銷。\n\n${product.name} 可協助安排：\n${extra}`,
    [
      btn("看價格", `${product.name} 價格`, "primary"),
      btn("看搭配組合", `${product.name} 搭配組合`),
      btn("我要買", `我要買 ${product.name}`)
    ]
  );
}

function buildGeneralRetentionFlex() {
  return flexInfoCard(
    "如果您在評估價格",
    "仙加味這邊比較重視原料、型態與日常安排方式，所以平常不會做太多大幅促銷。\n\n如果您是第一次想試，我可以幫您安排比較好入手的方式。",
    [
      btn("先看產品", "看產品", "primary"),
      btn("看搭配組合", "看搭配組合"),
      btn("幫我推薦", "幫我推薦")
    ]
  );
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

function buildDefaultText() {
  return `${DATA.welcomeText}\n\n可直接點選：看產品／幫我推薦／看搭配組合／付款方式／配送方式`;
}

function startOrder(state, productName) {
  state.order = {
    step: 1,
    product: productName,
    name: "",
    phone: "",
    address: "",
    payment: "",
    shipping: ""
  };
}

async function continueOrder(event, state, raw, userId) {
  if (state.order.step === 1) {
    state.order.name = raw;
    state.order.step = 2;
    return replyText(event.replyToken, "收到。請回覆收件電話。");
  }

  if (state.order.step === 2) {
    state.order.phone = raw;
    state.order.step = 3;
    return replyText(event.replyToken, "收到。請回覆收件地址或 7-11 門市資訊。");
  }

  if (state.order.step === 3) {
    state.order.address = raw;
    state.order.step = 4;
    return replyText(event.replyToken, "收到。請回覆付款方式：匯款／貨到付款\n若選貨到付款，可配合宅配或 7-11 賣貨便店到店。");
  }

  if (state.order.step === 4) {
    state.order.payment = raw;
    state.order.step = 5;
    return replyText(event.replyToken, "收到。請回覆配送方式：宅配／7-11賣貨便店到店／雙北親送");
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
      createdAt: new Date().toISOString()
    };

    state.order = {
      step: 0,
      product: "",
      name: "",
      phone: "",
      address: "",
      payment: "",
      shipping: ""
    };

    await saveToCRM(order);

    return replyText(
      event.replyToken,
      `已收到你的資料。

產品：${order.product}
姓名：${order.name}
電話：${order.phone}
地址 / 門市：${order.address}
付款：${order.payment}
配送：${order.shipping}

我們會再為你確認。`
    );
  }

  return replyText(event.replyToken, "請重新輸入一次，或輸入「取消」結束目前流程。");
}

async function saveToCRM(data) {
  if (!CRM_URL || typeof fetch !== "function") return;
  try {
    await fetch(CRM_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data)
    });
  } catch (e) {
    console.error("CRM error", e.message);
  }
}

function btn(label, text, style = "link") {
  return {
    type: "button",
    style,
    action: {
      type: "message",
      label,
      text
    }
  };
}

function singleActionBubble(title, subtitle, label, text) {
  return {
    type: "bubble",
    body: {
      type: "box",
      layout: "vertical",
      spacing: "md",
      contents: [
        { type: "text", text: title, weight: "bold", size: "lg" },
        { type: "text", text: subtitle, wrap: true, size: "sm", color: "#666666" }
      ]
    },
    footer: {
      type: "box",
      layout: "vertical",
      contents: [btn(label, text, "primary")]
    }
  };
}

function flexInfoCard(title, bodyText, buttons) {
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
          { type: "text", text: title, weight: "bold", size: "lg" },
          { type: "text", text: bodyText, wrap: true, size: "sm", color: "#333333" }
        ]
      },
      footer: {
        type: "box",
        layout: "vertical",
        spacing: "sm",
        contents: buttons
      }
    }
  };
}

function replyText(replyToken, text) {
  return client.replyMessage(replyToken, {
    type: "text",
    text
  });
}

function replyTextWithQuickReply(replyToken, text, items) {
  return client.replyMessage(replyToken, {
    type: "text",
    text,
    quickReply: quickReply(items)
  });
}

function replyFlex(replyToken, flexPayload) {
  return client.replyMessage(replyToken, flexPayload);
}

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`TS-LINE bot listening on ${port}`));
