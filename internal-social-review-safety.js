"use strict";

const crypto = require("crypto");
const express = require("express");
const Module = require("module");
const { requireSignedIn, requireAdmin } = require("./internal-app-security-patch");
const review = require("./social-review-center");

const VERSION = "1.0.0";
const json = express.json({ limit: "5mb" });
const ACTIVE_STATUSES = new Set([
  "draft",
  "rejected",
  "approved",
  "paused",
  "publishing",
  "failed",
  "partial",
  "published",
]);
const now = () => new Date().toISOString();
const clean = (value, max = 5000) =>
  String(value ?? "")
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .trim()
    .slice(0, max);
const uid = (prefix) => `${prefix}-${Date.now().toString(36)}-${crypto.randomBytes(3).toString("hex")}`;

function requestGuard(req, res, next) {
  if (req.get("X-XJW-Requested-With") !== "internal-app-v2") {
    return res.status(403).json({ ok: false, error: "請從管理 App 操作" });
  }
  const origin = clean(req.get("Origin"), 500);
  if (origin) {
    try {
      if (new URL(origin).host !== req.get("host")) {
        return res.status(403).json({ ok: false, error: "來源驗證失敗" });
      }
    } catch {
      return res.status(403).json({ ok: false, error: "來源驗證失敗" });
    }
  }
  return next();
}

function taipeiParts(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Taipei",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(date)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value])
  );
}

function validSchedule(value) {
  const parts = taipeiParts(value);
  return Boolean(
    parts &&
      ["Wed", "Fri"].includes(parts.weekday) &&
      parts.hour === "20" &&
      parts.minute === "00"
  );
}

function weekKey(value) {
  const parts = taipeiParts(value);
  if (!parts) return "";
  const localDate = new Date(Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day)));
  const day = localDate.getUTCDay() || 7;
  localDate.setUTCDate(localDate.getUTCDate() - day + 1);
  return localDate.toISOString().slice(0, 10);
}

function slotKey(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 16);
}

function scheduleErrors(posts, candidate, currentId = "") {
  const errors = [];
  if (!validSchedule(candidate.scheduledAt)) {
    errors.push("社群排程固定為每週三、週五晚上 20:00");
    return errors;
  }
  const active = (posts || []).filter(
    (post) =>
      post.id !== currentId &&
      ACTIVE_STATUSES.has(post.status) &&
      post.status !== "cancelled" &&
      !Number.isNaN(new Date(post.scheduledAt).getTime())
  );
  const slot = slotKey(candidate.scheduledAt);
  if (active.some((post) => slotKey(post.scheduledAt) === slot)) {
    errors.push("這個日期與時間已經有另一篇貼文");
  }
  const week = weekKey(candidate.scheduledAt);
  if (active.filter((post) => weekKey(post.scheduledAt) === week).length >= 2) {
    errors.push("同一週最多只能排 2 篇貼文");
  }
  return errors;
}

function normalizePost(body = {}, existing = {}) {
  const scheduledAt = new Date(body.scheduledAt ?? existing.scheduledAt);
  return {
    ...existing,
    title: clean(body.title ?? existing.title, 120),
    imageUrl: clean(body.imageUrl ?? existing.imageUrl, 1000),
    instagramCaption: clean(body.instagramCaption ?? existing.instagramCaption, 2200),
    facebookCaption: clean(body.facebookCaption ?? existing.facebookCaption, 5000),
    publishInstagram:
      body.publishInstagram === undefined ? Boolean(existing.publishInstagram) : Boolean(body.publishInstagram),
    publishFacebook:
      body.publishFacebook === undefined ? Boolean(existing.publishFacebook) : Boolean(body.publishFacebook),
    scheduledAt: Number.isNaN(scheduledAt.getTime()) ? "" : scheduledAt.toISOString(),
  };
}

function validationErrors(posts, post, currentId = "") {
  const errors = [];
  if (!post.title) errors.push("標題不可空白");
  errors.push(...review.validation(post));
  errors.push(...scheduleErrors(posts, post, currentId));
  return [...new Set(errors)];
}

function appendHistory(post, action, detail = "") {
  const history = Array.isArray(post.history) ? post.history.slice(-49) : [];
  history.push({ id: uid("hist"), action, detail: clean(detail, 500), createdAt: now() });
  return history;
}

function logActivity(legacy, actor, action, detail = "") {
  const store = legacy.readStore();
  store.activities = Array.isArray(store.activities) ? store.activities : [];
  store.activities.push({
    id: uid("act"),
    actor: clean(actor, 80),
    action: clean(action, 120),
    detail: clean(detail, 500),
    createdAt: now(),
  });
  store.activities = store.activities.slice(-1000);
  legacy.writeStore(store);
}

function auditExistingPosts(social) {
  const store = social.readStore();
  const posts = Array.isArray(store.posts) ? store.posts : [];
  const occupiedSlots = new Set();
  const weeklyCounts = new Map();
  let changed = 0;

  const ordered = posts
    .filter((post) => post.status === "approved")
    .sort((a, b) => new Date(a.scheduledAt) - new Date(b.scheduledAt));

  for (const post of ordered) {
    const errors = review.validation(post);
    if (post.assetLocked !== true) errors.push("正式素材尚未鎖定");
    if (!validSchedule(post.scheduledAt)) errors.push("排程不是週三或週五 20:00");
    const slot = slotKey(post.scheduledAt);
    const week = weekKey(post.scheduledAt);
    if (slot && occupiedSlots.has(slot)) errors.push("排程時間重複");
    if (week && Number(weeklyCounts.get(week) || 0) >= 2) errors.push("同週超過 2 篇");

    if (errors.length) {
      post.status = "paused";
      post.assetLocked = false;
      post.lastError = [...new Set(errors)].join("｜");
      post.history = appendHistory(post, "安全稽核暫停", post.lastError);
      post.updatedAt = now();
      changed += 1;
      continue;
    }
    if (slot) occupiedSlots.add(slot);
    if (week) weeklyCounts.set(week, Number(weeklyCounts.get(week) || 0) + 1);
  }

  if (changed) social.writeStore({ ...store, posts });
  return changed;
}

function mountSafetyRoutes(app, legacy) {
  const social = require("./social-server");

  app.post("/internal/api/v2/social", requireSignedIn, requestGuard, json, (req, res) => {
    const store = social.readStore();
    const post = normalizePost(req.body, {
      id: uid("post"),
      status: "draft",
      assetLocked: false,
      result: {},
      lastError: "",
      createdAt: now(),
      updatedAt: now(),
    });
    const errors = validationErrors(store.posts, post);
    if (errors.length) return res.status(400).json({ ok: false, error: errors.join("；") });
    post.history = appendHistory(post, "建立草稿", "等待審核");
    store.posts.push(post);
    social.writeStore(store);
    logActivity(legacy, req.internalUser.user, "建立社群草稿", post.title);
    return res.json({ ok: true, post });
  });

  app.patch("/internal/api/v2/social/:id", requireSignedIn, requestGuard, json, (req, res) => {
    const store = social.readStore();
    const index = store.posts.findIndex((post) => post.id === req.params.id);
    if (index < 0) return res.status(404).json({ ok: false, error: "找不到社群貼文" });
    const current = store.posts[index];
    if (["published", "publishing"].includes(current.status)) {
      return res.status(409).json({ ok: false, error: "已發布或發布中的貼文不可修改" });
    }
    const post = normalizePost(req.body, current);
    const errors = validationErrors(store.posts, post, current.id);
    if (errors.length) return res.status(400).json({ ok: false, error: errors.join("；") });
    store.posts[index] = {
      ...post,
      status: "draft",
      assetLocked: false,
      approvedAt: "",
      result: {},
      lastError: "",
      history: appendHistory(current, "修改貼文", "解除原核准並重新送審"),
      updatedAt: now(),
    };
    social.writeStore(store);
    logActivity(legacy, req.internalUser.user, "修改社群草稿", post.title);
    return res.json({ ok: true, post: store.posts[index] });
  });

  app.post("/internal/api/v2/social/:id/:action", requireSignedIn, requestGuard, json, async (req, res) => {
    const action = clean(req.params.action, 30);
    const store = social.readStore();
    const index = store.posts.findIndex((post) => post.id === req.params.id);
    if (index < 0) return res.status(404).json({ ok: false, error: "找不到社群貼文" });
    const post = store.posts[index];

    if (action === "delete") {
      return requireAdmin(req, res, () => {
        if (!["draft", "rejected", "cancelled", "failed"].includes(post.status)) {
          return res.status(409).json({ ok: false, error: "已排程、發布中或已發布的紀錄不可刪除" });
        }
        store.posts.splice(index, 1);
        social.writeStore(store);
        logActivity(legacy, req.internalUser.user, "刪除社群草稿", post.title);
        return res.json({ ok: true });
      });
    }

    if (["approve", "resume"].includes(action)) {
      const errors = validationErrors(store.posts, post, post.id);
      if (errors.length) {
        post.status = "draft";
        post.assetLocked = false;
        post.lastError = errors.join("｜");
        post.history = appendHistory(post, "審核未通過", post.lastError);
        post.updatedAt = now();
        social.writeStore(store);
        return res.status(400).json({ ok: false, error: errors.join("；") });
      }
      post.status = "approved";
      post.assetLocked = true;
      post.approvedAt = now();
      post.lastError = "";
      post.history = appendHistory(post, action === "resume" ? "恢復排程" : "審核通過", "正式素材已鎖定");
      post.updatedAt = now();
      social.writeStore(store);
    } else if (action === "reject") {
      post.status = "rejected";
      post.assetLocked = false;
      post.approvedAt = "";
      post.lastError = "已退回修改";
      post.history = appendHistory(post, "退回修改", "");
      post.updatedAt = now();
      social.writeStore(store);
    } else if (action === "pause") {
      if (!["approved", "failed", "partial"].includes(post.status)) {
        return res.status(409).json({ ok: false, error: "只有已排程或發布失敗的貼文可以暫停" });
      }
      post.status = "paused";
      post.history = appendHistory(post, "暫停排程", "");
      post.updatedAt = now();
      social.writeStore(store);
    } else if (action === "cancel") {
      if (post.status === "published") {
        return res.status(409).json({ ok: false, error: "已發布貼文不可取消" });
      }
      post.status = "cancelled";
      post.assetLocked = false;
      post.history = appendHistory(post, "取消貼文", "");
      post.updatedAt = now();
      social.writeStore(store);
    } else if (action === "publish") {
      const errors = validationErrors(store.posts, post, post.id);
      if (post.assetLocked !== true) errors.push("正式素材尚未鎖定");
      if (!["approved", "failed", "partial"].includes(post.status)) errors.push("貼文尚未通過審核");
      if (errors.length) return res.status(400).json({ ok: false, error: [...new Set(errors)].join("；") });
      const result = await social.execute(post.id);
      logActivity(legacy, req.internalUser.user, "立即發布社群貼文", post.title);
      return res.json({ ok: true, post: result });
    } else {
      return res.status(400).json({ ok: false, error: "不支援的操作" });
    }

    logActivity(legacy, req.internalUser.user, "社群操作", `${post.title}｜${action}`);
    return res.json({ ok: true, post });
  });

  const paused = auditExistingPosts(social);
  if (paused) console.warn(`Social safety audit paused ${paused} unsafe approved posts`);
}

let installed = false;
function installHook() {
  if (installed) return;
  installed = true;
  const originalLoad = Module._load;
  Module._load = function patchedLoad(request, parent, isMain) {
    const loaded = originalLoad.apply(this, arguments);
    if (
      request === "./internal-app" &&
      parent?.filename?.endsWith("internal-entry.js") &&
      loaded &&
      !loaded.__xjwSocialSafetyWrapped
    ) {
      const originalMount = loaded.mountInternalApp;
      loaded.mountInternalApp = function mountWithSocialSafety(app) {
        mountSafetyRoutes(app, loaded);
        return originalMount.apply(this, arguments);
      };
      Object.defineProperty(loaded, "__xjwSocialSafetyWrapped", { value: true });
    }
    return loaded;
  };
}

installHook();

module.exports = {
  VERSION,
  taipeiParts,
  validSchedule,
  weekKey,
  slotKey,
  scheduleErrors,
  normalizePost,
  validationErrors,
  auditExistingPosts,
  mountSafetyRoutes,
  installHook,
};
