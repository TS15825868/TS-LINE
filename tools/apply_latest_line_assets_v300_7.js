"use strict";

const fs = require("fs");
const path = require("path");
const root = path.resolve(__dirname, "..");

function read(file) {
  return fs.readFileSync(path.join(root, file), "utf8");
}

function write(file, content) {
  fs.writeFileSync(path.join(root, file), content, "utf8");
}

function replaceRequired(source, pattern, replacement, label) {
  const next = source.replace(pattern, replacement);
  if (next === source) throw new Error(`找不到更新區塊：${label}`);
  return next;
}

let server = read("server.js");
server = server.replace(/仙加味 LINE OA Bot v300\.6/g, "仙加味 LINE OA Bot v300.7");
server = server.replace('const VERSION = "v300.6";', 'const VERSION = "v300.7";');

const productBubble = `function productBubble(product) {
  const priceLine = product.originalPrice && product.originalPrice > product.price
    ? \`售價 \${money(product.originalPrice)}\\n優惠價 \${money(product.price)}\`
    : \`售價 \${money(product.price)}\`;
  const offers = product.offers.length
    ? \`\\n\${product.offers.map((offer) => \`\${offer.label}：\${money(offer.total)}\`).join("\\n")}\`
    : "";
  const productUrl = absoluteUrl(product.page || "products.html");
  const productImage = absoluteUrl(product.image || "images/logo.png");
  const dmUrl = absoluteUrl(product.dmImage || product.image || "images/logo.png");

  return {
    type: "bubble",
    size: "mega",
    hero: {
      type: "image",
      url: productImage,
      size: "full",
      aspectRatio: "1:1",
      aspectMode: "contain",
      backgroundColor: "#F7F4ED",
      action: { type: "uri", uri: productUrl },
    },
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
          action: { type: "uri", label: "完整介紹", uri: productUrl },
        },
        {
          type: "button",
          style: "secondary",
          action: { type: "uri", label: "看產品DM", uri: dmUrl },
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
server = replaceRequired(
  server,
  /function productBubble\(product\) \{[\s\S]*?\n\}\n\nfunction productCarousel/,
  productBubble,
  "產品圖卡"
);

server = server.replace(
  '{ label: "選擇數量", text: `選擇數量｜${product.id}` },\n          { label: "看產品", text: "看產品" },',
  '{ label: "選擇數量", text: `選擇數量｜${product.id}` },\n          { label: "看產品DM", uri: absoluteUrl(product.dmImage || product.image || "images/logo.png") },\n          { label: "看產品", text: "看產品" },'
);

write("server.js", server);

for (const fileName of ["test.js", "security.test.js", "function.test.js"]) {
  let value = read(fileName);
  value = value.replace(/v300\.6/g, "v300.7");
  write(fileName, value);
}

let functionTest = read("function.test.js");
functionTest = functionTest.replace(
  "assert.ok(productMenuReply().contents.contents.every((bubble) => !bubble.hero));",
  "assert.ok(productMenuReply().contents.contents.every((bubble) => Boolean(bubble.hero)));"
);
functionTest += `

for (const product of DATA.products) {
  const menu = productMenuReply();
  const bubble = menu.contents.contents.find((item) =>
    item.body?.contents?.some((content) => content.type === "text" && content.text === product.displayName)
  );
  assert.ok(bubble, product.id + " missing product bubble");
  assert.ok(bubble.hero, product.id + " missing product image hero");
  assert.ok(bubble.hero.url.startsWith("https://ts15825868.github.io/xianjiawei/images/products-v3/"), product.id + " wrong product image: " + bubble.hero.url);
  const dmButton = bubble.footer.contents.find((button) => button.action?.label === "看產品DM");
  assert.ok(dmButton, product.id + " missing DM button");
  assert.ok(dmButton.action.uri.includes("/images/dm-final/"), product.id + " wrong DM URL: " + dmButton.action.uri);
}
console.log("PASS LINE product images and final DM buttons v300.7");
`;
write("function.test.js", functionTest);

const pkg = JSON.parse(read("package.json"));
pkg.version = "3.0.7";
write("package.json", JSON.stringify(pkg, null, 2) + "\n");

let workflow = read(".github/workflows/verify-line-and-website-catalog.yml");
workflow = workflow.replace(/v300\.6/g, "v300.7");
write(".github/workflows/verify-line-and-website-catalog.yml", workflow);

let readme = read("README.md");
readme = readme.replace(/# 仙加味 LINE OA v300\.[0-9]+/, "# 仙加味 LINE OA v300.7");
readme = readme.replace(/\"version\": \"v300\.[0-9]+\"/, '"version": "v300.7"');
if (!readme.includes("## v300.7 最新產品圖與DM")) {
  readme += "\n## v300.7 最新產品圖與DM\n\n產品卡恢復使用官網 products-v3 最新實品圖，並加入 dm-final 最終DM按鈕；使用方式卡與價格卡也使用相同DM來源。\n";
}
write("README.md", readme);

console.log("Applied LINE OA latest product images and final DMs v300.7");
