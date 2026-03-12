/* eslint-disable no-console */
"use strict";

const express = require("express");
const line = require("@line/bot-sdk");
const https = require("https");
const http = require("http");
const fs = require("fs");
const path = require("path");

const {
  STORE,
  DOCTOR,
  FAQ,
  BUY_WORDS,
  DANGER_WORDS,
  MENU_WORDS
} = require("./config");

const {
  LINE_CHANNEL_ACCESS_TOKEN,
  LINE_CHANNEL_SECRET,
  CHANNEL_ACCESS_TOKEN,
  CHANNEL_SECRET,
  PRODUCTS_URL,
  PORT
} = process.env;

const ACCESS_TOKEN = LINE_CHANNEL_ACCESS_TOKEN || CHANNEL_ACCESS_TOKEN || "";
const CHANNEL_SEC = LINE_CHANNEL_SECRET || CHANNEL_SECRET || "";

const config = {
  channelAccessToken: ACCESS_TOKEN,
  channelSecret: CHANNEL_SEC
};

const client = new line.Client(config);

if (!ACCESS_TOKEN || !CHANNEL_SEC) {
  console.warn("[WARN] 缺少 LINE 金鑰，請設定 LINE_CHANNEL_ACCESS_TOKEN / LINE_CHANNEL_SECRET");
}

const PRODUCTS_URL_FALLBACK = PRODUCTS_URL || "";
const LOCAL_PRODUCTS_PATH = path.join(__dirname, "products.json");

const app = express();

app.get("/", (_req, res) => {
  res.status(200).send("TS LINE OA is running.");
});

app.get("/health", (_req, res) => {
  res.status(200).json({ ok: true });
});

app.post("/webhook", line.middleware(config), async (req, res) => {
  try {
    await Promise.all((req.body.events || []).map(handleEvent));
    res.status(200).end();
  } catch (err) {
    console.error("[webhook error]", err);
    res.status(500).end();
  }
});

function normalizeText(s) {
  return String(s || "")
    .replace(/\u3000/g, " ")
    .replace(/[，,、／/]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function safeText(s, max = 60) {
  const t = String(s || "");
  return t.length > max ? t.slice(0, max - 1) + "…" : t;
}

function lowerIncludesAny(text, list) {
  const t = String(text || "").toLowerCase();
  return list.some((w) => t.includes(String(w).toLowerCase()));
}

function fetchJson(url, timeoutMs = 6500) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith("https") ? https : http;
    const req = lib.get(url, (res) => {
      let data = "";
      res.on("data", (c) => (data += c));
      res.on("end", () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    });
    req.on("error", reject);
    req.setTimeout(timeoutMs, () => req.destroy(new Error("fetch timeout")));
  });
}

async function getProducts() {
  try {
    if (PRODUCTS_URL_FALLBACK) {
      return await fetchJson(PRODUCTS_URL_FALLBACK);
    }
  } catch (e) {
    console.error("[products remote failed]", e.message);
  }

  try {
    const raw = fs.readFileSync(LOCAL_PRODUCTS_PATH, "utf8");
    return JSON.parse(raw);
  } catch (e) {
    console.error("[products local failed]", e.message);
    return { categories: [] };
  }
}

function flattenProducts(data) {
  const rows = [];
  for (const category of data.categories || []) {
    for (const item of category.items || []) {
      rows.push({
        ...item,
        _categoryId: category.id,
        _categoryName: category.name
      });
    }
  }
  return rows;
}

function findProduct(flat, text) {
  const t = normalizeText(text);
  const lower = t.toLowerCase();

  let direct = flat.find((p) => lower === String(p.name || "").toLowerCase());
  if (direct) return direct;

  direct = flat.find((p) => (p.aliases || []).some((a) => lower.includes(String(a).toLowerCase())));
  if (direct) return direct;

  direct = flat.find((p) => lower.includes(String(p.name || "").toLowerCase()));
  if (direct) return direct;

  return null;
}

function looksSensitive(text) {
  return lowerIncludesAny(text, DANGER_WORDS);
}

function looksBuyIntent(text) {
  return lowerIncludesAny(text, BUY_WORDS);
}

function looksMenu(text) {
  return lowerIncludesAny(text, MENU_WORDS);
}

function faqHit(text) {
  const t = normalizeText(text);
  return FAQ.find((f) => (f.keywords || []).some((k) => t.includes(k)));
}

function makeText(text) {
  return { type: "text", text };
}

function makeButtons({ title, text, actions, thumbnailImageUrl }) {
  const template = {
    type: "buttons",
    title: safeText(title, 40),
    text: safeText(text, 160),
    actions: actions.slice(0, 4)
  };
  if (thumbnailImageUrl) template.thumbnailImageUrl = thumbnailImageUrl;

  return {
    type: "template",
    altText: `${title}`,
    template
  };
}

function makeCarousel(columns) {
  return {
    type: "template",
    altText: "產品選單",
    template: {
      type: "carousel",
      columns: columns.slice(0, 10)
    }
  };
}

function postbackAction(label, data, displayText = label) {
  return {
    type: "postback",
    label: safeText(label, 20),
    data,
    displayText
  };
}

function uriAction(label, uri) {
  return {
    type: "uri",
    label: safeText(label, 20),
    uri
  };
}

function messageAction(label, text) {
  return {
    type: "message",
    label: safeText(label, 20),
    text
  };
}

function mainMenuCard() {
  return makeButtons({
    title: STORE.brandName,
    text: "請選擇功能🙂",
    actions: [
      messageAction("產品介紹", "產品介紹"),
      messageAction("產品比較", "產品比較"),
      messageAction("推薦組合", "推薦組合"),
      messageAction("飲食建議", "飲食建議")
    ]
  });
}

function secondMenuCard() {
  return makeButtons({
    title: "更多",
    text: "也可以看門市 / 官網🙂",
    actions: [
      messageAction("成分規格", "成分規格"),
      messageAction("聯絡門市", "聯絡門市"),
      messageAction("中醫師諮詢", "中醫師諮詢"),
      messageAction("更多", "更多")
    ]
  });
}

function moreMenuCard() {
  return makeButtons({
    title: "更多",
    text: "也可以看門市 / 官網🙂",
    actions: [
      uriAction("官網", STORE.website),
      uriAction("加入 LINE", STORE.lineLink),
      uriAction("一鍵來電", `tel:${STORE.phoneTel}`),
      uriAction("地圖", STORE.mapUrl)
    ]
  });
}

function productMenuCarousel(flat) {
  const columns = flat.slice(0, 10).map((p) => ({
    thumbnailImageUrl: p.imageUrl || p.image || undefined,
    title: safeText(p.fullName || p.name, 40),
    text: safeText(`${p.spec || ""}\n${p.shortIntro || p.intro || p.description || "查看產品資訊"}`, 60),
    actions: [
      postbackAction("查看介紹", `product:${p.id}`, `查看 ${p.name}`),
      postbackAction("成分規格", `ingredient:${p.id}`, `${p.name} 成分規格`),
      postbackAction("怎麼吃", `usage:${p.id}`, `${p.name} 怎麼吃`)
    ]
  }));
  return makeCarousel(columns);
}

function compareMenuCard() {
  return makeButtons({
    title: "產品比較",
    text: "想先比哪一種？🙂",
    actions: [
      messageAction("膏 vs 飲", "膏跟飲差別"),
      messageAction("膏 vs 湯塊", "膏跟湯塊差別"),
      messageAction("飲 vs 湯塊", "飲跟湯塊差別"),
      messageAction("粉類比較", "粉類比較")
    ]
  });
}

function recommendMenuCard() {
  return makeButtons({
    title: "補養推薦組合",
    text: "直接選一種🙂",
    actions: [
      messageAction("日常補養組", "日常補養組"),
      messageAction("加強搭配組", "加強搭配組"),
      messageAction("長輩溫和組", "長輩溫和組"),
      messageAction("回選單", "選單")
    ]
  });
}

function foodMenuCard() {
  return makeButtons({
    title: "飲食建議",
    text: "想先看哪一種？🙂",
    actions: [
      messageAction("補養建議（綜合版）", "補養建議"),
      messageAction("季節推薦", "季節推薦"),
      messageAction("燉煮建議", "燉煮建議"),
      messageAction("常見問題 FAQ", "FAQ")
    ]
  });
}

function ingredientMenuCard() {
  return makeButtons({
    title: "成分規格",
    text: "想先看哪一項？🙂",
    actions: [
      messageAction("龜鹿膏成分", "龜鹿膏成分"),
      messageAction("龜鹿飲成分", "龜鹿飲成分"),
      messageAction("龜鹿湯塊成分", "龜鹿湯塊成分"),
      messageAction("調飲粉成分", "龜鹿調飲粉成分")
    ]
  });
}

function contactCard() {
  return makeButtons({
    title: "聯絡門市",
    text: `${STORE.address}\n${STORE.phoneDisplay}`,
    actions: [
      uriAction("官網", STORE.website),
      uriAction("加入 LINE", STORE.lineLink),
      uriAction("一鍵來電", `tel:${STORE.phoneTel}`),
      uriAction("地圖", STORE.mapUrl)
    ]
  });
}

function doctorCard() {
  return makeButtons({
    title: "中醫師諮詢",
    text: "若是個人身體狀況、適不適合食用、慢性病、用藥等問題，建議先由合作中醫師一對一說明🙂",
    actions: [
      uriAction("加入中醫師 LINE", DOCTOR.link),
      messageAction("回選單", "選單")
    ]
  });
}

function productIntroText(p) {
  const lines = [];
  lines.push(`${p.fullName || p.name}`);
  if (p.spec) lines.push(`【規格】${p.spec}`);
  if (p.intro) lines.push(`【介紹】${p.intro}`);
  if (p.priceText) lines.push(`【價格】${p.priceText}`);
  if (p.priceNote) lines.push(`${p.priceNote}`);
  return lines.join("\n");
}

function productIngredientText(p) {
  const ingredients = (p.ingredients || []).join("、") || "以實際包裝標示為準";
  const lines = [];
  lines.push(`${p.fullName || p.name}`);
  if (p.spec) lines.push(`【規格】${p.spec}`);
  lines.push(`【成分】${ingredients}`);
  lines.push(STORE.infoDisclaimer);
  return lines.join("\n");
}

function productUsageText(p) {
  const usage = (p.usage || []).map((x) => `• ${x}`).join("\n");
  const lines = [];
  lines.push(`${p.fullName || p.name}`);
  lines.push("【食用建議】");
  lines.push(usage || "• 可依個人習慣與需求調整");
  if (p.usageNote) lines.push(p.usageNote);
  lines.push(STORE.foodDisclaimer);
  return lines.join("\n");
}

function compareReply(text) {
  const t = normalizeText(text);

  if (t.includes("膏跟飲") || t.includes("膏 飲") || t.includes("膏vs飲")) {
    return makeText(
      "【龜鹿膏 vs 龜鹿飲】\n\n" +
      "龜鹿膏：濃縮膏狀型態，適合固定時間直接食用或熱水攪拌。\n" +
      "龜鹿飲：液態即飲型態，適合開封即飲、攜帶方便。\n\n" +
      "簡單分法🙂\n" +
      "想固定吃 → 龜鹿膏\n" +
      "想方便喝 → 龜鹿飲"
    );
  }

  if (t.includes("膏跟湯塊") || t.includes("膏 湯塊")) {
    return makeText(
      "【龜鹿膏 vs 龜鹿湯塊】\n\n" +
      "龜鹿膏：偏日常直接食用 / 熱水攪拌。\n" +
      "龜鹿湯塊：偏料理搭配，可煮雞湯、排骨湯。\n\n" +
      "想方便直接食用 → 龜鹿膏\n" +
      "想煮湯搭配 → 龜鹿湯塊"
    );
  }

  if (t.includes("飲跟湯塊") || t.includes("飲 湯塊")) {
    return makeText(
      "【龜鹿飲 vs 龜鹿湯塊】\n\n" +
      "龜鹿飲：開封即可飲用，適合即飲情境。\n" +
      "龜鹿湯塊：適合燉煮料理，偏雞湯 / 排骨湯使用。\n\n" +
      "想直接喝 → 龜鹿飲\n" +
      "想料理搭配 → 龜鹿湯塊"
    );
  }

  if (t.includes("粉類比較")) {
    return makeText(
      "【鹿茸粉 vs 龜鹿調飲粉】\n\n" +
      "鹿茸粉：較偏單純粉末型態，可搭熱飲或日常飲食。\n" +
      "龜鹿調飲粉：偏飲品情境，可加入茶、咖啡或熱水沖泡。\n\n" +
      "想要較單純粉類 → 鹿茸粉\n" +
      "想要更方便做飲品 → 龜鹿調飲粉"
    );
  }

  return null;
}

function ingredientQuestionReply(text, flat) {
  const t = normalizeText(text);

  if (t.includes("成分一樣") || t.includes("一樣嗎")) {
    return makeText(
      "【龜鹿膏 / 龜鹿飲 成分差異】\n\n" +
      "龜鹿膏與龜鹿飲的主要方向相近，差別在於龜鹿飲是液態型態，會多了「水」。\n\n" +
      "龜鹿膏成分：龜板萃取物、鹿角萃取物、粉光蔘、枸杞、紅棗、黃耆\n" +
      "龜鹿飲成分：水、龜板萃取物、鹿角萃取物、粉光蔘、枸杞、紅棗、黃耆\n\n" +
      STORE.infoDisclaimer
    );
  }

  if (t.includes("龜鹿膏成分")) {
    const p = flat.find((x) => x.id === "guilu-gao");
    if (p) return makeText(productIngredientText(p));
  }

  if (t.includes("龜鹿飲成分")) {
    const p = flat.find((x) => x.id === "guilu-drink");
    if (p) return makeText(productIngredientText(p));
  }

  if (t.includes("龜鹿湯塊成分")) {
    const p = flat.find((x) => x.id === "guilu-block");
    if (p) return makeText(productIngredientText(p));
  }

  if (t.includes("龜鹿調飲粉成分") || t.includes("調飲粉成分")) {
    const p = flat.find((x) => x.id === "guilu-mix");
    if (p) return makeText(productIngredientText(p));
  }

  return null;
}

function promoReply() {
  return makeText(
    "目前優惠與搭配方案，會依門市、LINE 與活動檔期不同而調整🙂\n\n" +
    "建議直接私訊我們，由專人幫您看目前較適合的方案。\n\n" +
    "可直接點下方：\n" +
    `加入 LINE：${STORE.lineLink}\n\n` +
    STORE.priceNote
  );
}

function northReply() {
  return makeText(
    "我們門市在北部🙂\n\n" +
    `【地址】${STORE.address}\n` +
    `【電話】${STORE.phoneDisplay}\n` +
    `【官網】${STORE.website}\n` +
    `【LINE】${STORE.lineId}\n\n` +
    STORE.deliverNote
  );
}

function recommendReply(text) {
  const t = normalizeText(text);

  if (t.includes("日常補養組")) {
    return makeText(
      "【日常補養組】\n\n" +
      "• 龜鹿膏\n" +
      "• 龜鹿飲\n\n" +
      "適合想以膏＋飲方式整理日常使用節奏的人。"
    );
  }

  if (t.includes("加強搭配組")) {
    return makeText(
      "【加強搭配組】\n\n" +
      "• 龜鹿膏\n" +
      "• 龜鹿湯塊\n" +
      "• 鹿茸粉\n\n" +
      "適合想搭配日常食用與燉湯料理的人。"
    );
  }

  if (t.includes("長輩溫和組")) {
    return makeText(
      "【長輩溫和組】\n\n" +
      "• 龜鹿飲\n" +
      "• 龜鹿湯塊\n\n" +
      "偏向飲用與燉湯情境，較方便依日常生活安排。"
    );
  }

  return null;
}

function foodReply(text) {
  const t = normalizeText(text);

  if (t.includes("補養建議")) {
    return makeText(
      "【補養建議（綜合版）】\n\n" +
      "• 想直接吃：可看龜鹿膏\n" +
      "• 想方便喝：可看龜鹿飲\n" +
      "• 想煮湯搭配：可看龜鹿湯塊\n" +
      "• 想粉末熱飲：可看鹿茸粉 / 龜鹿調飲粉"
    );
  }

  if (t.includes("季節推薦")) {
    return makeText(
      "【季節推薦】\n\n" +
      "天氣較涼或想以溫熱方式整理飲食時，可優先看：\n" +
      "• 龜鹿膏熱水攪拌\n" +
      "• 龜鹿飲溫飲\n" +
      "• 龜鹿湯塊燉湯\n" +
      "• 鹿茸粉 / 調飲粉搭熱飲"
    );
  }

  if (t.includes("燉煮建議")) {
    return makeText(
      "【燉煮建議】\n\n" +
      "龜鹿湯塊適合：\n" +
      "• 雞湯\n" +
      "• 排骨湯\n" +
      "• 日常燉煮料理\n\n" +
      "可依份量選 75 g / 300 g / 600 g。"
    );
  }

  if (t.includes("faq")) {
    return makeText("可直接回覆「FAQ」或點選常見問題查看🙂");
  }

  return null;
}

async function handleTextMessage(text) {
  const data = await getProducts();
  const flat = flattenProducts(data);
  const t = normalizeText(text);

  if (looksSensitive(t)) {
    return [makeText(DOCTOR.message), doctorCard()];
  }

  if (looksMenu(t) || t === "你好" || t === "哈囉" || t === "您好") {
    return [
      makeText("您好🙂 回「選單」可查看功能。"),
      mainMenuCard(),
      secondMenuCard()
    ];
  }

  if (t === "更多") {
    return [moreMenuCard()];
  }

  if (t === "產品介紹") {
    return [productMenuCarousel(flat), makeText("可直接點產品查看介紹、成分規格與食用方式🙂")];
  }

  if (t === "產品比較") {
    return [compareMenuCard()];
  }

  if (t === "推薦組合") {
    return [recommendMenuCard()];
  }

  if (t === "飲食建議" || t === "食用建議") {
    return [foodMenuCard()];
  }

  if (t === "成分規格") {
    return [ingredientMenuCard()];
  }

  if (t === "聯絡門市") {
    return [contactCard()];
  }

  if (t === "中醫師諮詢") {
    return [makeText(DOCTOR.message), doctorCard()];
  }

  if (t === "官網") {
    return [makeText(`官網：${STORE.website}`), moreMenuCard()];
  }

  if (t === "加入 line" || t === "加入line") {
    return [makeText(`加入 LINE：${STORE.lineLink}`), moreMenuCard()];
  }

  if (t === "一鍵來電" || t === "電話" || t === "來電") {
    return [makeText(`電話：${STORE.phoneDisplay}`), moreMenuCard()];
  }

  if (t === "地圖" || t === "地址") {
    return [makeText(`地址：${STORE.address}\n地圖：${STORE.mapUrl}`), moreMenuCard()];
  }

  const faq = faqHit(t);
  if (faq) {
    return [makeText(faq.reply)];
  }

  const ingredientReply = ingredientQuestionReply(t, flat);
  if (ingredientReply) return [ingredientReply];

  const compare = compareReply(t);
  if (compare) return [compare];

  const recom = recommendReply(t);
  if (recom) return [recom];

  const food = foodReply(t);
  if (food) return [food];

  if (looksBuyIntent(t)) {
    return [
      makeText(
        "想購買沒問題🙂\n\n" +
        "可直接私訊我們，由專人幫您整理目前適合的規格、搭配方式與活動方案。\n\n" +
        `加入 LINE：${STORE.lineLink}`
      ),
      contactCard()
    ];
  }

  if (
    t.includes("優惠") ||
    t.includes("活動") ||
    t.includes("更優惠") ||
    t.includes("便宜") ||
    t.includes("折扣")
  ) {
    return [promoReply(), contactCard()];
  }

  if (
    t.includes("北部") ||
    t.includes("台北") ||
    t.includes("萬華") ||
    t.includes("門市") ||
    t.includes("店面")
  ) {
    return [northReply(), contactCard()];
  }

  const product = findProduct(flat, t);
  if (product) {
    return [
      makeText(productIntroText(product)),
      makeButtons({
        title: product.fullName || product.name,
        text: "請選擇🙂",
        thumbnailImageUrl: product.imageUrl || product.image || undefined,
        actions: [
          postbackAction("成分規格", `ingredient:${product.id}`, `${product.name} 成分規格`),
          postbackAction("怎麼吃", `usage:${product.id}`, `${product.name} 怎麼吃`),
          messageAction("回選單", "選單")
        ]
      })
    ];
  }

  return [
    makeText("您好🙂 回「選單」查看功能。"),
    mainMenuCard(),
    secondMenuCard()
  ];
}

async function handlePostback(dataRaw) {
  const data = await getProducts();
  const flat = flattenProducts(data);

  const raw = String(dataRaw || "");

  if (raw.startsWith("product:")) {
    const id = raw.replace("product:", "");
    const p = flat.find((x) => x.id === id);
    if (!p) return [makeText("找不到這個產品🙂")];
    return [
      makeText(productIntroText(p)),
      makeButtons({
        title: p.fullName || p.name,
        text: "請選擇🙂",
        thumbnailImageUrl: p.imageUrl || p.image || undefined,
        actions: [
          postbackAction("成分規格", `ingredient:${p.id}`, `${p.name} 成分規格`),
          postbackAction("怎麼吃", `usage:${p.id}`, `${p.name} 怎麼吃`),
          messageAction("回選單", "選單")
        ]
      })
    ];
  }

  if (raw.startsWith("ingredient:")) {
    const id = raw.replace("ingredient:", "");
    const p = flat.find((x) => x.id === id);
    if (!p) return [makeText("找不到這個產品🙂")];
    return [makeText(productIngredientText(p))];
  }

  if (raw.startsWith("usage:")) {
    const id = raw.replace("usage:", "");
    const p = flat.find((x) => x.id === id);
    if (!p) return [makeText("找不到這個產品🙂")];
    return [makeText(productUsageText(p))];
  }

  return [makeText("您好🙂 回「選單」查看功能。")];
}

async function handleEvent(event) {
  if (event.type === "postback") {
    const messages = await handlePostback(event.postback?.data);
    return client.replyMessage(event.replyToken, messages);
  }

  if (event.type !== "message" || event.message.type !== "text") {
    return Promise.resolve(null);
  }

  const messages = await handleTextMessage(event.message.text);
  return client.replyMessage(event.replyToken, messages.slice(0, 5));
}

app.listen(PORT || 3000, () => {
  console.log(`TS LINE OA running on ${PORT || 3000}`);
});
