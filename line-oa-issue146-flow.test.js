"use strict";

const assert = require("assert");
const bot = require("./server");
const imageSafety = require("./line-image-safety");

function walk(node, visit) {
  if (!node || typeof node !== "object") return;
  visit(node);
  if (Array.isArray(node)) {
    for (const item of node) walk(item, visit);
    return;
  }
  for (const value of Object.values(node)) walk(value, visit);
}

function imageUrls(message) {
  const urls = [];
  walk(message, (node) => {
    if (node.type === "image" && node.url) urls.push(String(node.url));
  });
  return urls;
}

function actions(message) {
  const result = [];
  walk(message, (node) => {
    if (node.action && typeof node.action === "object") result.push(node.action);
  });
  return result;
}

function carouselSize(message) {
  const content = message?.contents;
  return content?.type === "carousel" && Array.isArray(content.contents)
    ? content.contents.length
    : 0;
}

assert(Array.isArray(bot.DATA.products), "LINE OA 正式產品資料不是陣列");
assert.strictEqual(bot.DATA.products.length, 6, "LINE OA 應維持六項正式產品規格");

const productCarousel = bot.productCarousel();
assert.strictEqual(productCarousel.type, "flex");
assert.strictEqual(productCarousel.contents.type, "carousel");
assert.strictEqual(productCarousel.contents.contents.length, bot.DATA.products.length);
assert(productCarousel.contents.contents.length <= 12, "產品 Carousel 超過 LINE 上限");
for (const bubble of productCarousel.contents.contents) {
  assert.strictEqual(bubble.type, "bubble");
  assert.strictEqual(bubble.hero?.type, "image", "產品卡缺少正式產品圖片");
  assert.strictEqual(bubble.hero?.aspectMode, "fit", "產品圖未維持等比例 fit");
  assert(/\/images\/products-v3\//.test(String(bubble.hero?.url || "")), `產品卡不是 products-v3 正式原圖：${bubble.hero?.url || ""}`);
  assert(!/\/mascot\//.test(String(bubble.hero?.url || "")), "產品卡被小老闆入口圖覆蓋");
}

const sceneReplies = [
  ["recommend", bot.recommendReply()],
  ["combo", bot.comboReply()],
  ["usage", bot.usageChooserReply()],
  ["faq", bot.faqReply()],
];

for (const [scene, response] of sceneReplies) {
  imageSafety.applyImageSafety(response);
  const urls = imageUrls(response);
  assert(urls.some((url) => url.includes(`/mascot/${scene}.jpg`)), `${scene} 流程未使用正式完整入口圖`);
  assert(!urls.some((url) => /welcome\.jpg|service\.jpg|brand\.jpg|products\.jpg|cart\.jpg/.test(url)), `${scene} 流程仍包含舊拼湊圖`);
  const count = carouselSize(response);
  if (count) assert(count <= 12, `${scene} Carousel 超過 LINE 上限`);
  const serviceActions = actions(response).filter((action) => action.text === "我要人工客服" || action.label === "人工客服");
  assert(serviceActions.length > 0, `${scene} 流程缺少人工客服入口`);
}

const recommendActions = actions(sceneReplies[0][1]);
assert(recommendActions.some((action) => action.text === "看產品"), "幫我推薦缺少看產品入口");
assert(recommendActions.some((action) => action.text === "搭配組合"), "幫我推薦缺少搭配組合入口");

const comboActions = actions(sceneReplies[1][1]);
assert(comboActions.some((action) => /搭配組數｜\d+/.test(String(action.text || ""))), "搭配組合缺少選擇組數操作");
assert(comboActions.some((action) => action.text === "看產品"), "搭配組合缺少看產品入口");

const usageActions = actions(sceneReplies[2][1]);
assert(usageActions.some((action) => /產品詳情｜/.test(String(action.text || ""))), "怎麼使用缺少產品詳情操作");

const faqActions = actions(sceneReplies[3][1]);
assert(faqActions.some((action) => action.text === "看產品" || action.text === "幫我推薦" || action.text === "我要人工客服"), "常見問題缺少後續操作");

const cartState = { cart: [] };
const firstProduct = bot.DATA.products[0];
bot.addCart(cartState, firstProduct, 1);
assert.strictEqual(cartState.cart.length, 1, "加入購物車失敗");
assert.strictEqual(cartState.cart[0].id, firstProduct.id, "購物車產品識別錯誤");
assert(bot.cartTotal(cartState.cart) > 0, "購物車總額未正確計算");

const qtyMenu = bot.qtyMenu(firstProduct);
assert(qtyMenu, "產品缺少數量選擇流程");
assert(actions(qtyMenu).length > 0, "數量選擇流程沒有可操作按鈕");

console.log("PASS LINE OA Issue #146: official complete scenes, real product cards, carousel limits, quick paths, cart, order quantity and human service flow");
