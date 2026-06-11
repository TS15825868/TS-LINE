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
  console.warn("CHANNEL_ACCESS_TOKEN / CHANNEL_SECRET 尚未設定，請至 Render Environment 設定。");
}

function loadData() {
  const dataPath = fs.existsSync(path.join(__dirname, "data.json"))
    ? path.join(__dirname, "data.json")
    : path.join(__dirname, "products.json");

  const data = JSON.parse(fs.readFileSync(dataPath, "utf8"));

  data.combos = data.combos || (data.offers && data.offers.comboOffers) || [];

  data.shipping = data.shipping || [
    "宅配",
    "7-11賣貨便",
    "門市自取",
    "雙北親送",
  ];

  data.payments = data.payments || [
    "匯款",
    "貨到付款",
  ];

  data.products = (data.products || []).map((p) => ({
    ...p,
    spec: p.spec || p.size || "",
    displayName: p.displayName || p.name,
    imageUrl:
      p.imageUrl ||
      ((data.siteUrl || "https://ts15825868.github.io/xianjiawei/") +
        (p.image || "images/logo.png")),
  }));

  return data;
}

const DATA = loadData();
const CRM_URL = process.env.CRM_URL || "https://script.google.com/macros/s/AKfycbwAFBxeROd2ZYGJ_h0O7_H2MMxptOMoj3EXIErZpbKuTYFOzOVwQkrk8X1MoxapkHVGSA/exec";

const app = express();
const client = new line.Client(config);
const states = new Map();

function money(n) {
  return `$${Number(n || 0).toLocaleString("zh-TW")}`;
}

function getState(userId) {
  if (!states.has(userId)) {
    states.set(userId, { cart: [], checkout: null, welcomed: false });
  }
  return states.get(userId);
}

function cleanName(text) {
  return String(text || "")
    .replace(/我要買|我要|加入清單|加入購買清單|直接買|只買|看|了解|刪除|移除/g, "")
    .trim();
}

function productByName(text) {
  const raw = cleanName(text);

  return DATA.products.find((p) => {
    const name = p.name || "";
    const displayName = p.displayName || "";
    const aliases = p.aliases || [];

    return (
      name === raw ||
      displayName === raw ||
      String(text).includes(name) ||
      String(text).includes(displayName) ||
      aliases.some((a) => raw.includes(a) || String(text).includes(a))
    );
  });
}

function comboByName(text) {
  const raw = cleanName(text);

  return DATA.combos.find((c) => {
    const aliases = c.aliases || [];
    return (
      c.name === raw ||
      String(text).includes(c.name) ||
      aliases.some((a) => raw.includes(a) || String(text).includes(a))
    );
  });
}

function itemPriceByName(name) {
  if (/30cc|玻璃瓶/.test(name)) return 50;
  if (/180cc|鋁袋/.test(name)) return 200;
  if (/龜鹿膏/.test(name)) return 2000;
  if (/龜鹿湯塊/.test(name)) return 2000;
  if (/鹿茸粉/.test(name)) return 2000;
  if (/龜鹿膠/.test(name)) return 15000;
  return 0;
}

function cartItemFromProduct(p) {
  const name = p.displayName || p.name;
  return {
    type: "product",
    id: p.id,
    name,
    qty: 1,
    price: p.price || itemPriceByName(`${name}${p.spec || p.size || ""}`),
  };
}

function cartItemFromCombo(c) {
  return {
    type: "combo",
    id: c.name,
    name: c.name,
    qty: 1,
    price: c.price || 0,
  };
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

  const lines = cart.map((i, idx) => {
    const subtotal = (i.price || 0) * (i.qty || 1);
    const priceText = subtotal ? `　${money(subtotal)}` : "";
    return `${idx + 1}. ${i.name} × ${i.qty}${priceText}`;
  });

  const total = cartTotal(cart);

  return `目前購買清單：\n\n${lines.join("\n")}\n\n預估合計：${money(total)}\n\n實際金額、活動與配送方式會由客服再協助確認。`;
}

function qr(items) {
  return {
    items: items.slice(0, 13).map((i) => ({
      type: "action",
      action: { type: "message", label: i.label, text: i.text },
    })),
  };
}

function textMsg(text, quick) {
  const m = { type: "text", text };
  if (quick) m.quickReply = qr(quick);
  return m;
}

function productFlex(p) {
  const price = "價格與搭配方案請洽官方 LINE";

  return {
    type: "bubble",
    size: "mega",
    hero: {
      type: "image",
      url: p.imageUrl,
      size: "full",
      aspectRatio: "1:1",
      aspectMode: "cover",
    },
    body: {
      type: "box",
      layout: "vertical",
      spacing: "md",
      contents: [
        {
          type: "text",
          text: p.displayName || p.name,
          weight: "bold",
          size: "xl",
          wrap: true,
        },
        {
          type: "text",
          text: p.description || "",
          wrap: true,
          size: "sm",
          color: "#555555",
        },
        {
          type: "text",
          text: `規格：${p.spec || p.size || ""}`,
          wrap: true,
          size: "sm",
          color: "#555555",
        },
        {
          type: "text",
          text: price,
          wrap: true,
          weight: "bold",
          color: "#7B1E1E",
        },
      ],
    },
    footer: {
      type: "box",
      layout: "vertical",
      spacing: "sm",
      contents: [
        {
          type: "button",
          style: "primary",
          color: "#7B1E1E",
          action: {
            type: "message",
            label: "加入清單",
            text: `加入清單 ${p.displayName || p.name}`,
          },
        },
        {
          type: "button",
          style: "secondary",
          action: {
            type: "message",
            label: "直接買",
            text: `直接買 ${p.displayName || p.name}`,
          },
        },
        {
          type: "button",
          style: "link",
          action: {
            type: "message",
            label: "查看清單",
            text: "查看購買清單",
          },
        },
      ],
    },
  };
}

function productCarousel(products = DATA.products) {
  return {
    type: "flex",
    altText: "仙加味產品",
    contents: {
      type: "carousel",
      contents: products.map(productFlex),
    },
  };
}

function comboFlex(c) {
  const body = [
    `內容：${(c.items || []).join("＋")}`,
    c.desc || "",
    "套餐活動依數量與配送方式，由客服協助確認。",
  ]
    .filter(Boolean)
    .join("\n");

  return {
    type: "bubble",
    body: {
      type: "box",
      layout: "vertical",
      spacing: "md",
      contents: [
        { type: "text", text: c.name, weight: "bold", size: "xl" },
        { type: "text", text: body, wrap: true, size: "sm", color: "#555555" },
      ],
    },
    footer: {
      type: "box",
      layout: "vertical",
      spacing: "sm",
      contents: [
        {
          type: "button",
          style: "primary",
          color: "#7B1E1E",
          action: {
            type: "message",
            label: "加入清單",
            text: `加入清單 ${c.name}`,
          },
        },
        {
          type: "button",
          style: "secondary",
          action: {
            type: "message",
            label: "直接買",
            text: `直接買 ${c.name}`,
          },
        },
        {
          type: "button",
          style: "link",
          action: {
            type: "message",
            label: "查看清單",
            text: "查看購買清單",
          },
        },
      ],
    },
  };
}

function comboCarousel() {
  return {
    type: "flex",
    altText: "仙加味搭配組合",
    contents: {
      type: "carousel",
      contents: DATA.combos.map(comboFlex),
    },
  };
}

function priceQuick() {
  return [
    { label: "單項售價", text: "單項售價" },
    { label: "套餐售價", text: "套餐售價" },
    { label: "看產品", text: "看產品" },
  ];
}

function singlePriceReply() {
  return `【仙加味｜單項售價與活動】

龜鹿飲 30cc玻璃瓶
單瓶 50元
12瓶 500元
24瓶 900元

龜鹿飲 180cc鋁袋
單包 200元
6包 1000元
12包 1800元

龜鹿膏 100g
單罐 2000元
2罐優惠請洽客服

龜鹿湯塊 75g（8入）
單盒 2000元
2盒優惠請洽客服

鹿茸粉 75g
單罐 2000元
2罐優惠請洽客服

龜鹿膠 一斤裝
單盒 15000元
大量／通路合作請洽客服`;
}

function comboPriceReply() {
  return `【仙加味｜套餐搭配】

日常節奏組
龜鹿膏＋龜鹿飲
適合想建立固定日常節奏的人。

養生燉湯組
龜鹿湯塊＋鹿茸粉
適合喜歡燉湯、料理與熱飲搭配的人。

完整體驗組
龜鹿膏＋龜鹿飲＋龜鹿湯塊＋鹿茸粉
適合第一次想完整比較龜鹿系列的人。

專業補養組
龜鹿膠＋龜鹿湯塊
適合固定使用者、家庭使用與通路合作。

套餐優惠會依數量、配送方式與活動內容，由客服協助確認。`;
}

function offerQuick() {
  return [
    { label: "龜鹿膏", text: "龜鹿膏" },
    { label: "龜鹿飲", text: "龜鹿飲" },
    { label: "龜鹿湯塊", text: "龜鹿湯塊" },
    { label: "龜鹿膠", text: "龜鹿膠" },
    { label: "鹿茸粉", text: "鹿茸粉" },
  ];
}

function mainQuick() {
  return [
    { label: "看產品", text: "看產品" },
    { label: "單項售價", text: "單項售價" },
    { label: "套餐售價", text: "套餐售價" },
    { label: "查看清單", text: "查看購買清單" },
    { label: "直接下單", text: "我想直接下單" },
  ];
}

function cartActions(state) {
  if (!state.cart.length) {
    return [
      { label: "看產品", text: "看產品" },
      { label: "套餐售價", text: "套餐售價" },
    ];
  }

  return [
    { label: "繼續加商品", text: "看產品" },
    { label: "移除商品", text: "移除商品" },
    { label: "清空清單", text: "清空購買清單" },
    { label: "直接結帳", text: "直接結帳" },
  ];
}

function isOfferQuestion(msg) {
  return /優惠|折扣|活動|比較便宜|便宜一點|買多|方案|有比較划算|有沒有優惠|能不能便宜/.test(
    msg
  );
}

function reply(token, messages) {
  return client.replyMessage(token, Array.isArray(messages) ? messages : [messages]);
}

app.get("/", (req, res) => res.send("仙加味 LINE Bot is running"));
app.get("/healthz", (req, res) =>
  res.json({ ok: true, time: new Date().toISOString() })
);

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
  if (event.type === "follow") {
    return reply(
      event.replyToken,
      textMsg(
        "歡迎來到仙加味・龜鹿🙂\n可以直接點下面按鈕，不用自己打字。",
        mainQuick()
      )
    );
  }

  if (event.type !== "message" || event.message.type !== "text") return;

  const userId = event.source.userId;
  const state = getState(userId);
  const msg = event.message.text.trim();
  state.welcomed = true;

  if (/價格|售價|價錢|多少錢/.test(msg)) {
    return reply(event.replyToken, textMsg("請問想了解哪一種價格？", priceQuick()));
  }

  if (/單項售價|單品售價|單項價格/.test(msg)) {
    return reply(event.replyToken, textMsg(singlePriceReply(), mainQuick()));
  }

  if (/套餐售價|套餐價格|搭配售價|搭配價格/.test(msg)) {
    return reply(event.replyToken, textMsg(comboPriceReply(), mainQuick()));
  }

  if (isOfferQuestion(msg)) {
    return reply(
      event.replyToken,
      textMsg("目前會依搭配方式、數量與需求協助整理較適合的方案🙂\n你想先了解哪一項呢？", [
        { label: "單項活動", text: "單項售價" },
        { label: "套餐搭配", text: "套餐售價" },
        { label: "看產品", text: "看產品" },
      ])
    );
  }

  if (/龜鹿膠|湯塊跟膠|湯塊.*膠|膠.*湯塊|差別/.test(msg)) {
    return reply(
      event.replyToken,
      textMsg(
        "龜鹿湯塊與龜鹿膠使用相同原料與製程，內容物相同，差異在包裝方式與規格。\n\n龜鹿湯塊：75g精品小包裝，方便燉湯與沖泡。\n\n龜鹿膠：一斤裝，適合固定使用、家庭使用與通路合作。",
        mainQuick()
      )
    );
  }

  if (/配送|運費|寄送|親送|宅配/.test(msg)) {
    return reply(
      event.replyToken,
      textMsg(
        "【配送方式】\n\n✓ 宅配\n✓ 7-11賣貨便\n✓ 萬華門市自取\n✓ 雙北地區可安排親送\n\n詳細配送與運費由客服協助確認。",
        mainQuick()
      )
    );
  }

  if (/^(清空購買清單|清空清單|清空購物清單)$/.test(msg)) {
    state.cart = [];
    state.checkout = null;
    return reply(
      event.replyToken,
      textMsg("購買清單已清空，可以重新挑選🙂", [
        { label: "看產品", text: "看產品" },
        { label: "套餐售價", text: "套餐售價" },
      ])
    );
  }

  if (msg === "移除商品") {
    if (!state.cart.length) {
      return reply(event.replyToken, textMsg("目前購買清單是空的。", mainQuick()));
    }

    return reply(
      event.replyToken,
      textMsg(
        "要移除哪一個？",
        state.cart.map((i) => ({
          label: i.name.slice(0, 20),
          text: `刪除 ${i.name}`,
        }))
      )
    );
  }

  if (msg.startsWith("刪除 ") || msg.startsWith("移除 ")) {
    const name = msg.replace(/^刪除\s*|^移除\s*/, "").trim();
    const before = state.cart.length;
    state.cart = state.cart.filter((i) => i.name !== name);

    if (state.cart.length === before) {
      return reply(
        event.replyToken,
        textMsg("購買清單裡沒有這個品項🙂", [
          { label: "查看清單", text: "查看購買清單" },
          { label: "看產品", text: "看產品" },
        ])
      );
    }

    return reply(
      event.replyToken,
      textMsg(`${name} 已移除。\n\n${cartText(state.cart)}`, cartActions(state))
    );
  }

  if (state.checkout && !["看產品", "看搭配組合", "查看購買清單", "取消"].includes(msg)) {
    return continueCheckout(event, state, msg);
  }

  if (msg === "取消") {
    state.checkout = null;
    return reply(event.replyToken, textMsg("已取消本次下單流程。", mainQuick()));
  }

  if (msg === "看產品" || msg === "直接下單" || msg === "我想直接下單") {
    return reply(event.replyToken, productCarousel());
  }

  if (msg === "看搭配組合" || msg === "搭配組合") {
    return reply(event.replyToken, comboCarousel());
  }

  if (msg === "查看購買清單" || msg === "查看清單") {
    return reply(event.replyToken, textMsg(cartText(state.cart), cartActions(state)));
  }

  if (msg === "直接結帳") {
    return startCheckout(event, state);
  }

  if (msg.startsWith("加入清單") || msg.startsWith("加入購買清單")) {
    const p = productByName(msg);
    const c = comboByName(msg);

    if (!p && !c) {
      return reply(
        event.replyToken,
        textMsg("找不到要加入的品項，請再點一次商品或套餐。", mainQuick())
      );
    }

    const item = c ? cartItemFromCombo(c) : cartItemFromProduct(p);
    addToCart(state, item);

    return reply(
      event.replyToken,
      textMsg(`${item.name} 已加入購買清單🙂\n\n${cartText(state.cart)}`, cartActions(state))
    );
  }

  if (msg.startsWith("直接買") || msg.startsWith("我要買") || msg.startsWith("我要 ")) {
    const p = productByName(msg);
    const c = comboByName(msg);

    if (!p && !c) {
      return reply(
        event.replyToken,
        textMsg("可以先看產品或搭配組合，再點按鈕直接加入。", mainQuick())
      );
    }

    const item = c ? cartItemFromCombo(c) : cartItemFromProduct(p);

    if (state.cart.length) {
      return reply(
        event.replyToken,
        textMsg(`你目前購買清單裡已有品項。\n要把「${item.name}」加入清單，還是只買這個？`, [
          { label: "加入清單", text: `加入清單 ${item.name}` },
          { label: "只買這個", text: `只買 ${item.name}` },
          { label: "查看清單", text: "查看購買清單" },
        ])
      );
    }

    state.cart = [item];
    return startCheckout(event, state);
  }

  if (msg.startsWith("只買 ")) {
    const p = productByName(msg);
    const c = comboByName(msg);

    if (!p && !c) {
      return reply(event.replyToken, textMsg("找不到這個品項，請再點一次。", mainQuick()));
    }

    state.cart = [c ? cartItemFromCombo(c) : cartItemFromProduct(p)];
    return startCheckout(event, state);
  }

  if (/懷孕|哺乳|高血壓|糖尿病|心臟|腎臟|肝|癌|化療|服藥|吃藥|藥物|手術|禁忌|副作用|診斷|醫師|醫生/.test(msg)) {
    return reply(
      event.replyToken,
      textMsg(
        "這部分會因每個人的身體狀況不同，建議先由合作中醫師協助了解，會比較準確🙂\n\n章無忌中醫師 LINE：@changwuchi\nhttps://lin.ee/1MK4NR9",
        mainQuick()
      )
    );
  }

  if (/推薦|怎麼選|適合哪個|不知道|Google|廣告|網站|食補|調養/.test(msg)) {
    return reply(
      event.replyToken,
      textMsg(
        "我先幫你用生活方式整理👇\n\n想固定節奏 → 龜鹿膏\n想方便快速 → 龜鹿飲\n想放進料理 → 龜鹿湯塊\n想固定使用或通路合作 → 龜鹿膠（一斤裝）\n想自己搭配 → 鹿茸粉",
        [
          { label: "看產品", text: "看產品" },
          { label: "單項售價", text: "單項售價" },
          { label: "套餐售價", text: "套餐售價" },
        ]
      )
    );
  }

  const p = productByName(msg);
  if (p) {
    return reply(event.replyToken, {
      type: "flex",
      altText: p.displayName,
      contents: productFlex(p),
    });
  }

  if (msg === "直接填單") {
    return reply(
      event.replyToken,
      textMsg(
        "你也可以直接照這個格式回覆👇\n\n姓名：\n電話：\n地址／門市：\n付款：匯款／貨到付款\n配送：宅配／7-11賣貨便／門市自取／雙北親送\n商品：",
        mainQuick()
      )
    );
  }

  return reply(event.replyToken, textMsg("可以直接點下面按鈕，我幫你整理🙂", mainQuick()));
}

function startCheckout(event, state) {
  if (!state.cart.length) {
    return reply(
      event.replyToken,
      textMsg("目前購買清單是空的，先看產品或搭配組合。", mainQuick())
    );
  }

  state.checkout = {
    step: "name",
    name: "",
    phone: "",
    address: "",
    payment: "",
    shipping: "",
  };

  return reply(
    event.replyToken,
    textMsg(`${cartText(state.cart)}\n\n請先回覆收件姓名。`, [
      { label: "看產品", text: "看產品" },
      { label: "查看清單", text: "查看購買清單" },
      { label: "取消", text: "取消" },
    ])
  );
}

async function continueCheckout(event, state, msg) {
  const ck = state.checkout;

  if (ck.step === "name") {
    ck.name = msg;
    ck.step = "phone";
    return reply(event.replyToken, textMsg("收到。請回覆收件電話。", [{ label: "取消", text: "取消" }]));
  }

  if (ck.step === "phone") {
    ck.phone = msg;
    ck.step = "address";
    return reply(
      event.replyToken,
      textMsg("收到。請回覆收件地址、7-11門市資訊，或雙北親送地址。", [
        { label: "取消", text: "取消" },
      ])
    );
  }

  if (ck.step === "address") {
    ck.address = msg;
    ck.step = "payment";
    return reply(
      event.replyToken,
      textMsg(
        "請選擇付款方式：",
        (DATA.payments || ["匯款", "貨到付款"]).map((x) => ({
          label: x,
          text: `付款 ${x}`,
        }))
      )
    );
  }

  if (ck.step === "payment") {
    ck.payment = msg.replace(/^付款\s*/, "");
    ck.step = "shipping";
    return reply(
      event.replyToken,
      textMsg(
        "請選擇配送方式：",
        (DATA.shipping || ["宅配", "7-11賣貨便", "門市自取", "雙北親送"]).map((x) => ({
          label: x.slice(0, 20),
          text: `配送 ${x}`,
        }))
      )
    );
  }

  if (ck.step === "shipping") {
    ck.shipping = msg.replace(/^配送\s*/, "");
    ck.step = "confirm";

    return reply(
      event.replyToken,
      textMsg(
        `請確認訂單👇\n\n${cartText(state.cart)}\n\n姓名：${ck.name}\n電話：${ck.phone}\n地址／門市：${ck.address}\n付款：${ck.payment}\n配送：${ck.shipping}`,
        [
          { label: "確認送出", text: "確認送出" },
          { label: "修改清單", text: "查看購買清單" },
          { label: "取消", text: "取消" },
        ]
      )
    );
  }

  if (ck.step === "confirm" && msg === "確認送出") {
    const summary = {
      cart: state.cart,
      total: cartTotal(state.cart),
      ...ck,
      createdAt: new Date().toISOString(),
    };

    await saveCRM(summary);

    state.cart = [];
    state.checkout = null;

    return reply(
      event.replyToken,
      textMsg("已收到你的資料，我們會再為你確認金額、活動與配送安排🙂", mainQuick())
    );
  }

  return reply(
    event.replyToken,
    textMsg("請依照按鈕或提示回覆。", [
      { label: "確認送出", text: "確認送出" },
      { label: "取消", text: "取消" },
    ])
  );
}

async function saveCRM(data) {
  if (!CRM_URL) return;

  try {
    await fetch(CRM_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
  } catch (e) {
    console.error("CRM error", e);
  }
}

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`仙加味 LINE Bot v109 running on ${port}`));
