"use strict";

const fs = require("fs");
const path = require("path");
const root = path.resolve(__dirname, "..");
const read = (name) => fs.readFileSync(path.join(root, name), "utf8");
const write = (name, value) => fs.writeFileSync(path.join(root, name), value, "utf8");

function replaceBlock(source, pattern, replacement, label) {
  const next = source.replace(pattern, replacement);
  if (next === source) throw new Error(`找不到更新區塊：${label}`);
  return next;
}

let server = read("server.js");
server = server.replace(/仙加味 LINE OA Bot v300\.2/g, "仙加味 LINE OA Bot v300.3");
server = server.replace('const VERSION = "v300.2";', 'const VERSION = "v300.3";');
server = server.replace(
  " * LINE 憑證與 CRM URL 僅從部署環境變數讀取。",
  " * LINE 憑證僅從部署環境變數讀取；CRM 可由環境變數覆蓋預設網址。"
);

const productBubble = [
  'function productBubble(product) {',
  '  const priceLine = product.originalPrice && product.originalPrice > product.price',
  '    ? `售價 ${money(product.originalPrice)}\\n優惠價 ${money(product.price)}`',
  '    : `售價 ${money(product.price)}`;',
  '  const offers = product.offers.length',
  '    ? `\\n${product.offers.map((offer) => `${offer.label}：${money(offer.total)}`).join("\\n")}`',
  '    : "";',
  '',
  '  return {',
  '    type: "bubble",',
  '    size: "mega",',
  '    body: {',
  '      type: "box",',
  '      layout: "vertical",',
  '      spacing: "md",',
  '      contents: [',
  '        { type: "text", text: product.displayName, weight: "bold", size: "xl", color: "#7B1E1E", wrap: true },',
  '        {',
  '          type: "text",',
  '          text: `規格：${product.spec}\\n${product.purpose ? `用途方向：${product.purpose}\\n` : ""}${priceLine}${offers}`,',
  '          size: "sm",',
  '          color: "#555555",',
  '          wrap: true,',
  '        },',
  '        { type: "text", text: ORDER_NOTICE, size: "sm", color: "#7B1E1E", weight: "bold", wrap: true },',
  '      ],',
  '    },',
  '    footer: {',
  '      type: "box",',
  '      layout: "vertical",',
  '      spacing: "sm",',
  '      contents: [',
  '        {',
  '          type: "button",',
  '          style: "primary",',
  '          color: "#7B1E1E",',
  '          action: { type: "message", label: "選擇數量", text: `選擇數量｜${product.id}` },',
  '        },',
  '        {',
  '          type: "button",',
  '          style: "secondary",',
  '          action: { type: "uri", label: "完整介紹", uri: absoluteUrl(product.page || "products.html") },',
  '        },',
  '        {',
  '          type: "button",',
  '          style: "secondary",',
  '          action: { type: "message", label: "使用方式", text: `使用方式｜${product.id}` },',
  '        },',
  '      ],',
  '    },',
  '  };',
  '}',
  '',
  'function productCarousel',
].join("\n");

server = replaceBlock(
  server,
  /function productBubble\(product\) \{[\s\S]*?\n\}\n\nfunction productCarousel/,
  productBubble,
  "產品卡片"
);

server = server.replace(
  '/^(看產品|查看產品|直接下單|我要下單|立即下單|開始下單|我要買)$/',
  '/^(看產品|查看產品|看商品|產品|直接下單|直接購買|我要下單|立即下單|開始下單|我要買)$/'
);

server = server.replace(
  "  cleanupExpiredStates,\n};",
  "  cleanupExpiredStates,\n  qtyMenu,\n  cartFlex,\n};"
);
write("server.js", server);

let test = read("test.js");
test = test.replace('assert.strictEqual(VERSION, "v300.2");', 'assert.strictEqual(VERSION, "v300.3");');
write("test.js", test);

let security = read("security.test.js");
security = security.replace('assert.strictEqual(VERSION, "v300.2");', 'assert.strictEqual(VERSION, "v300.3");');
security = security.replace("PASS security and UX v300.2", "PASS security and UX v300.3");
write("security.test.js", security);

const functionTest = [
  '"use strict";',
  'const assert = require("assert");',
  'const fs = require("fs");',
  'const {',
  '  DATA, VERSION, productMenuReply, priceCarousel, recommendReply,',
  '  comboMenuReply, comboDetailReply, usageChooserReply, usageReply,',
  '  doctorReferralReply, huangdiNeijingReply, brandStoryReply,',
  '  qtyMenu, cartFlex,',
  '} = require("./server");',
  '',
  'function validateMessage(message) {',
  '  assert.ok(message && typeof message === "object");',
  '  assert.ok(["text", "flex"].includes(message.type));',
  '  if (message.type === "flex") {',
  '    assert.ok(message.altText && message.altText.length <= 400);',
  '    assert.ok(message.contents && ["bubble", "carousel"].includes(message.contents.type));',
  '    if (message.contents.type === "carousel") {',
  '      assert.ok(message.contents.contents.length >= 1 && message.contents.contents.length <= 12);',
  '    }',
  '  }',
  '  const walk = (node) => {',
  '    if (!node || typeof node !== "object") return;',
  '    if (node.type === "button" && node.action) {',
  '      assert.ok(node.action.label && node.action.label.length <= 20);',
  '      if (node.action.type === "message") assert.ok(node.action.text && node.action.text.length <= 300);',
  '      if (node.action.type === "uri") assert.ok(/^https:\\/\\//.test(node.action.uri));',
  '    }',
  '    if (Array.isArray(node)) node.forEach(walk);',
  '    else Object.values(node).forEach(walk);',
  '  };',
  '  walk(message);',
  '}',
  '',
  'assert.strictEqual(VERSION, "v300.3");',
  'const messages = [',
  '  productMenuReply(), priceCarousel(), recommendReply(), comboMenuReply(), comboDetailReply(0),',
  '  usageChooserReply(), doctorReferralReply(), huangdiNeijingReply(), brandStoryReply(),',
  '  cartFlex({ cart: [], checkout: null }),',
  '];',
  'for (const product of DATA.products) {',
  '  messages.push(usageReply(product));',
  '  messages.push(qtyMenu(product));',
  '}',
  'messages.forEach(validateMessage);',
  'assert.strictEqual(productMenuReply().contents.contents.length, 6);',
  'assert.ok(productMenuReply().contents.contents.every((bubble) => !bubble.hero));',
  'assert.strictEqual(recommendReply().contents.contents.length, 3);',
  'assert.strictEqual(comboMenuReply().contents.contents.length, DATA.offers.comboOffers.length);',
  'assert.strictEqual(usageChooserReply().contents.contents.length, 6);',
  'const source = fs.readFileSync("server.js", "utf8");',
  'for (const command of ["看產品", "直接下單", "幫我推薦", "搭配組合", "怎麼使用", "查看購買清單", "開始結帳"]) {',
  '  assert.ok(source.includes(command), "missing command: " + command);',
  '}',
  'console.log("PASS full LINE function matrix v300.3");',
  '',
].join("\n");
write("function.test.js", functionTest);

const pkg = JSON.parse(read("package.json"));
pkg.version = "3.0.3";
pkg.scripts.test = "node test.js && node catalog.test.js && node security.test.js && node function.test.js";
write("package.json", JSON.stringify(pkg, null, 2) + "\n");

let verify = read(".github/workflows/verify-line-and-website-catalog.yml");
verify = verify.replace('"version":"v300.2"', '"version":"v300.3"');
if (!verify.includes("node --check function.test.js")) {
  verify = verify.replace("          node --check security.test.js\n", "          node --check security.test.js\n          node --check function.test.js\n");
}
write(".github/workflows/verify-line-and-website-catalog.yml", verify);

let readme = read("README.md");
readme = readme.replace(/# 仙加味 LINE OA v300\.[0-9]+/, "# 仙加味 LINE OA v300.3");
readme = readme.replace(/\"version\": \"v300\.[0-9]+\"/, '"version": "v300.3"');
if (!readme.includes("## v300.3 全功能檢查")) {
  readme += "\n## v300.3 全功能檢查\n\n產品與直接下單入口改為不依賴外部圖片載入的 Flex 卡片，保留選擇數量、完整介紹與使用方式按鈕；並加入產品、價格、推薦、搭配、使用、購物車與結帳的訊息格式測試。\n";
}
write("README.md", readme);

console.log("Applied LINE OA full function fix v300.3b");
