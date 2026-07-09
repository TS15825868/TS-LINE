"use strict";

const fs = require("fs");
const path = require("path");
const file = path.join(__dirname, "..", "server.js");
let source = fs.readFileSync(file, "utf8");
const pattern = /if \(\/\^\(看產品\|查看產品\|直接下單\|我要下單\|立即下單\|開始下單\|我要買\)\$\/\.test\(text\)\) \{\n\s*return reply\(event\.replyToken, productCarousel\(\)\);\n\s*\}/;
const replacement = `if (/^(看產品|查看產品|直接下單|我要下單|立即下單|開始下單|我要買)$/.test(text)) {
    return reply(event.replyToken, productMenuReply());
  }`;
if (!pattern.test(source)) {
  if (source.includes("return reply(event.replyToken, productMenuReply());")) {
    console.log("Product menu handler already updated");
    process.exit(0);
  }
  throw new Error("找不到看產品處理區塊");
}
source = source.replace(pattern, replacement);
fs.writeFileSync(file, source, "utf8");
console.log("Updated product menu handler");
