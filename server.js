"use strict";

const express = require("express");
const line = require("@line/bot-sdk");
const fs = require("fs");
const path = require("path");
const https = require("https");
const http = require("http");

/* =========================
   1️⃣ 環境變數
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

const config = {
  channelAccessToken: ACCESS_TOKEN,
  channelSecret: CHANNEL_SEC,
};

const client = new line.Client(config);

/* =========================
   2️⃣ 基本資訊
========================= */

const STORE = {
  brandName: "仙加味・龜鹿",
  address: "台北市萬華區西昌街 52 號",
  phone: "(02) 2381-2990",
  phoneTel: "0223812990",
  website: "https://ts15825868.github.io/TaiShing/index.html",
  mapUrl:
    "https://www.google.com/maps/search/?api=1&query=台北市萬華區西昌街+52號",
};

/* =========================
   3️⃣ 使用者狀態
========================= */

const DATA_DIR = path.join(__dirname, "data");
const USERS_FILE = path.join(DATA_DIR, "users.json");

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

function loadUsers() {
  if (!fs.existsSync(USERS_FILE)) return {};
  return JSON.parse(fs.readFileSync(USERS_FILE, "utf8") || "{}");
}

function saveUsers(users) {
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}

function ensureUser(userId) {
  const users = loadUsers();
  users[userId] = users[userId] || {
    step: null,
    method: null,
    cart: null,
    name: null,
    phone: null,
    address: null,
  };
  saveUsers(users);
  return users[userId];
}

function updateUser(userId, fn) {
  const users = loadUsers();
  users[userId] = users[userId] || {};
  fn(users[userId]);
  saveUsers(users);
}

function resetUser(userId) {
  updateUser(userId, (u) => {
    u.step = null;
    u.method = null;
    u.cart = null;
    u.name = null;
    u.phone = null;
    u.address = null;
  });
}

/* =========================
   4️⃣ 讀 products.json
========================= */

let cache = { at: 0, data: null };

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith("https") ? https : http;
    lib.get(url, (res) => {
      let data = "";
      res.on("data", (c) => (data += c));
      res.on("end", () => resolve(JSON.parse(data)));
    }).on("error", reject);
  });
}

async function getProducts() {
  const ttl = 5 * 60 * 1000;
  if (Date.now() - cache.at < ttl && cache.data) return cache.data;

  try {
    if (PRODUCTS_URL) {
      const data = await fetchJson(PRODUCTS_URL);
      cache = { at: Date.now(), data };
      return data;
    }
  } catch (e) {
    console.log("讀取 products.json 失敗，使用空資料");
  }

  return { categories: [] };
}

function money(n) {
  return "$" + Number(n).toLocaleString();
}

function calcDiscount(msrp, d) {
  if (!d) return null;
  return Math.round(msrp * d);
}

/* =========================
   5️⃣ LINE 卡片
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
        { type: "message", label: "看價格", text: "看價格" },
        { type: "message", label: "怎麼購買", text: "怎麼購買" },
        { type: "message", label: "門市資訊", text: "門市資訊" },
      ],
    },
  };
}

/* =========================
   6️⃣ 產品查詢
========================= */

function flattenProducts(data) {
  const list = [];
  for (const c of data.categories || []) {
    for (const item of c.items || []) {
      list.push({ ...item, categoryId: c.id });
    }
  }
  return list;
}

async function findProduct(name) {
  const data = await getProducts();
  const flat = flattenProducts(data);
  return flat.find((p) => name.includes(p.name));
}

/* =========================
   7️⃣ 對話邏輯（乾淨版）
========================= */

async function handleText(userId, text) {
  ensureUser(userId);
  const t = text.trim();

  /* 主選單 */
  if (!t || t === "選單" || t === "主選單") {
    resetUser(userId);
    return [mainMenuCard()];
  }

  if (t === "產品介紹") {
    const data = await getProducts();
    const flat = flattenProducts(data);

    return [{
      type: "text",
      text:
        "目前產品：\n" +
        flat.map((p) => "• " + p.name).join("\n") +
        "\n\n可輸入：介紹 龜鹿膏"
    }];
  }

  if (t === "看價格") {
    const data = await getProducts();
    const flat = flattenProducts(data);

    const lines = flat.map((p) => {
      const act = calcDiscount(p.msrp, p.discount);
      return `【${p.name}】\n建議售價：${money(p.msrp)}\n${act ? `活動價：${money(act)}` : ""}`;
    });

    return [{ type: "text", text: lines.join("\n\n") }];
  }

  if (t === "怎麼購買") {
    return [{
      type: "text",
      text:
        "可選：\n宅配\n超商店到店\n雙北親送\n到店自取\n\n請輸入其中一種。"
    }];
  }

  if (t === "門市資訊") {
    return [{
      type: "text",
      text:
        `${STORE.address}\n${STORE.phone}`
    }];
  }

  if (t.startsWith("介紹 ")) {
    const product = await findProduct(t);
    if (!product) return [{ type: "text", text: "找不到產品🙂" }];

    return [{
      type: "text",
      text:
        `【${product.name}】\n` +
        (product.intro || []).join("\n")
    }];
  }

  return [
    { type: "text", text: "請使用選單操作🙂" },
    mainMenuCard(),
  ];
}

/* =========================
   8️⃣ Webhook
========================= */

const app = express();

app.post(
  "/webhook",
  line.middleware(config),
  async (req, res) => {
    const events = req.body.events;
    await Promise.all(events.map(async (event) => {
      if (event.type !== "message" || event.message.type !== "text") return;
      const userId = event.source.userId;
      const msgs = await handleText(userId, event.message.text);
      return client.replyMessage(event.replyToken, msgs);
    }));
    res.sendStatus(200);
  }
);

app.listen(PORT || 3000, () => {
  console.log("LINE bot running");
});
