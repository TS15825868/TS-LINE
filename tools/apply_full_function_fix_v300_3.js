"use strict";

const fs = require("fs");
const path = require("path");
const root = path.resolve(__dirname, "..");
const file = (name) => path.join(root, name);
const read = (name) => fs.readFileSync(file(name), "utf8");
const write = (name, value) => fs.writeFileSync(file(name), value, "utf8");

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

const safeProductBubble = `function productBubble(product) {
  const priceLine = product.originalPrice && product.originalPrice > product.price
    ? \`售價 \${money(product.originalPrice)}\\n優惠價 \${money(product.price)}\`
    : \`售價 \${money(product.price)}\`;
  const offers = product.offers.length
    ? \`\\n\${product.offers.map((offer) => \`\${offer.label}：\${money(offer.total)}\`).join("\\n")}\`
    : "";

  return {
    type: "bubble",
    size: "mega",
    body: {
      type: "box",
      layout: "vertical",
      spacing: "md",
      contents: [
        { type: "text", text: product.displayName, weight: "bold", size: "xl", color: "#7B1E1E", wrap: true },
        {
          type: "text",
          text: \`規格：\${product.spec}\\n\${product.purpose ? \`用途方向：\${product.purpose}\\n\` : ""}\${priceLine}\${offers}\`,
          size: "sm",
          color: "#555555",
          wrap: true,
        },
        { type: "text", text: ORDER_NOTICE, size: "sm", color: "#7B1E1E", weight: "bold", wrap: true },
      ],
    },
    footer: {
      type: "box",
      layout: "vertical",
      spacing: "sm",
      contents: [
        {
          type: "button",
          style: "primary",
          color: "#7B1E1E",
          action: { type: "message", label: "選擇數量", text: \`選擇數量｜\${product.id}\` },
        },
        {
          type: "button",
          style: "secondary",
          action: { type: "uri", label: "完整介紹", uri: absoluteUrl(product.page || "products.html") },
        },
        {
          type: "button",
          style: "secondary",
          action: { type: "message", label: "使用方式", text: \`使用方式｜\${product.id}\` },
        },
      ],
    },
  };
}

function productCarousel`;
server = replaceBlock(
  server,
  /function productBubble\(product\) \{[\s\S]*?\n\}\n\nfunction productCarousel/,
  safeProductBubble,
  "安全產品卡片"
);

const validator = `function validateLineMessage(message, pathName = "message") {
  if (!message || typeof message !== "object") throw new Error(\`${pathName} 必須是物件\`);
  if (!["text", "flex"].includes(message.type)) throw new Error(\`${pathName}.type 不支援：\${message.type}\`);

  if (message.type === "text") {
    if (!message.text || message.text.length > 5000) throw new Error(\`${pathName}.text 長度不正確\`);
  }

  if (message.type === "flex") {
    if (!message.altText || message.altText.length > 400) throw new Error(\`${pathName}.altText 長度不正確\`);
    if (!message.contents || !["bubble", "carousel"].includes(message.contents.type)) {
      throw new Error(\`${pathName}.contents 格式不正確\`);
    }
    if (message.contents.type === "carousel") {
      const bubbles = message.contents.contents || [];
      if (!bubbles.length || bubbles.length > 12) throw new Error(\`${pathName} 輪播卡片數量不正確\`);
    }
  }

  const walk = (node, nodePath) => {
    if (!node || typeof node !== "object") return;
    if (node.type === "button" && node.action) {
      const label = String(node.action.label || "");
      if (!label || label.length > 20) throw new Error(\`${nodePath}.action.label 長度不正確\`);
      if (node.action.type === "message") {
        const text = String(node.action.text || "");
        if (!text || text.length > 300) throw new Error(\`${nodePath}.action.text 長度不正確\`);
      }
      if (node.action.type === "uri" && !/^https:\/\//.test(String(node.action.uri || ""))) {
        throw new Error(\`${nodePath}.action.uri 必須使用 HTTPS\`);
      }
    }
    if (Array.isArray(node)) node.forEach((item, index) => walk(item, \`${nodePath}[\${index}]\`));
    else Object.entries(node).forEach(([key, value]) => walk(value, \`${nodePath}.\${key}\`));
  };
  walk(message, pathName);
  return message;
}

async function reply(token, messages) {
  if (!client) {
    console.warn("LINE credentials are not configured; reply skipped.");
    return;
  }
  const payload = Array.isArray(messages) ? messages : [messages];
  payload.forEach((message, index) => validateLineMessage(message, \`messages[\${index}]\`));
  try {
    await client.replyMessage(token, payload);
  } catch (error) {
    console.error("LINE 回覆失敗：", error?.originalError?.response?.data || error.message || error);
    throw error;
  }
}

function productBubble`;
server = replaceBlock(
  server,
  /async function reply\(token, messages\) \{[\s\S]*?\n\}\n\nfunction productBubble/,
  validator,
  "回覆驗證"
);

server = server.replace(
  "  cleanupExpiredStates,\n};",
  "  cleanupExpiredStates,\n  validateLineMessage,\n  qtyMenu,\n  cartFlex,\n};"
);
write("server.js", server);

let test = read("test.js");
test = test.replace('assert.strictEqual(VERSION, "v300.2");', 'assert.strictEqual(VERSION, "v300.3");');
test = test.replace(
  "  cleanupExpiredStates,\n} = require(\"./server\");",
  "  cleanupExpiredStates,\n} = require(\"./server\");"
);
write("test.js", test);

let security = read("security.test.js");
security = security.replace('assert.strictEqual(VERSION, "v300.2");', 'assert.strictEqual(VERSION, "v300.3");');
security = security.replace("PASS security and UX v300.2", "PASS security and UX v300.3");
write("security.test.js", security);

const functionTest = `"use strict";
const assert = require("assert");
const {
  DATA,
  VERSION,
  productMenuReply,
  priceCarousel,
  recommendReply,
  comboMenuReply,
  comboDetailReply,
  usageChooserReply,
  usageReply,
  doctorReferralReply,
  huangdiNeijingReply,
  brandStoryReply,
  qtyMenu,
  cartFlex,
  validateLineMessage,
} = require("./server");

assert.strictEqual(VERSION, "v300.3");
const messages = [
  productMenuReply(),
  priceCarousel(),
  recommendReply(),
  comboMenuReply(),
  comboDetailReply(0),
  usageChooserReply(),
  doctorReferralReply(),
  huangdiNeijingReply(),
  brandStoryReply(),
  cartFlex({ cart: [], checkout: null }),
];
for (const product of DATA.products) {
  messages.push(usageReply(product));
  messages.push(qtyMenu(product));
}
for (const [index, message] of messages.entries()) {
  assert.doesNotThrow(() => validateLineMessage(message, "matrix[" + index + "]"));
}
assert.strictEqual(productMenuReply().contents.contents.length, 6);
assert.ok(productMenuReply().contents.contents.every((bubble) => !bubble.hero), "產品卡不應依賴可能失敗的外部圖片");
assert.strictEqual(recommendReply().contents.contents.length, 3);
assert.strictEqual(comboMenuReply().contents.contents.length, DATA.offers.comboOffers.length);
assert.strictEqual(usageChooserReply().contents.contents.length, 6);
console.log("PASS full LINE function matrix v300.3");
`;
write("function.test.js", functionTest);

const pkg = JSON.parse(read("package.json"));
pkg.version = "3.0.3";
pkg.scripts.test = "node test.js && node catalog.test.js && node security.test.js && node function.test.js";
write("package.json", JSON.stringify(pkg, null, 2) + "\n");

let workflow = read(".github/workflows/verify-line-and-website-catalog.yml");
workflow = workflow.replace('"version":"v300.2"', '"version":"v300.3"');
workflow = workflow.replace("          node --check security.test.js\n", "          node --check security.test.js\n          node --check function.test.js\n");
write(".github/workflows/verify-line-and-website-catalog.yml", workflow);

let readme = read("README.md");
readme = readme.replace(/# 仙加味 LINE OA v300\.[0-9]+/, "# 仙加味 LINE OA v300.3");
readme = readme.replace(/\"version\": \"v300\.[0-9]+\"/, '"version": "v300.3"');
readme += "\n## v300.3 穩定性修正\n\n產品與直接下單卡片改為不依賴外部圖片載入的 Flex 卡片，保留選擇數量、完整介紹與使用方式按鈕，並加入全功能訊息格式驗證。\n";
write("README.md", readme);

console.log("Applied LINE OA full function fix v300.3");
