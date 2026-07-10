"use strict";
const assert = require("assert");
const fs = require("fs");
const {
  DATA, VERSION, productMenuReply, priceCarousel, recommendReply, mascotWelcomeReply,
  comboMenuReply, comboDetailReply, usageChooserReply, usageReply,
  doctorReferralReply, huangdiNeijingReply, brandStoryReply,
  qtyMenu, cartFlex, detectWebsiteIntent, comboQtyMenu, comboUnitPrice, comboPromotionLines, addComboCart, getCombo,
} = require("./server");

function validateMessage(message) {
  assert.ok(message && typeof message === "object");
  assert.ok(["text", "flex"].includes(message.type));
  if (message.type === "flex") {
    assert.ok(message.altText && message.altText.length <= 400);
    assert.ok(message.contents && ["bubble", "carousel"].includes(message.contents.type));
    if (message.contents.type === "carousel") {
      assert.ok(message.contents.contents.length >= 1 && message.contents.contents.length <= 12);
    }
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

assert.strictEqual(VERSION, "v309.0");
const messages = [
  productMenuReply(), priceCarousel(), mascotWelcomeReply(), recommendReply(), comboMenuReply(), comboDetailReply(0),
  usageChooserReply(), doctorReferralReply(), huangdiNeijingReply(), brandStoryReply(),
  cartFlex({ cart: [], checkout: null }),
];
for (const product of DATA.products) {
  messages.push(usageReply(product));
  messages.push(qtyMenu(product));
}
messages.forEach(validateMessage);
assert.strictEqual(productMenuReply().contents.contents.length, DATA.products.length + 1);
assert.ok(productMenuReply().contents.contents.every((bubble) => Boolean(bubble.hero)));
assert.strictEqual(recommendReply().contents.contents.length, 4);
assert.strictEqual(comboMenuReply().contents.contents.length, DATA.offers.comboOffers.length + 1);
assert.strictEqual(usageChooserReply().contents.contents.length, DATA.products.length + 1);
const source = fs.readFileSync("server-core.js", "utf8");
for (const command of ["看產品", "直接下單", "幫我推薦", "搭配組合", "怎麼使用", "查看購買清單", "開始結帳"]) {
  assert.ok(source.includes(command), "missing command: " + command);
}
console.log("PASS full LINE function matrix v309.0");

const expectedSalesV3004 = {
  "guilu-gao": { price: 1500, originalPrice: 1800, options: [1, 2, 3, 5] },
  "guilu-drink-30": { price: 50, offerQty: 12, offerTotal: 500, options: [1, 3, 5, 12] },
  "guilu-drink-180": { price: 200, offerQty: 12, offerTotal: 2000, options: [1, 3, 5, 12] },
  "guilu-tangkuai": { price: 1600, options: [1, 2, 3, 5] },
  "guilu-jiao": { price: 9600, originalPrice: 12000, options: [1, 2, 3, 5] },
  "luerong-fen": { price: 2000, options: [1, 2, 3, 5] },
};
for (const product of DATA.products) {
  const expected = expectedSalesV3004[product.id];
  assert.deepStrictEqual(product.quantityOptions, expected.options);
  assert.strictEqual(product.price, expected.price);
  if (expected.originalPrice) assert.strictEqual(product.originalPrice, expected.originalPrice);
  if (expected.offerQty) {
    assert.ok(product.offers.some((offer) => offer.qty === expected.offerQty && offer.total === expected.offerTotal));
  }
  const menu = qtyMenu(product);
  assert.strictEqual(menu.contents.footer.contents.length, 5);
  validateMessage(menu);
}
console.log("PASS quantity options and promotions v300.4");


const websiteIntentCases = [
  ["我看了產品整理，想請你幫我比較產品。", "recommend"],
  ["我想依使用方式與規格比較仙加味產品。", "recommend"],
  ["我從官網套餐頁進來，想了解套餐搭配。", "combo"],
  ["我從官網怎麼使用頁面進來，想了解產品使用方式。", "usage"],
  ["我想了解價格與活動方案。", "price"],
  ["我從官網品牌頁進來，想了解仙加味。", "brand"],
  ["我從官網FAQ頁面進來，有幾個問題想詢問。", "human"],
  ["我從官網產品頁進來，想了解產品。", "products"],
];
for (const [message, expected] of websiteIntentCases) {
  assert.strictEqual(detectWebsiteIntent(message), expected, message);
}
console.log("PASS website legacy message routing v309.0");


const expectedComboPrices = [2500, 3500, 3600, 6100, 11600];
for (let index = 0; index < expectedComboPrices.length; index += 1) {
  const combo = getCombo(index);
  assert.ok(combo, "missing combo " + index);
  assert.strictEqual(comboUnitPrice(combo), expectedComboPrices[index], combo.name + " unit price");
  assert.deepStrictEqual(combo.quantityOptions, [1, 2, 3, 5], combo.name + " quantity options");
  const menu = comboQtyMenu(index);
  const buttons = menu.contents.footer.contents;
  assert.strictEqual(buttons.length, 5, combo.name + " button count");
  for (const qty of [1, 2, 3, 5]) {
    assert.ok(buttons.some((button) => button.action?.text === `加入組合｜${index}｜${qty}`), combo.name + " missing " + qty + " sets");
  }
}
const comboState = { cart: [], checkout: null };
addComboCart(comboState, getCombo(2), 2, 3);
assert.strictEqual(comboState.cart.length, 1);
assert.strictEqual(comboState.cart[0].qty, 3);
assert.strictEqual(comboState.cart[0].total, 10800);
assert.ok(comboPromotionLines(getCombo(1)).some((line) => line.includes("買10送2")));
console.log("PASS combo prices, quantities, promotions and cart v309.0");


for (const product of DATA.products) {
  const menu = productMenuReply();
  const bubble = menu.contents.contents.find((item) =>
    item.body?.contents?.some((content) => content.type === "text" && content.text === product.displayName)
  );
  assert.ok(bubble, product.id + " missing product bubble");
  assert.ok(bubble.hero, product.id + " missing product image hero");
  assert.ok(bubble.hero.url.startsWith("https://ts15825868.github.io/xianjiawei/images/products-v3/"), product.id + " wrong product image: " + bubble.hero.url);
  const dmButton = bubble.footer.contents.find((button) => button.action?.label === "看產品DM");
  assert.ok(dmButton, product.id + " missing DM button");
  assert.ok(dmButton.action.uri.includes("/images/dm-final/"), product.id + " wrong DM URL: " + dmButton.action.uri);
}
console.log("PASS LINE product images and final DM buttons v309.0");

for (const message of [mascotWelcomeReply(), recommendReply(), comboMenuReply(), usageChooserReply()]) {
  const bubble = message.contents.type === "carousel" ? message.contents.contents[0] : message.contents;
  assert.ok(bubble.hero, "小老闆卡缺少圖片");
  assert.ok(bubble.hero.url.includes("/images/brand/xianjiawei-scene-"));
}
console.log("PASS LINE OA mascot cards v309.0");
