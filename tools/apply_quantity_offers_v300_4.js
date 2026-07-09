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

const expectedSales = {
  "guilu-gao": { price: 1500, originalPrice: 1800, unit: "罐", quantityOptions: [1, 2, 3, 5], offers: [] },
  "guilu-drink-30": { price: 50, unit: "瓶", quantityOptions: [1, 3, 5, 12], offers: [{ qty: 12, total: 500, label: "買10送2（12瓶）" }] },
  "guilu-drink-180": { price: 200, unit: "包", quantityOptions: [1, 3, 5, 12], offers: [{ qty: 12, total: 2000, label: "買10送2（12包）" }] },
  "guilu-tangkuai": { price: 1600, unit: "盒", quantityOptions: [1, 2, 3, 5], offers: [] },
  "guilu-jiao": { price: 9600, originalPrice: 12000, unit: "盒", quantityOptions: [1, 2, 3, 5], offers: [] },
  "luerong-fen": { price: 2000, unit: "罐", quantityOptions: [1, 2, 3, 5], offers: [] },
};

const data = JSON.parse(read("data.json"));
for (const product of data.products) {
  const expected = expectedSales[product.id];
  if (!expected) throw new Error(`未定義銷售資料：${product.id}`);
  product.price = expected.price;
  if (expected.originalPrice) product.originalPrice = expected.originalPrice;
  else delete product.originalPrice;
  product.unit = expected.unit;
  product.offers = expected.offers;
  product.quantityOptions = expected.quantityOptions;

  if (product.originalPrice && product.originalPrice > product.price) {
    product.priceText = `$${product.originalPrice} / ${product.unit}`;
    product.priceLabel = `售價${product.originalPrice.toLocaleString("zh-TW")}元，優惠價${product.price.toLocaleString("zh-TW")}元`;
  } else if (product.offers.length) {
    product.priceText = `$${product.price} / ${product.unit}`;
    product.priceLabel = `售價${product.price.toLocaleString("zh-TW")}元，買10送2`;
  } else {
    product.priceText = `$${product.price} / ${product.unit}`;
    product.priceLabel = `售價${product.price.toLocaleString("zh-TW")}元`;
  }
}
write("data.json", JSON.stringify(data, null, 2) + "\n");

let server = read("server.js");
server = server.replace(/仙加味 LINE OA Bot v300\.3/g, "仙加味 LINE OA Bot v300.4");
server = server.replace('const VERSION = "v300.3";', 'const VERSION = "v300.4";');

const qtyMenu = [
  'function qtyMenu(product) {',
  '  const options = Array.isArray(product.quantityOptions) && product.quantityOptions.length',
  '    ? product.quantityOptions.slice(0, 4)',
  '    : [1, 2, 3, 5];',
  '',
  '  const buttons = options.map((qty) => {',
  '    const exactOffer = product.offers.find((offer) => Number(offer.qty) === Number(qty));',
  '    const result = calcItem(product, Number(qty));',
  '    return {',
  '      label: exactOffer',
  '        ? `${exactOffer.label.replace(/（.*?）/g, "")}｜${money(result.total)}`.slice(0, 20)',
  '        : `${qty}${product.unit || "件"}｜${money(result.total)}`.slice(0, 20),',
  '      text: `加入購物車｜${product.id}｜${qty}`,',
  '    };',
  '  });',
  '',
  '  const promotionLines = [];',
  '  if (product.originalPrice && product.originalPrice > product.price) {',
  '    promotionLines.push(`單${product.unit || "件"}原價 ${money(product.originalPrice)}，目前優惠價 ${money(product.price)}`);',
  '  }',
  '  for (const offer of product.offers) {',
  '    promotionLines.push(`${offer.label}：${money(offer.total)}`);',
  '  }',
  '  if (!promotionLines.length) promotionLines.push("目前無額外數量折扣，依所選數量計算。");',
  '',
  '  buttons.push({ label: "返回產品", text: "看產品" });',
  '  return flexCard(',
  '    `${product.displayName}｜選擇數量`,',
  '    `${ORDER_NOTICE}\\n\\n活動與優惠：\\n${promotionLines.map((line) => `・${line}`).join("\\n")}\\n\\n請選擇要加入購物車的數量。`,',
  '    buttons',
  '  );',
  '}',
  '',
  'function calcItem',
].join("\n");
server = replaceBlock(server, /function qtyMenu\(product\) \{[\s\S]*?\n\}\n\nfunction calcItem/, qtyMenu, "數量選單");
write("server.js", server);

let sync = read("tools/sync_website_catalog.js");
if (!sync.includes('"quantityOptions"')) {
  sync = sync.replace('  "offers",\n', '  "offers",\n  "quantityOptions",\n');
}
write("tools/sync_website_catalog.js", sync);

for (const name of ["test.js", "security.test.js", "function.test.js"]) {
  const value = read(name).replace(/v300\.3/g, "v300.4");
  write(name, value);
}

let functionTest = read("function.test.js");
if (!functionTest.includes("PASS quantity options and promotions v300.4")) {
  functionTest += `
const expectedSalesV3004 = {
  "guilu-gao": { price: 1500, originalPrice: 1800, options: [1, 2, 3, 5] },
  "guilu-drink-30": { price: 50, offerQty: 12, offerTotal: 500, options: [1, 3, 5, 12] },
  "guilu-drink-180": { price: 200, offerQty: 12, offerTotal: 2000, options: [1, 3, 5, 12] },
  "guilu-tangkuai": { price: 1600, options: [1, 2, 3, 5] },
  "guilu-jiao": { price: 9600, originalPrice: 12000, options: [1, 2, 3, 5] },
  "luerong-fen": { price: 2000, options: [1, 2, 3, 5] },
};
for (const product of DATA.products) {
  const expected = expectedSalesV3004[product.id];
  assert.deepStrictEqual(product.quantityOptions, expected.options);
  assert.strictEqual(product.price, expected.price);
  if (expected.originalPrice) assert.strictEqual(product.originalPrice, expected.originalPrice);
  if (expected.offerQty) {
    assert.ok(product.offers.some((offer) => offer.qty === expected.offerQty && offer.total === expected.offerTotal));
  }
  const menu = qtyMenu(product);
  assert.strictEqual(menu.contents.footer.contents.length, 5);
  validateMessage(menu);
}
console.log("PASS quantity options and promotions v300.4");
`;
}
write("function.test.js", functionTest);

const pkg = JSON.parse(read("package.json"));
pkg.version = "3.0.4";
write("package.json", JSON.stringify(pkg, null, 2) + "\n");

let workflow = read(".github/workflows/verify-line-and-website-catalog.yml").replace(/v300\.3/g, "v300.4");
write(".github/workflows/verify-line-and-website-catalog.yml", workflow);

let readme = read("README.md");
readme = readme.replace(/# 仙加味 LINE OA v300\.[0-9]+/, "# 仙加味 LINE OA v300.4");
readme = readme.replace(/\"version\": \"v300\.[0-9]+\"/, '"version": "v300.4"');
if (!readme.includes("## v300.4 數量與優惠")) {
  readme += "\n## v300.4 數量與優惠\n\n每項產品提供四個數量選項；龜鹿飲30cc與180cc保留買10送2，龜鹿膏與龜鹿膠顯示原價與優惠價，其餘品項依單價乘以數量計算。\n";
}
write("README.md", readme);

console.log("Applied quantity options and verified promotions v300.4");
