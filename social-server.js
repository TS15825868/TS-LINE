"use strict";

const fs = require("fs");
const path = require("path");
const { app, VERSION } = require("./server");
const publishGuard = require("./social-publish-guard");

const SOCIAL_VERSION = "1.2.1";
const GRAPH_VERSION = String(process.env.META_GRAPH_VERSION || "v25.0").replace(/^\/?/, "");
const IG_USER_ID = String(process.env.INSTAGRAM_USER_ID || "").trim();
const IG_TOKEN = String(process.env.INSTAGRAM_ACCESS_TOKEN || "").trim();
const FB_PAGE_ID = String(process.env.META_PAGE_ID || "").trim();
const FB_TOKEN = String(process.env.META_PAGE_ACCESS_TOKEN || "").trim();
const ADMIN_PIN = String(process.env.SOCIAL_ADMIN_PIN || "").trim();
const STORE_PATH = process.env.SOCIAL_DATA_PATH || "/tmp/xianjiawei-social-posts.json";
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
let running = false;

const now = () => new Date().toISOString();

function readStore() {
  try {
    if (!fs.existsSync(STORE_PATH)) return { posts: [] };
    const data = JSON.parse(fs.readFileSync(STORE_PATH, "utf8"));
    return { ...data, posts: Array.isArray(data.posts) ? data.posts : [] };
  } catch (error) {
    console.error("social store read failed", error.message);
    return { posts: [] };
  }
}

function writeStore(store) {
  fs.mkdirSync(path.dirname(STORE_PATH), { recursive: true });
  const temp = `${STORE_PATH}.${process.pid}.tmp`;
  fs.writeFileSync(
    temp,
    JSON.stringify({ ...store, posts: (store.posts || []).slice(-500), updatedAt: now() }, null, 2),
    { mode: 0o600 }
  );
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

function officialImage(imageUrl) {
  if (!imageUrl) return false;
  try {
    const url = new URL(String(imageUrl));
    if (url.protocol !== "https:") return false;
    const host = url.hostname.toLowerCase();
    const officialRaw =
      host === "raw.githubusercontent.com" &&
      /^\/TS15825868\/(TS-LINE|xianjiawei)\//i.test(url.pathname);
    return officialRaw || (host !== "raw.githubusercontent.com" && OFFICIAL_HOSTS.has(host)) || ALLOW_EXTERNAL;
  } catch {
    return false;
  }
}

function taipeiParts(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const parts = Object.fromEntries(
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
  return parts;
}

function validOfficialSchedule(value) {
  const parts = taipeiParts(value);
  if (!parts) return false;
  return ["Wed", "Fri"].includes(parts.weekday) && parts.hour === "20" && parts.minute === "00";
}

function validatePublishable(post) {
  const errors = [];
  if (!post) return ["找不到貼文"];
  if (post.assetLocked !== true) errors.push("正式素材尚未鎖定");
  if (!post.publishInstagram && !post.publishFacebook) errors.push("至少選擇一個發布平台");
  if (!validOfficialSchedule(post.scheduledAt)) errors.push("排程必須是週三或週五 20:00");
  if (post.publishInstagram) {
    if (!officialImage(post.imageUrl)) errors.push("Instagram 必須使用仙加味正式 HTTPS 圖片");
    if (!String(post.instagramCaption || "").trim()) errors.push("Instagram 文案不可為空");
  }
  if (post.publishFacebook && !String(post.facebookCaption || post.instagramCaption || "").trim()) {
    errors.push("Facebook 文案不可為空");
  }
  const text = `${post.title || ""}\n${post.instagramCaption || ""}\n${post.facebookCaption || ""}`;
  const found = BLOCKED_TERMS.filter((term) => text.includes(term));
  if (found.length) errors.push(`文案含需修正字詞：${found.join("、")}`);
  return errors;
}

async function request(url, options = {}) {
  const response = await fetch(url, options);
  const text = await response.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = { raw: text };
  }
  if (!response.ok || data.error) {
    throw new Error(data.error?.message || data.raw || `HTTP ${response.status}`);
  }
  return data;
}

async function publishInstagram(post) {
  if (!IG_USER_ID || !IG_TOKEN) throw new Error("Instagram 環境變數尚未設定");
  const created = await request(
    `https://graph.instagram.com/${GRAPH_VERSION}/${encodeURIComponent(IG_USER_ID)}/media`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        image_url: post.imageUrl,
        caption: post.instagramCaption,
        access_token: IG_TOKEN,
      }),
    }
  );

  let finished = false;
  for (let index = 0; index < 12; index += 1) {
    const statusUrl = new URL(
      `https://graph.instagram.com/${GRAPH_VERSION}/${encodeURIComponent(created.id)}`
    );
    statusUrl.searchParams.set("fields", "status_code,status");
    statusUrl.searchParams.set("access_token", IG_TOKEN);
    const status = await request(statusUrl);
    if (status.status_code === "FINISHED") {
      finished = true;
      break;
    }
    if (["ERROR", "EXPIRED"].includes(status.status_code)) {
      throw new Error(status.status || status.status_code);
    }
    await new Promise((resolve) => setTimeout(resolve, 5000));
  }
  if (!finished) throw new Error("Instagram 圖片處理逾時");

  return request(
    `https://graph.instagram.com/${GRAPH_VERSION}/${encodeURIComponent(IG_USER_ID)}/media_publish`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ creation_id: created.id, access_token: IG_TOKEN }),
    }
  );
}

async function publishFacebook(post) {
  if (!FB_PAGE_ID || !FB_TOKEN) throw new Error("Facebook 粉絲專頁環境變數尚未設定");
  const message = post.facebookCaption || post.instagramCaption;
  const endpoint = post.imageUrl ? "photos" : "feed";
  const body = post.imageUrl
    ? { url: post.imageUrl, caption: message, published: "true", access_token: FB_TOKEN }
    : { message, published: "true", access_token: FB_TOKEN };
  return request(
    `https://graph.facebook.com/${GRAPH_VERSION}/${encodeURIComponent(FB_PAGE_ID)}/${endpoint}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(body),
    }
  );
}

function mergePlatformStatus(post = {}, change = {}) {
  return { ...(post.platformStatus || {}), ...change };
}

async function executeOnce(postId) {
  const current = readStore().posts.find((post) => post.id === postId);
  if (!current) return null;
  if (!['approved', 'failed', 'partial'].includes(current.status)) {
    if (current.status === "publishing") return current;
    return updatePost(postId, {
      status: "paused",
      assetLocked: false,
      lastError: "貼文不是可發布狀態，已安全暫停",
    });
  }

  const validationErrors = validatePublishable(current);
  if (validationErrors.length) {
    return updatePost(postId, {
      status: "paused",
      assetLocked: false,
      lastError: validationErrors.join("｜"),
    });
  }

  const attemptId = `${Date.now()}-${process.pid}-${Math.random().toString(36).slice(2, 8)}`;
  let post = updatePost(postId, {
    status: "publishing",
    lastError: "",
    publishAttemptId: attemptId,
    publishAttemptStartedAt: now(),
  });
  const result = { ...(post.result || {}) };
  let platformStatus = { ...(post.platformStatus || {}) };
  const errors = [];

  if (post.publishInstagram && !publishGuard.platformDone({ ...post, result, platformStatus }, "instagram")) {
    platformStatus = mergePlatformStatus(post, { ...platformStatus, instagram: "發布中" });
    post = updatePost(postId, {
      platformStatus,
      instagramPublishAttemptAt: now(),
      publishAttemptId: attemptId,
    });
    try {
      result.instagram = await publishInstagram(post);
      platformStatus = mergePlatformStatus(post, { instagram: "成功" });
      post = updatePost(postId, {
        result: { ...(post.result || {}), instagram: result.instagram },
        platformStatus,
        instagramPublishedAt: now(),
        status: "publishing",
        lastError: "",
        publishAttemptId: attemptId,
      });
    } catch (error) {
      platformStatus = mergePlatformStatus(post, { instagram: "失敗" });
      errors.push(`Instagram：${error.message}`);
      post = updatePost(postId, {
        result: { ...(post.result || {}), ...result },
        platformStatus,
        lastError: errors.join("｜"),
        publishAttemptId: attemptId,
      });
    }
  }

  if (post.publishFacebook && !publishGuard.platformDone({ ...post, result, platformStatus }, "facebook")) {
    platformStatus = mergePlatformStatus(post, { ...platformStatus, facebook: "發布中" });
    post = updatePost(postId, {
      platformStatus,
      facebookPublishAttemptAt: now(),
      publishAttemptId: attemptId,
    });
    try {
      result.facebook = await publishFacebook(post);
      platformStatus = mergePlatformStatus(post, { facebook: "成功" });
      post = updatePost(postId, {
        result: { ...(post.result || {}), facebook: result.facebook },
        platformStatus,
        facebookPublishedAt: now(),
        status: "publishing",
        lastError: errors.join("｜"),
        publishAttemptId: attemptId,
      });
    } catch (error) {
      platformStatus = mergePlatformStatus(post, { facebook: "失敗" });
      errors.push(`Facebook：${error.message}`);
      post = updatePost(postId, {
        result: { ...(post.result || {}), ...result },
        platformStatus,
        lastError: errors.join("｜"),
        publishAttemptId: attemptId,
      });
    }
  }

  post = readStore().posts.find((item) => item.id === postId) || post;
  const finalPost = {
    ...post,
    result: { ...(post.result || {}), ...result },
    platformStatus: { ...(post.platformStatus || {}), ...platformStatus },
  };
  const outcome = publishGuard.publishOutcome(finalPost);
  return updatePost(postId, {
    result: finalPost.result,
    platformStatus: finalPost.platformStatus,
    status: outcome.status,
    lastError: errors.join("｜"),
    publishedAt: outcome.allDone ? (post.publishedAt || now()) : "",
    publishAttemptCompletedAt: now(),
    publishAttemptId: attemptId,
  });
}

function execute(postId) {
  return publishGuard.withPostLock(postId, () => executeOnce(postId));
}

async function scheduler() {
  if (running) return { skipped: true, due: 0, blocked: 0 };
  running = true;
  let dueCount = 0;
  let blocked = 0;
  try {
    const due = readStore().posts.filter(
      (post) => post.status === "approved" && new Date(post.scheduledAt).getTime() <= Date.now()
    );
    dueCount = due.length;
    for (const post of due) {
      const errors = validatePublishable(post);
      if (errors.length) {
        blocked += 1;
        updatePost(post.id, {
          status: "paused",
          assetLocked: false,
          lastError: errors.join("｜"),
        });
        continue;
      }
      await execute(post.id);
    }
  } catch (error) {
    console.error("social scheduler failed", error.message);
  } finally {
    running = false;
  }
  return { skipped: false, due: dueCount, blocked };
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
    persistentStoreConfigured: true,
    graphVersion: GRAPH_VERSION,
    schedulerRunning: running,
    publishGuardVersion: publishGuard.VERSION,
    publishGuardInFlight: publishGuard.inFlightCount(),
    postCount: readStore().posts.length,
    scheduleRule: "每週三、週五 20:00（Asia/Taipei）",
    assetLockRequired: true,
    checkedAt: now(),
  };
}

app.get("/social/healthz", (_req, res) => res.json(healthPayload()));
app.get("/health", (_req, res) => res.json(healthPayload()));

const timer = setInterval(scheduler, 30000);
timer.unref?.();
scheduler();

const port = process.env.PORT || 3000;
if (require.main === module) {
  app.listen(port, () =>
    console.log(`仙加味 LINE OA ${VERSION} + social ${SOCIAL_VERSION} running on ${port}`)
  );
}

module.exports = {
  app,
  officialImage,
  validOfficialSchedule,
  validatePublishable,
  publishInstagram,
  publishFacebook,
  execute,
  executeOnce,
  scheduler,
  healthPayload,
  readStore,
  writeStore,
};
