"use strict";

const assert = require("assert");
const { rebuildReservations } = require("./internal-reservation-rebuild");

let store = {
  inventory: [
    { productId: "paste-100", name: "龜鹿膏100g", stock: 10, reserved: 99 },
    { productId: "powder-75", name: "鹿茸粉75g", stock: 5, reserved: 99 },
  ],
  orders: [
    { id: "a", items: "龜鹿膏100g × 2", status: "新訂單" },
    { id: "b", items: "龜鹿膏100g × 1\n鹿茸粉75g × 2", status: "備貨中" },
    { id: "c", items: "鹿茸粉75g × 1", status: "已出貨" },
    { id: "d", items: "龜鹿膏100g × 8", status: "已取消" },
  ],
};

const result = rebuildReservations(() => JSON.parse(JSON.stringify(store)), (next) => { store = next; });
assert.strictEqual(result.rebuilt, true);
assert.strictEqual(store.inventory[0].reserved, 3);
assert.strictEqual(store.inventory[1].reserved, 2);
assert.strictEqual(store.inventory[0].stock, 10);
assert.strictEqual(store.inventory[1].stock, 5);
console.log("PASS reserved stock rebuild");
