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
  BLOCKED_MASCOT_ASSETS,
  MASCOT_RULES,
  isBlockedMascotUrl,
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
  const originalUrl = bubble.hero.url;
  applyImageSafety(bubble);
  assert.strictEqual(bubble.hero.url, originalUrl, "真實產品主圖不得被安全層移除或覆蓋");
}

assert.deepStrictEqual(MASCOT_RULES, [], "未安裝核准 LINE OA 獨立圖前，不得自動配置舊小老闆拼接圖");
assert.ok(BLOCKED_MASCOT_ASSETS.includes("/public/mascot/"), "舊 public/mascot 圖集必須封鎖");
for (const filename of ["welcome.jpg", "recommend.jpg", "combo.jpg", "usage.jpg", "faq.jpg", "service.jpg", "brand.jpg"]) {
  assert.ok(BLOCKED_MASCOT_ASSETS.includes(filename), `${filename} 必須列入舊圖封鎖清單`);
  assert.strictEqual(isBlockedMascotUrl(`https://example.com/public/mascot/${filename}`), true, `${filename} 必須被辨識為舊拼接圖`);
}

for (const message of [
  mascotWelcomeReply(),
  recommendReply(),
  comboMenuReply(),
  usageChooserReply(),
  faqReply(),
  cartFlex({ cart: [], checkout: null }),
]) {
  const cloned = JSON.parse(JSON.stringify(message));
  applyImageSafety(cloned);
  const bubble = firstBubble(cloned);
  if (bubble.hero) {
    assert.strictEqual(isBlockedMascotUrl(bubble.hero.url), false, "LINE OA 回覆不得保留舊小老闆拼接圖");
  }
}

const explicitLegacyBubble = {
  type: "bubble",
  hero: {
    type: "image",
    url: "https://example.com/public/mascot/welcome.jpg",
    aspectRatio: "1:1",
    aspectMode: "fit",
  },
  body: { type: "box", layout: "vertical", contents: [] },
};
applyImageSafety(explicitLegacyBubble);
assert.ok(!explicitLegacyBubble.hero, "安全層必須移除舊小老闆拼接圖");

console.log("PASS LINE OA image policy: real product photos retained; legacy stitched mascot images blocked until approved independent artwork is installed");
