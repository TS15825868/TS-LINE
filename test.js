"use strict";

const assert = require("assert");
const {
  DATA,
  VERSION,
  getProduct,
  detectProduct,
  calcItem,
  addCart,
  cartTotal,
  productCarousel,
  productMenuReply,
  priceCarousel,
  recommendReply,
  comboReply,
  comboMenuReply,
  comboDetailReply,
  usageChooserReply,
  usageReply,
  doctorReferralReply,
  huangdiNeijingReply,
  brandStoryReply,
  isSensitiveHealthQuestion,
} = require("./server");

assert.strictEqual(VERSION, "v401.4");
assert.deepStrictEqual(
  DATA.products.map((product) => product.id),
  ["guilu-gao", "guilu-drink-30", "guilu-drink-180", "guilu-tangkuai", "guilu-jiao", "luerong-fen"]
);

for (const product of DATA.products) {
  for (const key of ["displayName", "spec", "price", "unit", "image", "dmImage", "page", "usage", "ingredients"]) {
    assert.ok(product[key], `${product.id} missing ${key}`);
  }
  assert.ok(Array.isArray(product.usage) && product.usage.length > 0, `${product.id} usage invalid`);
  assert.ok(Array.isArray(product.ingredients) && product.ingredients.length > 0, `${product.id} ingredients invalid`);
}

assert.strictEqual(detectProduct("龜鹿飲180cc鋁袋").id, "guilu-drink-180");
assert.strictEqual(detectProduct("龜鹿飲30cc玻璃瓶").id, "guilu-drink-30");
assert.strictEqual(detectProduct("龜鹿膏怎麼使用").id, "guilu-gao");
assert.strictEqual(detectProduct("龜鹿湯塊").id, "guilu-tangkuai");
assert.strictEqual(detectProduct("龜鹿膠一斤裝").id, "guilu-jiao");
assert.strictEqual(detectProduct("鹿茸粉").id, "luerong-fen");

const drink30 = getProduct("guilu-drink-30");
assert.deepStrictEqual(calcItem(drink30, 1), { total: 50, label: "單瓶×1" });
assert.deepStrictEqual(calcItem(drink30, 12), { total: 500, label: "買10送2（12瓶）×1" });
assert.deepStrictEqual(calcItem(drink30, 24), { total: 1000, label: "買10送2（12瓶）×2" });

const state = { cart: [], checkout: null };
addCart(state, drink30, 12);
addCart(state, drink30, 1);
assert.strictEqual(state.cart.length, 1);
assert.strictEqual(state.cart[0].qty, 13);
assert.strictEqual(cartTotal(state.cart), 550);

const productCards = productCarousel();
assert.strictEqual(productCards.type, "flex");
assert.strictEqual(productCards.contents.type, "carousel");
assert.strictEqual(productCards.contents.contents.length, DATA.products.length);
assert.strictEqual(priceCarousel().contents.contents.length, DATA.products.length);

for (const card of productCards.contents.contents) {
  for (const button of card.footer.contents) {
    assert.ok(["message", "uri"].includes(button.action.type));
    assert.notStrictEqual(button.action.type, "postback");
  }
}

assert.strictEqual(recommendReply().contents.contents.length, 4);
assert.ok(comboReply().contents.body.contents[1].text.includes("搭配組合"));
assert.strictEqual(usageChooserReply().contents.contents.length, DATA.products.length + 1);
assert.ok(usageReply(drink30).contents.body.contents[1].text.includes("開瓶即可飲用"));
assert.ok(doctorReferralReply().contents.body.contents[1].text.includes("@changwuchi"));
assert.strictEqual(doctorReferralReply().contents.footer.contents[0].action.uri, "https://lin.ee/1MK4NR9");
assert.ok(huangdiNeijingReply().contents.body.contents[0].text.includes("黃帝內經"));
assert.ok(brandStoryReply().body.contents[1].text.includes("2008年"));

assert.strictEqual(isSensitiveHealthQuestion("我有高血壓可以吃嗎"), true);
assert.strictEqual(isSensitiveHealthQuestion("枸杞可以明目嗎"), true);
assert.strictEqual(isSensitiveHealthQuestion("龜鹿膏怎麼使用"), false);
assert.strictEqual(isSensitiveHealthQuestion("搭配組合"), false);

console.log(`PASS LINE OA ${VERSION}: products, prices, cart, cards, usage, classics and referral`);

assert.strictEqual(productMenuReply().contents.contents.length, DATA.products.length);
assert.strictEqual(comboMenuReply().contents.contents.length, DATA.offers.comboOffers.length + 1);
assert.ok(comboMenuReply().contents.contents[0].body.contents[0].text.includes("日常搭配導覽"));
assert.ok(comboMenuReply().contents.contents[1].body.contents[0].text.includes("日常節奏組"));
assert.ok(comboDetailReply(0).contents.body.contents[0].text.includes("日常節奏組"));
