"use strict";

const { parseOrderLines, inventoryMode } = require("./internal-line-order-sync");

function rebuildReservations(readStore, writeStore) {
  const store = readStore();
  store.inventory = Array.isArray(store.inventory) ? store.inventory : [];
  store.orders = Array.isArray(store.orders) ? store.orders : [];

  for (const item of store.inventory) item.reserved = 0;

  for (const order of store.orders) {
    if (inventoryMode(order) !== "reserved") continue;
    const lines = parseOrderLines(order, store.inventory);
    order.orderLines = lines;
    order.inventoryMode = "reserved";
    for (const line of lines) {
      const item = store.inventory.find((entry) => entry.productId === line.productId);
      if (item) item.reserved = Math.max(0, Number(item.reserved || 0) + Number(line.qty || 0));
    }
  }

  const summary = store.inventory.map((item) => ({
    productId: item.productId,
    name: item.name,
    stock: Number(item.stock || 0),
    reserved: Number(item.reserved || 0),
    available: Math.max(0, Number(item.stock || 0) - Number(item.reserved || 0)),
  }));
  writeStore(store);
  return { rebuilt: true, products: summary.length, reservedProducts: summary.filter((item) => item.reserved > 0).length, summary };
}

module.exports = { rebuildReservations };
