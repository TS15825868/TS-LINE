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

  data.products = (data.products || []).map((p) => ({
    ...p,
    spec: p.spec || p.size || "",
    displayName: p.displayName || p.name,
    imageUrl:
      p.imageUrl ||
      ((data.siteUrl || "https://ts15825868.github.io/xianjiawei/") +
        (p.image || "images/logo.png")),
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
  if (!states.has(userId)) {
    states.set(userId, { cart: [], checkout: null });
  }
  return states.get(userId);
}

function qr(items) {
  return {
    items: items.slice(0, 13).map((i) => ({
      type: "action",
      action: {
        type: "message",
        label: i.label,
        text: i.text,
      },
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

function cleanName(text) {
  return String(text || "")
    .replace(
      /我要買|我要|加入清單|加入購買清單|直接買|只買|建議售價|活動優惠|食用方式|看|了解|刪除|移除/g,
      ""
    )
    .trim();
}

function productByName(text) {
  const raw = cleanName(text);

  return DATA.products.find((p) => {
    return (
      p.name === raw ||
      p.displayName === raw ||
      String(text).includes(p.name) ||
      String(text).includes(p.displayName) ||
      (p.aliases || []).some((a) => raw.includes(a) || String(text).includes(a))
    );
  });
}

function comboByName(text) {
  const raw = cleanName(text);

  return DATA.combos.find((c) => {
    return (
      c.name === raw ||
      String(text).includes(c.name) ||
      (c.aliases || []).some((a) => raw.includes(a) || String(text).includes(a))
    );
  });
}

function cartItemFromProduct(p) {
  return {
    type: "product",
    id: p.id,
    name: p.displayName || p.name,
    qty: 1,
    price: p.price || 0,
  };
}

function cartItemFromCombo(c) {
  return {
    type: "combo",
    id: c.id || c.name,
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
    return `${idx + 1}. ${i.name} × ${i.qty}${i.price ? "\n" + money(subtotal) : ""}`;
  });

  return `目前購買清單：

${lines.join("\n\n")}

預估合計：${money(cartTotal(cart))}

實際金額、活動與配送方式會由客服再協助確認。`;
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
  return state.cart.length
    ? [
        { label: "繼續加商品", text: "看產品" },
        { label: "移除商品", text: "移除商品" },
        { label: "清空清單", text: "清空購買清單" },
        { label: "直接結帳", text: "直接結帳" },
      ]
    : [
        { label: "看產品", text: "看產品" },
        { label: "套餐售價", text: "套餐售價" },
      ];
}

function productPriceText(p) {
  const activity =
    p.activity && p.activity.length
      ? `\n\n活動優惠：\n${p.activity.map((x) => `・${x}`).join("\n")}`
      : "";

  return `【${p.displayName || p.name}】

規格：${p.spec || p.size || ""}
建議售價：${money(p.price)} / ${p.unit || "件"}${activity}

配送方式：
✓ 宅配
✓ 7-11賣貨便
✓ 門市自取
✓ 雙北親送`;
}

function productActivityText(p) {
  if (p.activity && p.activity.length) {
    return `【${p.displayName || p.name}｜活動優惠】

${p.activity.map((x) => `・${x}`).join("\n")}

單品建議售價：${money(p.price)} / ${p.unit || "件"}

實際活動與配送方式由客服協助確認。`;
  }

  return `【${p.displayName || p.name}｜活動優惠】

目前多入優惠請洽客服確認。

單品建議售價：${money(p.price)} / ${p.unit || "件"}`;
}

function productUsageText(p) {
  const ing =
    p.ingredients && p.ingredients.length
      ? `\n\n成分：${p.ingredients.join("、")}`
      : "";

  return `【${p.displayName || p.name}｜食用方式】

${(p.usage || []).join("\n\n")}${ing}`;
}

function productFlex(p) {
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
          text: "價格、活動與搭配方案可點下方按鈕查看",
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
            label: "立即下單",
            text: `直接買 ${p.displayName || p.name}`,
          },
        },
        {
          type: "button",
          style: "link",
          action: {
            type: "message",
            label: "建議售價",
            text: `建議售價 ${p.displayName || p.name}`,
          },
        },
        {
          type: "button",
          style: "link",
          action: {
            type: "message",
            label: "活動優惠",
            text: `活動優惠 ${p.displayName || p.name}`,
          },
        },
        {
          type: "button",
          style: "link",
          action: {
            type: "message",
            label: "食用方式",
            text: `食用方式 ${p.displayName || p.name}`,
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
    c.priceNote || "套餐優惠依數量與配送方式，由客服協助確認。",
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
            label: "立即下單",
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

龜鹿湯塊 75g（2兩／8塊）
單盒 2000元
2盒優惠請洽客服

鹿茸粉 75g
單罐 2000元
2罐優惠請洽客服

龜鹿膠 600g（一斤裝／32塊）
單盒 15000元
大量／通路合作請洽客服`;
}

function comboPriceReply() {
  return `【仙加味｜套餐搭配】

日常節奏組
龜鹿膏＋龜鹿飲

養生燉湯組
龜鹿湯塊＋鹿茸粉

完整體驗組
龜鹿膏＋龜鹿飲＋龜鹿湯塊＋鹿茸粉

專業補養組
龜鹿膠＋龜鹿湯塊

套餐優惠會依數量、配送方式與活動內容，由客服協助確認。`;
}

function priceQuick() {
  return [
    { label: "單項售價", text: "單項售價" },
    { label: "套餐售價", text: "套餐售價" },
    { label: "看產品", text: "看產品" },
  ];
}

function isOfferQuestion(msg) {
  return /優惠|折扣|活動|比較便宜|便宜一點|買多|方案|有比較划算|有沒有優惠|能不能便宜/.test(
    msg
  );
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
          {
            type: "text",
            text: title,
            weight: "bold",
            size: "xl",
            color: "#7B1E1E",
            wrap: true,
          },
          {
            type: "text",
            text: desc,
            size: "sm",
            color: "#555555",
            wrap: true,
          },
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
          action: {
            type: "message",
            label: b.label,
            text: b.text,
          },
        })),
      },
    },
  };
}

function orderConfirmFlex(state, ck) {
  return {
    type: "flex",
    altText: "請確認訂單",
    contents: {
      type: "bubble",
      body: {
        type: "box",
        layout: "vertical",
        spacing: "md",
        contents: [
          {
            type: "text",
            text: "請確認訂單",
            weight: "bold",
            size: "xl",
            color: "#7B1E1E",
          },
          {
            type: "text",
            text: cartText(state.cart),
            wrap: true,
            size: "sm",
          },
          {
            type: "separator",
          },
          {
            type: "text",
            text: `姓名：${ck.name}
電話：${ck.phone}
地址／門市：${ck.address}
付款：${ck.payment}
配送：${ck.shipping}`,
            wrap: true,
            size: "sm",
            color: "#555555",
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
              label: "確認送出",
              text: "確認送出",
            },
          },
          {
            type: "button",
            style: "secondary",
            action: {
              type: "message",
              label: "取消",
              text: "取消",
            },
          },
        ],
      },
    },
  };
}

async function saveCRM(data) {
  if (!CRM_URL) return;

  try {
    await fetch(CRM_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    });
  } catch (e) {
    console.error("CRM error", e);
  }
}

app.get("/", (req, res) => res.send("仙加味 LINE Bot is running"));

app.get("/healthz", (req, res) => {
  res.json({
    ok: true,
    time: new Date().toISOString(),
  });
});

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
      textMsg("歡迎來到仙加味・龜鹿🙂\n可以直接點下面按鈕，不用自己打字。", mainQuick())
    );
  }

  if (event.type !== "message" || event.message.type !== "text") return;

  const userId = event.source.userId;
  const state = getState(userId);
  const msg = event.message.text.trim();

  if (msg.startsWith("建議售價")) {
    const p = productByName(msg);
    return reply(event.replyToken, textMsg(p ? productPriceText(p) : "請先點產品卡上的建議售價按鈕。", mainQuick()));
  }

  if (msg.startsWith("活動優惠")) {
    const p = productByName(msg);
    return reply(event.replyToken, textMsg(p ? productActivityText(p) : "請先點產品卡上的活動優惠按鈕。", mainQuick()));
  }

  if (msg.startsWith("食用方式")) {
    const p = productByName(msg);
    return reply(event.replyToken, textMsg(p ? productUsageText(p) : "請先點產品卡上的食用方式按鈕。", mainQuick()));
  }

  if (/單項售價|單品售價|單項價格/.test(msg)) {
    return reply(event.replyToken, textMsg(singlePriceReply(), mainQuick()));
  }

  if (/套餐售價|套餐價格|搭配售價|搭配價格/.test(msg)) {
    return reply(event.replyToken, textMsg(comboPriceReply(), mainQuick()));
  }

  if (/價格|售價|價錢|多少錢/.test(msg)) {
    return reply(event.replyToken, textMsg("請問想了解哪一種價格？", priceQuick()));
  }

  if (isOfferQuestion(msg)) {
    return reply(event.replyToken, textMsg("目前會依搭配方式、數量與需求協助整理較適合的方案🙂", priceQuick()));
  }

  if (/龜鹿膠|湯塊跟膠|湯塊.*膠|膠.*湯塊|差別/.test(msg)) {
    return reply(
      event.replyToken,
      textMsg(
        "龜鹿湯塊與龜鹿膠使用相同原料與製程，內容物相同，差異在包裝方式與規格。\n\n龜鹿湯塊：75g（2兩／8塊，每塊約9.375g）\n\n龜鹿膠：600g（一斤裝／32塊，每塊約18.75g）",
        mainQuick()
      )
    );
  }

  if (/配送|運費|寄送|親送|宅配/.test(msg)) {
    return reply(
      event.replyToken,
      checkoutCard("配送方式", "請選擇你方便的配送方式。", [
        { label: "宅配", text: "宅配" },
        { label: "7-11賣貨便", text: "7-11賣貨便" },
        { label: "門市自取", text: "門市自取" },
        { label: "雙北親送", text: "雙北親送" },
      ])
    );
  }

  if (/^(清空購買清單|清空清單|清空購物清單)$/.test(msg)) {
    state.cart = [];
    state.checkout = null;
    return reply(event.replyToken, textMsg("購買清單已清空，可以重新挑選🙂", cartActions(state)));
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
    state.cart = state.cart.filter((i) => i.name !== name);
    return reply(event.replyToken, textMsg(`${name} 已移除。\n\n${cartText(state.cart)}`, cartActions(state)));
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
      return reply(event.replyToken, textMsg("找不到要加入的品項，請再點一次商品或套餐。", mainQuick()));
    }

    const item = c ? cartItemFromCombo(c) : cartItemFromProduct(p);
    addToCart(state, item);

    return reply(event.replyToken, textMsg(`${item.name} 已加入購買清單🙂\n\n${cartText(state.cart)}`, cartActions(state)));
  }

  if (msg.startsWith("直接買") || msg.startsWith("我要買") || msg.startsWith("我要 ")) {
    const p = productByName(msg);
    const c = comboByName(msg);

    if (!p && !c) {
      return reply(event.replyToken, textMsg("可以先看產品或搭配組合，再點按鈕直接加入。", mainQuick()));
    }

    state.cart = [c ? cartItemFromCombo(c) : cartItemFromProduct(p)];
    return startCheckout(event, state);
  }

  const p = productByName(msg);
  if (p) {
    return reply(event.replyToken, {
      type: "flex",
      altText: p.displayName,
      contents: productFlex(p),
    });
  }

  return reply(event.replyToken, textMsg("可以直接點下面按鈕，我幫你整理🙂", mainQuick()));
}

function startCheckout(event, state) {
  if (!state.cart.length) {
    return reply(event.replyToken, textMsg("目前購買清單是空的，先看產品或搭配組合。", mainQuick()));
  }

  state.checkout = {
    step: "name",
    name: "",
    phone: "",
    address: "",
    payment: "",
    shipping: "",
  };

  return reply(event.replyToken, [
    textMsg(cartText(state.cart)),
    checkoutCard("填寫收件姓名", "請直接回覆收件人姓名。", [
      { label: "取消", text: "取消" },
    ]),
  ]);
}

async function continueCheckout(event, state, msg) {
  const ck = state.checkout;
  const text = msg.trim();

  if (ck.step === "name") {
    ck.name = text;
    ck.step = "phone";
    return reply(event.replyToken, checkoutCard("填寫收件電話", "請直接回覆收件人電話。", [
      { label: "取消", text: "取消" },
    ]));
  }

  if (ck.step === "phone") {
    ck.phone = text;
    ck.step = "address";
    return reply(event.replyToken, checkoutCard("填寫收件地址", "請回覆收件地址、7-11門市資訊，或門市自取備註。", [
      { label: "取消", text: "取消" },
    ]));
  }

  if (ck.step === "address") {
    ck.address = text;
    ck.step = "payment";
    return reply(event.replyToken, checkoutCard("選擇付款方式", "請選擇付款方式。", [
      { label: "匯款", text: "匯款" },
      { label: "貨到付款", text: "貨到付款" },
      { label: "取消", text: "取消" },
    ]));
  }

  if (ck.step === "payment") {
    if (/匯款/.test(text)) ck.payment = "匯款";
    else if (/貨到付款|貨付|到付/.test(text)) ck.payment = "貨到付款";
    else {
      return reply(event.replyToken, checkoutCard("選擇付款方式", "請選擇付款方式。", [
        { label: "匯款", text: "匯款" },
        { label: "貨到付款", text: "貨到付款" },
        { label: "取消", text: "取消" },
      ]));
    }

    ck.step = "shipping";
    return reply(event.replyToken, checkoutCard("選擇配送方式", "請選擇配送方式。", [
      { label: "宅配", text: "宅配" },
      { label: "7-11賣貨便", text: "7-11賣貨便" },
      { label: "門市自取", text: "門市自取" },
      { label: "雙北親送", text: "雙北親送" },
      { label: "取消", text: "取消" },
    ]));
  }

  if (ck.step === "shipping") {
    if (/宅配/.test(text)) ck.shipping = "宅配";
    else if (/7-11|711|賣貨便|超商/.test(text)) ck.shipping = "7-11賣貨便";
    else if (/自取|門市/.test(text)) ck.shipping = "門市自取";
    else if (/雙北|親送/.test(text)) ck.shipping = "雙北親送";
    else {
      return reply(event.replyToken, checkoutCard("選擇配送方式", "請選擇配送方式。", [
        { label: "宅配", text: "宅配" },
        { label: "7-11賣貨便", text: "7-11賣貨便" },
        { label: "門市自取", text: "門市自取" },
        { label: "雙北親送", text: "雙北親送" },
        { label: "取消", text: "取消" },
      ]));
    }

    ck.step = "confirm";
    return reply(event.replyToken, orderConfirmFlex(state, ck));
  }

  if (ck.step === "confirm") {
    if (!/確認送出|確認|送出/.test(text)) {
      return reply(event.replyToken, orderConfirmFlex(state, ck));
    }

    const summary = {
      cart: state.cart,
      total: cartTotal(state.cart),
      ...ck,
      createdAt: new Date().toISOString(),
    };

    await saveCRM(summary);

    state.cart = [];
    state.checkout = null;

    return reply(event.replyToken, textMsg("已收到你的資料，我們會再為你確認金額、活動與配送安排🙂", mainQuick()));
  }
}

const port = process.env.PORT || 3000;

app.listen(port, () => {
  console.log(`仙加味 LINE Bot running on ${port}`);
});
