"use strict";

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const express = require("express");
const line = require("@line/bot-sdk");
const { app } = require("./server");
const social = require("./social-server");

const VERSION = "1.0.0";
const ROUTE = "/internal/api/v2/publish-bridge";
const BRIDGE_SECRET = String(process.env.INTERNAL_APP_SECRET || "").trim();
const LINE_TOKEN = String(process.env.CHANNEL_ACCESS_TOKEN || "").trim();
const LEDGER_PATH = String(
  process.env.ERP_PUBLISH_BRIDGE_LEDGER_PATH ||
  `${process.env.SOCIAL_DATA_PATH || "/tmp/xianjiawei-social-posts.json"}.erp-publish-bridge.json`
).trim();
const json = express.json({ limit: "2mb" });
const lineClient = LINE_TOKEN
  ? new line.messagingApi.MessagingApiClient({ channelAccessToken: LINE_TOKEN })
  : null;

function clean(value, max = 5000) {
  return String(value || "").trim().slice(0, max);
}

function safeEqual(left, right) {
  const a = Buffer.from(String(left || ""));
  const b = Buffer.from(String(right || ""));
  return a.length === b.length && a.length > 0 && crypto.timingSafeEqual(a, b);
}

function bearer(req) {
  const header = clean(req.get("authorization"), 10000);
  if (/^Bearer\s+/i.test(header)) return header.replace(/^Bearer\s+/i, "").trim();
  return clean(req.get("x-internal-app-secret"), 10000);
}

function authorized(req) {
  return Boolean(BRIDGE_SECRET && safeEqual(bearer(req), BRIDGE_SECRET));
}

function platformKey(value) {
  const text = clean(value, 80).toLowerCase();
  if (text.includes("voom")) return "line_voom";
  if (text.includes("facebook")) return "facebook";
  if (text.includes("instagram")) return "instagram";
  if (text.includes("line")) return "line_oa";
  return "";
}

function postText(post = {}) {
  return [...new Set([clean(post.headline), clean(post.copy), clean(post.caption)])]
    .filter(Boolean)
    .join("\n\n")
    .slice(0, 5000);
}

function readLedger() {
  try {
    if (!fs.existsSync(LEDGER_PATH)) return { items: {} };
    const parsed = JSON.parse(fs.readFileSync(LEDGER_PATH, "utf8"));
    return { items: parsed?.items && typeof parsed.items === "object" ? parsed.items : {} };
  } catch (error) {
    console.error("ERP publish bridge ledger read failed", error.message);
    return { items: {} };
  }
}

function writeLedger(ledger) {
  const entries = Object.entries(ledger.items || {})
    .sort((a, b) => String(b[1]?.published_at || "").localeCompare(String(a[1]?.published_at || "")))
    .slice(0, 1500);
  const payload = { version: VERSION, updated_at: new Date().toISOString(), items: Object.fromEntries(entries) };
  fs.mkdirSync(path.dirname(LEDGER_PATH), { recursive: true });
  const temporary = `${LEDGER_PATH}.${process.pid}.tmp`;
  fs.writeFileSync(temporary, `${JSON.stringify(payload, null, 2)}\n`, { mode: 0o600 });
  fs.renameSync(temporary, LEDGER_PATH);
}

function remoteId(result, fallback) {
  return clean(
    result?.id || result?.post_id || result?.media_id || result?.messageId || result?.requestId || fallback,
    500
  );
}

async function publishLine(post) {
  if (!lineClient) throw new Error("LINE OA 的 CHANNEL_ACCESS_TOKEN 尚未設定");
  const messages = [];
  const text = postText(post);
  const image = clean(post.image_url || post.imageUrl, 2000);
  if (text) messages.push({ type: "text", text });
  if (image) {
    if (!/^https:\/\//i.test(image)) throw new Error("LINE OA 圖片必須是公開 HTTPS 網址");
    messages.push({ type: "image", originalContentUrl: image, previewImageUrl: image });
  }
  if (!messages.length) throw new Error("LINE OA 廣播缺少文案或圖片");
  return lineClient.broadcast({ messages: messages.slice(0, 5), notificationDisabled: false });
}

async function dispatch(key, post) {
  const text = postText(post);
  const imageUrl = clean(post.image_url || post.imageUrl, 2000);
  if (key === "facebook") {
    return social.publishFacebook({ imageUrl, facebookCaption: text, instagramCaption: text });
  }
  if (key === "instagram") {
    if (!imageUrl) throw new Error("Instagram 必須有圖片");
    return social.publishInstagram({ imageUrl, instagramCaption: text, facebookCaption: text });
  }
  if (key === "line_oa") return publishLine(post);
  throw new Error("不支援的發布平台");
}

function readiness() {
  return {
    Facebook: Boolean(process.env.META_PAGE_ID && process.env.META_PAGE_ACCESS_TOKEN),
    Instagram: Boolean(process.env.INSTAGRAM_USER_ID && process.env.INSTAGRAM_ACCESS_TOKEN),
    "LINE OA 廣播": Boolean(LINE_TOKEN),
    "LINE VOOM": false,
  };
}

function mount() {
  if (global.__xjwErpPublishBridgeMounted) return;
  global.__xjwErpPublishBridgeMounted = true;

  app.get(`${ROUTE}/healthz`, (_req, res) => {
    res.set("Cache-Control", "no-store, max-age=0");
    res.json({
      ok: true,
      service: "仙加味 ERP 發布橋接",
      version: VERSION,
      authenticationConfigured: Boolean(BRIDGE_SECRET),
      platforms: readiness(),
      lineVoomManualOnly: true,
      checkedAt: new Date().toISOString(),
    });
  });

  app.post(ROUTE, json, async (req, res) => {
    res.set("Cache-Control", "no-store, max-age=0");
    if (!authorized(req)) return res.status(401).json({ ok: false, error: "發布橋接驗證失敗" });

    const key = platformKey(req.body?.platform || req.get("x-xianjiawei-platform"));
    if (key === "line_voom") {
      return res.status(409).json({
        ok: false,
        manual_required: true,
        error: "LINE VOOM 沒有公開建立貼文 API，請使用 ERP 手動發布包後補登已發布。",
      });
    }
    if (!key) return res.status(400).json({ ok: false, error: "不支援的發布平台" });

    const post = req.body?.post && typeof req.body.post === "object" ? req.body.post : {};
    const postId = clean(post.id || req.get("x-xianjiawei-post-id"), 300);
    if (!postId) return res.status(400).json({ ok: false, error: "缺少貼文 ID" });

    const idempotencyKey = clean(
      req.body?.idempotency_key || req.get("idempotency-key") || `${postId}:${key}`,
      700
    );
    const ledger = readLedger();
    const existing = ledger.items[idempotencyKey];
    if (existing?.status === "published") {
      return res.json({
        ok: true,
        deduplicated: true,
        id: existing.remote_id || idempotencyKey,
        post_id: postId,
        platform: key,
        published_at: existing.published_at,
      });
    }

    try {
      const result = await dispatch(key, post);
      const publishedAt = new Date().toISOString();
      const id = remoteId(result, idempotencyKey);
      ledger.items[idempotencyKey] = {
        status: "published",
        post_id: postId,
        platform: key,
        remote_id: id,
        published_at: publishedAt,
      };
      writeLedger(ledger);
      return res.json({
        ok: true,
        id,
        post_id: postId,
        platform: key,
        published_at: publishedAt,
        response: result || {},
      });
    } catch (error) {
      const message = clean(error?.message || error || "發布失敗", 1500);
      console.error(`ERP publish bridge ${key} failed`, message);
      return res.status(502).json({ ok: false, platform: key, error: message });
    }
  });
}

mount();

module.exports = {
  VERSION,
  ROUTE,
  platformKey,
  postText,
  readiness,
  mount,
};
