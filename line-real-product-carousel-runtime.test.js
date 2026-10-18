"use strict";
const assert = require("node:assert/strict");
const server = require("./server");
const response = server.productCarousel();
assert.equal(response.type, "flex", "單組全部商品應為 LINE Flex");
assert.equal(response.contents.type, "carousel", "全部商品需左右滑動");
assert.ok(response.contents.contents.length >= 9, "核心四款與五款已核准公開商品必須出現");
for (const [i, bubble] of response.contents.contents.entries()) {
  assert.equal(bubble.type, "bubble", "第 "+(i+1)+"張卡片類型錯誤");
  assert.equal(bubble.hero?.type, "image");
  assert.match(bubble.hero?.url || "", /^https:\/\//);
  assert.ok((bubble.footer?.contents || []).length >= 2, "缺少商品操作");
}
console.log("PASS: 完整 server 真正產生 "+response.contents.contents.length+" 張商品卡，LINE 點看產品不應拋錯");
process.exit(0);
