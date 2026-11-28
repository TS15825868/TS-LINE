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
// New combined menu is only navigation. Existing verified trial and retail routes remain separate.
const fresh = {cart:[{id:"guilu-gao",qty:1}]};
const before = JSON.stringify(fresh);
const services = server.purchaseServiceReply(fresh);
assert.equal(services.type, "flex");
assert.equal(services.contents.type, "bubble");
assert.deepEqual(services.contents.footer.contents.map(x=>x.action.text),
  ["試喝","看產品","查看購買清單","常見問題","我要人工客服"]);
assert.equal(JSON.stringify(fresh),before,"入口不得清空購買清單或建立訂單");
for (const state of [{checkout:{trial:true,crmUncertain:true}},{businessInquiry:{step:"details"}},{merchantOrderInquiry:{step:"contact"}},{merchantQuickOrder:{items:[]}},{consumerCustomQuantityId:"guilu-gao"}]) {
  const snapshot=JSON.stringify(state);
  const reply=server.purchaseServiceReply(state);
  assert.equal(reply.type,"text");
  assert.deepEqual(reply.quickReply.items.map(x=>x.action.text),["我要人工客服"]);
  assert.equal(JSON.stringify(state),snapshot,"進行中的填寫與不確定收件狀態必須保留");
}
assert.ok(require("node:fs").readFileSync(require("node:path").join(__dirname,"server.js"),"utf8").includes('if (text === "訂購與試喝") return reply(event.replyToken, purchaseServiceReply(state));'));
console.log("PASS: 訂購與試喝提供獨立五入口；保留購買清單及進行中表單；不自動建立或送出訂單。");
process.exit(0);
