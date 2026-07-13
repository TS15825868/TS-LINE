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
const { cleanOutgoingMessages } = require("./no-collage-runtime");

function clean(message) {
  return cleanOutgoingMessages(JSON.parse(JSON.stringify(message)));
}

const products = clean(productCarousel());
assert.strictEqual(products.contents.type, "carousel");
assert.strictEqual(products.contents.contents.length, 6, "產品入口應直接顯示六張真實產品卡");
for (const bubble of products.contents.contents) {
  assert.ok(bubble.hero, "每張產品卡都必須有真實產品主圖");
  assert.ok(
    bubble.hero.url.includes("/xianjiawei/images/products-v3/"),
    "產品卡不得使用小老闆拼湊圖或重畫包裝"
  );
}

const textOnlyCards = [
  clean(mascotWelcomeReply()),
  clean(recommendReply()),
  clean(comboMenuReply()),
  clean(usageChooserReply()),
  clean(cartFlex({ cart: [], checkout: null })),
];

for (const message of textOnlyCards) {
  const bubbles = message.contents.type === "carousel" ? message.contents.contents : [message.contents];
  const first = bubbles[0];
  assert.ok(!first.hero, "缺少合格獨立情境圖時應使用乾淨文字卡，不得拼湊");
}

const faq = clean(faqReply());
assert.ok(faq.contents.hero, "FAQ可保留已核准的單一場景專用圖");

console.log("PASS LINE OA image policy v401.1: no collage, real product images only, clean fallback cards");
