"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const { isSensitiveHealthQuestion, isEmergencyHealthQuestion } = require("./medical-referral-policy");

for (const input of [
  "我有糖尿病，龜鹿飲適合我嗎", "正在吃藥可以吃嗎", "懷孕可以喝嗎",
  "龜鹿活力飲對關節有用嗎", "我的體質適合哪一款", "怎樣改善失眠",
  "章無忌中醫師", "醫師諮詢", "適合我食用嗎", "會有副作用嗎"
]) assert.equal(isSensitiveHealthQuestion(input), true, "必須轉介中醫師：" + input);

for (const input of [
  "龜鹿膏多少錢", "我要試喝", "龜鹿飲180cc鋁袋規格", "怎麼保存",
  "商品分類", "想看龜鹿活力飲", "請問配送方式", "黑糖仙楂烏梅茶怎麼泡",
  "幫我推薦不同包裝的產品", "申請試喝"
]) assert.equal(isSensitiveHealthQuestion(input), false, "應保留商品或客服流程：" + input);

assert.equal(isEmergencyHealthQuestion("胸痛又呼吸困難"), true);
assert.equal(isEmergencyHealthQuestion("我想了解商品價錢"), false);

const server = fs.readFileSync("server.js", "utf8");
const priority = server.indexOf("if (isSensitiveHealthQuestion(text))");
const checkout = server.indexOf("if (state.checkout) return continueCheckout");
const partner = server.indexOf("const partnerInquiry =");
const website = server.indexOf("const websiteIntent = detectWebsiteIntent(text);");
assert.ok(priority > 0 && priority < checkout && priority < partner && priority < website,
  "敏感健康問題必須先於結帳、合作商品及網站推薦路由");
assert.ok(server.includes("if (isEmergencyHealthQuestion(text))"), "急症提示應先於一般轉介");
assert.ok(server.includes("https://lin.ee/1MK4NR9"), "轉介文案需附合作中醫師連結");
assert.ok(server.includes("LINE ID"), "轉介文案需附 LINE ID");
console.log("PASS：個人健康轉介、危急情況優先及非醫療商品分流");
