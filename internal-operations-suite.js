"use strict";

const crypto = require("crypto");
const express = require("express");

const VERSION = "1.0.0";
const COOKIE = "xjw_internal";
const json = express.json({ limit: "6mb" });
const now = () => new Date().toISOString();
const uid = (prefix) => `${prefix}-${Date.now().toString(36)}-${crypto.randomBytes(3).toString("hex")}`;
const clean = (value, max = 2000) => String(value ?? "").replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, max);
const number = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const csvCell = (value) => `"${String(value ?? "").replace(/"/g, '""')}"`;

function secret() {
  return clean(process.env.INTERNAL_APP_SECRET || process.env.INTERNAL_APP_PASSWORD || process.env.SOCIAL_ADMIN_PIN, 500);
}

function cookies(req) {
  return Object.fromEntries(String(req.headers.cookie || "").split(";").map((part) => part.trim().split("=")).filter((pair) => pair.length === 2));
}

function session(req) {
  try {
    const raw = cookies(req)[COOKIE] || "";
    const [payload, signature] = raw.split(".");
    if (!payload || !signature || !secret()) return null;
    const expected = crypto.createHmac("sha256", secret()).update(payload).digest("base64url");
    if (signature.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (!parsed.user || parsed.exp < Date.now()) return null;
    return parsed;
  } catch {
    return null;
  }
}

function requireApi(req, res, next) {
  const user = session(req);
  if (!user) return res.status(401).json({ ok: false, error: "請重新登入" });
  req.internalUser = user;
  return next();
}

function requestGuard(req, res, next) {
  if (req.get("X-XJW-Requested-With") !== "internal-app-v2") return res.status(403).json({ ok: false, error: "請從管理 App 操作" });
  const origin = clean(req.get("Origin"), 500);
  if (origin) {
    try {
      if (new URL(origin).host !== req.get("host")) return res.status(403).json({ ok: false, error: "來源驗證失敗" });
    } catch {
      return res.status(403).json({ ok: false, error: "來源驗證失敗" });
    }
  }
  return next();
}

function log(store, actor, action, detail = "") {
  store.activities = Array.isArray(store.activities) ? store.activities : [];
  store.activities.push({ id: uid("act"), actor: clean(actor, 80), action: clean(action, 120), detail: clean(detail, 500), createdAt: now() });
  store.activities = store.activities.slice(-1500);
}

function parseProductLines(orders = []) {
  const totals = new Map();
  for (const order of orders) {
    if (order.status === "已取消") continue;
    const lines = String(order.items || "").split(/\n|、|,/).map((line) => line.trim()).filter(Boolean);
    for (const line of lines) {
      const match = line.match(/^(.*?)\s*[×xX*]\s*(\d+(?:\.\d+)?)/);
      const name = clean(match ? match[1] : line, 120) || "未分類";
      const qty = match ? number(match[2], 1) : 1;
      totals.set(name, (totals.get(name) || 0) + qty);
    }
  }
  return [...totals.entries()].map(([name, qty]) => ({ name, qty })).sort((a, b) => b.qty - a.qty);
}

function analytics(store) {
  const orders = Array.isArray(store.orders) ? store.orders : [];
  const customers = Array.isArray(store.customers) ? store.customers : [];
  const inventory = Array.isArray(store.inventory) ? store.inventory : [];
  const valid = orders.filter((item) => item.status !== "已取消");
  const completed = orders.filter((item) => item.status === "已完成");
  const statusCounts = orders.reduce((map, item) => {
    map[item.status || "未分類"] = (map[item.status || "未分類"] || 0) + 1;
    return map;
  }, {});
  const customerSpend = new Map();
  for (const order of valid) {
    const key = clean(order.phone || order.customerName, 120);
    if (!key) continue;
    const row = customerSpend.get(key) || { key, name: order.customerName || key, phone: order.phone || "", orders: 0, total: 0, lastAt: "" };
    row.orders += 1;
    row.total += number(order.total);
    if (!row.lastAt || new Date(order.createdAt) > new Date(row.lastAt)) row.lastAt = order.createdAt;
    customerSpend.set(key, row);
  }
  return {
    orderCount: orders.length,
    validOrderCount: valid.length,
    completedOrderCount: completed.length,
    totalSales: valid.reduce((sum, item) => sum + number(item.total), 0),
    completedSales: completed.reduce((sum, item) => sum + number(item.total), 0),
    averageOrderValue: valid.length ? Math.round(valid.reduce((sum, item) => sum + number(item.total), 0) / valid.length) : 0,
    customerCount: customers.length,
    repeatCustomerCount: [...customerSpend.values()].filter((item) => item.orders > 1).length,
    lowStockCount: inventory.filter((item) => number(item.stock) <= number(item.lowStock)).length,
    statusCounts,
    topProducts: parseProductLines(valid).slice(0, 20),
    topCustomers: [...customerSpend.values()].sort((a, b) => b.total - a.total).slice(0, 20),
  };
}

function mountOperationsSuite(app, deps) {
  const { readStore, writeStore, readSocialStore, writeSocialStore, bridge } = deps;

  app.get("/internal/api/v2/ops/analytics", requireApi, (_req, res) => {
    res.json({ ok: true, version: VERSION, ...analytics(readStore()) });
  });

  app.get("/internal/api/v2/ops/diagnostics", requireApi, (_req, res) => {
    const store = readStore();
    const social = readSocialStore();
    const health = bridge.health();
    res.status(health.enabled && !health.connected ? 503 : 200).json({
      ok: !health.enabled || health.connected,
      version: VERSION,
      storage: health.storage,
      supabaseEnabled: health.enabled,
      supabaseConnected: health.connected,
      restoredAt: health.restoredAt,
      lastSavedAt: health.lastSavedAt,
      lastError: health.lastError,
      counts: {
        orders: store.orders?.length || 0,
        customers: store.customers?.length || 0,
        inventory: store.inventory?.length || 0,
        reminders: store.reminders?.length || 0,
        activities: store.activities?.length || 0,
        socialPosts: social.posts?.length || 0,
      },
      integrations: {
        line: Boolean(process.env.CHANNEL_ACCESS_TOKEN && process.env.CHANNEL_SECRET),
        instagram: Boolean(process.env.INSTAGRAM_USER_ID && process.env.INSTAGRAM_ACCESS_TOKEN),
        facebook: Boolean(process.env.META_PAGE_ID && process.env.META_PAGE_ACCESS_TOKEN),
        crm: Boolean(process.env.CRM_URL),
        socialStorage: Boolean(process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY),
      },
      checkedAt: now(),
    });
  });

  app.post("/internal/api/v2/ops/sync", requireApi, requestGuard, async (req, res) => {
    try {
      const result = await bridge.syncAll();
      const store = readStore();
      log(store, req.internalUser.user, "手動同步", result.enabled ? "Supabase 同步完成" : "本機模式");
      writeStore(store);
      res.json({ ok: true, result, checkedAt: now() });
    } catch (error) {
      res.status(503).json({ ok: false, error: error.message || "同步失敗" });
    }
  });

  app.post("/internal/api/v2/orders/:id/duplicate", requireApi, requestGuard, (req, res) => {
    const store = readStore();
    const source = store.orders.find((item) => item.id === req.params.id);
    if (!source) return res.status(404).json({ ok: false, error: "找不到訂單" });
    const createdAt = now();
    const order = {
      ...source,
      id: uid("ord"),
      source: "內部 App 複製",
      status: "新訂單",
      trackingNo: "",
      note: clean([source.note, `由訂單 ${source.id} 複製`].filter(Boolean).join("｜"), 2000),
      createdAt,
      updatedAt: createdAt,
    };
    store.orders.push(order);
    log(store, req.internalUser.user, "複製訂單", `${order.customerName}｜${source.id}`);
    writeStore(store);
    res.json({ ok: true, order });
  });

  app.post("/internal/api/v2/customers/:id/reminder", requireApi, requestGuard, json, (req, res) => {
    const store = readStore();
    const customer = store.customers.find((item) => item.id === req.params.id);
    if (!customer) return res.status(404).json({ ok: false, error: "找不到客戶" });
    const dueAt = new Date(req.body.dueAt || Date.now() + 7 * 86400000);
    if (Number.isNaN(dueAt.getTime())) return res.status(400).json({ ok: false, error: "提醒時間不正確" });
    const reminder = {
      id: uid("rem"),
      title: clean(req.body.title || `聯絡 ${customer.name}`, 120),
      dueAt: dueAt.toISOString(),
      note: clean(req.body.note || [customer.phone, customer.interests].filter(Boolean).join("｜"), 1000),
      customerId: customer.id,
      done: false,
      createdAt: now(),
      updatedAt: now(),
    };
    store.reminders.push(reminder);
    log(store, req.internalUser.user, "建立客戶追蹤", customer.name);
    writeStore(store);
    res.json({ ok: true, reminder });
  });

  app.post("/internal/api/v2/inventory/bulk", requireApi, requestGuard, json, (req, res) => {
    const updates = Array.isArray(req.body.items) ? req.body.items : [];
    if (!updates.length) return res.status(400).json({ ok: false, error: "沒有庫存資料" });
    const store = readStore();
    const changed = [];
    for (const update of updates.slice(0, 200)) {
      const item = store.inventory.find((entry) => entry.productId === clean(update.productId, 120));
      if (!item) continue;
      if (update.stock !== undefined) item.stock = Math.max(0, number(update.stock));
      if (update.lowStock !== undefined) item.lowStock = Math.max(0, number(update.lowStock));
      item.updatedAt = now();
      changed.push(item.productId);
    }
    log(store, req.internalUser.user, "批次盤點庫存", `更新 ${changed.length} 項`);
    writeStore(store);
    res.json({ ok: true, changed: changed.length });
  });

  app.patch("/internal/api/v2/social/:id", requireApi, requestGuard, json, (req, res) => {
    const store = readSocialStore();
    const post = store.posts.find((item) => item.id === req.params.id);
    if (!post) return res.status(404).json({ ok: false, error: "找不到社群草稿" });
    if (["published", "publishing"].includes(post.status)) return res.status(409).json({ ok: false, error: "已發布或發布中的貼文不可修改" });
    const scheduledAt = req.body.scheduledAt !== undefined ? new Date(req.body.scheduledAt) : new Date(post.scheduledAt);
    if (Number.isNaN(scheduledAt.getTime())) return res.status(400).json({ ok: false, error: "排程時間不正確" });
    for (const [key, max] of [["title",120],["imageUrl",1000],["instagramCaption",2200],["facebookCaption",5000]]) {
      if (req.body[key] !== undefined) post[key] = clean(req.body[key], max);
    }
    if (req.body.publishInstagram !== undefined) post.publishInstagram = Boolean(req.body.publishInstagram);
    if (req.body.publishFacebook !== undefined) post.publishFacebook = Boolean(req.body.publishFacebook);
    post.scheduledAt = scheduledAt.toISOString();
    post.status = "draft";
    post.lastError = "";
    post.updatedAt = now();
    writeSocialStore(store);
    const internal = readStore();
    log(internal, req.internalUser.user, "修改社群草稿", post.title);
    writeStore(internal);
    res.json({ ok: true, post });
  });

  app.post("/internal/api/v2/social/:id/duplicate", requireApi, requestGuard, (req, res) => {
    const store = readSocialStore();
    const source = store.posts.find((item) => item.id === req.params.id);
    if (!source) return res.status(404).json({ ok: false, error: "找不到社群貼文" });
    const post = {
      ...source,
      id: uid("post"),
      title: clean(`${source.title}（複製）`, 120),
      scheduledAt: new Date(Date.now() + 86400000).toISOString(),
      status: "draft",
      result: {},
      lastError: "",
      createdAt: now(),
      updatedAt: now(),
    };
    store.posts.push(post);
    writeSocialStore(store);
    const internal = readStore();
    log(internal, req.internalUser.user, "複製社群草稿", post.title);
    writeStore(internal);
    res.json({ ok: true, post });
  });

  app.get("/internal/api/v2/export/inventory.csv", requireApi, (_req, res) => {
    const rows = readStore().inventory || [];
    const lines = [["產品編號","產品名稱","規格","單位","目前庫存","警戒值","最後更新"], ...rows.map((item) => [item.productId,item.name,item.spec,item.unit,item.stock,item.lowStock,item.updatedAt])]
      .map((row) => row.map(csvCell).join(","));
    res.set("Content-Disposition", "attachment; filename=inventory.csv").type("text/csv; charset=utf-8").send("\ufeff" + lines.join("\n"));
  });

  app.get("/internal/api/v2/export/activities.csv", requireApi, (_req, res) => {
    const rows = readStore().activities || [];
    const lines = [["時間","操作者","動作","內容"], ...rows.map((item) => [item.createdAt,item.actor,item.action,item.detail])]
      .map((row) => row.map(csvCell).join(","));
    res.set("Content-Disposition", "attachment; filename=activities.csv").type("text/csv; charset=utf-8").send("\ufeff" + lines.join("\n"));
  });
}

module.exports = { VERSION, analytics, parseProductLines, mountOperationsSuite };