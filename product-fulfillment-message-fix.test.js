"use strict";

const assert = require("node:assert/strict");
const {
  LEGACY_ALL_PRODUCT_NOTICE,
  DRINK_NOTICE,
  READY_STOCK_NOTICE,
  MIXED_NOTICE,
  SOUP_VARIANTS,
  normalizeNode,
} = require("./product-fulfillment-message-fix");

function bubbleContents(title, bodyText, actionText) {
  return {
    type: "bubble",
    body: {type: "box",layout: "vertical",contents: [
      { type: "text", text: title },
      { type: "text", text: bodyText },
      { type: "text", text: LEGACY_ALL_PRODUCT_NOTICE },
    ]},
    footer: {type: "box",layout: "vertical",contents: [
      { type: "button", action: { type: "message", label: "選擇數量", text: actionText } },
    ]},
  };
}

function bubble(title, bodyText, actionText = "選擇數量｜guilu-tangkuai") {
  return {type: "flex",altText: title,contents: bubbleContents(title, bodyText, actionText)};
}

const drink = normalizeNode(bubble("龜鹿飲30cc玻璃罐", "規格：30cc／罐（小玻璃罐）", "選擇數量｜guilu-drink-30"));
const drinkText = JSON.stringify(drink);
assert.ok(drinkText.includes(DRINK_NOTICE));
assert.ok(!drinkText.includes(READY_STOCK_NOTICE));
assert.ok(!drinkText.includes("選擇規格"));
assert.ok(!drinkText.includes("玻璃瓶"));

const soup = normalizeNode(bubble("龜鹿湯塊", "規格：75g／盒｜8塊裝｜每塊約9.375g"));
const soupText = JSON.stringify(soup);
assert.equal(soup.contents.body.contents[0].text, "龜鹿湯塊");
assert.equal(soup.contents.body.contents[1].text, SOUP_VARIANTS);
assert.ok(soupText.includes(READY_STOCK_NOTICE));
assert.ok(soupText.includes("75g／盒"));
assert.ok(!soupText.includes("300g"));
assert.ok(!soupText.includes("600g"));
assert.ok(!soupText.includes("選擇規格"));
assert.ok(soupText.includes("選擇數量｜guilu-tangkuai"));
assert.ok(!soupText.includes(LEGACY_ALL_PRODUCT_NOTICE));

const legacySoup = normalizeNode(bubble("龜鹿湯塊", "正式規格：75g／盒｜8塊裝｜每塊約9.375g；300g／盒｜16塊裝｜每塊約18.75g；600g／盒｜32塊裝｜每塊約18.75g。", "我要人工客服｜龜鹿湯塊75g、300g、600g規格與價格"));
const legacySoupText = JSON.stringify(legacySoup);
assert.ok(legacySoupText.includes("75g／盒"));
assert.ok(!legacySoupText.includes("300g"));
assert.ok(!legacySoupText.includes("600g"));
assert.ok(legacySoupText.includes("選擇數量｜guilu-tangkuai"));

const carousel = normalizeNode({
  type: "flex",altText: "仙加味產品",contents: {type: "carousel",contents: [
    bubbleContents("龜鹿飲30cc玻璃罐", "規格：30cc／罐（小玻璃罐）", "選擇數量｜guilu-drink-30"),
    bubbleContents("龜鹿湯塊", "規格：75g／盒｜8塊裝｜每塊約9.375g", "選擇數量｜guilu-tangkuai"),
    bubbleContents("龜鹿膏", "規格：100g／罐", "選擇數量｜guilu-gao"),
  ]}
});
const bubbles = carousel.contents.contents;
const drinkBubble = JSON.stringify(bubbles[0]);
const soupBubble = JSON.stringify(bubbles[1]);
const gaoBubble = JSON.stringify(bubbles[2]);
assert.ok(drinkBubble.includes(DRINK_NOTICE));
assert.ok(!drinkBubble.includes("選擇規格"));
assert.ok(soupBubble.includes(SOUP_VARIANTS));
assert.ok(!soupBubble.includes("300g"));
assert.ok(!soupBubble.includes("600g"));
assert.equal(bubbles[1].body.contents[0].text, "龜鹿湯塊");
assert.ok(gaoBubble.includes(READY_STOCK_NOTICE));
assert.ok(!gaoBubble.includes("選擇規格"));

const mixed = normalizeNode({type: "text",text: `龜鹿飲30cc玻璃罐、龜鹿膏\n${LEGACY_ALL_PRODUCT_NOTICE}`});
assert.ok(JSON.stringify(mixed).includes(MIXED_NOTICE));

console.log("PASS：LINE OA 依產品區分接單製作與預先備貨；龜鹿湯塊只保留75g深藍盒，不再出現300g／600g或多規格流程。");
