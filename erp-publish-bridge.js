"use strict";

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const express = require("express");
const line = require("@line/bot-sdk");

const VERSION = "2.1.0-20260904-multi-instagram-auth";
const ROUTE = "/internal/api/v2/publish-bridge";
const GRAPH_VERSION = String(process.env.META_GRAPH_VERSION || "v25.0").replace(/^\/+|\/+$/g, "");
const LINE_TOKEN = String(process.env.CHANNEL_ACCESS_TOKEN || "").trim();
const LEDGER_PATH = String(
  process.env.ERP_PUBLISH_BRIDGE_LEDGER_PATH ||
  `${process.env.SOCIAL_DATA_PATH || "/tmp/xianjiawei-social-posts.json"}.erp-publish-bridge.json`
).trim();

const lineClient = LINE_TOKEN
  ? new line.messagingApi.MessagingApiClient({ channelAccessToken: LINE_TOKEN })
  : null;

function clean(value, max = 5000) {
  return String(value || "").trim().slice(0, max);
}

function unique(values) {
  return [...new Set(values.map((value) => clean(value, 20000)).filter(Boolean))];
}

function bridgeSecrets() {
  return unique([
    process.env.INTERNAL_APP_SECRET,
    process.env.INTERNAL_PUBLISH_BRIDGE_SECRET,
    process.env.FACEBOOK_PUBLISH_WEBHOOK_TOKEN,
    process.env.INSTAGRAM_PUBLISH_WEBHOOK_TOKEN,
    process.env.LINE_OA_PUBLISH_WEBHOOK_TOKEN,
  ]);
}

function safeEqual(left, right) {
  const a = Buffer.from(String(left || ""));
  const b = Buffer.from(String(right || ""));
  return a.length === b.length && a.length > 0 && crypto.timingSafeEqual(a, b);
}

function bearer(req) {
  const header = clean(req.get("authorization"), 20000);
  if (/^Bearer\s+/i.test(header)) return header.replace(/^Bearer\s+/i, "").trim();
  return clean(req.get("x-internal-app-secret"), 20000);
}

function authorized(req) {
  const supplied = bearer(req);
  return Boolean(supplied && bridgeSecrets().some((secret) => safeEqual(supplied, secret)));
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

function imageUrl(post = {}) {
  return clean(post.image_url || post.imageUrl || post.media_url || post.mediaUrl, 3000);
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

function graphUrl(pathname, params = {}) {
  const url = new URL(`https://graph.facebook.com/${GRAPH_VERSION}/${String(pathname || "").replace(/^\/+/, "")}`);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && String(value) !== "") url.searchParams.set(key, String(value));
  }
  return url;
}

async function readJson(response) {
  const text = await response.text();
  let data = {};
  try { data = text ? JSON.parse(text) : {}; }
  catch { data = { raw: text }; }
  if (!response.ok || data?.error) {
    const message = data?.error?.message || data?.error_description || data?.raw || `HTTP ${response.status}`;
    const error = new Error(clean(message, 1800));
    error.status = response.status;
    error.data = data;
    throw error;
  }
  return data;
}

async function graphGet(pathname, token, params = {}) {
  const response = await fetch(graphUrl(pathname, { ...params, access_token: token }), { method: "GET", cache: "no-store" });
  return readJson(response);
}

async function graphPost(pathname, token, params = {}) {
  const response = await fetch(graphUrl(pathname), {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded; charset=utf-8" },
    body: new URLSearchParams({ ...params, access_token: token }),
  });
  return readJson(response);
}

function metaTokenCandidates() {
  return unique([
    process.env.META_PAGE_ACCESS_TOKEN_NEXT,
    process.env.META_PAGE_ACCESS_TOKEN,
    process.env.META_USER_ACCESS_TOKEN,
    process.env.FACEBOOK_PAGE_ACCESS_TOKEN,
    process.env.FACEBOOK_USER_ACCESS_TOKEN,
    process.env.INSTAGRAM_ACCESS_TOKEN,
  ]);
}

async function accountsForToken(token) {
  try {
    const data = await graphGet("me/accounts", token, {
      fields: "id,name,access_token,tasks,instagram_business_account,connected_instagram_account",
      limit: 100,
    });
    return Array.isArray(data?.data) ? data.data : [];
  } catch {
    return [];
  }
}

async function resolvePageAuth() {
  const configuredPageId = clean(process.env.META_PAGE_ID || process.env.FACEBOOK_PAGE_ID, 200);
  const candidates = metaTokenCandidates();
  if (!candidates.length) throw new Error("Meta 發布 Token 尚未設定");

  for (const token of candidates) {
    const accounts = await accountsForToken(token);
    const account = configuredPageId
      ? accounts.find((item) => clean(item?.id) === configuredPageId)
      : accounts.find((item) => item?.access_token);
    if (account?.id && account?.access_token) {
      return {
        pageId: clean(account.id),
        pageName: clean(account.name),
        token: clean(account.access_token, 20000),
        instagramUserId: clean(account.instagram_business_account?.id || account.connected_instagram_account?.id, 200),
      };
    }

    try {
      const me = await graphGet("me", token, {
        fields: "id,name,instagram_business_account,connected_instagram_account",
      });
      const meId = clean(me?.id);
      if (meId && (!configuredPageId || meId === configuredPageId)) {
        return {
          pageId: configuredPageId || meId,
          pageName: clean(me?.name),
          token,
          instagramUserId: clean(me?.instagram_business_account?.id || me?.connected_instagram_account?.id, 200),
        };
      }
    } catch {}
  }

  throw new Error(configuredPageId ? `找不到可發布的 Facebook Page ${configuredPageId}` : "無法解析可發布的 Facebook Page");
}

async function resolveInstagramAuth() {
  const explicitId = clean(process.env.META_INSTAGRAM_USER_ID || process.env.INSTAGRAM_USER_ID, 200);
  const explicitToken = clean(process.env.META_PAGE_ACCESS_TOKEN || process.env.INSTAGRAM_ACCESS_TOKEN, 20000);
  if (explicitId && explicitToken) return { instagramUserId: explicitId, token: explicitToken, source: "explicit" };

  let pageAuth = null;
  try { pageAuth = await resolvePageAuth(); }
  catch {}
  if (pageAuth?.instagramUserId) {
    return { instagramUserId: pageAuth.instagramUserId, token: pageAuth.token, source: "page-accounts" };
  }

  if (pageAuth?.pageId) {
    for (const token of unique([pageAuth.token, ...metaTokenCandidates()])) {
      try {
        const page = await graphGet(pageAuth.pageId, token, {
          fields: "instagram_business_account,connected_instagram_account",
        });
        const id = clean(page?.instagram_business_account?.id || page?.connected_instagram_account?.id, 200);
        if (id) return { instagramUserId: id, token, source: "page-fields" };
      } catch {}
    }
  }

  for (const token of metaTokenCandidates()) {
    const accounts = await accountsForToken(token);
    const linked = accounts.find((item) => item?.instagram_business_account?.id || item?.connected_instagram_account?.id);
    if (linked) {
      return {
        instagramUserId: clean(linked.instagram_business_account?.id || linked.connected_instagram_account?.id, 200),
        token: clean(linked.access_token || token, 20000),
        source: "linked-account",
      };
    }
    try {
      const me = await graphGet("me", token, { fields: "instagram_business_account,connected_instagram_account" });
      const id = clean(me?.instagram_business_account?.id || me?.connected_instagram_account?.id, 200);
      if (id) return { instagramUserId: id, token, source: "me-fields" };
    } catch {}
  }

  throw new Error("無法解析 Instagram 專業帳號 ID；請確認粉專已連結 Instagram 專業帳號");
}

async function publishFacebook(post) {
  const image = imageUrl(post);
  if (!/^https:\/\//i.test(image)) throw new Error("Facebook 圖片必須是公開 HTTPS 網址");
  const auth = await resolvePageAuth();
  const result = await graphPost(`${encodeURIComponent(auth.pageId)}/photos`, auth.token, {
    url: image,
    caption: postText(post),
  });
  return { ...result, page_id: auth.pageId, page_name: auth.pageName };
}

function instagramLoginGraphUrl(pathname, params = {}) {
  const url = new URL(`https://graph.instagram.com/${GRAPH_VERSION}/${String(pathname || "").replace(/^\/+/, "")}`);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && String(value) !== "") url.searchParams.set(key, String(value));
  }
  return url;
}

async function instagramLoginGet(pathname, token, params = {}) {
  const response = await fetch(instagramLoginGraphUrl(pathname, { ...params, access_token: token }), {
    method: "GET",
    cache: "no-store",
    headers: { authorization: `Bearer ${token}` },
  });
  return readJson(response);
}

async function instagramLoginPost(pathname, token, params = {}) {
  const response = await fetch(instagramLoginGraphUrl(pathname), {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/x-www-form-urlencoded; charset=utf-8",
    },
    body: new URLSearchParams({ ...params, access_token: token }),
  });
  return readJson(response);
}

function sanitizeMetaError(message) {
  return clean(message || "Meta API error", 900)
    .replace(/access_token[=:]?[A-Za-z0-9._-]+/gi, "access_token=[redacted]")
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, "Bearer [redacted]");
}

async function resolveInstagramAuthCandidates() {
  const metaId = clean(process.env.META_INSTAGRAM_USER_ID, 200);
  const instagramId = clean(process.env.INSTAGRAM_USER_ID, 200);
  const pageToken = clean(process.env.META_PAGE_ACCESS_TOKEN, 20000);
  const instagramToken = clean(process.env.INSTAGRAM_ACCESS_TOKEN, 20000);
  const candidates = [];
  const seen = new Set();

  const add = (instagramUserId, token, mode, source) => {
    const id = clean(instagramUserId, 200);
    const authToken = clean(token, 20000);
    if (!id || !authToken) return;
    const key = `${mode}:${id}:${authToken}`;
    if (seen.has(key)) return;
    seen.add(key);
    candidates.push({ instagramUserId: id, token: authToken, mode, source });
  };

  // Instagram Login uses an Instagram User access token and graph.instagram.com.
  // Prefer that exact pair first when it is configured.
  add(instagramId, instagramToken, "instagram-login", "INSTAGRAM_USER_ID+INSTAGRAM_ACCESS_TOKEN");
  add(metaId, instagramToken, "instagram-login", "META_INSTAGRAM_USER_ID+INSTAGRAM_ACCESS_TOKEN");

  // Facebook Login uses the connected IG professional account ID with a Page token.
  add(metaId, pageToken, "facebook-login", "META_INSTAGRAM_USER_ID+META_PAGE_ACCESS_TOKEN");
  add(instagramId, pageToken, "facebook-login", "INSTAGRAM_USER_ID+META_PAGE_ACCESS_TOKEN");

  let pageAuth = null;
  try { pageAuth = await resolvePageAuth(); } catch {}
  if (pageAuth?.instagramUserId && pageAuth?.token) {
    add(pageAuth.instagramUserId, pageAuth.token, "facebook-login", "page-accounts");
  }

  if (pageAuth?.pageId) {
    for (const token of unique([pageAuth.token, ...metaTokenCandidates()])) {
      try {
        const page = await graphGet(pageAuth.pageId, token, {
          fields: "instagram_business_account,connected_instagram_account",
        });
        const id = clean(page?.instagram_business_account?.id || page?.connected_instagram_account?.id, 200);
        if (id) add(id, token, "facebook-login", "page-fields");
      } catch {}
    }
  }

  for (const token of metaTokenCandidates()) {
    const accounts = await accountsForToken(token);
    for (const account of accounts) {
      const id = clean(account?.instagram_business_account?.id || account?.connected_instagram_account?.id, 200);
      if (id) add(id, clean(account?.access_token || token, 20000), "facebook-login", "linked-account");
    }
  }

  // Some older deployments stored an Instagram token under META_* names. Trying
  // the Instagram host as a final compatibility path is safe and keeps retries idempotent.
  add(instagramId, pageToken, "instagram-login", "instagram-host-compat");
  add(metaId, pageToken, "instagram-login", "meta-instagram-host-compat");

  return candidates;
}

async function publishInstagramWithAuth(post, auth) {
  const image = imageUrl(post);
  const get = auth.mode === "instagram-login" ? instagramLoginGet : graphGet;
  const postRequest = auth.mode === "instagram-login" ? instagramLoginPost : graphPost;
  const created = await postRequest(`${encodeURIComponent(auth.instagramUserId)}/media`, auth.token, {
    image_url: image,
    caption: postText(post),
  });
  const creationId = clean(created?.id, 300);
  if (!creationId) throw new Error("Instagram 未回傳媒體容器 ID");

  for (let attempt = 0; attempt < 12; attempt += 1) {
    if (attempt > 0) await new Promise((resolve) => setTimeout(resolve, 1500));
    try {
      const status = await get(creationId, auth.token, { fields: "status_code,status" });
      if (status?.status_code === "FINISHED") break;
      if (["ERROR", "EXPIRED"].includes(status?.status_code)) {
        throw new Error(status?.status || `Instagram 容器狀態：${status.status_code}`);
      }
      if (attempt === 11) throw new Error("Instagram 圖片處理尚未完成，請稍後重試");
    } catch (error) {
      if (attempt === 11 || /容器狀態|尚未完成/.test(error.message)) throw error;
    }
  }

  const published = await postRequest(`${encodeURIComponent(auth.instagramUserId)}/media_publish`, auth.token, {
    creation_id: creationId,
  });
  return {
    ...published,
    instagram_user_id: auth.instagramUserId,
    auth_source: auth.source,
    auth_mode: auth.mode,
  };
}

async function publishInstagram(post) {
  const image = imageUrl(post);
  if (!/^https:\/\//i.test(image)) throw new Error("Instagram 圖片必須是公開 HTTPS 網址");

  const candidates = await resolveInstagramAuthCandidates();
  if (!candidates.length) {
    throw new Error("找不到可嘗試的 Instagram 正式發布憑證組合");
  }

  const failures = [];
  for (const auth of candidates) {
    try {
      return await publishInstagramWithAuth(post, auth);
    } catch (error) {
      failures.push(`${auth.source}/${auth.mode}：${sanitizeMetaError(error?.message || error)}`);
    }
  }

  throw new Error(`Instagram 所有既有正式授權路徑均失敗：${failures.join("｜")}`.slice(0, 1750));
}

async function publishLine(post) {
  if (!lineClient) throw new Error("LINE OA 的 CHANNEL_ACCESS_TOKEN 尚未設定");
  const messages = [];
  const text = postText(post);
  const image = imageUrl(post);
  if (text) messages.push({ type: "text", text });
  if (image) {
    if (!/^https:\/\//i.test(image)) throw new Error("LINE OA 圖片必須是公開 HTTPS 網址");
    messages.push({ type: "image", originalContentUrl: image, previewImageUrl: image });
  }
  if (!messages.length) throw new Error("LINE OA 廣播缺少文案或圖片");
  return lineClient.broadcast({ messages: messages.slice(0, 5), notificationDisabled: false });
}

async function dispatch(key, post) {
  if (key === "facebook") return publishFacebook(post);
  if (key === "instagram") return publishInstagram(post);
  if (key === "line_oa") return publishLine(post);
  throw new Error("不支援的發布平台");
}

function readiness() {
  const tokens = metaTokenCandidates();
  return {
    Facebook: Boolean(tokens.length),
    Instagram: Boolean(tokens.length || (process.env.INSTAGRAM_USER_ID && process.env.INSTAGRAM_ACCESS_TOKEN)),
    "LINE OA 廣播": Boolean(LINE_TOKEN),
    "LINE VOOM": false,
  };
}

function remoteId(result, fallback) {
  return clean(result?.id || result?.post_id || result?.media_id || result?.messageId || result?.requestId || fallback, 500);
}

function mount(app) {
  if (!app || typeof app.get !== "function" || typeof app.post !== "function") {
    throw new Error("ERP publish bridge mount 需要有效 Express app");
  }
  if (app.locals.__xjwErpPublishBridgeMounted) return app;
  app.locals.__xjwErpPublishBridgeMounted = true;
  const json = express.json({ limit: "2mb" });

  app.get(`${ROUTE}/healthz`, (_req, res) => {
    res.set("Cache-Control", "no-store, max-age=0");
    res.json({
      ok: true,
      service: "仙加味 ERP 發布橋接",
      version: VERSION,
      authenticationConfigured: bridgeSecrets().length > 0,
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
      const message = clean(error?.message || error || "發布失敗", 1800);
      console.error(`ERP publish bridge ${key} failed`, message);
      return res.status(502).json({ ok: false, platform: key, error: message });
    }
  });

  return app;
}

module.exports = {
  VERSION,
  ROUTE,
  GRAPH_VERSION,
  mount,
  platformKey,
  postText,
  readiness,
  resolvePageAuth,
  resolveInstagramAuth,
};
