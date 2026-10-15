"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const {
  isSensitiveHealthQuestion,
  isExplicitDoctorReferralRequest,
  isEmergencyHealthQuestion,
} = require("./medical-referral-policy");

for (const input of [
  "我有糖尿病，龜鹿飲適合我嗎", "正在吃藥可以吃嗎", "懷孕可以喝嗎",
  "龜鹿活力飲對關節有用嗎", "我的體質適合哪一款", "怎樣改善失眠",
  "適合我食用嗎", "會有副作用嗎"
]) {
  assert.equal(isSensitiveHealthQuestion(input), true, "需由仙加味人工客服接續：" + input);
  assert.equal(isExplicitDoctorReferralRequest(input), false, "不得直接把一般健康疑問導往醫師：" + input);
}

for (const input of ["醫師諮詢", "章無忌中醫師", "轉介中醫師", "我要中醫師諮詢", "我想找中醫師", "章無忌的聯絡方式"]) {
  assert.equal(isExplicitDoctorReferralRequest(input), true, "顧客明確要求醫師才允許提供醫師連結：" + input);
}

for (const input of [
  "龜鹿膏多少錢", "我要試喝", "龜鹿飲180cc鋁袋規格", "怎麼保存",
  "商品分類", "想看龜鹿活力飲", "請問配送方式", "黑糖仙楂烏梅茶怎麼泡",
  "幫我推薦不同包裝的產品", "申請試喝"
]) {
  assert.equal(isSensitiveHealthQuestion(input), false, "應保留商品或客服流程：" + input);
  assert.equal(isExplicitDoctorReferralRequest(input), false, "一般商品問題不得轉醫師：" + input);
}
assert.equal(isEmergencyHealthQuestion("胸痛又呼吸困難"), true);
assert.equal(isEmergencyHealthQuestion("我想了解商品價錢"), false);

const server = fs.readFileSync("server.js", "utf8");
const explicit = server.indexOf("if (isExplicitDoctorReferralRequest(text))");
const sensitive = server.indexOf("if (isSensitiveHealthQuestion(text))");
const checkout = server.indexOf("if (state.checkout) return continueCheckout");
const partner = server.indexOf("const partnerInquiry =");
const website = server.indexOf("const websiteIntent = detectWebsiteIntent(text);");
const urgent = server.indexOf("if (isEmergencyHealthQuestion(text))");
assert.ok(urgent > 0 && urgent < explicit && explicit < sensitive && sensitive < checkout
  && sensitive < partner && sensitive < website, "危急問題、主動求醫、仙加味承接的優先順序錯誤");
assert.ok(server.includes("return reply(event.replyToken, healthQuestionIntakeReply());"), "健康疑問須先由仙加味人工客服承接");
assert.ok(server.includes("function healthQuestionIntakeReply()"), "缺少人工客服接待回覆");
assert.ok(server.includes("return reply(event.replyToken, doctorReferralReply());"), "缺少顧客主動請求醫師轉介");
const intake = server.slice(server.indexOf("function healthQuestionIntakeReply()"), server.indexOf("function doctorReferralReply()"));
assert.ok(!intake.includes("https://lin.ee/1MK4NR9") && !intake.includes("uri: url"), "首次接待不得直接送醫師連結");
assert.ok(server.includes("我是由仙加味介紹"), "轉介時應保留來源標註");
assert.ok(server.includes("後續一般食品及依法可由仙加味販售商品"), "轉介後須說明合法商品回流仙加味");
assert.ok(server.includes('https://lin.ee/1MK4NR9'), "中醫師連結不可遺失");
console.log("PASS：先由仙加味接待、明確請求才轉醫師、來源標註與一般商品回流");
