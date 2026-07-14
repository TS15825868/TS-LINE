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
assert.strictEqual(data.catalogVersion, "408.7");
assert.strictEqual(data.catalogSource.repository, "TS15825868/xianjiawei");
assert.strictEqual(data.lineId, "@762jybnm");
assert.deepStrictEqual(data.products.map((product) => product.id), expectedIds);

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
    "price",
    "unit",
  ]) {
    assert.ok(product[field], `${product.id} missing ${field}`);
  }
  assert.ok(Array.isArray(product.ingredients) && product.ingredients.length > 0, `${product.id} ingredients invalid`);
  assert.ok(Array.isArray(product.usage) && product.usage.length > 0, `${product.id} usage invalid`);
  assert.ok(product.image.startsWith("images/"), `${product.id} image must use website asset path`);
  assert.ok(product.page.endsWith(".html"), `${product.id} page invalid`);
}

const combos = data.offers?.comboOffers || [];
const comboItems = combos.flatMap((combo) => combo.items || []);
assert.ok(comboItems.includes("龜鹿飲180cc 5 包"));
assert.ok(comboItems.includes("龜鹿飲180cc 12 包（買10送2）"));
assert.ok(!comboItems.includes("龜鹿飲 5 包"));
assert.ok(!comboItems.includes("龜鹿飲 10 包"));
assert.ok(!comboItems.includes("龜鹿飲180cc 10 包"));

const drink180 = data.products.find((product) => product.id === "guilu-drink-180");
assert.strictEqual(drink180.page, "product-guilu-drink-180cc.html");
assert.ok(drink180.image.includes("guilu-drink-180.jpg"));

console.log(`PASS LINE OA catalog ${data.catalogVersion}: website fields, sales fields, assets and combo wording`);
