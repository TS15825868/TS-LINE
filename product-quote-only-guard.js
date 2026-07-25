"use strict";

const fs = require("fs");
const path = require("path");
const Module = require("module");

const VERSION = "2026-07-25-quote-only-v2";

function transformServer(source) {
  let out = String(source);

  out = out.replace(
    'orderStatus: "開放下單",',
    'orderStatus: product.quoteOnly ? "洽詢客服" : "開放下單",'
  );

  out = out.replace(
    "function productBubble(product) {\n  const priceLine = product.originalPrice",
    "function productBubble(product) {\n  const priceLine = product.quoteOnly ? (product.priceLabel || \"價格請洽詢客服\") : product.originalPrice"
  );

  out = out.replace(
    'contents: [\n        {\n          type: "button",\n          style: "primary",\n          color: "#7B1E1E",\n          action: { type: "message", label: "選擇數量", text: `選擇數量｜${product.id}` },\n        },',
    'contents: [\n        product.quoteOnly ? {\n          type: "button",\n          style: "primary",\n          color: "#7B1E1E",\n          action: { type: "uri", label: "LINE洽詢", uri: DATA.lineUrl || "https://lin.ee/sHZW7NkR" },\n        } : {\n          type: "button",\n          style: "primary",\n          color: "#7B1E1E",\n          action: { type: "message", label: "選擇數量", text: `選擇數量｜${product.id}` },\n        },'
  );

  out = out.replace(
    "contents: DATA.products.map((product) => {\n        const original = product.originalPrice",
    "contents: DATA.products.map((product) => {\n        if (product.quoteOnly) return flexCard(product.displayName, `規格：${product.spec}\\n${product.priceLabel || \"價格與通路條件請洽詢客服\"}\\n\\n${ORDER_NOTICE}`, [\n          { label: \"LINE洽詢\", uri: DATA.lineUrl || \"https://lin.ee/sHZW7NkR\" },\n          { label: \"看產品DM\", uri: absoluteUrl(product.dmImage || product.image || \"images/logo.png\") },\n          { label: \"看產品\", text: \"看產品\" },\n        ]).contents;\n        const original = product.originalPrice"
  );

  out = out.replace(
    "function qtyMenu(product) {\n  const options",
    "function qtyMenu(product) {\n  if (product.quoteOnly) return flexCard(`${product.displayName}｜價格洽詢`, `${product.priceLabel || \"價格與通路條件請洽詢客服\"}\\n\\n${ORDER_NOTICE}`, [\n    { label: \"LINE洽詢\", uri: DATA.lineUrl || \"https://lin.ee/sHZW7NkR\" },\n    { label: \"看產品DM\", uri: absoluteUrl(product.dmImage || product.image || \"images/logo.png\") },\n    { label: \"返回產品\", text: \"看產品\" },\n  ]);\n  const options"
  );

  out = out.replace(
    "function calcItem(product, qty) {\n  const offers",
    "function calcItem(product, qty) {\n  if (product.quoteOnly) return { total: 0, label: \"價格請洽詢\" };\n  const offers"
  );

  out = out.replace(
    "function addCart(state, product, qty) {\n  const existing",
    "function addCart(state, product, qty) {\n  if (product.quoteOnly) return false;\n  const existing"
  );

  out = out.replace(
    'function usageReply(product) {\n  return flexCard(\n    `${product.displayName}｜使用方式`,\n    `${(product.usage || []).join("\\n\\n")}\\n\\n成分：${(product.ingredients || []).join("、")}\\n\\n${ORDER_NOTICE}`,\n    [\n      { label: "選擇數量", text: `選擇數量｜${product.id}` },',
    'function usageReply(product) {\n  return flexCard(\n    `${product.displayName}｜使用方式`,\n    `${(product.usage || []).join("\\n\\n")}\\n\\n成分：${(product.ingredients || []).join("、")}\\n\\n${ORDER_NOTICE}`,\n    [\n      product.quoteOnly\n        ? { label: "LINE洽詢", uri: DATA.lineUrl || "https://lin.ee/sHZW7NkR" }\n        : { label: "選擇數量", text: `選擇數量｜${product.id}` },'
  );

  out = out.replace(
    'if (data.action === "add" && product && data.qty > 0) {\n    addCart(state, product, data.qty);',
    'if (data.action === "add" && product && data.qty > 0) {\n    if (product.quoteOnly) return reply(event.replyToken, qtyMenu(product));\n    addCart(state, product, data.qty);'
  );

  out = out.replace(
    'if (!product || qty <= 0) return reply(event.replyToken, textMsg("加入購物車失敗，請重新選擇。", mainQuick()));\n    addCart(state, product, qty);',
    'if (!product || qty <= 0) return reply(event.replyToken, textMsg("加入購物車失敗，請重新選擇。", mainQuick()));\n    if (product.quoteOnly) return reply(event.replyToken, qtyMenu(product));\n    addCart(state, product, qty);'
  );

  return out;
}

function install() {
  if (Module._extensions[".js"].__xjwQuoteOnlyGuard) return;
  const previous = Module._extensions[".js"];
  const wrapped = function loadWithQuoteOnly(module, filename) {
    if (path.basename(filename) !== "server.js") return previous(module, filename);
    return module._compile(transformServer(fs.readFileSync(filename, "utf8")), filename);
  };
  Object.defineProperty(wrapped, "__xjwQuoteOnlyGuard", { value: true });
  Module._extensions[".js"] = wrapped;
}

install();
module.exports = { VERSION, transformServer, install };
