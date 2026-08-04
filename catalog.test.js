"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const data = JSON.parse(fs.readFileSync(path.join(__dirname, "data.json"), "utf8"));
const expectedIds = [
  "guilu-gao",
  "guilu-drink-30",
  "guilu-drink-180",
  "guilu-tangkuai",
  "guilu-jiao",
  "luerong-fen",
];

assert.strictEqual(data.version, "401.6");
assert.match(String(data.catalogVersion || ""), /^\d+\.\d+$/, "catalogVersion must be a numeric release version");
assert.strictEqual(data.catalogSource.repository, "TS15825868/xianjiawei");
assert.strictEqual(data.lineId, "@762jybnm");
assert.deepStrictEqual([...data.products.map((product) => product.id)].sort(), [...expectedIds].sort());
assert.strictEqual(new Set(data.products.map((product) => product.id)).size, expectedIds.length);

for (const product of data.products) {
  for (const field of [
    "displayName",
    "size",
    "description",
    "ingredients",
    "usage",
    "image",
    "dmImage",
    "page",
    "aliases",
    "spec",
    "unit",
  ]) {
    assert.ok(product[field], `${product.id} missing ${field}`);
  }
  assert.notStrictEqual(product.price, undefined, `${product.id} missing price`);
  if (product.quoteOnly) {
    assert.strictEqual(Number(product.price), 0, `${product.id} quote-only price must be zero`);
    assert.strictEqual(product.priceText, "價格請洽詢");
  } else {
    assert(Number(product.price) > 0, `${product.id} price invalid`);
  }
  assert.ok(Array.isArray(product.ingredients) && product.ingredients.length > 0, `${product.id} ingredients invalid`);
  assert.ok(Array.isArray(product.usage) && product.usage.length > 0, `${product.id} usage invalid`);
  assert.ok(product.image.startsWith("images/"), `${product.id} image must use website asset path`);
  assert.ok(product.page.endsWith(".html"), `${product.id} page invalid`);
}

const combos = data.offers?.comboOffers || [];
assert.strictEqual(combos.length, 3);
assert.deepStrictEqual(combos.map((combo) => combo.name), ["日常節奏組", "料理搭配組", "完整體驗組"]);
const comboItems = combos.flatMap((combo) => combo.items || []);
assert.ok(comboItems.includes("龜鹿飲180cc 5 包"));
assert.ok(!comboItems.some((item) => item.includes("買10送1")));
assert.ok(!comboItems.includes("龜鹿飲 5 包"));
assert.ok(!comboItems.includes("龜鹿飲 10 包"));
assert.ok(!comboItems.includes("龜鹿飲180cc 10 包"));

const drink30 = data.products.find((product) => product.id === "guilu-drink-30");
assert.strictEqual(drink30.name, "龜鹿飲30cc玻璃罐");
assert.strictEqual(drink30.size, "30cc／罐（小玻璃罐）");
assert.strictEqual(drink30.unit, "罐");
assert.deepStrictEqual(drink30.offers[0], { qty: 11, total: 500, label: "買10送1" });

const drink180 = data.products.find((product) => product.id === "guilu-drink-180");
assert.strictEqual(drink180.page, "product-guilu-drink-180cc.html");
assert.ok(drink180.image.includes("guilu-drink-180.jpg"));
assert.deepStrictEqual(drink180.offers[0], { qty: 11, total: 2000, label: "買10送1" });

console.log(`PASS LINE OA catalog ${data.catalogVersion}: website fields, official sales fields, six products and three combos`);
