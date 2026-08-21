"use strict";

const assert = require("node:assert/strict");
const visual = require("./line-recording-ui-fix");
const actions = require("./line-product-card-action-guard");

function button(label, action = {}) {
  return { type: "button", style: "secondary", action: { type: "message", label, text: label, ...action } };
}

function product30BubbleWithLegacyTrialButton() {
  return {
    type: "bubble",
    hero: { type: "image", url: "https://example.com/old.jpg", aspectMode: "cover" },
    body: {
      type: "box",
      layout: "vertical",
      contents: [
        { type: "text", text: "龜鹿飲30cc玻璃罐", weight: "bold", size: "xl" },
        { type: "text", text: "規格：30cc／罐（小玻璃罐）\n每日 1–2 罐", wrap: true },
      ],
    },
    footer: {
      type: "box",
      layout: "vertical",
      contents: [
        button("選擇數量"),
        button("申請試喝"),
        button("完整介紹"),
        button("看實際產品照片"),
        button("使用方式"),
      ],
    },
  };
}

// 即使 footer 有「申請試喝」，30cc 產品卡也必須先被視為產品卡，不能變成試喝海報。
const product30 = product30BubbleWithLegacyTrialButton();
visual.applyVisualFix(product30);
assert.equal(visual.isTrialBubble(product30), false, "30cc產品卡不得因footer試喝按鈕被判成試喝卡");
assert.equal(product30.xjwProductPhoto, "guilu-drink-30");
assert.match(product30.hero.url, /\/assets\/formal-product\/guilu-drink-30\.jpg\?v=/, "30cc必須保留正式產品hero");
assert.ok(!product30.hero.url.includes("formal-trial"), "30cc產品卡不得使用試喝海報");

actions.normalizeActions(product30);
const productLabels = product30.footer.contents.map((item) => String(item?.action?.label || ""));
assert.deepEqual(productLabels, ["選擇數量", "官網完整介紹", "使用方式"], "產品摘要卡應維持三顆核心按鈕");
assert.equal(productLabels.some((label) => /試喝/.test(label)), false, "看產品carousel不得塞試喝按鈕");
assert.equal(product30.footer.contents.length, 3, "產品卡不得因試喝入口拉高carousel");

// 真正試喝內容卡才允許使用正式試喝海報。
const trial = {
  type: "bubble",
  body: {
    type: "box",
    layout: "vertical",
    contents: [
      { type: "text", text: "龜鹿飲試喝組｜先試喝，再決定", weight: "bold", size: "xl" },
      { type: "text", text: "30cc小玻璃罐×3罐｜試喝品免費", wrap: true },
    ],
  },
};
visual.applyVisualFix(trial);
assert.equal(visual.isTrialBubble(trial), true);
assert.equal(trial.xjwTrialMedia, true);
assert.match(trial.hero.url, /\/assets\/formal-trial\/trial\.jpg\?v=/);

// 六張產品總覽的按鈕高度規則一致：任何摘要卡都最多三顆核心動作。
const names = [
  "龜鹿膏",
  "龜鹿飲30cc玻璃罐",
  "龜鹿飲180cc鋁袋",
  "龜鹿湯塊",
  "龜鹿膠",
  "鹿茸粉",
];
for (const name of names) {
  const bubble = {
    type: "bubble",
    body: { type: "box", layout: "vertical", contents: [
      { type: "text", text: name, weight: "bold", size: "xl" },
      { type: "text", text: name === "龜鹿飲30cc玻璃罐" ? "30cc／罐（小玻璃罐）" : "正式產品規格", wrap: true },
    ] },
    footer: { type: "box", layout: "vertical", contents: [
      button("選擇數量"),
      button("完整介紹"),
      button("看實際產品照片"),
      button("使用方式"),
    ] },
  };
  actions.normalizeActions(bubble);
  assert.ok(bubble.footer.contents.length <= 3, `${name}產品卡按鈕不得超過3顆`);
  assert.equal(bubble.footer.contents.some((item) => /試喝/.test(String(item?.action?.label || ""))), false, `${name}產品總覽卡不得插入試喝`);
}

console.log("PASS：看產品維持六張正常等高產品卡；30cc正式圖不被試喝按鈕誤換；試喝保留獨立入口。");
