"use strict";

const express = require("express");
const line = require("@line/bot-sdk");
const https = require("https");
const http = require("http");

/* =========================
   環境變數
========================= */

const {
  LINE_CHANNEL_ACCESS_TOKEN,
  LINE_CHANNEL_SECRET,
  CHANNEL_ACCESS_TOKEN,
  CHANNEL_SECRET,
  PRODUCTS_URL,
  PORT,
} = process.env;

const ACCESS_TOKEN = LINE_CHANNEL_ACCESS_TOKEN || CHANNEL_ACCESS_TOKEN;
const CHANNEL_SEC = LINE_CHANNEL_SECRET || CHANNEL_SECRET;

if (!ACCESS_TOKEN || !CHANNEL_SEC) {
  console.warn(
    "[WARN] 缺少 LINE 金鑰：請在 Render 設定 LINE_CHANNEL_ACCESS_TOKEN / LINE_CHANNEL_SECRET"
  );
}

const config = {
  channelAccessToken: ACCESS_TOKEN || "",
  channelSecret: CHANNEL_SEC || "",
};

const client = new line.Client(config);

/* =========================
   基本資訊
========================= */

const STORE = {
  brandName: "仙加味・龜鹿",
  address: "台北市萬華區西昌街 52 號",
  phone: "(02) 2381-2990",
  phoneTel: "0223812990",
  website: "https://ts15825868.github.io/TaiShing/index.html",
  productsUrlDefault: "https://ts15825868.github.io/TaiShing/products.json",
  mapUrl:
    "https://www.google.com/maps/search/?api=1&query=%E5%8F%B0%E5%8C%97%E5%B8%82%E8%90%AC%E8%8F%AF%E5%8D%80%E8%A5%BF%E6%98%8C%E8%A1%97+52+%E8%99%9F",
  priceNote:
    "※ 不同通路/搭配方案可能略有差異，依現場或回覆為準🙂",
  infoDisclaimer: "※ 產品資訊以實際包裝標示為準（不同批次可能略有差異）。",
};

const PRODUCTS_JSON_URL = PRODUCTS_URL || STORE.productsUrlDefault;

/* =========================
   抓 products.json（快取）
========================= */

let cache = { at: 0, data: null };

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    if (!url) return resolve({ categories: [] });
    const lib = url.startsWith("https") ? https : http;

    lib
      .get(url, (res) => {
        let data = "";
        res.on("data", (c) => (data += c));
        res.on("end", () => {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            resolve({ categories: [] });
          }
        });
      })
      .on("error", () => resolve({ categories: [] }));
  });
}

async function getProducts() {
  const ttl = 5 * 60 * 1000;
  if (Date.now() - cache.at < ttl && cache.data) return cache.data;

  const data = await fetchJson(PRODUCTS_JSON_URL);
  cache = { at: Date.now(), data };
  return data;
}

function flattenProducts(data) {
  const list = [];
  for (const c of data.categories || []) {
    for (const item of c.items || []) {
      list.push(item);
    }
  }
  return list;
}

function money(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return "—";
  return "$" + x.toLocaleString();
}

function calcDiscount(msrp, d) {
  const m = Number(msrp);
  const disc = Number(d);
  if (!Number.isFinite(m) || !Number.isFinite(disc)) return null;
  return Math.round(m * disc);
}

function norm(s) {
  return String(s || "").trim();
}

/* =========================
   找產品（用名稱模糊匹配）
========================= */

function findProductByName(flat, nameRaw) {
  const name = norm(nameRaw);
  if (!name) return null;

  // 先完全等於
  let p = flat.find((x) => norm(x.name) === name);
  if (p) return p;

  // 再包含
  p = flat.find((x) => name.includes(norm(x.name)));
  if (p) return p;

  // 再反向包含
  p = flat.find((x) => norm(x.name).includes(name));
  if (p) return p;

  // 湯塊別名（你之前常用）
  if (name.includes("湯塊") || name.includes("仙膠") || name.includes("二仙膠") || name.includes("龜鹿膠")) {
    return flat.find((x) => norm(x.name).includes("龜鹿湯塊"));
  }

  return null;
}

/* =========================
   主選單卡
========================= */

function mainMenuCard() {
  return {
    type: "template",
    altText: "主選單",
    template: {
      type: "buttons",
      title: STORE.brandName,
      text: "想先看哪個？直接點就好🙂",
      actions: [
        { type: "message", label: "產品介紹", text: "產品介紹" },
        { type: "message", label: "產品規格", text: "產品規格" },
        { type: "message", label: "看價格", text: "看價格" },
        { type: "message", label: "怎麼購買", text: "怎麼購買" },
        { type: "message", label: "門市資訊", text: "門市資訊" },
      ].slice(0, 4), // buttons 最多 4 個，所以下面會另外補一張輔助卡
    },
  };
}

// 因為 buttons 一張最多 4 個 action，所以補第二張（讓老人家一眼可點）
function mainMenuCard2() {
  return {
    type: "template",
    altText: "更多選單",
    template: {
      type: "buttons",
      title: STORE.brandName,
      text: "更多功能🙂",
      actions: [
        { type: "message", label: "門市資訊", text: "門市資訊" },
        { type: "uri", label: "地圖", uri: STORE.mapUrl },
        { type: "uri", label: "一鍵來電", uri: `tel:${STORE.phoneTel}` },
        { type: "uri", label: "官網", uri: STORE.website },
      ],
    },
  };
}

/* =========================
   操作卡（回覆後給客人繼續點）
========================= */

function actionCard(productName) {
  return {
    type: "template",
    altText: "操作選單",
    template: {
      type: "buttons",
      title: productName || STORE.brandName,
      text: "接下來想看什麼？🙂",
      actions: productName
        ? [
            { type: "message", label: "看介紹", text: `介紹 ${productName}` },
            { type: "message", label: "看規格", text: `規格 ${productName}` },
            { type: "message", label: "看價格", text: `價格 ${productName}` },
            { type: "message", label: "回主選單", text: "選單" },
          ]
        : [
            { type: "message", label: "產品介紹", text: "產品介紹" },
            { type: "message", label: "產品規格", text: "產品規格" },
            { type: "message", label: "看價格", text: "看價格" },
            { type: "message", label: "回主選單", text: "選單" },
          ],
    },
  };
}

/* =========================
   產品列表（carousel：最多 10 欄）
========================= */

async function productsCarousel() {
  const data = await getProducts();
  const flat = flattenProducts(data);

  // 你主力四品（固定順序）
  const wanted = ["龜鹿膏", "龜鹿飲", "鹿茸粉", "龜鹿湯塊（膠）"];
  const items = wanted.map((n) => flat.find((p) => p.name === n)).filter(Boolean);

  return {
    type: "template",
    altText: "產品列表",
    template: {
      type: "carousel",
      columns: items.slice(0, 10).map((p) => ({
        title: p.name,
        text: (p.intro && p.intro[0]) || "點一下就能看介紹🙂",
        actions: [
          { type: "message", label: "看介紹", text: `介紹 ${p.name}` },
          { type: "message", label: "看規格", text: `規格 ${p.name}` },
          { type: "message", label: "看價格", text: `價格 ${p.name}` },
        ],
      })),
    },
  };
}

/* =========================
   規格列表（卡片）
========================= */

async function specCarousel() {
  const data = await getProducts();
  const flat = flattenProducts(data);

  const wanted = ["龜鹿膏", "龜鹿飲", "鹿茸粉", "龜鹿湯塊（膠）"];
  const items = wanted.map((n) => flat.find((p) => p.name === n)).filter(Boolean);

  return {
    type: "template",
    altText: "產品規格",
    template: {
      type: "carousel",
      columns: items.slice(0, 10).map((p) => ({
        title: p.name,
        text: "點一下就能看規格🙂",
        actions: [
          { type: "message", label: "看規格", text: `規格 ${p.name}` },
          { type: "message", label: "看介紹", text: `介紹 ${p.name}` },
          { type: "message", label: "回主選單", text: "選單" },
        ],
      })),
    },
  };
}

/* =========================
   價格列表（卡片：每個產品一張）
   - 湯塊：把 variants 合併在同一張卡（避免欄數爆掉）
========================= */

async function priceCarousel() {
  const data = await getProducts();
  const flat = flattenProducts(data);

  const wanted = ["龜鹿膏", "龜鹿飲", "鹿茸粉", "龜鹿湯塊（膠）"];
  const items = wanted.map((n) => flat.find((p) => p.name === n)).filter(Boolean);

  return {
    type: "template",
    altText: "產品價格",
    template: {
      type: "carousel",
      columns: items.slice(0, 10).map((p) => {
        // 湯塊 variants
        if (p.variants && p.variants.length > 0) {
          const lines = p.variants.map((v) => {
            const act = v.discount ? calcDiscount(v.msrp, v.discount) : null;
            return `• ${v.label}\n  建議：${money(v.msrp)}${act ? `｜活動：${money(act)}` : ""}${v.note ? `\n  ${v.note}` : ""}`;
          });

          const text =
            lines.join("\n").slice(0, 55 * 10) + // 保守避免太長
            "\n" +
            STORE.priceNote;

          return {
            title: p.name,
            text: text.slice(0, 60), // LINE carousel text 有長度限制，故「詳細價格」走文字訊息
            actions: [
              { type: "message", label: "看詳細價格", text: `價格 ${p.name}` },
              { type: "message", label: "看規格", text: `規格 ${p.name}` },
              { type: "message", label: "回主選單", text: "選單" },
            ],
          };
        }

        const act = p.discount ? calcDiscount(p.msrp, p.discount) : null;
        const text =
          `建議售價：${money(p.msrp)}\n` +
          (act ? `活動價：${money(act)}` : "") +
          `\n${STORE.priceNote}`;

        return {
          title: p.name,
          text: text.trim().slice(0, 60),
          actions: [
            { type: "message", label: "看詳細價格", text: `價格 ${p.name}` },
            { type: "message", label: "看規格", text: `規格 ${p.name}` },
            { type: "message", label: "回主選單", text: "選單" },
          ],
        };
      }),
    },
  };
}

/* =========================
   介紹/規格/價格（文字回覆）
========================= */

async function introText(name) {
  const data = await getProducts();
  const flat = flattenProducts(data);
  const p = findProductByName(flat, name);
  if (!p) return "找不到產品🙂 你可以點「產品介紹」再選。";

  const lines = [];
  lines.push(`【${p.name}】`);

  if (p.intro && p.intro.length) {
    lines.push(p.intro.map((x) => `• ${x}`).join("\n"));
  }

  if (p.ingredients && p.ingredients.length) {
    lines.push("");
    lines.push("成分：");
    lines.push(p.ingredients.map((x) => `• ${x}`).join("\n"));
  }

  if (p.usage && p.usage.length) {
    lines.push("");
    lines.push("食用建議：");
    lines.push(p.usage.map((x) => `• ${x}`).join("\n"));
  }

  // 湯塊 variants
  if (p.variants && p.variants.length) {
    lines.push("");
    lines.push("規格：");
    lines.push(
      p.variants
        .map((v) => `• ${v.label}${v.note ? `（${v.note}）` : ""}`)
        .join("\n")
    );
  } else if (p.spec) {
    lines.push("");
    lines.push(`規格：${p.spec}`);
  }

  lines.push("");
  lines.push(STORE.infoDisclaimer);

  return lines.join("\n").trim();
}

async function specText(name) {
  const data = await getProducts();
  const flat = flattenProducts(data);
  const p = findProductByName(flat, name);
  if (!p) return "找不到產品🙂 你可以點「產品規格」再選。";

  // 湯塊 variants
  if (p.variants && p.variants.length) {
    const lines = p.variants
      .map((v) => `• ${v.label}${v.note ? `（${v.note}）` : ""}`)
      .join("\n");
    return `【${p.name}｜規格】\n${lines}`;
  }

  return `【${p.name}｜規格】\n${p.spec || "（尚未設定規格）"}`;
}

async function priceText(name) {
  const data = await getProducts();
  const flat = flattenProducts(data);
  const p = findProductByName(flat, name);
  if (!p) return "找不到產品🙂 你可以點「看價格」再選。";

  // 湯塊 variants
  if (p.variants && p.variants.length) {
    const out = [`【${p.name}｜價格】`];
    for (const v of p.variants) {
      const act = v.discount ? calcDiscount(v.msrp, v.discount) : null;
      out.push("");
      out.push(`${v.label}`);
      out.push(`建議售價：${money(v.msrp)}`);
      if (act) out.push(`活動價：${money(act)}`);
      if (v.note) out.push(`備註：${v.note}`);
    }
    out.push("");
    out.push(STORE.priceNote);
    return out.join("\n").trim();
  }

  const act = p.discount ? calcDiscount(p.msrp, p.discount) : null;
  return [
    `【${p.name}｜價格】`,
    `建議售價：${money(p.msrp)}`,
    act ? `活動價：${money(act)}` : "",
    "",
    STORE.priceNote,
  ]
    .filter(Boolean)
    .join("\n");
}

/* =========================
   怎麼購買（卡片）
========================= */

function buyMenuCard() {
  return {
    type: "template",
    altText: "怎麼購買",
    template: {
      type: "buttons",
      title: "怎麼購買",
      text: "選一種方式，我再一步步帶你🙂",
      actions: [
        { type: "message", label: "宅配", text: "宅配" },
        { type: "message", label: "超商店到店", text: "店到店" },
        { type: "message", label: "雙北親送", text: "雙北親送" },
        { type: "message", label: "到店自取", text: "到店自取" },
      ],
    },
  };
}

function buyExplainText(method) {
  if (method === "宅配")
    return "【宅配】\n請直接貼：\n1) 要買的品項＋數量\n2) 收件姓名＋電話＋地址\n\n我看到就會幫你確認🙂";
  if (method === "店到店")
    return "【超商店到店】\n請直接貼：\n1) 要買的品項＋數量\n2) 收件姓名＋電話＋取貨門市（店名/店號/地址）\n\n我看到就會幫你確認🙂";
  if (method === "雙北親送")
    return "【雙北親送】\n請直接貼：\n1) 要買的品項＋數量\n2) 收件姓名＋電話＋地址\n\n我看到就會幫你確認能否安排親送🙂";
  if (method === "到店自取")
    return "【到店自取】\n請直接貼：\n1) 要買的品項＋數量\n2) 聯絡姓名＋電話\n\n我看到就會幫你保留並確認取貨時間🙂";
  return "你想用哪種方式買呢？🙂";
}

/* =========================
   對話邏輯
========================= */

async function handleText(text) {
  const t = norm(text);

  if (!t || t === "選單" || t === "主選單") return [mainMenuCard(), mainMenuCard2()];

  // 主功能（卡片）
  if (t === "產品介紹" || t === "產品") return [await productsCarousel()];
  if (t === "產品規格" || t === "規格") return [await specCarousel()];
  if (t === "看價格" || t === "價格") return [await priceCarousel()];
  if (t === "怎麼購買" || t === "購買" || t === "怎麼買") return [buyMenuCard()];

  // 門市資訊
  if (t === "門市資訊" || t === "門市" || t === "地址") {
    return [
      {
        type: "template",
        altText: "門市資訊",
        template: {
          type: "buttons",
          title: "門市資訊",
          text: `${STORE.address}\n${STORE.phone}\n看到會盡快回覆🙂`,
          actions: [
            { type: "uri", label: "地圖", uri: STORE.mapUrl },
            { type: "uri", label: "一鍵來電", uri: `tel:${STORE.phoneTel}` },
            { type: "uri", label: "官網", uri: STORE.website },
            { type: "message", label: "回主選單", text: "選單" },
          ],
        },
      },
    ];
  }

  // 文字直打（不強迫）
  if (t.startsWith("介紹 ")) {
    const name = t.replace("介紹 ", "").trim();
    return [{ type: "text", text: await introText(name) }, actionCard(name)];
  }
  if (t.startsWith("規格 ")) {
    const name = t.replace("規格 ", "").trim();
    return [{ type: "text", text: await specText(name) }, actionCard(name)];
  }
  if (t.startsWith("價格 ")) {
    const name = t.replace("價格 ", "").trim();
    return [{ type: "text", text: await priceText(name) }, actionCard(name)];
  }

  // 購買方式點選後說明
  if (["宅配", "店到店", "雙北親送", "到店自取"].includes(t)) {
    return [{ type: "text", text: buyExplainText(t) }, buyMenuCard()];
  }

  // 如果客人只打品名（老人家常這樣），直接給操作卡
  if (["龜鹿膏", "龜鹿飲", "鹿茸粉", "龜鹿湯塊", "龜鹿湯塊（膠）"].some((k) => t.includes(k))) {
    const name =
      t.includes("湯塊") ? "龜鹿湯塊（膠）" :
      t.includes("龜鹿膏") ? "龜鹿膏" :
      t.includes("龜鹿飲") ? "龜鹿飲" :
      t.includes("鹿茸粉") ? "鹿茸粉" : "";
    if (name) return [actionCard(name)];
  }

  // fallback
  return [
    { type: "text", text: "我有收到🙂\n你可以直接點上面卡片，或回「選單」回主選單。" },
    mainMenuCard(),
    mainMenuCard2(),
  ];
}

/* =========================
   Webhook / Health
========================= */

const app = express();

app.get("/", (req, res) => res.status(200).send("ok"));
app.get("/health", (req, res) => res.status(200).send("ok"));

app.post(
  "/webhook",
  (req, res, next) => {
    // 若金鑰沒設定，避免 Render crash，但會回錯誤提示
    if (!config.channelAccessToken || !config.channelSecret) {
      return res.status(500).send("LINE credentials missing");
    }
    return line.middleware(config)(req, res, next);
  },
  async (req, res) => {
    const events = (req.body && req.body.events) || [];

    await Promise.all(
      events.map(async (event) => {
        try {
          if (event.type !== "message") return;
          if (!event.message || event.message.type !== "text") return;

          const msgs = await handleText(event.message.text);
          return client.replyMessage(event.replyToken, msgs);
        } catch (e) {
          console.error("handle error:", e);
        }
      })
    );

    res.sendStatus(200);
  }
);

app.listen(Number(PORT) || 3000, "0.0.0.0", () => {
  console.log("LINE bot running on", Number(PORT) || 3000);
  console.log("PRODUCTS_JSON_URL =", PRODUCTS_JSON_URL);
});
