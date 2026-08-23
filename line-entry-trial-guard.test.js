"use strict";

const assert = require("node:assert/strict");
const guard = require("./line-entry-trial-guard");

const welcome = {
  type: "flex",
  altText: "歡迎來到仙加味",
  contents: {
    type: "bubble",
    body: { type: "box", layout: "vertical", contents: [{ type: "text", text: "您好，歡迎使用仙加味 LINE OA。" }] },
    footer: { type: "box", layout: "vertical", contents: [] },
  },
};

guard.walk(welcome);
const bubble = welcome.contents;
const buttons = bubble.footer.contents;
assert.deepEqual(buttons.map((item) => item.action.label), ["申請試喝", "看產品", "幫我推薦"]);
assert.equal(buttons[0].style, "primary");
assert.equal(buttons[0].color, "#7B1E1E");
assert.equal(buttons.length, 3);
assert.equal(bubble.hero?.url, guard.FORMAL_WELCOME_HERO_URL);
assert.match(String(bubble.hero?.url || ""), /^https:\/\/ts-line\.onrender\.com\/mascot\/welcome-hd\.jpg\?v=20260824-final-welcome-v3$/);
assert.equal(bubble.hero?.aspectRatio, "4:3");
assert.equal(bubble.hero?.aspectMode, "fit");

const bodyTexts = (bubble.body?.contents || []).filter((item) => item?.type === "text").map((item) => String(item.text || ""));
assert.equal(bodyTexts[0], "歡迎來到仙加味");
assert.equal(bodyTexts[1], guard.FORMAL_WELCOME_DESCRIPTION);
assert.doesNotMatch(bodyTexts.join("\n"), /5\s*[～~〜－-]\s*7/);

const normal = {
  type: "flex",
  altText: "仙加味產品",
  contents: {
    type: "bubble",
    hero: { type: "image", url: "https://example.com/formal-product.jpg", size: "full", aspectRatio: "1:1", aspectMode: "fit" },
    body: { type: "box", layout: "vertical", contents: [{ type: "text", text: "龜鹿膏" }] },
    footer: { type: "box", layout: "vertical", contents: [{ type: "button", action: { type: "message", label: "選擇數量", text: "選擇數量" } }] },
  },
};
const before = JSON.stringify(normal);
guard.walk(normal);
assert.equal(JSON.stringify(normal), before);

console.log("PASS：歡迎卡使用 2026-08-24 正式歡迎 Hero，三入口維持正常；非歡迎卡不受影響。");
