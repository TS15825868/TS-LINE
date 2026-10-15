"use strict";

// Only route individual medical/suitability questions away from product/sales replies.
// Information-only product, price, brewing, order and delivery inquiries stay with 仙加味.
const PERSONAL_HEALTH = /功效|效果|有效|有沒有用|多久有效|改善|治療|預防|疾病|症狀|不舒服|疼痛|腰痠|腰酸|膝蓋|關節|睡眠|失眠|血糖|血壓|膽固醇|免疫|明目|補血|補氣|壯陽|腎虛|肝腎|眼睛|服藥|用藥|藥物|正在吃藥|吃藥|中西藥|藥一起|孕婦|懷孕|備孕|哺乳|兒童|小孩|慢性病|過敏|手術|化療|洗腎|適不適合吃|適不適合食用|能不能吃|可以吃嗎|我能吃嗎|我適合|適合我|適用於我|我的體質|身體狀況|病史|體質|燥熱|上火|副作用|禁忌|醫生建議|醫師建議/;
const ASK_DOCTOR = /^(?:找中醫師|中醫師諮詢|醫師諮詢|找醫師|章無忌|章無忌中醫師|@changwuchi|醫生諮詢|醫師轉介)$/;
const URGENT = /胸痛|胸口劇痛|呼吸困難|喘不過氣|意識不清|昏迷|疑似中風|口眼歪斜|單側無力|嚴重出血|大量出血|抽搐不止|自殺|想不開|傷害自己/;

function isSensitiveHealthQuestion(value) {
  const text = String(value || "").trim();
  return PERSONAL_HEALTH.test(text) || ASK_DOCTOR.test(text);
}

function isEmergencyHealthQuestion(value) {
  return URGENT.test(String(value || ""));
}

module.exports = { isSensitiveHealthQuestion, isEmergencyHealthQuestion };
