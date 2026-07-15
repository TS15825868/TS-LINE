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
const {
  approvedImageForTitle,
  applyImageSafety,
} = require("./line-image-safety");

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
  assert.ok(!firstBubble(message).hero, "搭配組合與空購物車在建立時應維持乾淨文字卡，再由正式路由層配置情境圖");
}

const titleRoutes = {
  "歡迎來到仙加味": "welcome.jpg",
  "依日常使用方式幫你選": "recommend.jpg",
  "搭配組合": "combo.jpg",
  "怎麼使用": "usage.jpg",
  "常見問題 FAQ": "faq.jpg",
  "購物車｜小老闆幫你整理": "service.jpg",
  "仙加味的故事": "brand.jpg",
};

for (const [title, filename] of Object.entries(titleRoutes)) {
  const url = approvedImageForTitle(title);
  assert.ok(url.includes(`/public/mascot/${filename}`), `${title} 應使用 ${filename}`);
}

const protectedProduct = JSON.parse(JSON.stringify(products.contents.contents[0]));
const originalProductUrl = protectedProduct.hero.url;
applyImageSafety(protectedProduct);
assert.strictEqual(protectedProduct.hero.url, originalProductUrl, "真實產品主圖不得被小老闆圖覆蓋");

const serviceCard = cartFlex({ cart: [], checkout: null });
applyImageSafety(serviceCard);
const serviceBubble = firstBubble(serviceCard);
assert.ok(serviceBubble.hero.url.includes("/service.jpg"), "購物車應配置客服小老闆圖");
assert.strictEqual(serviceBubble.hero.aspectRatio, "1:1", "LINE OA 小老闆圖必須使用正方形比例");
assert.strictEqual(serviceBubble.hero.aspectMode, "fit", "LINE OA 小老闆圖必須完整顯示，不得裁切");

const comboCard = comboMenuReply();
applyImageSafety(comboCard);
const comboBubble = firstBubble(comboCard);
assert.ok(comboBubble.hero.url.includes("/combo.jpg"), "搭配組合應配置專用小老闆圖");
assert.strictEqual(comboBubble.hero.aspectRatio, "1:1");

console.log("PASS LINE OA integrated image policy v401.6");
