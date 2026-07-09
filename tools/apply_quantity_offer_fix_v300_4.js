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
server = server.replace(/仙加味 LINE OA Bot v300\.3/g, "仙加味 LINE OA Bot v300.4");
server = server.replace('const VERSION = "v300.3";', 'const VERSION = "v300.4";');

const qtyMenu = `function qtyMenu(product) {
  const quantityOptions = [...new Set(
    (Array.isArray(product.quantityOptions) && product.quantityOptions.length
      ? product.quantityOptions
      : [1, 2, 3, 5])
      .map(Number)
      .filter((qty) => Number.isInteger(qty) && qty > 0)
  )].slice(0, 4);

  const priceSummary = product.originalPrice && product.originalPrice > product.price
    ? \`售價 \${money(product.originalPrice)}，目前優惠價 \${money(product.price)}\`
    : \`目前單價 \${money(product.price)}／\${product.unit || "件"}\`;
  const activitySummary = product.offers.length
    ? \`\\n活動：\${product.offers.map((offer) => \`\${offer.label} \${money(offer.total)}\`).join("、")}\`
    : "";

  const buttons = quantityOptions.map((qty) => {
    const offer = product.offers.find((item) => Number(item.qty) === qty);
    const calculation = calcItem(product, qty);
    const label = offer
      ? \`\${qty}\${product.unit || "件"}｜買10送2 \${money(calculation.total)}\`
      : \`\${qty}\${product.unit || "件"}｜\${money(calculation.total)}\`;
    return {
      label: label.slice(0, 20),
      text: \`加入購物車｜\${product.id}｜\${qty}\`,
    };
  });

  buttons.push({ label: "返回產品", text: "看產品" });
  return flexCard(
    \`\${product.displayName}｜選擇數量\`,
    \`\${priceSummary}\${activitySummary}\\n\\n請選擇要加入購物車的數量。\`,
    buttons
  );
}

function calcItem`;

server = replaceBlock(
  server,
  /function qtyMenu\(product\) \{[\s\S]*?\n\}\n\nfunction calcItem/,
  qtyMenu,
  "數量選擇"
);
write("server.js", server);

let test = read("test.js");
test = test.replace('assert.strictEqual(VERSION, "v300.3");', 'assert.strictEqual(VERSION, "v300.4");');
write("test.js", test);

let security = read("security.test.js");
security = security.replace('assert.strictEqual(VERSION, "v300.3");', 'assert.strictEqual(VERSION, "v300.4");');
security = security.replace("PASS security and UX v300.3", "PASS security and UX v300.4");
write("security.test.js", security);

let functionTest = read("function.test.js");
functionTest = functionTest.replace('assert.strictEqual(VERSION, "v300.3");', 'assert.strictEqual(VERSION, "v300.4");');
functionTest = functionTest.replace('console.log("PASS full LINE function matrix v300.3");', 'console.log("PASS full LINE function matrix v300.4");');
functionTest += `

const expectedSales = {
  "guilu-gao": { price: 1500, originalPrice: 1800, quantities: [1, 2, 3, 5] },
  "guilu-drink-30": { price: 50, offerQty: 12, offerTotal: 500, quantities: [1, 3, 5, 12] },
  "guilu-drink-180": { price: 200, offerQty: 12, offerTotal: 2000, quantities: [1, 3, 5, 12] },
  "guilu-tangkuai": { price: 1600, quantities: [1, 2, 3, 5] },
  "guilu-jiao": { price: 9600, originalPrice: 12000, quantities: [1, 2, 3, 5] },
  "luerong-fen": { price: 2000, quantities: [1, 2, 3, 5] },
};

for (const product of DATA.products) {
  const expected = expectedSales[product.id];
  assert.ok(expected, "unexpected product: " + product.id);
  assert.strictEqual(product.price, expected.price, product.id + " price");
  if (expected.originalPrice) assert.strictEqual(product.originalPrice, expected.originalPrice, product.id + " original price");
  assert.deepStrictEqual(product.quantityOptions, expected.quantities, product.id + " quantity options");
  if (expected.offerQty) {
    const offer = product.offers.find((item) => Number(item.qty) === expected.offerQty);
    assert.ok(offer, product.id + " missing offer");
    assert.strictEqual(offer.total, expected.offerTotal, product.id + " offer total");
  }
  const menu = qtyMenu(product);
  const buttons = menu.contents.footer.contents;
  assert.strictEqual(buttons.length, expected.quantities.length + 1, product.id + " button count");
  for (const qty of expected.quantities) {
    assert.ok(buttons.some((button) => button.action?.text === \`加入購物車｜\${product.id}｜\${qty}\`), product.id + " missing qty " + qty);
  }
}
console.log("PASS prices, promotions and quantity choices v300.4");
`;
write("function.test.js", functionTest);

const pkg = JSON.parse(read("package.json"));
pkg.version = "3.0.4";
write("package.json", JSON.stringify(pkg, null, 2) + "\n");

let verify = read(".github/workflows/verify-line-and-website-catalog.yml");
verify = verify.replace('"version":"v300.3"', '"version":"v300.4"');
write(".github/workflows/verify-line-and-website-catalog.yml", verify);

let readme = read("README.md");
readme = readme.replace(/# 仙加味 LINE OA v300\.[0-9]+/, "# 仙加味 LINE OA v300.4");
readme = readme.replace(/\"version\": \"v300\.[0-9]+\"/, '"version": "v300.4"');
if (!readme.includes("## v300.4 數量與優惠")) {
  readme += "\n## v300.4 數量與優惠\n\n每項產品的數量卡會依 data.json 的 quantityOptions 顯示四種數量；龜鹿飲 30cc／180cc 顯示買10送2，龜鹿膏與龜鹿膠顯示售價與優惠價。\n";
}
write("README.md", readme);

console.log("Applied quantity and offer fix v300.4");
