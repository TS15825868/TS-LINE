"use strict";

const crypto = require("crypto");
const express = require("express");
const { app } = require("./server");

const VERSION = "1.0.0";
const ADMIN_PIN = String(process.env.SOCIAL_ADMIN_PIN || "").trim();
const COOKIE = "xjw_social";
const form = express.urlencoded({ extended: false, limit: "2mb" });
const BLOCKED_TERMS = String(
  process.env.SOCIAL_BLOCKED_TERMS ||
    "改善,治療,關節,卡卡,疲勞,精神不濟,補氣,生津,膠原蛋白,鈣質"
)
  .split(",")
  .map((item) => item.trim())
  .filter(Boolean);
const OFFICIAL_HOSTS = new Set(
  String(process.env.SOCIAL_APPROVED_IMAGE_HOSTS || "raw.githubusercontent.com,ts15825868.github.io")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean)
);
const ALLOW_EXTERNAL = String(process.env.SOCIAL_ALLOW_EXTERNAL_IMAGES || "").toLowerCase() === "true";

const now = () => new Date().toISOString();
const clean = (value, max = 5000) => String(value || "").replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, max);
const esc = (value) => String(value || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
const eventId = () => `${Date.now().toString(36)}-${crypto.randomBytes(3).toString("hex")}`;

function social() {
  return require("./social-server");
}

function sessionValue() {
  return ADMIN_PIN ? crypto.createHmac("sha256", ADMIN_PIN).update("xjw-social-v1").digest("hex") : "";
}

function cookies(req) {
  return Object.fromEntries(
    String(req.headers.cookie || "")
      .split(";")
      .map((part) => part.trim().split("="))
      .filter((part) => part.length === 2)
  );
}

function authed(req) {
  const actual = cookies(req)[COOKIE] || "";
  const expected = sessionValue();
  if (!actual || !expected || actual.length !== expected.length) return false;
  return crypto.timingSafeEqual(Buffer.from(actual), Buffer.from(expected));
}

function requireAdmin(req, res, next) {
  if (authed(req)) return next();
  return res.redirect("/social-review");
}

function officialImage(imageUrl) {
  if (!imageUrl) return { ok: false, message: "Instagram 貼文必須使用正式圖片。" };
  try {
    const url = new URL(imageUrl);
    if (url.protocol !== "https:") return { ok: false, message: "圖片必須是 HTTPS 網址。" };
    const host = url.hostname.toLowerCase();
    const officialRaw = host === "raw.githubusercontent.com" && /^\/TS15825868\/(TS-LINE|xianjiawei)\//i.test(url.pathname);
    if (officialRaw || (host !== "raw.githubusercontent.com" && OFFICIAL_HOSTS.has(host)) || ALLOW_EXTERNAL) {
      return { ok: true, message: "" };
    }
    return { ok: false, message: "圖片不是仙加味 TS-LINE／xianjiawei 正式素材。" };
  } catch {
    return { ok: false, message: "圖片網址格式不正確。" };
  }
}

function validation(post) {
  const errors = [];
  if (!post) return ["找不到貼文。"];
  if (!post.publishInstagram && !post.publishFacebook) errors.push("至少選擇一個發布平台。");
  if (post.publishInstagram) {
    const image = officialImage(post.imageUrl);
    if (!image.ok) errors.push(image.message);
    if (!post.instagramCaption) errors.push("Instagram 文案不可為空。");
  }
  if (post.publishFacebook && !(post.facebookCaption || post.instagramCaption)) errors.push("Facebook 文案不可為空。");
  if (Number.isNaN(new Date(post.scheduledAt).getTime())) errors.push("預定時間格式不正確。");
  const text = `${post.title || ""}\n${post.instagramCaption || ""}\n${post.facebookCaption || ""}`;
  const found = BLOCKED_TERMS.filter((term) => text.includes(term));
  if (found.length) errors.push(`文案含需修正字詞：${found.join("、")}`);
  return errors;
}

function appendHistory(post, action, detail = "") {
  const history = Array.isArray(post.history) ? post.history.slice(-49) : [];
  history.push({ id: eventId(), action, detail: clean(detail, 500), createdAt: now() });
  return history;
}

function updatePost(postId, change, action, detail = "") {
  const api = social();
  const store = api.readStore();
  const index = store.posts.findIndex((post) => post.id === postId);
  if (index < 0) return null;
  const previous = store.posts[index];
  store.posts[index] = {
    ...previous,
    ...change,
    history: appendHistory(previous, action, detail),
    updatedAt: now(),
  };
  api.writeStore(store);
  return store.posts[index];
}

function migrateLegacyApprovals() {
  const api = social();
  const store = api.readStore();
  let changed = 0;
  store.posts = store.posts.map((post) => {
    if (post.status === "approved" && !post.assetLocked) {
      changed += 1;
      return {
        ...post,
        status: "paused",
        lastError: "舊版已通過貼文已安全暫停，請重新檢查後恢復排程。",
        history: appendHistory(post, "安全暫停", "等待重新確認正式素材"),
        updatedAt: now(),
      };
    }
    return post;
  });
  if (changed) api.writeStore(store);
  return changed;
}

function statusLabel(status) {
  return {
    draft: "待審核",
    rejected: "退回修改",
    approved: "已通過／等待發布",
    paused: "已暫停",
    publishing: "發布中",
    published: "已發布",
    failed: "發布失敗",
    cancelled: "已取消",
  }[status] || status || "未知";
}

function formatTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "未設定";
  return date.toLocaleString("zh-TW", { hour12: false, timeZone: "Asia/Taipei" });
}

function localTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date).replace(" ", "T");
}

function css() {
  return `:root{--navy:#0b1f3b;--cream:#f7f4ed;--red:#7b1e1e;--green:#315c45;--gold:#b88a2b;--line:#ded7ca;--muted:#6b655d}*{box-sizing:border-box}body{margin:0;background:var(--cream);color:#24211d;font-family:-apple-system,BlinkMacSystemFont,"PingFang TC",sans-serif}main{max-width:1040px;margin:auto;padding:12px}section,article{background:#fff;border:1px solid var(--line);border-radius:16px;padding:15px;margin-bottom:13px}h1,h2{color:var(--navy);margin-top:0}input,textarea,button{font:inherit}input,textarea{width:100%;padding:11px;border:1px solid #cfc7ba;border-radius:10px;margin:5px 0 12px}textarea{min-height:120px}button,.btn{border:0;border-radius:10px;padding:11px 14px;background:var(--navy);color:#fff;font-weight:700;text-decoration:none;display:inline-block}.green{background:var(--green)}.red{background:#982b2b}.gray{background:var(--muted)}.gold{background:var(--gold)}.outline{background:#fff;color:var(--navy);border:1px solid var(--navy)}.post{display:grid;grid-template-columns:minmax(180px,250px) 1fr;gap:16px}.post img{width:100%;aspect-ratio:1/1;object-fit:contain;background:#faf8f4;border:1px solid var(--line);border-radius:12px}.meta{color:var(--muted);font-size:14px;line-height:1.6}.cap{white-space:pre-wrap;background:#faf8f4;padding:10px;border-radius:10px;max-height:250px;overflow:auto}.actions,.toolbar,.tabs{display:flex;gap:8px;flex-wrap:wrap}.toolbar{align-items:center;justify-content:space-between}.actions{margin-top:12px}.actions form{margin:0}.notice{background:#fff3c9;padding:10px;border-radius:10px}.error{background:#fde8e8;color:#7a1616;padding:10px;border-radius:10px}.tabs a{padding:8px 11px;border:1px solid var(--line);border-radius:999px;color:var(--navy);text-decoration:none}.tabs a.active{background:var(--navy);color:#fff}.counts{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}.count{background:#faf8f4;border:1px solid var(--line);border-radius:12px;padding:10px;text-align:center}.count strong{display:block;font-size:22px;color:var(--red)}.row{display:grid;grid-template-columns:1fr 1fr;gap:12px}.check{display:flex;align-items:center;gap:8px;margin-bottom:9px}.check input{width:auto;margin:0}.locked{color:var(--green);font-weight:700}.empty{text-align:center;color:var(--muted);padding:25px}@media(max-width:700px){.post,.row,.counts{grid-template-columns:1fr}.actions form,.actions button,.actions .btn{width:100%}}`;
}

function page(title, body) {
  return `<!doctype html><html lang="zh-Hant"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><style>${css()}</style><title>${esc(title)}</title></head><body><main>${body}</main></body></html>`;
}

function loginPage(message = "") {
  return page("仙加味社群審核中心", `<section><h1>仙加味社群審核中心</h1><p>你只需要檢查、修改與按通過；未通過不會發布。</p>${message ? `<p class="notice">${esc(message)}</p>` : ""}<form method="post" action="/social-login"><label>管理密碼<input type="password" name="pin" required></label><button>登入</button></form></section>`);
}

function card(post) {
  const errors = validation(post);
  const actions = [];
  if (["draft", "rejected"].includes(post.status)) {
    actions.push(`<a class="btn outline" href="/social-post/${encodeURIComponent(post.id)}/edit">檢查／修改</a>`);
    actions.push(`<form method="post" action="/social-post/${encodeURIComponent(post.id)}/approve"><button class="green" ${errors.length ? "disabled" : ""}>通過並排程</button></form>`);
    actions.push(`<form method="post" action="/social-post/${encodeURIComponent(post.id)}/reject"><button class="red">退回修改</button></form>`);
  }
  if (["approved", "failed"].includes(post.status)) {
    actions.push(`<form method="post" action="/social-post/${encodeURIComponent(post.id)}/publish"><button class="green">立即發布</button></form>`);
    actions.push(`<form method="post" action="/social-post/${encodeURIComponent(post.id)}/pause"><button class="gold">暫停</button></form>`);
    actions.push(`<a class="btn outline" href="/social-post/${encodeURIComponent(post.id)}/edit">修改</a>`);
  }
  if (post.status === "paused") {
    actions.push(`<form method="post" action="/social-post/${encodeURIComponent(post.id)}/resume"><button class="green">重新檢查並恢復</button></form>`);
    actions.push(`<a class="btn outline" href="/social-post/${encodeURIComponent(post.id)}/edit">修改</a>`);
  }
  if (!["published", "publishing", "cancelled"].includes(post.status)) {
    actions.push(`<form method="post" action="/social-post/${encodeURIComponent(post.id)}/cancel"><button class="gray">取消</button></form>`);
  }
  const history = (post.history || []).slice(-6).reverse();
  return `<article class="post"><div>${post.imageUrl ? `<img src="${esc(post.imageUrl)}" alt="${esc(post.title)}">` : `<div class="empty">沒有圖片</div>`}</div><div><h2>${esc(post.title)}</h2><div class="meta">狀態：<strong>${esc(statusLabel(post.status))}</strong><br>預定：${esc(formatTime(post.scheduledAt))}<br>平台：${post.publishInstagram ? "Instagram " : ""}${post.publishFacebook ? "Facebook" : ""}<br>${post.assetLocked ? `<span class="locked">正式素材已鎖定</span>` : "素材尚未鎖定"}</div>${post.lastError ? `<p class="error">${esc(post.lastError)}</p>` : ""}${errors.length && ["draft", "rejected", "paused"].includes(post.status) ? `<p class="error">通過前需修正：<br>${errors.map(esc).join("<br>")}</p>` : ""}<details><summary>Instagram 文案</summary><div class="cap">${esc(post.instagramCaption)}</div></details><details><summary>Facebook 文案</summary><div class="cap">${esc(post.facebookCaption)}</div></details>${history.length ? `<details><summary>操作紀錄</summary><ol>${history.map((item) => `<li>${esc(formatTime(item.createdAt))}｜${esc(item.action)}${item.detail ? `｜${esc(item.detail)}` : ""}</li>`).join("")}</ol></details>` : ""}<div class="actions">${actions.join("")}</div></div></article>`;
}

function reviewPage(req) {
  migrateLegacyApprovals();
  const all = social().readStore().posts.slice().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  const filter = clean(req.query.status || "active", 20);
  const posts = all.filter((post) => {
    if (filter === "all") return true;
    if (filter === "review") return ["draft", "rejected"].includes(post.status);
    if (filter === "scheduled") return ["approved", "paused"].includes(post.status);
    if (filter === "failed") return post.status === "failed";
    if (filter === "published") return post.status === "published";
    return !["published", "cancelled"].includes(post.status);
  });
  const count = (statuses) => all.filter((post) => statuses.includes(post.status)).length;
  const tabs = [["active", "處理中"], ["review", "待審核"], ["scheduled", "已排程"], ["failed", "失敗"], ["published", "已發布"], ["all", "全部"]];
  return page("仙加味社群審核中心", `<section><div class="toolbar"><div><h1>仙加味社群審核中心</h1><p class="meta">圖片以完整比例顯示，不裁切、不重畫；只有通過並鎖定的正式素材才排程。</p></div><form method="post" action="/social-logout"><button class="gray">登出</button></form></div><div class="counts"><div class="count"><strong>${count(["draft", "rejected"])}</strong>待審核</div><div class="count"><strong>${count(["approved", "paused"])}</strong>排程／暫停</div><div class="count"><strong>${count(["published"])}</strong>已發布</div><div class="count"><strong>${count(["failed"])}</strong>失敗</div></div></section><section><div class="toolbar"><h2>貼文清單</h2><a class="btn" href="/social-post/new">新增草稿</a></div><nav class="tabs">${tabs.map(([key, label]) => `<a class="${filter === key ? "active" : ""}" href="/social-review?status=${key}">${label}</a>`).join("")}</nav></section>${posts.length ? posts.map(card).join("") : `<section class="empty">目前沒有符合條件的貼文。</section>`}`);
}

function editPage(post, message = "") {
  const isNew = !post || !post.id;
  const value = post || { title: "", scheduledAt: new Date(Date.now() + 86400000).toISOString(), imageUrl: "", instagramCaption: "", facebookCaption: "", publishInstagram: true, publishFacebook: true };
  const action = isNew ? "/social-post" : `/social-post/${encodeURIComponent(value.id)}/edit`;
  return page(isNew ? "新增貼文" : "修改貼文", `<section><div class="toolbar"><h1>${isNew ? "新增待審草稿" : "檢查／修改貼文"}</h1><a class="btn outline" href="/social-review">返回</a></div>${message ? `<p class="error">${esc(message)}</p>` : ""}<p class="notice">修改後會自動解除原核准狀態，必須重新按「通過並排程」。</p><form method="post" action="${action}"><div class="row"><label>標題<input name="title" required maxlength="120" value="${esc(value.title)}"></label><label>預定時間<input name="scheduledAt" type="datetime-local" required value="${esc(localTime(value.scheduledAt))}"></label></div><label>正式圖片網址<input name="imageUrl" type="url" value="${esc(value.imageUrl)}"></label><label>Instagram 文案<textarea name="instagramCaption" maxlength="2200">${esc(value.instagramCaption)}</textarea></label><label>Facebook 文案<textarea name="facebookCaption" maxlength="5000">${esc(value.facebookCaption)}</textarea></label><label class="check"><input type="checkbox" name="publishInstagram" ${value.publishInstagram ? "checked" : ""}> 發布 Instagram</label><label class="check"><input type="checkbox" name="publishFacebook" ${value.publishFacebook ? "checked" : ""}> 發布 Facebook</label><button>${isNew ? "建立待審草稿" : "儲存並重新送審"}</button></form></section>`);
}

function parseForm(body) {
  const scheduledAt = new Date(body.scheduledAt);
  const value = {
    title: clean(body.title, 120),
    imageUrl: clean(body.imageUrl, 1000),
    instagramCaption: clean(body.instagramCaption, 2200),
    facebookCaption: clean(body.facebookCaption, 5000),
    publishInstagram: body.publishInstagram === "on",
    publishFacebook: body.publishFacebook === "on",
    scheduledAt: Number.isNaN(scheduledAt.getTime()) ? "" : scheduledAt.toISOString(),
  };
  const errors = validation(value).filter((item) => !item.startsWith("文案含需修正字詞"));
  if (!value.title) errors.push("標題不可為空。");
  return { value, errors };
}

app.get("/social-review", (req, res) => {
  res.set("Cache-Control", "no-store");
  if (!ADMIN_PIN) return res.status(503).send(loginPage("請先在 Render 設定 SOCIAL_ADMIN_PIN。"));
  return res.send(authed(req) ? reviewPage(req) : loginPage());
});

app.post("/social-login", form, (req, res) => {
  if (!ADMIN_PIN || String(req.body.pin || "") !== ADMIN_PIN) return res.status(401).send(loginPage("密碼不正確。"));
  res.cookie(COOKIE, sessionValue(), { httpOnly: true, secure: true, sameSite: "lax", maxAge: 12 * 60 * 60 * 1000, path: "/" });
  res.redirect("/social-review");
});

app.post("/social-logout", form, (_req, res) => {
  res.clearCookie(COOKIE, { path: "/" });
  res.redirect("/social-review");
});

app.get("/social-post/new", requireAdmin, (_req, res) => res.send(editPage(null)));
app.get("/social-post/:id/edit", requireAdmin, (req, res) => {
  const post = social().readStore().posts.find((item) => item.id === req.params.id);
  if (!post) return res.status(404).send("找不到貼文");
  if (post.status === "published") return res.status(409).send("已發布貼文不可修改，請另建新草稿。");
  res.send(editPage(post));
});

app.post("/social-post", requireAdmin, form, (req, res) => {
  const parsed = parseForm(req.body);
  if (parsed.errors.length) return res.status(400).send(editPage({ ...parsed.value, id: "" }, parsed.errors.join("；")));
  const api = social();
  const store = api.readStore();
  store.posts.push({ id: eventId(), ...parsed.value, status: "draft", assetLocked: false, result: {}, lastError: "", history: [{ id: eventId(), action: "建立草稿", detail: "等待審核", createdAt: now() }], createdAt: now(), updatedAt: now() });
  api.writeStore(store);
  res.redirect("/social-review?status=review");
});

app.post("/social-post/:id/edit", requireAdmin, form, (req, res) => {
  const parsed = parseForm(req.body);
  if (parsed.errors.length) {
    const previous = social().readStore().posts.find((item) => item.id === req.params.id) || {};
    return res.status(400).send(editPage({ ...previous, ...parsed.value }, parsed.errors.join("；")));
  }
  updatePost(req.params.id, { ...parsed.value, status: "draft", assetLocked: false, approvedAt: "", result: {}, lastError: "" }, "修改貼文", "解除原核准並重新送審");
  res.redirect("/social-review?status=review");
});

app.post("/social-post/:id/approve", requireAdmin, form, (req, res) => {
  const post = social().readStore().posts.find((item) => item.id === req.params.id);
  const errors = validation(post);
  if (errors.length) {
    updatePost(req.params.id, { status: "draft", assetLocked: false, lastError: errors.join("｜") }, "審核未通過", errors.join("｜"));
    return res.redirect("/social-review?status=review");
  }
  updatePost(req.params.id, { status: "approved", assetLocked: true, approvedAt: now(), lastError: "" }, "審核通過", "正式素材已鎖定");
  res.redirect("/social-review?status=scheduled");
});

app.post("/social-post/:id/reject", requireAdmin, form, (req, res) => {
  updatePost(req.params.id, { status: "rejected", assetLocked: false, approvedAt: "", lastError: "已退回修改" }, "退回修改", "");
  res.redirect("/social-review?status=review");
});
app.post("/social-post/:id/pause", requireAdmin, form, (req, res) => {
  updatePost(req.params.id, { status: "paused" }, "暫停排程", "");
  res.redirect("/social-review?status=scheduled");
});
app.post("/social-post/:id/resume", requireAdmin, form, (req, res) => {
  const post = social().readStore().posts.find((item) => item.id === req.params.id);
  const errors = validation(post);
  if (errors.length) {
    updatePost(req.params.id, { status: "draft", assetLocked: false, lastError: errors.join("｜") }, "恢復失敗", errors.join("｜"));
    return res.redirect("/social-review?status=review");
  }
  updatePost(req.params.id, { status: "approved", assetLocked: true, approvedAt: now(), lastError: "" }, "恢復排程", "重新確認正式素材");
  res.redirect("/social-review?status=scheduled");
});
app.post("/social-post/:id/cancel", requireAdmin, form, (req, res) => {
  updatePost(req.params.id, { status: "cancelled", assetLocked: false }, "取消貼文", "");
  res.redirect("/social-review");
});
app.post("/social-post/:id/publish", requireAdmin, form, async (req, res) => {
  const post = social().readStore().posts.find((item) => item.id === req.params.id);
  const errors = validation(post);
  if (errors.length || !post?.assetLocked) {
    updatePost(req.params.id, { status: "draft", assetLocked: false, lastError: errors.join("｜") || "素材尚未鎖定" }, "發布阻擋", errors.join("｜") || "素材尚未鎖定");
    return res.redirect("/social-review?status=review");
  }
  await social().execute(req.params.id);
  res.redirect("/social-review");
});

app.get("/social-review/version", (_req, res) => res.json({ ok: true, version: VERSION }));

module.exports = { VERSION, validation, officialImage, migrateLegacyApprovals };
