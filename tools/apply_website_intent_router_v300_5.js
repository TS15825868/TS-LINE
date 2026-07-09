"use strict";

const fs = require("fs");
const path = require("path");
const root = path.resolve(__dirname, "..");
const read = (name) => fs.readFileSync(path.join(root, name), "utf8");
const write = (name, value) => fs.writeFileSync(path.join(root, name), value, "utf8");

function replaceBlock(source, pattern, replacement, label) {
  const next = source.replace(pattern, replacement);
  if (next === source) throw new Error(`找不到更新區塊：${label}`);
  return next;
}

let server = read("server.js");
server = server.replace(/仙加味 LINE OA Bot v300\.4/g, "仙加味 LINE OA Bot v300.5");
server = server.replace('const VERSION = "v300.4";', 'const VERSION = "v300.5";');

const router = `function detectWebsiteIntent(text) {
  const value = String(text || "").trim();
  if (!value) return "";

  if (/我看了產品整理|幫我比較產品|產品差異|規格比較|想請你幫我比較|哪一種比較適合|適合我的|我目前是/.test(value)) return "recommend";
  if (/官網套餐|套餐搭配|搭配組合|搭配方式|料理搭配|熱飲.*燉湯|燉湯.*調飲/.test(value)) return "combo";
  if (/官網怎麼使用|產品使用方式|想了解.*使用方式|怎麼使用頁/.test(value)) return "usage";
  if (/價格|售價|價錢|多少錢|活動方案|優惠/.test(value)) return "price";
  if (/官網品牌|品牌頁|萬華門市|想了解仙加味|四代傳承/.test(value)) return "brand";
  if (/官網FAQ|FAQ頁|幾個問題想詢問|官網聯絡|聯絡頁|配送|付款|通路合作|診所|中藥店/.test(value)) return "human";
  if (/官網產品頁|網站看到產品|產品資訊|想了解產品/.test(value)) return "products";
  return "";
}

async function handleMessage`;
server = replaceBlock(
  server,
  /async function handleMessage/,
  router,
  "官網意圖函式"
);

const insertion = `  const websiteIntent = detectWebsiteIntent(text);
  if (websiteIntent === "recommend") return reply(event.replyToken, recommendReply());
  if (websiteIntent === "combo") return reply(event.replyToken, comboMenuReply());
  if (websiteIntent === "usage") return reply(event.replyToken, usageChooserReply());
  if (websiteIntent === "price") return reply(event.replyToken, priceCarousel());
  if (websiteIntent === "brand") return reply(event.replyToken, brandStoryReply());
  if (websiteIntent === "human") return reply(event.replyToken, textMsg("請直接留下想詢問的內容，我們會由人工協助回覆。", mainQuick()));
  if (websiteIntent === "products") return reply(event.replyToken, productMenuReply());

  if (/黃帝內經|內經|食飲有節|飲食有節|起居有常|四時調養|順應四時/.test(text)) {`;
server = replaceBlock(
  server,
  /  if \(\/黃帝內經\|內經\|食飲有節\|飲食有節\|起居有常\|四時調養\|順應四時\/\.test\(text\)\) \{/,
  insertion,
  "官網意圖路由"
);

server = server.replace(
  "  cartFlex,\n};",
  "  cartFlex,\n  detectWebsiteIntent,\n};"
);
write("server.js", server);

let test = read("test.js");
test = test.replace('assert.strictEqual(VERSION, "v300.4");', 'assert.strictEqual(VERSION, "v300.5");');
write("test.js", test);

let security = read("security.test.js");
security = security.replace('assert.strictEqual(VERSION, "v300.4");', 'assert.strictEqual(VERSION, "v300.5");');
security = security.replace("PASS security and UX v300.4", "PASS security and UX v300.5");
write("security.test.js", security);

let functionTest = read("function.test.js");
functionTest = functionTest.replace('  qtyMenu, cartFlex,', '  qtyMenu, cartFlex, detectWebsiteIntent,');
functionTest = functionTest.replace('assert.strictEqual(VERSION, "v300.4");', 'assert.strictEqual(VERSION, "v300.5");');
functionTest = functionTest.replace(/PASS full LINE function matrix v300\.4/g, "PASS full LINE function matrix v300.5");
functionTest = functionTest.replace(/PASS prices, promotions and quantity choices v300\.4/g, "PASS prices, promotions and quantity choices v300.5");
functionTest += `

const websiteIntentCases = [
  ["我看了產品整理，想請你幫我比較產品。", "recommend"],
  ["我想依使用方式與規格比較仙加味產品。", "recommend"],
  ["我從官網套餐頁進來，想了解套餐搭配。", "combo"],
  ["我從官網怎麼使用頁面進來，想了解產品使用方式。", "usage"],
  ["我想了解價格與活動方案。", "price"],
  ["我從官網品牌頁進來，想了解仙加味。", "brand"],
  ["我從官網FAQ頁面進來，有幾個問題想詢問。", "human"],
  ["我從官網產品頁進來，想了解產品。", "products"],
];
for (const [message, expected] of websiteIntentCases) {
  assert.strictEqual(detectWebsiteIntent(message), expected, message);
}
console.log("PASS website legacy message routing v300.5");
`;
write("function.test.js", functionTest);

const pkg = JSON.parse(read("package.json"));
pkg.version = "3.0.5";
write("package.json", JSON.stringify(pkg, null, 2) + "\n");

let workflow = read(".github/workflows/verify-line-and-website-catalog.yml");
workflow = workflow.replace('"version":"v300.4"', '"version":"v300.5"');
write(".github/workflows/verify-line-and-website-catalog.yml", workflow);

let readme = read("README.md");
readme = readme.replace(/# 仙加味 LINE OA v300\.[0-9]+/, "# 仙加味 LINE OA v300.5");
readme = readme.replace(/\"version\": \"v300\.[0-9]+\"/, '"version": "v300.5"');
if (!readme.includes("## v300.5 官網連結整合")) {
  readme += "\n## v300.5 官網連結整合\n\n官網按鈕統一使用固定意圖指令；舊版官網已產生的自然語句仍可識別並導向產品、推薦、搭配、使用方式、價格、品牌或人工客服卡片。\n";
}
write("README.md", readme);

console.log("Applied website message intent router v300.5");
