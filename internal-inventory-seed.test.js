"use strict";

const assert = require("assert");
const { readCatalog, seedInventory, promotionFields } = require("./internal-inventory-seed");

const catalog = readCatalog();
assert.strictEqual(catalog.length, 6);
const drink30 = catalog.find((product) => product.id === "guilu-drink-30");
const fields = promotionFields(drink30);
assert.deepStrictEqual(fields.offers, [{ qty: 12, total: 500, label: "買10送2" }]);
assert.strictEqual(fields.quoteOnly, false);

let writes = 0;
let store = {
  inventory: [{
    productId: "guilu-drink-30",
    name: "舊龜鹿飲",
    price: 100,
    originalPrice: 0,
    stock: 24,
    reserved: 3,
    lowStock: 5,
  }],
  activities: [],
};
const result = seedInventory(
  () => store,
  (next) => { store = next; writes += 1; }
);

assert.strictEqual(result.total, 6);
assert.strictEqual(result.promotionRulesSynchronized, true);
assert.strictEqual(writes, 1);
const seededDrink30 = store.inventory.find((item) => item.productId === "guilu-drink-30");
assert.strictEqual(seededDrink30.price, 50);
assert.strictEqual(seededDrink30.stock, 24);
assert.strictEqual(seededDrink30.reserved, 3);
assert.deepStrictEqual(seededDrink30.offers, [{ qty: 12, total: 500, label: "買10送2" }]);
const paste = store.inventory.find((item) => item.productId === "guilu-gao");
assert.strictEqual(paste.price, 1500);
assert.strictEqual(paste.originalPrice, 1800);
const jiao = store.inventory.find((item) => item.productId === "guilu-jiao");
assert.strictEqual(jiao.price, 9600);
assert.strictEqual(jiao.originalPrice, 12000);
assert.strictEqual(jiao.quoteOnly, false);
assert.ok(store.activities.at(-1).detail.includes("價格、優惠與規格"));

console.log("PASS ERP inventory keeps stock while synchronizing six official prices and buy-ten-get-two promotions");
