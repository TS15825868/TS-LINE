"use strict";

const assert = require("assert");
const { readCatalog, seedInventory, promotionFields } = require("./internal-inventory-seed");

const catalog = readCatalog();
assert.strictEqual(catalog.length, 4);
const paste = catalog.find(product => product.id === "guilu-gao");
const drink30 = catalog.find(product => product.id === "guilu-drink-30");
assert.ok(paste && drink30);
assert.ok(!Object.hasOwn(paste, "price"), "Public LINE catalogue must not contain private retail prices");
assert.strictEqual(promotionFields(drink30).quoteOnly, true);
assert.deepStrictEqual(promotionFields(drink30).offers, []);

// Deliberately impossible sentinel amounts; these are NOT real product prices.
const confidentialPrice = 987654321;
const confidentialOriginalPrice = 987654322;
let writes = 0;
let store = {
  inventory: [{
    productId: "guilu-gao",
    name: "舊名稱",
    price: confidentialPrice,
    originalPrice: confidentialOriginalPrice,
    offers: [{ qty: 3, total: 270, label: "既有內部活動" }],
    promotionTexts: ["由 ERP 人工核准"],
    stock: 24,
    reserved: 3,
    lowStock: 5,
  }],
  activities: [],
};

const result = seedInventory(
  () => store,
  next => { store = next; writes += 1; }
);

assert.strictEqual(result.total, 4);
assert.strictEqual(result.added, 3);
assert.strictEqual(result.updated, 1);
assert.strictEqual(result.promotionRulesSynchronized, true);
assert.strictEqual(writes, 1);
const updatedPaste = store.inventory.find(item => item.productId === "guilu-gao");
assert.strictEqual(updatedPaste.name, "龜鹿膏");
assert.strictEqual(updatedPaste.price, confidentialPrice, "Never replace private price with missing public price");
assert.strictEqual(updatedPaste.originalPrice, confidentialOriginalPrice);
assert.strictEqual(updatedPaste.stock, 24);
assert.strictEqual(updatedPaste.reserved, 3);
assert.strictEqual(updatedPaste.quoteOnly, true);
assert.deepStrictEqual(updatedPaste.offers, [{ qty: 3, total: 270, label: "既有內部活動" }], "Keep authorized ERP promotions");
assert.deepStrictEqual(updatedPaste.promotionTexts, ["由 ERP 人工核准"]);

const newlyAdded = store.inventory.find(item => item.productId === "guilu-drink-30");
assert.strictEqual(newlyAdded.price, 0, "Unknown retail price must not be inferred");
assert.strictEqual(newlyAdded.originalPrice, 0);
assert.strictEqual(newlyAdded.quoteOnly, true);
assert.deepStrictEqual(newlyAdded.offers, []);
assert.ok(store.activities.at(-1).detail.includes("內部售價未被公開目錄覆寫"));

const second = seedInventory(() => store, next => { store = next; writes += 1; });
assert.strictEqual(second.added, 0);
assert.strictEqual(second.updated, 0);
assert.strictEqual(writes, 1, "Repeated syncing must be idempotent");

console.log("PASS public catalogue sync preserves internal prices and approved promotions");
