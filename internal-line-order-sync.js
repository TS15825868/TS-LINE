"use strict";

const express = require("express");
const crypto = require("crypto");

const VERSION = "1.2.1";
const json = express.json({ limit: "2mb" });
const SHIPPED = new Set(["已出貨", "已完成"]);
const CANCELLED = new Set(["已取消"]);
const ORDER_STATUSES = new Set(["新訂單", "已聯絡", "已付款", "備貨中", "待送貨", "已出貨", "已完成", "已取消"]);
const clean = (value, max = 1000) => String(value ?? "").replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, max);
const now = () => new Date().toISOString();
const uid = (prefix) => `${prefix}-${Date.now().toString(36)}-${crypto.randomBytes(3).toString("hex")}`;
const number = (value) => Number.isFinite(Number(String(value ?? "").replace(/,/g, ""))) ? Number(String(value ?? "").replace(/,/g, "")) : 0;

function normalized(value) {
  return clean(value, 300).toLowerCase().replace(/[\s　()（）\[\]【】]/g, "");
}

function inventoryMatch(line = {}, inventory = []) {
  const wantedId = clean(line.productId, 120);
  const wantedName = normalized(line.name || line.displayName || line.productName);
  return inventory.find((entry) => wantedId && entry.productId === wantedId)
    || inventory.find((entry) => normalized(entry.name) === wantedName)
    || inventory.find((entry) => wantedName && (normalized(entry.name).includes(wantedName) || wantedName.includes(normalized(entry.name))));
}

function rawOrderLines(order = {}) {
  let structured = order.orderLines;
  if (typeof structured === "string") {
    try { structured = JSON.parse(structured); }
    catch { structured = []; }
  }
  if (Array.isArray(structured) && structured.length) return structured;
  return String(order.items || "")
    .split(/\n|、|；|;/)
    .map((line) => {
      const match = line.trim().match(/^(.+?)\s*[×xX*]\s*(\d+(?:\.\d+)?)(?:\s*[｜|]\s*單價\s*\$?([\d,]+(?:\.\d+)?))?(?:\s*[｜|]\s*小計\s*\$?([\d,]+(?:\.\d+)?))?\s*$/);
      if (!match) return null;
      const qty = number(match[2]);
      const subtotal = number(match[4]);
      return { name: match[1].trim(), qty, unitPrice: number(match[3]) || (qty && subtotal ? subtotal / qty : 0) };
    })
    .filter(Boolean);
}

function normalizePricingLines(order = {}, inventory = []) {
  const lines = [];
  for (const raw of rawOrderLines(order)) {
    const qty = Math.max(0, number(raw.qty ?? raw.quantity));
    if (!qty) continue;
    const item = inventoryMatch(raw, inventory);
    const name = clean(raw.name || raw.productName || item?.name || "自訂商品", 300);
    const unitPrice = Math.max(0, number(raw.unitPrice ?? raw.price));
    lines.push({
      productId: item?.productId || clean(raw.productId, 120),
      name,
      qty,
      unitPrice,
      subtotal: Math.round(qty * unitPrice),
    });
  }
  return lines;
}

function hasManagedPricing(order = {}) {
  if (order.pricingManaged === true || order.pricingManaged === "true") return true;
  if (Array.isArray(order.orderLines)) return true;
  if (typeof order.orderLines === "string" && order.orderLines.trim().startsWith("[")) return true;
  return ["subtotal", "discount", "shippingFee", "paidAmount", "paymentStatus", "balance"].some((key) => order[key] !== undefined && order[key] !== "");
}

function normalizeOrderPayload(order = {}, inventory = []) {
  const next = { ...order };
  const lines = normalizePricingLines(next, inventory);
  const managed = hasManagedPricing(next);

  if (managed && lines.length) {
    next.orderLines = lines;
    next.items = lines.map((line) => `${line.name} × ${line.qty}｜單價 $${Math.round(line.unitPrice).toLocaleString("en-US")}｜小計 $${Math.round(line.subtotal).toLocaleString("en-US")}`).join("\n");
  }

  if (managed) {
    const subtotal = lines.reduce((sum, line) => sum + number(line.subtotal), 0);
    const discount = Math.max(0, number(next.discount));
    const shippingFee = Math.max(0, number(next.shippingFee));
    const total = Math.max(0, subtotal + shippingFee - discount);
    const paidAmount = Math.max(0, number(next.paidAmount));
    const balance = Math.max(0, total - paidAmount);
    next.subtotal = Math.round(subtotal);
    next.discount = Math.round(discount);
    next.shippingFee = Math.round(shippingFee);
    next.total = Math.round(total);
    next.paidAmount = Math.round(paidAmount);
    next.balance = Math.round(balance);
    next.paymentStatus = clean(next.paymentStatus, 40) === "已退款"
      ? "已退款"
      : total > 0 && paidAmount >= total
        ? "已付款"
        : paidAmount > 0
          ? "部分付款"
          : "未付款";
    next.pricingManaged = true;
    next.pricingUpdatedAt = now();
  }

  if (next.status && ORDER_STATUSES.has(clean(next.status, 40))) next.status = clean(next.status, 40);
  return next;
}

function parseOrderLines(order = {}, inventory = []) {
  const merged = new Map();
  for (const line of normalizePricingLines(order, inventory)) {
    const item = inventoryMatch(line, inventory);
    if (!item) continue;
    const unitPrice = Math.max(0, number(line.unitPrice || item.price));
    const key = `${item.productId}::${unitPrice}`;
    const previous = merged.get(key) || { productId: item.productId, name: item.name, qty: 0, unitPrice };
    previous.qty += line.qty;
    previous.subtotal = Math.round(previous.qty * previous.unitPrice);
    merged.set(key, previous);
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
    const previous = result.get(line.productId) || { ...line, qty: 0, reserved: 0, shipped: 0 };
    previous.qty += line.qty;
    previous.reserved += mode === "reserved" ? line.qty : 0;
    previous.shipped += mode === "shipped" ? line.qty : 0;
    result.set(line.productId, previous);
  }
  return result;
}

function movement(item, delta, reservedDelta, reason, actor, order) {
  item.movements = Array.isArray(item.movements) ? item.movements : [];
  item.movements.push({
    id: uid("mov"), delta, reservedDelta, reason: clean(reason, 300), actor: clean(actor, 80),
    orderId: clean(order?.id, 120), createdAt: now(),
  });
  item.movements = item.movements.slice(-300);
}

function applyOrderTransition(store, before, after, actor = "系統") {
  store.inventory = Array.isArray(store.inventory) ? store.inventory : [];
  store.activities = Array.isArray(store.activities) ? store.activities : [];
  if (after) Object.assign(after, normalizeOrderPayload(after, store.inventory));
  const beforeQty = quantities(before, store.inventory);
  const afterQty = quantities(after, store.inventory);
  const ids = new Set([...beforeQty.keys(), ...afterQty.keys()]);
  const changes = [];

  for (const productId of ids) {
    const item = store.inventory.find((entry) => entry.productId === productId);
    if (!item) continue;
    item.stock = Math.max(0, number(item.stock));
    item.reserved = Math.max(0, number(item.reserved));
    const oldLine = beforeQty.get(productId) || { reserved: 0, shipped: 0 };
    const newLine = afterQty.get(productId) || { reserved: 0, shipped: 0 };
    const reservedDelta = newLine.reserved - oldLine.reserved;
    const shippedDelta = newLine.shipped - oldLine.shipped;
    const stockDelta = -shippedDelta;
    if (!reservedDelta && !stockDelta) continue;

    item.reserved = Math.max(0, item.reserved + reservedDelta);
    item.stock = Math.max(0, item.stock + stockDelta);
    item.availableStock = Math.max(0, item.stock - item.reserved);
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
    after.inventoryMode = inventoryMode(after);
    after.inventorySyncedAt = now();
  }
  if (changes.length) {
    store.activities.push({
      id: uid("act"), actor: clean(actor, 80), action: "訂單庫存連動",
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
    "待送貨": "您的仙加味訂單已完成備貨，正在等待安排寄送。",
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
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
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

function validateOrderAvailability(store, before, candidate) {
  if (!candidate || CANCELLED.has(candidate.status)) return null;
  const inventory = store.inventory || [];
  const beforeQty = quantities(before, inventory);
  const candidateQty = quantities(candidate, inventory);
  const mode = inventoryMode(candidate);
  const shortages = [];
  for (const [productId, line] of candidateQty.entries()) {
    const item = inventory.find((entry) => entry.productId === productId);
    if (!item) { shortages.push(`${line.name} 找不到庫存品項`); continue; }
    const previous = beforeQty.get(productId) || { reserved: 0, shipped: 0 };
    const available = mode === "shipped"
      ? number(item.stock) + number(previous.shipped)
      : number(item.stock) - number(item.reserved) + number(previous.reserved);
    if (line.qty > available) shortages.push(`${line.name} 需要 ${line.qty}，可用 ${Math.max(0, available)}`);
  }
  return shortages.length ? `庫存不足：${shortages.join("、")}` : null;
}

function validateShipment(store, before, candidate) {
  if (!candidate || !SHIPPED.has(candidate.status)) return null;
  return validateOrderAvailability(store, before, candidate);
}

function mountLineOrderSync(app, { readStore, writeStore }) {
  app.use("/internal/api/v2/orders", json, (req, res, next) => {
    const method = req.method.toUpperCase();
    if (!["POST", "PATCH", "DELETE"].includes(method)) return next();
    const beforeStore = readStore();
    const routeId = req.path.split("/").filter(Boolean)[0] || "";
    const before = method === "POST" ? null : beforeStore.orders.find((item) => item.id === routeId);
    const requestedStatus = clean(req.body?.status, 40);

    if (["POST", "PATCH"].includes(method)) {
      const merged = method === "POST" ? req.body : { ...before, ...req.body };
      const normalizedPayload = normalizeOrderPayload(merged, beforeStore.inventory || []);
      req.body = method === "POST" ? normalizedPayload : { ...req.body, ...normalizedPayload };
      const error = validateOrderAvailability(beforeStore, before, normalizedPayload);
      if (error) return res.status(409).json({ ok: false, error });
    }

    const originalJson = res.json.bind(res);
    res.json = (payload) => {
      if (res.statusCode >= 200 && res.statusCode < 300 && payload?.ok !== false) {
        try {
          const store = readStore();
          const payloadOrder = payload?.order || null;
          let after = payloadOrder ? store.orders.find((item) => item.id === payloadOrder.id) || payloadOrder : null;
          if (!after && method === "POST") after = store.orders.at(-1) || null;
          if (after) {
            Object.assign(after, normalizeOrderPayload({ ...after, ...req.body }, store.inventory || []));
            if (ORDER_STATUSES.has(requestedStatus)) after.status = requestedStatus;
          }
          applyOrderTransition(store, before, after, req.internalUser?.user || "內部 App");
          writeStore(store);
          res.locals.xjwOrderAfter = after;
          if (after) payload.order = after;
        } catch (error) {
          console.error("order inventory synchronization failed", error.message);
        }
      }
      return originalJson(payload);
    };

    res.on("finish", () => {
      if (res.statusCode < 200 || res.statusCode >= 300 || !res.locals.xjwOrderAfter) return;
      setImmediate(async () => {
        const store = readStore();
        const after = store.orders.find((item) => item.id === res.locals.xjwOrderAfter.id) || res.locals.xjwOrderAfter;
        try { await notifyOrder(store, before, after); }
        catch (error) {
          store.activities.push({ id: uid("act"), actor: "系統", action: "LINE 訂單通知失敗", detail: `${after.customerName || after.id}｜${error.message}`, createdAt: now() });
        }
        writeStore(store);
      });
    });
    next();
  });
}

module.exports = {
  VERSION, ORDER_STATUSES, rawOrderLines, normalizePricingLines, normalizeOrderPayload, parseOrderLines,
  inventoryMode, applyOrderTransition, statusMessage, notifyOrder, validateOrderAvailability,
  validateShipment, mountLineOrderSync,
};
