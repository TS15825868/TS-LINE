"use strict";

const express = require("express");
const crypto = require("crypto");

const VERSION = "1.0.0";
const json = express.json({ limit: "2mb" });
const SHIPPED = new Set(["已出貨", "已完成"]);
const CANCELLED = new Set(["已取消"]);
const clean = (value, max = 1000) => String(value ?? "").replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, max);
const now = () => new Date().toISOString();
const uid = (prefix) => `${prefix}-${Date.now().toString(36)}-${crypto.randomBytes(3).toString("hex")}`;
const number = (value) => Number.isFinite(Number(value)) ? Number(value) : 0;

function normalized(value) {
  return clean(value, 300).toLowerCase().replace(/[\s　()（）\[\]【】]/g, "");
}

function parseOrderLines(order = {}, inventory = []) {
  const structured = Array.isArray(order.orderLines) ? order.orderLines : [];
  const source = structured.length
    ? structured
    : String(order.items || "")
        .split(/\n|、|；|;/)
        .map((line) => {
          const match = line.trim().match(/^(.+?)\s*[×xX*]\s*(\d+(?:\.\d+)?)\s*$/);
          return match ? { name: match[1].trim(), qty: Number(match[2]) } : null;
        })
        .filter(Boolean);

  const merged = new Map();
  for (const line of source) {
    const qty = Math.max(0, number(line.qty ?? line.quantity));
    if (!qty) continue;
    const wantedId = clean(line.productId, 120);
    const wantedName = normalized(line.name || line.displayName || line.productName);
    const item = inventory.find((entry) => wantedId && entry.productId === wantedId)
      || inventory.find((entry) => normalized(entry.name) === wantedName)
      || inventory.find((entry) => wantedName && (normalized(entry.name).includes(wantedName) || wantedName.includes(normalized(entry.name))));
    if (!item) continue;
    const previous = merged.get(item.productId) || { productId: item.productId, name: item.name, qty: 0 };
    previous.qty += qty;
    merged.set(item.productId, previous);
  }
  return [...merged.values()];
}

function inventoryMode(order = {}) {
  if (SHIPPED.has(order.status)) return "shipped";
  if (CANCELLED.has(order.status)) return "cancelled";
  return "reserved";
}

function quantities(order, inventory) {
  const result = new Map();
  if (!order) return result;
  const mode = inventoryMode(order);
  for (const line of parseOrderLines(order, inventory)) {
    result.set(line.productId, {
      ...line,
      reserved: mode === "reserved" ? line.qty : 0,
      shipped: mode === "shipped" ? line.qty : 0,
    });
  }
  return result;
}

function movement(item, delta, reservedDelta, reason, actor, order) {
  item.movements = Array.isArray(item.movements) ? item.movements : [];
  item.movements.push({
    id: uid("mov"),
    delta,
    reservedDelta,
    reason: clean(reason, 300),
    actor: clean(actor, 80),
    orderId: clean(order?.id, 120),
    createdAt: now(),
  });
  item.movements = item.movements.slice(-300);
}

function applyOrderTransition(store, before, after, actor = "系統") {
  store.inventory = Array.isArray(store.inventory) ? store.inventory : [];
  store.activities = Array.isArray(store.activities) ? store.activities : [];
  const beforeQty = quantities(before, store.inventory);
  const afterQty = quantities(after, store.inventory);
  const ids = new Set([...beforeQty.keys(), ...afterQty.keys()]);
  const changes = [];

  for (const productId of ids) {
    const item = store.inventory.find((entry) => entry.productId === productId);
    if (!item) continue;
    item.stock = Math.max(0, number(item.stock));
    item.reserved = Math.max(0, number(item.reserved));
    const oldLine = beforeQty.get(productId) || { reserved: 0, shipped: 0, qty: 0 };
    const newLine = afterQty.get(productId) || { reserved: 0, shipped: 0, qty: 0 };
    const reservedDelta = newLine.reserved - oldLine.reserved;
    const shippedDelta = newLine.shipped - oldLine.shipped;
    const stockDelta = -shippedDelta;

    if (!reservedDelta && !stockDelta) continue;
    item.reserved = Math.max(0, item.reserved + reservedDelta);
    item.stock = Math.max(0, item.stock + stockDelta);
    item.updatedAt = now();

    let reason = "訂單調整";
    if (reservedDelta > 0) reason = "訂單建立／修改，保留庫存";
    else if (reservedDelta < 0 && stockDelta === 0) reason = "訂單取消／修改，釋放保留庫存";
    if (stockDelta < 0) reason = "訂單出貨，正式扣除庫存";
    if (stockDelta > 0) reason = "訂單取消／退回，回補庫存";
    movement(item, stockDelta, reservedDelta, reason, actor, after || before);
    changes.push({ productId, name: item.name, stockDelta, reservedDelta, stock: item.stock, reserved: item.reserved });
  }

  if (after) {
    after.orderLines = parseOrderLines(after, store.inventory);
    after.inventoryMode = inventoryMode(after);
    after.inventorySyncedAt = now();
  }

  if (changes.length) {
    store.activities.push({
      id: uid("act"),
      actor: clean(actor, 80),
      action: "訂單庫存連動",
      detail: changes.map((item) => `${item.name}｜庫存${item.stockDelta >= 0 ? "+" : ""}${item.stockDelta}｜保留${item.reservedDelta >= 0 ? "+" : ""}${item.reservedDelta}`).join("；"),
      createdAt: now(),
    });
    store.activities = store.activities.slice(-1000);
  }
  return changes;
}

function lineUserId(order, store) {
  const direct = clean(order?.lineUserId, 200);
  if (/^U[a-zA-Z0-9_-]{20,}$/.test(direct)) return direct;
  const customer = (store.customers || []).find((item) => order?.phone && item.phone === order.phone);
  const linked = clean(customer?.lineId, 200);
  return /^U[a-zA-Z0-9_-]{20,}$/.test(linked) ? linked : "";
}

function statusMessage(order, before = {}) {
  const changedStatus = before.status !== order.status;
  const changedTracking = clean(before.trackingNo, 120) !== clean(order.trackingNo, 120) && clean(order.trackingNo, 120);
  if (!changedStatus && !changedTracking) return "";
  const name = order.customerName ? `${order.customerName}您好，` : "您好，";
  const numberText = order.externalId || order.id || "";
  const tracking = order.trackingNo ? `\n物流單號：${order.trackingNo}` : "";
  const map = {
    "已聯絡": "您的仙加味訂單已由客服確認。",
    "已付款": "您的仙加味訂單已確認付款。",
    "備貨中": "您的仙加味訂單正在備貨中。",
    "已出貨": `您的仙加味訂單已出貨。${tracking}`,
    "已完成": "您的仙加味訂單已完成，謝謝您的支持。",
    "已取消": "您的仙加味訂單已取消；如有疑問請直接回覆官方 LINE。",
  };
  const main = changedStatus ? map[order.status] : `您的仙加味訂單物流資訊已更新。${tracking}`;
  if (!main) return "";
  return `${name}${main}${numberText ? `\n訂單編號：${numberText}` : ""}\n\n仙加味・龜鹿`;
}

async function pushLineText(userId, text) {
  const token = String(process.env.CHANNEL_ACCESS_TOKEN || "").trim();
  if (!token || !userId || !text) return { sent: false, reason: "not-configured" };
  const response = await fetch("https://api.line.me/v2/bot/message/push", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ to: userId, messages: [{ type: "text", text }] }),
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`LINE 通知失敗（${response.status}）${detail ? `：${detail.slice(0, 180)}` : ""}`);
  }
  return { sent: true };
}

async function notifyOrder(store, before, after) {
  if (!after) return { sent: false, reason: "deleted" };
  const userId = lineUserId(after, store);
  const text = statusMessage(after, before || {});
  if (!userId || !text) return { sent: false, reason: !userId ? "no-line-user" : "no-change" };
  try {
    const result = await pushLineText(userId, text);
    after.lastLineNotificationAt = now();
    after.lastLineNotificationStatus = after.status;
    after.lastLineNotificationError = "";
    return result;
  } catch (error) {
    after.lastLineNotificationError = error.message;
    throw error;
  }
}

function validateShipment(store, before, candidate) {
  if (!candidate || !SHIPPED.has(candidate.status) || SHIPPED.has(before?.status)) return null;
  const lines = parseOrderLines(candidate, store.inventory || []);
  const shortages = lines.filter((line) => {
    const item = (store.inventory || []).find((entry) => entry.productId === line.productId);
    return !item || number(item.stock) < line.qty;
  });
  return shortages.length ? `庫存不足：${shortages.map((line) => `${line.name} 需要 ${line.qty}`).join("、")}` : null;
}

function mountLineOrderSync(app, { readStore, writeStore }) {
  app.use("/internal/api/v2/orders", json, (req, res, next) => {
    const method = req.method.toUpperCase();
    if (!["POST", "PATCH", "DELETE"].includes(method)) return next();
    const beforeStore = readStore();
    const before = method === "POST" ? null : beforeStore.orders.find((item) => item.id === req.params?.id || item.id === req.path.split("/").filter(Boolean)[0]);

    if (method === "PATCH" && before) {
      const candidate = { ...before, ...req.body };
      const error = validateShipment(beforeStore, before, candidate);
      if (error) return res.status(409).json({ ok: false, error });
    }

    const originalJson = res.json.bind(res);
    res.json = (payload) => {
      res.locals.xjwOrderPayload = payload;
      return originalJson(payload);
    };

    res.on("finish", () => {
      if (res.statusCode < 200 || res.statusCode >= 300) return;
      setImmediate(async () => {
        try {
          const store = readStore();
          const after = res.locals.xjwOrderPayload?.order || null;
          const removed = method === "DELETE" ? before : null;
          applyOrderTransition(store, before, after, req.internalUser?.user || "內部 App");
          if (removed) removed.deletedAt = now();
          writeStore(store);
          if (after) {
            try { await notifyOrder(store, before, after); }
            catch (error) {
              store.activities.push({ id: uid("act"), actor: "系統", action: "LINE 訂單通知失敗", detail: `${after.customerName || after.id}｜${error.message}`, createdAt: now() });
            }
            writeStore(store);
          }
        } catch (error) {
          console.error("order inventory/LINE synchronization failed", error.message);
        }
      });
    });
    next();
  });
}

module.exports = {
  VERSION,
  parseOrderLines,
  inventoryMode,
  applyOrderTransition,
  statusMessage,
  notifyOrder,
  validateShipment,
  mountLineOrderSync,
};
