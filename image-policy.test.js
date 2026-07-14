"use strict";

const assert = require("assert");
const {
  productCarousel,
  cartFlex,
  mascotWelcomeReply,
  recommendReply,
  comboMenuReply,
  usageChooserReply,
  faqReply,
} = require("./server");

function firstBubble(message) {
  return message.contents.type === "carousel" ? message.contents.contents[0] : message.contents;
}

const products = productCarousel();
assert.strictEqual(products.contents.type, "carousel");
assert.strictEqual(products.contents.contents.length, 6, "產品入口應直接顯示六張真實產品卡");
for (const bubble of products.contents.contents) {
  assert.ok(bubble.hero, "每張產品卡都必須有真實產品主圖");
  assert.ok(bubble.hero.url.includes("/xianjiawei/images/products-v3/"), "產品卡不得使用小老闆拼湊圖或重畫包裝");
}
for (const message of [mascotWelcomeReply(), recommendReply(), usageChooserReply(), faqReply()]) {
  assert.ok(firstBubble(message).hero, "歡迎、推薦、使用方式與 FAQ 應保留一張獨立小老闆圖");
}
for (const message of [comboMenuReply(), cartFlex({ cart: [], checkout: null })]) {
  assert.ok(!firstBubble(message).hero, "搭配組合與空購物車應維持乾淨文字卡");
}
console.log("PASS LINE OA integrated image policy v401.3");
