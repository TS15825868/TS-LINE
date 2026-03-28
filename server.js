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
    return replyFlexWithQuickReply(
      event.replyToken,
      DATA.flex.welcome,
      DATA.quickReplies.main
    );
  }

  if (event.type !== "message" || event.message.type !== "text") return null;

  const raw = String(event.message.text || "").trim();
  const msg = normalize(raw);
  state.history.push(raw);

  if (handleCancel(state, raw, msg)) {
    return replyTextWithQuickReply(
      event.replyToken,
      "已取消目前流程。你可以直接點下面按鈕，或直接輸入產品名稱。",
      DATA.quickReplies.main
    );
  }

  if (SENSITIVE_RE.test(raw)) {
    return replyTextWithQuickReply(
      event.replyToken,
      DATA.doctorReferral,
      DATA.quickReplies.main
    );
  }

  if (state.order.step) {
    return continueOrder(event, state, raw, userId);
  }

  const product = detectProduct(msg);
  const intent = detectIntent(msg);

  if (intent === "welcome") {
    return replyFlexWithQuickReply(
      event.replyToken,
      DATA.flex.welcome,
      DATA.quickReplies.main
    );
  }

  if (intent === "products") {
    return replyTextWithQuickReply(
      event.replyToken,
      "想看哪一個產品呢？請直接點選：",
      DATA.quickReplies.products
    );
  }

  if (intent === "recommend") {
    state.lastProduct = null;
    return replyTextWithQuickReply(
      event.replyToken,
      buildRecommendText(),
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

  if (intent === "contact") {
    return replyTextWithQuickReply(
      event.replyToken,
      `可以直接加官方 LINE：${LINE_ID}\n${LINE_URL}`,
      DATA.quickReplies.main
    );
  }

  if (intent === "price") {
    if (product) {
      state.lastProduct = product;
      return replyTextWithQuickReply(
        event.replyToken,
        `${product.name}
規格：${product.size}
建議售價：${money(product.price)}`,
        [
          { label: "成分", text: `${product.name} 成分` },
          { label: "怎麼使用", text: `${product.name} 使用方式` },
          { label: "我要買", text: `我要買 ${product.name}` },
          { label: "看搭配組合", text: `${product.name} 搭配組合` }
        ]
      );
    }

    return replyTextWithQuickReply(
      event.replyToken,
      "想看哪一個產品的價格呢？請直接點選：",
      [
        { label: "龜鹿膏", text: "龜鹿膏 價格" },
        { label: "龜鹿飲", text: "龜鹿飲 價格" },
        { label: "龜鹿湯塊", text: "龜鹿湯塊 價格" },
        { label: "鹿茸粉", text: "鹿茸粉 價格" }
      ]
    );
  }

  if (intent === "combo" || intent === "offer") {
    if (product) {
      state.lastProduct = product;
      return replyTextWithQuickReply(
        event.replyToken,
        buildOfferText(product),
        [
          { label: "看價格", text: `${product.name} 價格` },
          { label: "我要買", text: `我要買 ${product.name}` },
          { label: "成分", text: `${product.name} 成分` },
          { label: "怎麼使用", text: `${product.name} 使用方式` }
        ]
      );
    }

    return replyTextWithQuickReply(
      event.replyToken,
      buildOfferText(null),
      [
        { label: "龜鹿膏組合", text: "龜鹿膏 搭配組合" },
        { label: "龜鹿飲組合", text: "龜鹿飲 搭配組合" },
        { label: "龜鹿湯塊組合", text: "龜鹿湯塊 搭配組合" },
        { label: "鹿茸粉組合", text: "鹿茸粉 搭配組合" }
      ]
    );
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

  if (intent === "hesitate") {
    if (product) {
      state.lastProduct = product;
      return replyTextWithQuickReply(
        event.replyToken,
        buildHesitateText(product),
        [
          { label: "看價格", text: `${product.name} 價格` },
          { label: "看組合", text: `${product.name} 搭配組合` },
          { label: "我要買", text: `我要買 ${product.name}` },
          { label: "幫我推薦", text: "幫我推薦" }
        ]
      );
    }

    return replyTextWithQuickReply(
      event.replyToken,
      buildHesitateText(null),
      [
        { label: "先看單品", text: "看產品" },
        { label: "看搭配組合", text: "看搭配組合" },
        { label: "幫我推薦", text: "幫我推薦" }
      ]
    );
  }

  if (intent === "order") {
    const orderProduct = product || state.lastProduct;
    if (!orderProduct) {
      return replyTextWithQuickReply(
        event.replyToken,
        "你想下單哪一個呢？請直接點選：",
        [
          { label: "龜鹿膏", text: "我要買 龜鹿膏" },
          { label: "龜鹿飲", text: "我要買 龜鹿飲" },
          { label: "龜鹿湯塊", text: "我要買 龜鹿湯塊" },
          { label: "鹿茸粉", text: "我要買 鹿茸粉" }
        ]
      );
    }
    startOrder(state, orderProduct.name);
    return replyText(event.replyToken, `好的，我幫你登記 ${orderProduct.name}。\n請先回覆收件姓名。`);
  }

  if (product && ["spec", "usage", "ingredients", "detail"].includes(intent)) {
    state.lastProduct = product;
    return replyTextWithQuickReply(
      event.replyToken,
      buildProductDetail(product, intent),
      [
        { label: "價格", text: `${product.name} 價格` },
        { label: "成分", text: `${product.name} 成分` },
        { label: "怎麼使用", text: `${product.name} 使用方式` },
        { label: "我要買", text: `我要買 ${product.name}` }
      ]
    );
  }

  if (product) {
    state.lastProduct = product;
    return replyTextWithQuickReply(
      event.replyToken,
      buildProductSummary(product),
      [
        { label: "價格", text: `${product.name} 價格` },
        { label: "成分", text: `${product.name} 成分` },
        { label: "怎麼使用", text: `${product.name} 使用方式` },
        { label: "看搭配組合", text: `${product.name} 搭配組合` },
        { label: "我要買", text: `我要買 ${product.name}` }
      ]
    );
  }

  if (["spec", "usage", "ingredients"].includes(intent) && state.lastProduct) {
    return replyTextWithQuickReply(
      event.replyToken,
      buildProductDetail(state.lastProduct, intent),
      [
        { label: "價格", text: `${state.lastProduct.name} 價格` },
        { label: "我要買", text: `我要買 ${state.lastProduct.name}` },
        { label: "看搭配組合", text: `${state.lastProduct.name} 搭配組合` }
      ]
    );
  }

  if (msg.includes("影片")) {
    return replyTextWithQuickReply(
      event.replyToken,
      "官網影片頁已整理公開影片，可直接查看：\nhttps://ts15825868.github.io/xianjiawei/videos.html",
      DATA.quickReplies.main
    );
  }

  return replyTextWithQuickReply(
    event.replyToken,
    buildDefaultText(),
    DATA.quickReplies.main
  );
}

function getUserState(userId) {
  if (!users[userId]) {
    users[userId] = {
      history: [],
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
  if (/(規格|容量|幾g|幾cc|重量)/.test(msg)) return "spec";
  if (/(怎麼吃|怎麼用|怎麼使用|使用方式|使用|食用|喝法)/.test(msg)) return "usage";
  if (/(成分|內容物|原料)/.test(msg)) return "ingredients";
  if (/(價格|價錢|售價|多少錢|費用)/.test(msg)) return "price";
  if (/(搭配組合|看搭配組合|組合|搭配|套餐|搭配組|套組|買多少|送幾罐|贈送|優惠)/.test(msg)) return "offer";
  if (/(付款|匯款|貨到付款|付款方式)/.test(msg)) return "payment";
  if (/(宅配|賣貨便|7-11|711|超商|配送|運送|寄送|親送|雙北)/.test(msg)) return "shipping";
  if (/(faq|常見問題|問題)/.test(msg)) return "faq";
  if (/(聯絡|line|客服)/.test(msg)) return "contact";
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

function buildRecommendText() {
  const lines = ["我幫你快速整理：", ""];
  for (const item of DATA.recommend) {
    lines.push(`・${item.keyword} → ${item.result}`);
    lines.push(`  ${item.desc}`);
  }
  lines.push("", "也可以直接點下面按鈕，我再幫你往下整理。");
  return lines.join("\n");
}

function buildFaqText() {
  return DATA.faqs.map((f) => `Q：${f.q}\nA：${f.a}`).join("\n\n");
}

function buildPaymentText() {
  return `付款方式目前可安排：\n・${DATA.payments.join("\n・")}\n\n若要直接下單，可先告訴我想買的品項與數量。`;
}

function buildShippingText() {
  const lines = ["配送方式目前可安排：", ...DATA.shipping.map((x) => `・${x}`), ""];
  if (DATA.shippingNotes) {
    Object.entries(DATA.shippingNotes).forEach(([k, v]) => {
      lines.push(`${k}：${v}`);
    });
  }
  return lines.join("\n");
}

function buildProductSummary(product) {
  return `${product.name}
規格：${product.size}
${product.description}

你可以直接再點下面按鈕查看價格、成分、使用方式或下單。`;
}

function buildProductDetail(product, intent) {
  if (intent === "spec") return `${product.name} 的規格是 ${product.size}。`;
  if (intent === "ingredients") return `${product.name} 成分：\n${product.ingredients.join("、")}`;
  if (intent === "usage") return `${product.name} 使用方式：\n${product.usage.map((x) => `・${x}`).join("\n")}`;
  return `${buildProductSummary(product)}\n\n成分：${product.ingredients.join("、")}`;
}

function buildOfferText(product) {
  const offers = DATA.offers || {};
  const comboOffers = offers.comboOffers || [];

  if (!product) {
    const lines = ["目前可參考這幾種搭配方式：", ""];
    comboOffers.forEach((offer) => {
      lines.push(`【${offer.name}】`);
      lines.push(`內容：${offer.items.join("＋")}`);
      if (offer.gift) lines.push(`附贈：${offer.gift}`);
      if (offer.desc) lines.push(offer.desc);
      lines.push("");
    });
    lines.push("你也可以直接點產品，我再幫你看該產品目前有沒有搭配方式。");
    return lines.join("\n").trim();
  }

  const relatedComboOffers = comboOffers.filter((offer) =>
    (offer.items || []).some((item) => item.includes(product.name))
  );

  const lines = [`${product.name} 目前可參考：`, ""];

  if (relatedComboOffers.length) {
    lines.push("【搭配組合】");
    relatedComboOffers.forEach((offer) => {
      lines.push(`・${offer.name}`);
      lines.push(`  內容：${offer.items.join("＋")}`);
      if (offer.gift) lines.push(`  附贈：${offer.gift}`);
      if (offer.desc) lines.push(`  ${offer.desc}`);
    });
  } else {
    lines.push("目前這項沒有另外設定組合方式。");
  }

  return lines.join("\n").trim();
}

function buildHesitateText(product) {
  const retention = DATA.retentionOffers || {};
  const triggerText =
    retention.triggerText ||
    "如果您是第一次想試，這邊可以幫您安排成比較好入手的方式🙂";

  if (product) {
    const extra = (retention.products && retention.products[product.name]) || "";
    const lines = [
      "我理解，第一次看價格會想先評估🙂",
      "",
      "仙加味這邊比較重視原料、型態與日常安排方式，所以平常不會做太多大幅促銷。",
      triggerText
    ];

    if (extra) {
      lines.push("", `${product.name} 這邊可協助安排：`, `・${extra}`);
    }

    lines.push("", "如果您想，我也可以再幫您看搭配組合。");
    return lines.join("\n");
  }

  const comboRetention = retention.combos || {};
  const comboNames = Object.keys(comboRetention);

  const lines = [
    "我理解，第一次看價格會想先評估🙂",
    "",
    "仙加味這邊比較重視原料、型態與日常安排方式，所以平常不會做太多大幅促銷。",
    triggerText
  ];

  if (comboNames.length) {
    lines.push("", "若您是在評估搭配方式，也可參考：");
    comboNames.forEach((name) => {
      lines.push(`・${name}：${comboRetention[name]}`);
    });
  }

  lines.push("", "您可以直接點下面想看的方向，我再幫您整理。");
  return lines.join("\n");
}

function buildDefaultText() {
  return DATA.welcomeText || "您好，歡迎來到仙加味🙂";
}

function buildQuickReply(items) {
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
    return replyText(event.replyToken, "收到。請回覆收件地址。");
  }

  if (state.order.step === 3) {
    state.order.address = raw;
    state.order.step = 4;
    return replyText(event.replyToken, "收到。請回覆付款方式：匯款／貨到付款");
  }

  if (state.order.step === 4) {
    state.order.payment = raw;
    state.order.step = 5;
    return replyText(event.replyToken, "收到。請回覆配送方式：宅配／7-11賣貨便／雙北親送");
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
地址：${order.address}
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
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(data)
    });
  } catch (e) {
    console.error("CRM error", e.message);
  }
}

function replyText(replyToken, text) {
  return client.replyMessage(replyToken, {
    type: "text",
    text
  });
}

function replyTextWithQuickReply(replyToken, text, quickReplyItems) {
  return client.replyMessage(replyToken, {
    type: "text",
    text,
    quickReply: buildQuickReply(quickReplyItems)
  });
}

function replyFlexWithQuickReply(replyToken, flexPayload, quickReplyItems) {
  if (!flexPayload) {
    return replyTextWithQuickReply(replyToken, buildDefaultText(), DATA.quickReplies.main);
  }
  return client.replyMessage(replyToken, {
    ...flexPayload,
    quickReply: buildQuickReply(quickReplyItems)
  });
}

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`TS-LINE bot listening on ${port}`));
