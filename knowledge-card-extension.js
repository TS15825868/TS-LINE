"use strict";

const { CARDS } = require("./knowledge-card-server");

const VERSION = "1.0.0";

const EXTRA_CARDS = {
  "opening-date": {
    number: "21",
    eyebrow: "管理篇",
    title: ["開封後記下日期", "管理會更清楚"],
    bullets: ["方便掌握使用進度", "配合包裝保存方式", "不是改變有效期限"],
    mascot: "faq",
  },
  "spoon-size": {
    number: "22",
    eyebrow: "份量篇",
    title: ["一匙不是固定公克", "先看工具大小"],
    bullets: ["不同湯匙容量不同", "匙數不能直接當重量", "依包裝建議安排"],
    mascot: "guide",
  },
  "family-portions": {
    number: "23",
    eyebrow: "家用篇",
    title: ["家人一起使用", "先分清每次份量"],
    bullets: ["先確認每人怎麼安排", "使用乾淨乾燥工具", "避免大家隨意加量"],
    mascot: "products",
  },
  "original-packaging": {
    number: "24",
    eyebrow: "外出篇",
    title: ["外出攜帶時", "盡量保留原包裝"],
    bullets: ["品名規格不容易混淆", "保存說明隨時可查看", "密封完整比較安心"],
    mascot: "choose",
  },
  "simple-soup-base": {
    number: "25",
    eyebrow: "料理篇",
    title: ["第一次搭配料理", "先從單純湯底開始"],
    bullets: ["先用熟悉的家常湯底", "完成後再調整濃淡", "容易找到喜歡的比例"],
    mascot: "recipes",
  },
  "gift-instructions": {
    number: "26",
    eyebrow: "分享篇",
    title: ["分享給家人朋友", "別忘了附上說明"],
    bullets: ["告知產品名稱與規格", "說明使用與保存方式", "讓對方知道怎麼安排"],
    mascot: "brand",
  },
  "no-pour-back": {
    number: "27",
    eyebrow: "取用篇",
    title: ["取出或沖泡之後", "不要再倒回原容器"],
    bullets: ["避免把水氣帶回去", "也不要混入其他食物", "取多少就使用多少"],
    mascot: "guide",
  },
  "repack-label": {
    number: "28",
    eyebrow: "分裝篇",
    title: ["需要分裝時", "記得標示三項資訊"],
    bullets: ["寫清楚產品名稱", "記下分裝日期", "保留保存方式提醒"],
    mascot: "faq",
  },
  "first-in-first-out": {
    number: "29",
    eyebrow: "保存篇",
    title: ["家裡有同款產品", "先開先用較清楚"],
    bullets: ["先使用已開封的包裝", "未開封品妥善保存", "再確認有效日期"],
    mascot: "products",
  },
  "personal-notes": {
    number: "30",
    eyebrow: "日常篇",
    title: ["記下自己的沖泡方式", "下次更容易安排"],
    bullets: ["記錄習慣的水量", "記下飲用溫度與時段", "找到順手的日常節奏"],
    mascot: "guide",
  },
};

function applyKnowledgeCardExtension() {
  Object.assign(CARDS, EXTRA_CARDS);
  return {
    version: VERSION,
    added: Object.keys(EXTRA_CARDS).length,
    total: Object.keys(CARDS).length,
  };
}

const applied = applyKnowledgeCardExtension();

module.exports = {
  VERSION,
  EXTRA_CARDS,
  applied,
  applyKnowledgeCardExtension,
};
