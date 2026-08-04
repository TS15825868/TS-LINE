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
assert.strictEqual(detectProduct("龜鹿飲30cc玻璃罐").id, "guilu-drink-30");
assert.strictEqual(detectProduct("龜鹿飲30cc玻璃罐").id, "guilu-drink-30");
assert.strictEqual(detectProduct("龜鹿飲30cc玻璃罐").id, "guilu-drink-30");
assert.strictEqual(detectProduct("龜鹿飲30cc玻璃罐").id, "guilu-drink-30");
assert.strictEqual(detectProduct("龜鹿飲30cc玻璃罐").id, "guilu-drink-30");
assert.strictEqual(detectProduct("龜鹿飲30cc玻璃罐").id, "guilu-drink-30");
assert.strictEqual(detectProduct("龜鹿飲30cc玻璃罐").id, "guilu-drink-30");
assert.strictEqual(detectProduct("龜鹿飲30cc玻璃罐").id, "guilu-drink-30");
assert.strictEqual(detectProduct("龜鹿飲30cc玻璃罐").id, "guilu-drink-30");
assert.strictEqual(detectProduct("龜鹿飲30cc玻璃罐").id, "guilu-drink-30");
assert.strictEqual(detectProduct("龜鹿飲30cc玻璃罐").id, "guilu-drink-30");
assert.strictEqual(detectProduct("龜鹿飲30cc玻璃罐").id, "guilu-drink-30");
assert.strictEqual(detectProduct("龜鹿飲30cc玻璃罐").id, "guilu-drink-30");
assert.strictEqual(detectProduct("龜鹿飲30cc玻璃罐").id, "guilu-drink-30");
assert.strictEqual(detectProduct("龜鹿飲30cc玻璃罐").id, "guilu-drink-30");
assert.strictEqual(detectProduct("龜鹿飲30cc玻璃罐").id, "guilu-drink-30");
assert.strictEqual(detectProduct("龜鹿飲30cc玻璃罐").id, "guilu-drink-30");
assert.strictEqual(detectProduct("龜鹿飲30cc玻璃罐").id, "guilu-drink-30");
assert.strictEqual(detectProduct("龜鹿飲30cc玻璃罐").id, "guilu-drink-30");
assert.strictEqual(detectProduct("龜鹿飲30cc玻璃罐").id, "guilu-drink-30");
assert.strictEqual(detectProduct("龜鹿飲30cc玻璃罐").id, "guilu-drink-30");
assert.strictEqual(detectProduct("龜鹿飲30cc玻璃罐").id, "guilu-drink-30");
assert.strictEqual(detectProduct("龜鹿飲30cc玻璃罐").id, "guilu-drink-30");
assert.strictEqual(detectProduct("龜鹿飲30cc玻璃罐").id, "guilu-drink-30");
assert.strictEqual(detectProduct("龜鹿飲30cc玻璃罐").id, "guilu-drink-30");
assert.strictEqual(detectProduct("龜鹿飲30cc玻璃罐").id, "guilu-drink-30");
assert.strictEqual(detectProduct("龜鹿飲30cc玻璃罐").id, "guilu-drink-30");
assert.strictEqual(detectProduct("龜鹿飲30cc玻璃罐").id, "guilu-drink-30");
assert.strictEqual(detectProduct("龜鹿飲30cc玻璃罐").id, "guilu-drink-30");
assert.strictEqual(detectProduct("龜鹿飲30cc玻璃罐").id, "guilu-drink-30");
assert.strictEqual(detectProduct("龜鹿飲30cc玻璃罐").id, "guilu-drink-30");
assert.strictEqual(detectProduct("龜鹿膏怎麼使用").id, "guilu-gao");
assert.strictEqual(detectProduct("龜鹿湯塊").id, "guilu-tangkuai");
assert.strictEqual(detectProduct("龜鹿膠一斤裝").id, "guilu-jiao");
assert.strictEqual(detectProduct("鹿茸粉").id, "luerong-fen");

const gao = getProduct("guilu-gao");
assert.strictEqual(gao.price, 1800);
assert.strictEqual(gao.originalPrice, 2100);
const drink30 = getProduct("guilu-drink-30");
assert.strictEqual(drink30.price, 50);
assert.strictEqual(drink30.unit, "罐");
assert.strictEqual(drink30.size, "30cc／罐（小玻璃罐）");
assert.deepStrictEqual(calcItem(drink30, 1), { total: 50, label: "單罐×1" });
assert.deepStrictEqual(calcItem(drink30, 11), { total: 500, label: "買10送1×1" });
assert.deepStrictEqual(calcItem(drink30, 22), { total: 1000, label: "買10送1×2" });
const drink180 = getProduct("guilu-drink-180");
assert.strictEqual(drink180.price, 200);
assert.deepStrictEqual(calcItem(drink180, 12), { total: 2000, label: "買10送1×1" });
assert.strictEqual(getProduct("guilu-tangkuai").price, 1600);
assert.strictEqual(getProduct("luerong-fen").price, 2000);
assert.strictEqual(getProduct("guilu-jiao").price, 9600);
assert.strictEqual(getProduct("guilu-jiao").originalPrice, 12000);
assert.strictEqual(getProduct("guilu-jiao").quoteOnly, false);
assert.strictEqual(getProduct("guilu-jiao").size, "600g／盒（1斤）｜32塊裝｜每塊約18.75g");
assert.strictEqual(getProduct("guilu-jiao").unit, "盒");

const state = { cart: [], checkout: null };
addCart(state, drink30, 11);
addCart(state, drink30, 1);
assert.strictEqual(state.cart.length, 1);
assert.strictEqual(state.cart[0].qty, 12);
assert.strictEqual(state.cart[0].label, "買10送1×1＋單罐×1");
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
