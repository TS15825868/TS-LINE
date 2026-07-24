"use strict";

const Module = require("module");
const batch = require("./social-final-approved-batch");

const VERSION = "2026-07-24-incomplete-retry-v1";
const RETRY_INTERVAL_MS = Math.max(10 * 60 * 1000, Number(process.env.SOCIAL_INCOMPLETE_RETRY_INTERVAL_MS || 30 * 60 * 1000));
const START_DELAY_MS = Math.max(3000, Number(process.env.SOCIAL_INCOMPLETE_RETRY_START_DELAY_MS || 8000));
const LAST_ATTEMPT = new Map();
let installed = false;
let timer = null;
let socialApi = null;
let running = false;
const nowIso = () => new Date().toISOString();

function isCanonical(post = {}) {
  return batch.CANONICAL_IDS.has(String(post.id || ""));
}

function platformDone(post = {}, key) {
  const result = post.result?.[key];
  return Boolean(
    result?.id
    || result?.post_id
    || result?.media_id
    || result?.deduplicated === true
    || post.platformStatus?.[key] === "成功"
    || post.platformStatus?.[key] === "已略過重複"
    || post[`${key}PublishedAt`]
  );
}

function incompletePlatforms(post = {}) {
  return ["instagram", "facebook"].filter((key) => post[`publish${key === "instagram" ? "Instagram" : "Facebook"}`] && !platformDone(post, key));
}

function eligible(post = {}, nowMs = Date.now()) {
  if (!isCanonical(post)) return false;
  if (!["partial", "failed"].includes(String(post.status || ""))) return false;
  if (!incompletePlatforms(post).length) return false;
  const scheduled = new Date(post.scheduledAt).getTime();
  if (Number.isFinite(scheduled) && scheduled > nowMs) return false;
  const previous = Number(LAST_ATTEMPT.get(post.id) || 0);
  return nowMs - previous >= RETRY_INTERVAL_MS;
}

function safePost(post = {}) {
  return {
    id: post.id || "",
    title: post.title || "",
    status: post.status || "",
    scheduledAt: post.scheduledAt || "",
    platformStatus: post.platformStatus || {},
    incompletePlatforms: incompletePlatforms(post),
    lastError: post.lastError || "",
    instagramPublishedAt: post.instagramPublishedAt || "",
    facebookPublishedAt: post.facebookPublishedAt || "",
    publishedAt: post.publishedAt || "",
    lastAutoRetryAt: LAST_ATTEMPT.get(post.id) ? new Date(LAST_ATTEMPT.get(post.id)).toISOString() : "",
  };
}

function statusPayload() {
  const posts = socialApi?.readStore ? socialApi.readStore().posts || [] : [];
  const canonical = posts.filter(isCanonical).map(safePost);
  return {
    ok: Boolean(socialApi?.readStore && socialApi?.execute),
    version: VERSION,
    retryIntervalMs: RETRY_INTERVAL_MS,
    running,
    canonicalCount: canonical.length,
    incompleteCount: canonical.filter((post) => ["partial", "failed"].includes(post.status) && post.incompletePlatforms.length).length,
    posts: canonical,
    checkedAt: nowIso(),
  };
}

async function retryIncomplete() {
  if (running || !socialApi?.readStore || !socialApi?.execute) return { skipped: true, reason: running ? "already-running" : "social-not-ready" };
  running = true;
  const attempted = [];
  try {
    const posts = socialApi.readStore().posts || [];
    for (const post of posts) {
      if (!eligible(post)) continue;
      LAST_ATTEMPT.set(post.id, Date.now());
      attempted.push({ id: post.id, title: post.title, platforms: incompletePlatforms(post) });
      try {
        await socialApi.execute(post.id);
      } catch (error) {
        console.error("Incomplete social platform retry failed", post.id, error.message);
      }
    }
    return { skipped: false, attempted };
  } finally {
    running = false;
  }
}

function mount(app) {
  if (!app || app.__xjwIncompleteSocialRetryMounted) return;
  Object.defineProperty(app, "__xjwIncompleteSocialRetryMounted", { value: true });
  app.get("/social/publish-status", (_req, res) => {
    const body = statusPayload();
    res.status(body.ok ? 200 : 503).json(body);
  });
}

function start() {
  if (timer) return timer;
  const first = setTimeout(() => retryIncomplete().catch((error) => console.error("Initial incomplete social retry failed", error.message)), START_DELAY_MS);
  first.unref?.();
  timer = setInterval(() => retryIncomplete().catch((error) => console.error("Scheduled incomplete social retry failed", error.message)), RETRY_INTERVAL_MS);
  timer.unref?.();
  return timer;
}

function install() {
  if (installed) return;
  installed = true;
  const previousLoad = Module._load;
  Module._load = function loadWithIncompleteRetry(request, parent, isMain) {
    const loaded = previousLoad.apply(this, arguments);
    if (request === "./server" && loaded?.app) mount(loaded.app);
    if (request === "./social-server" && loaded?.readStore && loaded?.execute) {
      socialApi = loaded;
      start();
    }
    return loaded;
  };
}

install();
module.exports = { VERSION, RETRY_INTERVAL_MS, START_DELAY_MS, isCanonical, platformDone, incompletePlatforms, eligible, safePost, statusPayload, retryIncomplete, mount, start, install };
