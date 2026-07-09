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

const data = JSON.parse(read("data.json"));
const combos = data.offers?.comboOffers || [];
const definitions = [
  {
    id: "daily-rhythm",
    products: [
      { productId: "guilu-gao", qty: 1 },
      { productId: "guilu-drink-180", qty: 5 },
    ],
    items: ["龜鹿膏 1 罐", "龜鹿飲180cc 5 包"],
  },
  {
    id: "daily-convenience",
    products: [
      { productId: "guilu-gao", qty: 1 },
      { productId: "guilu-drink-180", qty: 12 },
    ],
    items: ["龜鹿膏 1 罐", "龜鹿飲180cc 12 包（買10送2）"],
  },
  {
    id: "table-pairing",
    products: [
      { productId: "guilu-tangkuai", qty: 1 },
      { productId: "luerong-fen", qty: 1 },
    ],
    items: ["龜鹿湯塊75g 1 盒", "鹿茸粉75g 1 罐"],
  },
  {
    id: "full-experience",
    products: [
      { productId: "guilu-gao", qty: 1 },
      { productId: "guilu-drink-180", qty: 5 },
      { productId: "guilu-tangkuai", qty: 1 },
      { productId: "luerong-fen", qty: 1 },
    ],
    items: ["龜鹿膏 1 罐", "龜鹿飲180cc 5 包", "龜鹿湯塊75g 1 盒", "鹿茸粉75g 1 罐"],
  },
  {
    id: "traditional-stew",
    products: [
      { productId: "guilu-jiao", qty: 1 },
      { productId: "luerong-fen", qty: 1 },
    ],
    items: ["龜鹿膠600g（一斤裝）1 盒", "鹿茸粉75g 1 罐"],
  },
];

if (combos.length !== definitions.length) throw new Error("搭配組合數量與預期不一致");
combos.forEach((combo, index) => {
  Object.assign(combo, definitions[index], {
    unit: "組",
    quantityOptions: [1, 2, 3, 5],
  });
  delete combo.priceNote;
});
write("data.json", JSON.stringify(data, null, 2) + "\n");

let server = read("server.js");
server = server.replace(/仙加味 LINE OA Bot v300\.5/g, "仙加味 LINE OA Bot v300.6");
server = server.replace('const VERSION = "v300.5";', 'const VERSION = "v300.6";');

const helpers = `function getCombo(index) {
  return (DATA.offers?.comboOffers || [])[Number(index)] || null;
}

function comboUnitPrice(combo) {
  if (!combo) return 0;
  return (combo.products || []).reduce((sum, component) => {
    const product = getProduct(component.productId);
    if (!product) return sum;
    return sum + calcItem(product, Number(component.qty || 0)).total;
  }, 0);
}

function comboPromotionLines(combo) {
  const lines = [];
  for (const component of combo?.products || []) {
    const product = getProduct(component.productId);
    if (!product) continue;
    const qty = Number(component.qty || 0);
    const exactOffer = product.offers.find((offer) => Number(offer.qty) === qty);
    if (exactOffer) {
      lines.push(\`${product.displayName}：${exactOffer.label} ${money(exactOffer.total)}\`);
    } else if (product.originalPrice && product.originalPrice > product.price) {
      lines.push(\`${product.displayName}：已套用優惠價 ${money(product.price)}\`);
    }
  }
  return lines;
}

function comboQtyMenu(index) {
  const combo = getCombo(index);
  if (!combo) return comboMenuReply();
  const unitPrice = comboUnitPrice(combo);
  const quantities = Array.isArray(combo.quantityOptions) && combo.quantityOptions.length
    ? combo.quantityOptions.slice(0, 4)
    : [1, 2, 3, 5];
  const promotionLines = comboPromotionLines(combo);
  const description = [
    ...(combo.items || []).map((item) => \`・${item}\`),
    "",
    \`每組售價：${money(unitPrice)}\`,
    \`可選組數：${quantities.join("、")}組\`,
    ...(promotionLines.length ? ["", "已套用活動／優惠：", ...promotionLines.map((line) => \`・${line}\`)] : []),
    "",
    ORDER_NOTICE,
  ].join("\\n");
  const buttons = quantities.map((qty) => ({
    label: \`${qty}組｜${money(unitPrice * qty)}\`.slice(0, 20),
    text: \`加入組合｜${index}｜${qty}\`,
  }));
  buttons.push({ label: "其他搭配方案", text: "搭配組合" });
  return flexCard(\`${combo.name}｜選擇組數\`, description, buttons);
}

function addComboCart(state, combo, index, qty) {
  const id = \`combo-${index}\`;
  const existing = state.cart.find((item) => item.id === id);
  if (existing) existing.qty += qty;
  else state.cart.push({ id, name: combo.name, qty, unit: combo.unit || "組", comboIndex: Number(index) });

  const item = state.cart.find((cartItem) => cartItem.id === id);
  const unitPrice = comboUnitPrice(combo);
  item.total = unitPrice * item.qty;
  item.label = \`每組 ${money(unitPrice)} × ${item.qty}\`;
}

function comboMenuReply()`;
server = replaceBlock(
  server,
  /function comboMenuReply\(\)/,
  helpers,
  "搭配組合輔助函式"
);

const comboMenu = `function comboMenuReply() {
  const combos = DATA.offers?.comboOffers || [];
  if (!combos.length) {
    return flexCard("搭配組合", "目前搭配組合由客服依需求協助整理。", [
      { label: "看產品", text: "看產品" },
      { label: "人工客服", text: "我要人工客服" },
    ]);
  }

  return {
    type: "flex",
    altText: "仙加味搭配組合",
    contents: {
      type: "carousel",
      contents: combos.slice(0, 10).map((combo, index) => {
        const unitPrice = comboUnitPrice(combo);
        const quantities = combo.quantityOptions || [1, 2, 3, 5];
        const promotions = comboPromotionLines(combo);
        const description = [
          ...(combo.items || []).map((item) => \`・${item}\`),
          "",
          combo.desc || "",
          "",
          \`每組售價：${money(unitPrice)}\`,
          \`可選組數：${quantities.join("、")}組\`,
          ...(promotions.length ? ["", "活動／優惠已套用：", ...promotions.map((line) => \`・${line}\`)] : []),
        ].join("\\n");
        return flexCard(combo.name, description, [
          { label: "選擇組數", text: \`搭配組數｜${index}\` },
          { label: "看全部產品", text: "看產品" },
          { label: "人工客服", text: "我要人工客服" },
        ]).contents;
      }),
    },
  };
}

function comboDetailReply(index) {
  return comboQtyMenu(index);
}`;
server = replaceBlock(
  server,
  /function comboMenuReply\(\) \{[\s\S]*?\n\}\n\nfunction comboDetailReply\(index\) \{[\s\S]*?\n\}/,
  comboMenu,
  "搭配組合卡片"
);

server = server.replace(
  "  const comboDetailMatch = text.match(/^搭配方案｜(\\d+)$/);\n  if (comboDetailMatch) return reply(event.replyToken, comboDetailReply(comboDetailMatch[1]));",
  "  const comboDetailMatch = text.match(/^(?:搭配方案|搭配組數)｜(\\d+)$/);\n  if (comboDetailMatch) return reply(event.replyToken, comboQtyMenu(comboDetailMatch[1]));"
);

const addComboHandler = `  const addComboMatch = text.match(/^加入組合｜(\\d+)｜(\\d+)$/);
  if (addComboMatch) {
    const combo = getCombo(addComboMatch[1]);
    const qty = Number(addComboMatch[2]);
    if (!combo || qty <= 0) return reply(event.replyToken, textMsg("加入搭配組合失敗，請重新選擇。", mainQuick()));
    addComboCart(state, combo, addComboMatch[1], qty);
    return reply(event.replyToken, cartFlex(state));
  }

  const addMatch = text.match(/^加入購物車｜([^｜]+)｜(\\d+)$/);`;
server = replaceBlock(
  server,
  /  const addMatch = text\.match\(\/\^加入購物車｜\(\[\^｜\]\+\)｜\(\\d\+\)\$\/\);/,
  addComboHandler,
  "加入搭配組合訊息"
);

server = server.replace(
  "  comboDetailReply,\n  usageChooserReply,",
  "  comboDetailReply,\n  comboQtyMenu,\n  comboUnitPrice,\n  comboPromotionLines,\n  addComboCart,\n  getCombo,\n  usageChooserReply,"
);

write("server.js", server);

for (const fileName of ["test.js", "security.test.js", "function.test.js"]) {
  let value = read(fileName);
  value = value.replace(/v300\.5/g, "v300.6");
  write(fileName, value);
}

let functionTest = read("function.test.js");
functionTest = functionTest.replace(
  "  qtyMenu, cartFlex, detectWebsiteIntent,",
  "  qtyMenu, cartFlex, detectWebsiteIntent, comboQtyMenu, comboUnitPrice, comboPromotionLines, addComboCart, getCombo,"
);
functionTest += `

const expectedComboPrices = [2500, 3500, 3600, 6100, 11600];
for (let index = 0; index < expectedComboPrices.length; index += 1) {
  const combo = getCombo(index);
  assert.ok(combo, "missing combo " + index);
  assert.strictEqual(comboUnitPrice(combo), expectedComboPrices[index], combo.name + " unit price");
  assert.deepStrictEqual(combo.quantityOptions, [1, 2, 3, 5], combo.name + " quantity options");
  const menu = comboQtyMenu(index);
  const buttons = menu.contents.footer.contents;
  assert.strictEqual(buttons.length, 5, combo.name + " button count");
  for (const qty of [1, 2, 3, 5]) {
    assert.ok(buttons.some((button) => button.action?.text === \`加入組合｜\${index}｜\${qty}\`), combo.name + " missing " + qty + " sets");
  }
}
const comboState = { cart: [], checkout: null };
addComboCart(comboState, getCombo(2), 2, 3);
assert.strictEqual(comboState.cart.length, 1);
assert.strictEqual(comboState.cart[0].qty, 3);
assert.strictEqual(comboState.cart[0].total, 10800);
assert.ok(comboPromotionLines(getCombo(1)).some((line) => line.includes("買10送2")));
console.log("PASS combo prices, quantities, promotions and cart v300.6");
`;
write("function.test.js", functionTest);

const pkg = JSON.parse(read("package.json"));
pkg.version = "3.0.6";
write("package.json", JSON.stringify(pkg, null, 2) + "\n");

let workflow = read(".github/workflows/verify-line-and-website-catalog.yml");
workflow = workflow.replace(/v300\.5/g, "v300.6");
write(".github/workflows/verify-line-and-website-catalog.yml", workflow);

let readme = read("README.md");
readme = readme.replace(/# 仙加味 LINE OA v300\.[0-9]+/, "# 仙加味 LINE OA v300.6");
readme = readme.replace(/\"version\": \"v300\.[0-9]+\"/, '"version": "v300.6"');
readme += "\n## v300.6 搭配組合購物車\n\n搭配組合顯示每組售價、可選1／2／3／5組、已套用的單品活動與優惠，並可直接加入購物車及結帳。\n";
write("README.md", readme);

console.log("Applied combo price, quantity and cart fix v300.6");
