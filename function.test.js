"use strict";
const assert = require("assert");
const fs = require("fs");
const {
  DATA, VERSION, productMenuReply, priceCarousel, recommendReply,
  comboMenuReply, comboDetailReply, usageChooserReply, usageReply,
  doctorReferralReply, huangdiNeijingReply, brandStoryReply,
  qtyMenu, cartFlex,
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

assert.strictEqual(VERSION, "v300.3");
const messages = [
  productMenuReply(), priceCarousel(), recommendReply(), comboMenuReply(), comboDetailReply(0),
  usageChooserReply(), doctorReferralReply(), huangdiNeijingReply(), brandStoryReply(),
  cartFlex({ cart: [], checkout: null }),
];
for (const product of DATA.products) {
  messages.push(usageReply(product));
  messages.push(qtyMenu(product));
}
messages.forEach(validateMessage);
assert.strictEqual(productMenuReply().contents.contents.length, 6);
assert.ok(productMenuReply().contents.contents.every((bubble) => !bubble.hero));
assert.strictEqual(recommendReply().contents.contents.length, 3);
assert.strictEqual(comboMenuReply().contents.contents.length, DATA.offers.comboOffers.length);
assert.strictEqual(usageChooserReply().contents.contents.length, 6);
const source = fs.readFileSync("server.js", "utf8");
for (const command of ["看產品", "直接下單", "幫我推薦", "搭配組合", "怎麼使用", "查看購買清單", "開始結帳"]) {
  assert.ok(source.includes(command), "missing command: " + command);
}
console.log("PASS full LINE function matrix v300.3");
