"use strict";

const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const data = JSON.parse(read("data.json"));
const server = read("server.js");

const errors = [];
const requiredProducts = [
  "guilu-gao",
  "guilu-drink-30",
  "guilu-drink-180",
  "guilu-tangkuai",
  "guilu-jiao",
  "luerong-fen",
];

if (data.lineId !== "@762jybnm") errors.push("LINE ID 不正確");
if (!Array.isArray(data.products)) errors.push("products 必須是陣列");
for (const id of requiredProducts) {
  const product = (data.products || []).find((item) => item.id === id);
  if (!product) {
    errors.push(`缺少產品：${id}`);
    continue;
  }
  for (const field of ["name", "spec", "price", "unit", "image", "page", "usage", "ingredients"]) {
    if (product[field] === undefined || product[field] === null || product[field] === "") {
      errors.push(`${id} 缺少 ${field}`);
    }
  }
}

const requiredServerTokens = [
  "process.env.CHANNEL_ACCESS_TOKEN",
  "process.env.CHANNEL_SECRET",
  "process.env.CRM_URL",
  "app.post(\"/webhook\"",
  "app.get(\"/healthz\"",
  "productCarousel()",
  "priceCarousel()",
  "cartFlex(state)",
  "startCheckout(state)",
  "doctorReferralReply()",
  "mascotWelcomeReply()",
];
for (const token of requiredServerTokens) {
  if (!server.includes(token)) errors.push(`server.js 缺少必要功能：${token}`);
}

if (/channelAccessToken\s*:\s*["'][^"']{20,}/.test(server)) errors.push("server.js 疑似含硬編碼 access token");
if (/channelSecret\s*:\s*["'][^"']{10,}/.test(server)) errors.push("server.js 疑似含硬編碼 channel secret");

if (errors.length) {
  console.error("LINE OA 正式上線檢查失敗：\n- " + errors.join("\n- "));
  process.exit(1);
}

console.log(`LINE OA 正式上線檢查通過：${data.products.length} 項產品、Webhook、健康檢查、購物車、結帳、CRM、客服轉介與小老闆卡片皆已納入。`);