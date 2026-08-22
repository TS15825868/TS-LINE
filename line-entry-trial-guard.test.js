"use strict";

const assert = require("node:assert/strict");
const guard = require("./line-entry-trial-guard");

const welcome = {
  type: "flex",
  altText: "歡迎來到仙加味",
  contents: {
    type: "bubble",
    body: {
      type: "box",
      layout: "vertical",
      contents: [{ type: "text", text: "您好，歡迎使用仙加味 LINE OA。" }],
    },
    footer: {
      type: "box",
      layout: "vertical",
      contents: [
        { type: "button", action: { type: "message", label: "看產品", text: "看產品" } },
        { type: "button", action: { type: "message", label: "幫我推薦", text: "幫我推薦" } },
        { type: "button", action: { type: "message", label: "人工客服", text: "我要人工客服" } },
      ],
    },
  },
};

guard.walk(welcome);

const bubble = welcome.contents;
const buttons = bubble.footer.contents;
assert.deepEqual(buttons.map((item) => item.action.label), ["申請試喝", "看產品", "幫我推薦"]);
assert.deepEqual(buttons.map((item) => item.action.text), ["申請試喝", "看產品", "幫我推薦"]);
assert.equal(buttons[0].style, "primary");
assert.equal(buttons[0].color, "#7B1E1E");
assert.equal(buttons[1].style, "secondary");
assert.equal(buttons[2].style, "secondary");
assert.equal(buttons.length, 3, "歡迎卡不得因增加試喝而被拉長");

assert.equal(bubble.hero?.url, guard.FORMAL_WELCOME_HERO_URL, "歡迎 Hero 必須使用唯一正式來源");
assert.match(String(bubble.hero?.url || ""), /^https:\/\/ts15825868\.github\.io\/xianjiawei\/images\/brand\/line-oa\/welcome\.jpg\?v=/, "歡迎 Hero 必須走官網 GitHub Pages 靜態圖，避免 Render Free 冷啟動造成空白");
assert.equal(bubble.hero?.aspectRatio, "4:3");
assert.equal(bubble.hero?.aspectMode, "fit");

const bodyTexts = (bubble.body?.contents || []).filter((item) => item?.type === "text").map((item) => String(item.text || ""));
assert.equal(bodyTexts[0], "歡迎來到仙加味");
assert.equal(bodyTexts[1], guard.FORMAL_WELCOME_DESCRIPTION);
assert.doesNotMatch(bodyTexts.join("\n"), /5\s*[～~〜－-]\s*7/, "歡迎第一層不得再塞龜鹿飲交期長文");
assert.match(bodyTexts.join("\n"), /產品/);
assert.match(bodyTexts.join("\n"), /申請試喝/);

const normal = {
  type: "flex",
  altText: "仙加味產品",
  contents: {
    type: "bubble",
    hero: {
      type: "image",
      url: "https://example.com/formal-product.jpg",
      size: "full",
      aspectRatio: "1:1",
      aspectMode: "fit",
    },
    body: { type: "box", layout: "vertical", contents: [{ type: "text", text: "龜鹿膏" }] },
    footer: { type: "box", layout: "vertical", contents: [{ type: "button", action: { type: "message", label: "選擇數量", text: "選擇數量" } }] },
  },
};
const before = JSON.stringify(normal);
guard.walk(normal);
assert.equal(JSON.stringify(normal), before, "非歡迎卡不得被入口守門修改，產品圖與產品流程必須維持原樣");

console.log("PASS：歡迎卡固定正式 Hero／精簡文案／申請試喝・看產品・幫我推薦三入口；非歡迎卡完全不受影響。");
