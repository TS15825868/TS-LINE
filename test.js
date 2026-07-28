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

assert.strictEqual(VERSION, "v401.6");
assert.deepStrictEqual(
  DATA.products.map((product) => product.id),
  ["guilu-gao", "guilu-drink-30", "guilu-drink-180", "guilu-tangkuai", "guilu-jiao", "luerong-fen"]
);

for (const product of DATA.products) {
  for (const key of ["displayName", "spec", "unit", "image", "dmImage", "page", "usage", "ingredients"]) {
    assert.ok(product[key], `${product.id} missing ${key}`);
  }
  assert.notStrictEqual(product.price, undefined, `${product.id} missing price`);
  assert(Number(product.price) > 0, `${product.id} 正式售價必須大於0`);
  assert.ok(Array.isArray(product.offers), `${product.id} offers invalid`);
  assert(product.offers.every((offer) => offer && typeof offer === "object" && Number(offer.qty) > 0 && Number(offer.total) >= 0 && offer.label), `${product.id} offers must be cart-safe objects`);
  assert.ok(Array.isArray(product.usage) && product.usage.length > 0, `${product.id} usage invalid`);
  assert.ok(Array.isArray(product.ingredients) && product.ingredients.length > 0, `${product.id} ingredients invalid`);
}

assert.strictEqual(detectProduct("龜鹿飲180cc鋁袋").id, "guilu-drink-180");
assert.strictEqual(detectProduct("龜鹿飲30cc玻璃罐").id, "guilu-drink-30");
assert.strictEqual(detectProduct("龜鹿膏怎麼使用").id, "guilu-gao");
assert.strictEqual(detectProduct("龜鹿湯塊").id, "guilu-tangkuai");
assert.strictEqual(detectProduct("龜鹿膠一斤裝").id, "guilu-jiao");
assert.strictEqual(detectProduct("鹿茸粉").id, "luerong-fen");

const gao = getProduct("guilu-gao");
assert.strictEqual(gao.price, 1500);
assert.strictEqual(gao.originalPrice, 1800);
const drink30 = getProduct("guilu-drink-30");
assert.strictEqual(drink30.price, 50);
assert.deepStrictEqual(calcItem(drink30, 1), { total: 50, label: "單瓶×1" });
assert.deepStrictEqual(calcItem(drink30, 12), { total: 500, label: "買10送2×1" });
assert.deepStrictEqual(calcItem(drink30, 24), { total: 1000, label: "買10送2×2" });
const drink180 = getProduct("guilu-drink-180");
assert.strictEqual(drink180.price, 200);
assert.deepStrictEqual(calcItem(drink180, 12), { total: 2000, label: "買10送2×1" });
assert.strictEqual(getProduct("guilu-tangkuai").price, 1600);
assert.strictEqual(getProduct("luerong-fen").price, 2000);
assert.strictEqual(getProduct("guilu-jiao").price, 9600);
assert.strictEqual(getProduct("guilu-jiao").originalPrice, 12000);
assert.strictEqual(getProduct("guilu-jiao").quoteOnly, false);

const state = { cart: [], checkout: null };
addCart(state, drink30, 12);
addCart(state, drink30, 1);
assert.strictEqual(state.cart.length, 1);
assert.strictEqual(state.cart[0].qty, 13);
assert.strictEqual(state.cart[0].label, "買10送2×1＋單瓶×1");
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
assert.ok(usageReply(drink30).contents.body.contents[1].text.includes("開罐即可飲用"));
assert.ok(doctorReferralReply().contents.body.contents[1].text.includes("@changwuchi"));
assert.strictEqual(doctorReferralReply().contents.footer.contents[0].action.uri, "https://lin.ee/1MK4NR9");
assert.ok(huangdiNeijingReply().contents.body.contents[0].text.includes("黃帝內經"));
assert.ok(brandStoryReply().body.contents[1].text.includes("2008年"));

assert.strictEqual(isSensitiveHealthQuestion("我有高血壓可以吃嗎"), true);
assert.strictEqual(isSensitiveHealthQuestion("枸杞可以明目嗎"), true);
assert.strictEqual(isSensitiveHealthQuestion("龜鹿膏怎麼使用"), false);
assert.strictEqual(isSensitiveHealthQuestion("搭配組合"), false);

assert.strictEqual(productMenuReply().contents.contents.length, DATA.products.length);
assert.strictEqual(DATA.offers.comboOffers.length, 3);
assert.strictEqual(comboMenuReply().contents.contents.length, DATA.offers.comboOffers.length + 1);
assert.ok(comboMenuReply().contents.contents[0].body.contents[0].text.includes("日常搭配導覽"));
assert.ok(comboMenuReply().contents.contents[1].body.contents[0].text.includes("日常節奏組"));
assert.ok(comboDetailReply(0).contents.body.contents[0].text.includes("日常節奏組"));

console.log(`PASS LINE OA ${VERSION}: official prices, buy-ten-get-two cart pricing, six products, three combos, cards, usage, classics and referral`);
