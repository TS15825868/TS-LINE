"use strict";

const crypto = require("crypto");
const express = require("express");
const fs = require("fs");
const path = require("path");
const { app, VERSION } = require("./server");

const SOCIAL_VERSION = "1.1.0";
const GRAPH_VERSION = String(process.env.META_GRAPH_VERSION || "v25.0").replace(/^\/?/, "");
const IG_USER_ID = String(process.env.INSTAGRAM_USER_ID || "").trim();
const IG_TOKEN = String(process.env.INSTAGRAM_ACCESS_TOKEN || "").trim();
const FB_PAGE_ID = String(process.env.META_PAGE_ID || "").trim();
const FB_TOKEN = String(process.env.META_PAGE_ACCESS_TOKEN || "").trim();
const ADMIN_PIN = String(process.env.SOCIAL_ADMIN_PIN || "").trim();
const STORE_PATH = process.env.SOCIAL_DATA_PATH || "/tmp/xianjiawei-social-posts.json";
const COOKIE = "xjw_social";
const form = express.urlencoded({ extended: false, limit: "2mb" });
let running = false;

const now = () => new Date().toISOString();
const esc = (s) => String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
const clean = (s, n = 5000) => String(s || "").replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, n);
const id = () => `${Date.now().toString(36)}-${crypto.randomBytes(4).toString("hex")}`;

function readStore() {
  try {
    if (!fs.existsSync(STORE_PATH)) return { posts: [] };
    const data = JSON.parse(fs.readFileSync(STORE_PATH, "utf8"));
    return { posts: Array.isArray(data.posts) ? data.posts : [] };
  } catch (error) {
    console.error("social store read failed", error.message);
    return { posts: [] };
  }
}

function writeStore(store) {
  fs.mkdirSync(path.dirname(STORE_PATH), { recursive: true });
  const temp = `${STORE_PATH}.${process.pid}.tmp`;
  fs.writeFileSync(temp, JSON.stringify({ posts: store.posts.slice(-500), updatedAt: now() }, null, 2), { mode: 0o600 });
  fs.renameSync(temp, STORE_PATH);
}

function updatePost(postId, change) {
  const store = readStore();
  const index = store.posts.findIndex((post) => post.id === postId);
  if (index < 0) return null;
  store.posts[index] = { ...store.posts[index], ...change, updatedAt: now() };
  writeStore(store);
  return store.posts[index];
}

function sessionValue() {
  return ADMIN_PIN ? crypto.createHmac("sha256", ADMIN_PIN).update("xjw-social-v1").digest("hex") : "";
}

function cookies(req) {
  return Object.fromEntries(String(req.headers.cookie || "").split(";").map((part) => part.trim().split("=")).filter((x) => x.length === 2));
}

function authed(req) {
  const value = cookies(req)[COOKIE] || "";
  const expected = sessionValue();
  if (!value || !expected || value.length !== expected.length) return false;
  return crypto.timingSafeEqual(Buffer.from(value), Buffer.from(expected));
}

function requireAdmin(req, res, next) {
  if (authed(req)) return next();
  return res.redirect("/social-review");
}

function validImageUrl(value) {
  if (!String(value || "").trim()) return "";
  try {
    const url = new URL(String(value));
    return url.protocol === "https:" ? url.toString() : "";
  } catch {
    return "";
  }
}

function css() {
  return `body{margin:0;background:#f7f4ed;color:#24211d;font-family:-apple-system,BlinkMacSystemFont,"PingFang TC",sans-serif}main{max-width:900px;margin:auto;padding:18px}section,article{background:#fff;border:1px solid #ded7ca;border-radius:18px;padding:18px;margin-bottom:16px}h1,h2{color:#0b1f3b}input,textarea,button{font:inherit}input,textarea{width:100%;box-sizing:border-box;padding:11px;border:1px solid #ccc;border-radius:10px;margin:5px 0 12px}textarea{min-height:110px}button{border:0;border-radius:10px;padding:11px 14px;background:#0b1f3b;color:#fff;font-weight:700}.green{background:#315c45}.red{background:#982b2b}.gray{background:#6b655d}.row{display:grid;grid-template-columns:1fr 1fr;gap:12px}.post{display:grid;grid-template-columns:180px 1fr;gap:16px}.post img{width:100%;aspect-ratio:1/1;object-fit:cover;border-radius:12px}.meta{color:#6b655d;font-size:14px}.cap{white-space:pre-wrap;background:#faf8f4;padding:10px;border-radius:10px}.actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}.notice{background:#fff3c9;padding:10px;border-radius:10px}@media(max-width:650px){.row,.post{grid-template-columns:1fr}}`;
}

function loginPage(message = "") {
  return `<!doctype html><html lang="zh-Hant"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css()}</style><title>仙加味社群審核台</title></head><body><main><section><h1>仙加味社群審核台</h1>${message ? `<p class="notice">${esc(message)}</p>` : ""}<form method="post" action="/social-login"><label>管理密碼<input type="password" name="pin" required></label><button>登入</button></form></section></main></body></html>`;
}

function postCard(post) {
  const actions = [];
  if (["draft", "rejected"].includes(post.status)) {
    actions.push(`<form method="post" action="/social-post/${post.id}/approve"><button class="green">通過並排程</button></form>`);
    actions.push(`<form method="post" action="/social-post/${post.id}/reject"><button class="red">退回修改</button></form>`);
  }
  if (["approved", "failed"].includes(post.status)) {
    actions.push(`<form method="post" action="/social-post/${post.id}/publish"><button class="green">立即發布</button></form>`);
    actions.push(`<form method="post" action="/social-post/${post.id}/cancel"><button class="red">取消</button></form>`);
  }
  return `<article class="post"><div>${post.imageUrl ? `<img src="${esc(post.imageUrl)}" alt="">` : ""}</div><div><h2>${esc(post.title)}</h2><div class="meta">狀態：${esc(post.status)}｜預定：${esc(new Date(post.scheduledAt).toLocaleString("zh-TW", { hour12: false }))}｜平台：${post.publishInstagram ? "IG " : ""}${post.publishFacebook ? "FB" : ""}</div>${post.lastError ? `<p class="notice">${esc(post.lastError)}</p>` : ""}<details><summary>Instagram 文案</summary><div class="cap">${esc(post.instagramCaption)}</div></details><details><summary>Facebook 文案</summary><div class="cap">${esc(post.facebookCaption)}</div></details><div class="actions">${actions.join("")}</div></div></article>`;
}

function reviewPage() {
  const posts = readStore().posts.slice().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  return `<!doctype html><html lang="zh-Hant"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css()}</style><title>仙加味社群審核台</title></head><body><main><section><h1>仙加味社群審核台</h1><p class="notice">Instagram：${IG_USER_ID && IG_TOKEN ? "已設定" : "未設定"}／Facebook：${FB_PAGE_ID && FB_TOKEN ? "已設定" : "未設定"}／資料儲存：${STORE_PATH.startsWith("/tmp/") ? "暫存（重新部署可能清除）" : "持久化"}</p><form method="post" action="/social-logout"><button class="gray">登出</button></form></section><section><h2>新增待審核草稿</h2><form method="post" action="/social-post"><div class="row"><label>標題<input name="title" maxlength="120" required></label><label>預定時間<input name="scheduledAt" type="datetime-local" required></label></div><label>公開圖片網址（Facebook 純文字貼文可留空；Instagram 必填）<input name="imageUrl" type="url" placeholder="https://...jpg"></label><label>Instagram 文案<textarea name="instagramCaption" maxlength="2200"></textarea></label><label>Facebook 文案<textarea name="facebookCaption" maxlength="5000"></textarea></label><label><input style="width:auto" type="checkbox" name="publishInstagram" checked> 發布 Instagram</label><label><input style="width:auto" type="checkbox" name="publishFacebook" checked> 發布 Facebook</label><br><button>建立草稿</button></form></section>${posts.map(postCard).join("")}</main></body></html>`;
}

async function request(url, options = {}) {
  const response = await fetch(url, options);
  const text = await response.text();
  let data;
  try { data = JSON.parse(text); } catch { data = { raw: text }; }
  if (!response.ok || data.error) throw new Error(data.error?.message || data.raw || `HTTP ${response.status}`);
  return data;
}

async function publishInstagram(post) {
  if (!IG_USER_ID || !IG_TOKEN) throw new Error("Instagram 環境變數尚未設定");
  if (!post.imageUrl) throw new Error("Instagram 發布必須提供公開 HTTPS 圖片網址");
  if (!post.instagramCaption) throw new Error("Instagram 文案不可為空");
  const created = await request(`https://graph.instagram.com/${GRAPH_VERSION}/${encodeURIComponent(IG_USER_ID)}/media`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ image_url: post.imageUrl, caption: post.instagramCaption, access_token: IG_TOKEN }),
  });
  for (let i = 0; i < 12; i += 1) {
    const statusUrl = new URL(`https://graph.instagram.com/${GRAPH_VERSION}/${created.id}`);
    statusUrl.searchParams.set("fields", "status_code,status");
    statusUrl.searchParams.set("access_token", IG_TOKEN);
    const status = await request(statusUrl);
    if (status.status_code === "FINISHED") break;
    if (["ERROR", "EXPIRED"].includes(status.status_code)) throw new Error(status.status || status.status_code);
    if (i === 11) throw new Error("Instagram 圖片處理逾時");
    await new Promise((resolve) => setTimeout(resolve, 5000));
  }
  return request(`https://graph.instagram.com/${GRAPH_VERSION}/${encodeURIComponent(IG_USER_ID)}/media_publish`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ creation_id: created.id, access_token: IG_TOKEN }),
  });
}

async function publishFacebook(post) {
  if (!FB_PAGE_ID || !FB_TOKEN) throw new Error("Facebook 粉絲專頁環境變數尚未設定");
  const message = post.facebookCaption || post.instagramCaption;
  if (!message) throw new Error("Facebook 文案不可為空");
  const endpoint = post.imageUrl ? "photos" : "feed";
  const body = post.imageUrl
    ? { url: post.imageUrl, caption: message, published: "true", access_token: FB_TOKEN }
    : { message, published: "true", access_token: FB_TOKEN };
  return request(`https://graph.facebook.com/${GRAPH_VERSION}/${encodeURIComponent(FB_PAGE_ID)}/${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(body),
  });
}

async function execute(postId) {
  let post = updatePost(postId, { status: "publishing", lastError: "" });
  if (!post) return null;
  const result = { ...(post.result || {}) };
  const errors = [];
  if (post.publishInstagram && !result.instagram) {
    try { result.instagram = await publishInstagram(post); } catch (error) { errors.push(`Instagram：${error.message}`); }
  }
  if (post.publishFacebook && !result.facebook) {
    try { result.facebook = await publishFacebook(post); } catch (error) { errors.push(`Facebook：${error.message}`); }
  }
  post = updatePost(postId, { result, status: errors.length ? "failed" : "published", lastError: errors.join("｜"), publishedAt: errors.length ? "" : now() });
  return post;
}

async function scheduler() {
  if (running) return;
  running = true;
  try {
    const due = readStore().posts.filter((post) => post.status === "approved" && new Date(post.scheduledAt).getTime() <= Date.now());
    for (const post of due) await execute(post.id);
  } catch (error) {
    console.error("social scheduler failed", error.message);
  } finally {
    running = false;
  }
}

function healthPayload() {
  return {
    ok: true,
    service: "仙加味 LINE OA 社群發布系統",
    socialVersion: SOCIAL_VERSION,
    lineVersion: VERSION,
    instagramConfigured: Boolean(IG_USER_ID && IG_TOKEN),
    facebookConfigured: Boolean(FB_PAGE_ID && FB_TOKEN),
    adminPinConfigured: Boolean(ADMIN_PIN),
    persistentStoreConfigured: !STORE_PATH.startsWith("/tmp/"),
    graphVersion: GRAPH_VERSION,
    schedulerRunning: running,
    postCount: readStore().posts.length,
    checkedAt: now(),
  };
}

app.get("/social-review", (req, res) => {
  res.set("Cache-Control", "no-store");
  if (!ADMIN_PIN) return res.status(503).send(loginPage("請先在 Render 設定 SOCIAL_ADMIN_PIN"));
  return res.send(authed(req) ? reviewPage() : loginPage());
});

app.post("/social-login", form, (req, res) => {
  if (!ADMIN_PIN || String(req.body.pin || "") !== ADMIN_PIN) return res.status(401).send(loginPage("密碼不正確"));
  res.cookie(COOKIE, sessionValue(), { httpOnly: true, secure: true, sameSite: "lax", maxAge: 12 * 60 * 60 * 1000, path: "/" });
  res.redirect("/social-review");
});

app.post("/social-logout", form, (_req, res) => {
  res.clearCookie(COOKIE, { path: "/" });
  res.redirect("/social-review");
});

app.post("/social-post", requireAdmin, form, (req, res) => {
  const imageUrl = validImageUrl(req.body.imageUrl);
  const scheduledAt = new Date(req.body.scheduledAt);
  const publishInstagram = req.body.publishInstagram === "on";
  const publishFacebook = req.body.publishFacebook === "on";
  const instagramCaption = clean(req.body.instagramCaption, 2200);
  const facebookCaption = clean(req.body.facebookCaption, 5000);
  if (Number.isNaN(scheduledAt.getTime())) return res.status(400).send("時間格式不正確");
  if (!publishInstagram && !publishFacebook) return res.status(400).send("至少選擇一個發布平台");
  if (publishInstagram && (!imageUrl || !instagramCaption)) return res.status(400).send("Instagram 必須提供圖片網址與文案");
  if (publishFacebook && !(facebookCaption || instagramCaption)) return res.status(400).send("Facebook 文案不可為空");
  const store = readStore();
  store.posts.push({ id: id(), title: clean(req.body.title, 120), imageUrl, instagramCaption, facebookCaption, scheduledAt: scheduledAt.toISOString(), publishInstagram, publishFacebook, status: "draft", result: {}, lastError: "", createdAt: now(), updatedAt: now() });
  writeStore(store);
  res.redirect("/social-review");
});

for (const [action, status] of [["approve", "approved"], ["reject", "rejected"], ["cancel", "cancelled"]]) {
  app.post(`/social-post/:id/${action}`, requireAdmin, form, (req, res) => {
    updatePost(req.params.id, { status, lastError: status === "rejected" ? "已退回修改" : "" });
    res.redirect("/social-review");
  });
}

app.post("/social-post/:id/publish", requireAdmin, form, async (req, res) => {
  await execute(req.params.id);
  res.redirect("/social-review");
});

app.get("/social/healthz", (_req, res) => res.json(healthPayload()));
app.get("/health", (_req, res) => res.json(healthPayload()));
app.get("/debug", (_req, res) => {
  const data = healthPayload();
  res.json({ ...data, environment: { metaPageIdPresent: Boolean(FB_PAGE_ID), metaPageTokenPresent: Boolean(FB_TOKEN), instagramUserIdPresent: Boolean(IG_USER_ID), instagramTokenPresent: Boolean(IG_TOKEN), socialDataPath: STORE_PATH } });
});

const timer = setInterval(scheduler, 30000);
timer.unref?.();
scheduler();

const port = process.env.PORT || 3000;
if (require.main === module) app.listen(port, () => console.log(`仙加味 LINE OA ${VERSION} + social ${SOCIAL_VERSION} running on ${port}`));

module.exports = { app, publishInstagram, publishFacebook, execute, scheduler, healthPayload };
