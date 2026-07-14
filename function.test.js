"use strict";

const assert = require("assert");
const fs = require("fs");
const {
  DATA,
  VERSION,
  productMenuReply,
  priceCarousel,
  recommendReply,
  mascotWelcomeReply,
  comboMenuReply,
  comboDetailReply,
  usageChooserReply,
  usageReply,
  doctorReferralReply,
  huangdiNeijingReply,
  brandStoryReply,
  faqReply,
  qtyMenu,
  cartFlex,
  detectWebsiteIntent,
  comboQtyMenu,
  comboUnitPrice,
  comboPromotionLines,
  addComboCart,
  getCombo,
} = require("./server");

function validateMessage(message) {
  assert.ok(message && typeof message === "object");
  assert.ok(["text", "flex"].includes(message.type));
  if (message.type !== "flex") return;
  assert.ok(message.altText && message.altText.length <= 400);
  assert.ok(message.contents && ["bubble", "carousel"].includes(message.contents.type));
  if (message.contents.type === "carousel") {
    assert.ok(message.contents.contents.length >= 1 && message.contents.contents.length <= 12);
  }
  const walk = (node) => {
    if (!node || typeof node !== "object") return;
    if (node.type === "button" && node.action) {
      assert.ok(node.action.label && node.action.label.length <= 20);
      if (node.action.type === "message") assert.ok(node.action.text && node.action.text.length <= 300);
      if (node.action.type === "uri") assert.ok(/^https:\/\//.test(node.action.uri));
    }
    if (Array.isArray(node)) node.forEach(walk);
    else Object.values(node).forEach(walk);
  };
  walk(message);
}

function validateBubble(value) {
  const bubble = value?.type === "flex" ? value.contents : value;
  assert.ok(bubble && bubble.type === "bubble");
  assert.ok(bubble.body && bubble.body.type === "box");
  validateMessage(value?.type === "flex" ? value : { type: "flex", altText: "測試卡片", contents: bubble });
}

assert.strictEqual(VERSION, "v401.6");

const messages = [
  productMenuReply(),
  priceCarousel(),
  mascotWelcomeReply(),
  recommendReply(),
  comboMenuReply(),
  usageChooserReply(),
  doctorReferralReply(),
  huangdiNeijingReply(),
  cartFlex({ cart: [], checkout: null }),
];
for (const product of DATA.products) {
  messages.push(usageReply(product), qtyMenu(product));
}
messages.forEach(validateMessage);
validateMessage(comboDetailReply(0));
validateBubble(brandStoryReply());
validateMessage(faqReply());

assert.strictEqual(productMenuReply().contents.contents.length, DATA.products.length);
assert.strictEqual(recommendReply().contents.contents.length, 4);
assert.strictEqual(comboMenuReply().contents.contents.length, DATA.offers.comboOffers.length + 1);
assert.strictEqual(usageChooserReply().contents.contents.length, DATA.products.length + 1);

const source = fs.readFileSync("server.js", "utf8");
for (const command of ["看產品", "直接下單", "幫我推薦", "搭配組合", "怎麼使用", "查看購買清單", "開始結帳"]) {
  assert.ok(source.includes(command), `missing command: ${command}`);
}

const expectedSales = {
  "guilu-gao": { price: 1500, originalPrice: 1800, options: [1, 2, 3, 5] },
  "guilu-drink-30": { price: 50, offerQty: 12, offerTotal: 500, options: [1, 3, 5, 12] },
  "guilu-drink-180": { price: 200, offerQty: 12, offerTotal: 2000, options: [1, 3, 5, 12] },
  "guilu-tangkuai": { price: 1600, options: [1, 2, 3, 5] },
  "guilu-jiao": { price: 9600, originalPrice: 12000, options: [1, 2, 3, 5] },
  "luerong-fen": { price: 2000, options: [1, 2, 3, 5] },
};
for (const product of DATA.products) {
  const expected = expectedSales[product.id];
  assert.ok(expected, `unexpected product: ${product.id}`);
  assert.strictEqual(product.price, expected.price);
  assert.deepStrictEqual(product.quantityOptions, expected.options);
  if (expected.originalPrice) assert.strictEqual(product.originalPrice, expected.originalPrice);
  if (expected.offerQty) assert.ok(product.offers.some((offer) => offer.qty === expected.offerQty && offer.total === expected.offerTotal));
  const bubble = productMenuReply().contents.contents.find((item) => item.body?.contents?.some((content) => content.type === "text" && content.text === product.displayName));
  assert.ok(bubble?.hero?.url.startsWith("https://ts15825868.github.io/xianjiawei/images/products-v3/"));
  const dmButton = bubble.footer.contents.find((button) => button.action?.label === "看產品DM");
  assert.ok(dmButton?.action?.uri.includes("/images/dm-final/"));
}

const websiteIntentCases = [
  ["我看了產品整理，想請你幫我比較產品。", "recommend"],
  ["我從官網套餐頁進來，想了解套餐搭配。", "combo"],
  ["我從官網怎麼使用頁面進來，想了解產品使用方式。", "usage"],
  ["我想了解價格與活動方案。", "price"],
  ["我從官網品牌頁進來，想了解仙加味。", "brand"],
  ["我從官網FAQ頁面進來，有幾個問題想詢問。", "faq"],
  ["我從官網產品頁進來，想了解產品。", "products"],
];
for (const [message, expected] of websiteIntentCases) assert.strictEqual(detectWebsiteIntent(message), expected);

const expectedComboPrices = [2500, 3500, 3600, 6100, 11600];
for (let index = 0; index < expectedComboPrices.length; index += 1) {
  const combo = getCombo(index);
  assert.ok(combo);
  assert.strictEqual(comboUnitPrice(combo), expectedComboPrices[index]);
  assert.deepStrictEqual(combo.quantityOptions, [1, 2, 3, 5]);
  const buttons = comboQtyMenu(index).contents.footer.contents;
  for (const qty of [1, 2, 3, 5]) assert.ok(buttons.some((button) => button.action?.text === `加入組合｜${index}｜${qty}`));
}
const comboState = { cart: [], checkout: null };
addComboCart(comboState, getCombo(2), 2, 3);
assert.strictEqual(comboState.cart[0].total, 10800);
assert.ok(comboPromotionLines(getCombo(1)).some((line) => line.includes("買10送2")));

for (const message of [mascotWelcomeReply(), recommendReply(), usageChooserReply(), faqReply()]) {
  const bubble = message.contents.type === "carousel" ? message.contents.contents[0] : message.contents;
  assert.ok(bubble.hero);
  assert.ok(bubble.hero.url.includes("/TS-LINE/main/public/mascot/"));
  assert.strictEqual(bubble.hero.aspectMode, "fit");
}

console.log("PASS full LINE OA function matrix v401.6");
