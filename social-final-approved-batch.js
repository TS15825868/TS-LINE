"use strict";

const fs = require("fs");
const path = require("path");
const Module = require("module");
const sharp = require("sharp");

const VERSION = "5.0.0";
const CONTENT_VERSION = "approved-highres-1080-v5";
const CAMPAIGN_ID = "xjw-social-final-11-v5";
const PUBLIC_BASE = String(process.env.RENDER_EXTERNAL_URL || "https://ts-line.onrender.com").replace(/\/$/, "");
const ROUTE_PREFIX = "/social-approved-assets";
const ASSET_DIR = path.join(__dirname, "assets", "social-approved");
const HIGHRES_DIR = path.join(ASSET_DIR, "care-highres");
const CARE_CHUNK_DIR = path.join(ASSET_DIR, "care-chunks");
const WEATHER_INTERVAL_MS = Number(process.env.SOCIAL_WEATHER_CHECK_INTERVAL_MS || 60 * 60 * 1000);
const WEATHER_LATITUDE = Number(process.env.SOCIAL_WEATHER_LATITUDE || 25.038);
const WEATHER_LONGITUDE = Number(process.env.SOCIAL_WEATHER_LONGITUDE || 121.499);
const TARGET_IMAGE_SIZE = 1080;

const nowIso = () => new Date().toISOString();
const assetUrl = (name) => `${PUBLIC_BASE}${ROUTE_PREFIX}/${encodeURIComponent(name)}?v=${CONTENT_VERSION}`;
const { POSTS } = require("./social-final-posts");
const CANONICAL_IDS = new Set(POSTS.map((post) => post.id));
const IMAGE_CACHE = new Map();
let weatherTimer = null;
let weatherChecking = false;

function addApprovedHost() {
  const hosts = new Set(
    String(process.env.SOCIAL_APPROVED_IMAGE_HOSTS || "raw.githubusercontent.com,ts15825868.github.io,ts-line.onrender.com")
      .split(",").map((value) => value.trim()).filter(Boolean)
  );
  try { hosts.add(new URL(PUBLIC_BASE).hostname); } catch {}
  process.env.SOCIAL_APPROVED_IMAGE_HOSTS = [...hosts].join(",");
}

function decodeBase64File(file) {
  if (!fs.existsSync(file)) return null;
  const encoded = fs.readFileSync(file, "utf8").replace(/\s+/g, "");
  if (!encoded || !/^[A-Za-z0-9+/]+={0,2}$/.test(encoded)) return null;
  const buffer = Buffer.from(encoded, "base64");
  return buffer.length > 1000 ? buffer : null;
}

function highresAvifBuffer(name) {
  const stem = path.basename(String(name || ""), ".jpg");
  return decodeBase64File(path.join(HIGHRES_DIR, `${stem}.avif.b64`));
}

function legacyAvifBuffer(name) {
  const stem = path.basename(String(name || ""), ".jpg");
  const prefix = `${stem}.avif.`;
  if (!fs.existsSync(CARE_CHUNK_DIR)) return null;
  const chunks = fs.readdirSync(CARE_CHUNK_DIR)
    .filter((file) => file.startsWith(prefix) && file.endsWith(".b64"))
    .sort();
  if (!chunks.length) return null;
  const encoded = chunks.map((file) => fs.readFileSync(path.join(CARE_CHUNK_DIR, file), "utf8").trim()).join("");
  const buffer = Buffer.from(encoded, "base64");
  return buffer.length > 1000 ? buffer : null;
}

function careAvifBuffer(name) {
  return highresAvifBuffer(name) || legacyAvifBuffer(name);
}

async function assetBuffer(name) {
  if (!String(name || "").startsWith("care-")) return null;
  if (!IMAGE_CACHE.has(name)) {
    const avif = careAvifBuffer(name);
    if (!avif) return null;
    IMAGE_CACHE.set(name, (async () => {
      const image = sharp(avif, { failOn: "none" });
      const metadata = await image.metadata();
      let pipeline = image;
      if ((metadata.width || 0) < TARGET_IMAGE_SIZE || (metadata.height || 0) < TARGET_IMAGE_SIZE) {
        pipeline = pipeline.resize(TARGET_IMAGE_SIZE, TARGET_IMAGE_SIZE, {
          fit: "fill",
          kernel: sharp.kernel.lanczos3,
        }).sharpen({ sigma: 0.8, m1: 0.8, m2: 1.4, x1: 2, y2: 10, y3: 20 });
      }
      return pipeline
        .jpeg({ quality: 96, chromaSubsampling: "4:4:4", mozjpeg: true })
        .toBuffer();
    })());
  }
  return IMAGE_CACHE.get(name);
}

async function assetInfo(name) {
  const buffer = await assetBuffer(name);
  if (!buffer) return { name, ok: false, width: 0, height: 0, bytes: 0 };
  const metadata = await sharp(buffer).metadata();
  return {
    name,
    ok: metadata.width >= TARGET_IMAGE_SIZE && metadata.height >= TARGET_IMAGE_SIZE,
    width: metadata.width || 0,
    height: metadata.height || 0,
    bytes: buffer.length,
    highresSource: Boolean(highresAvifBuffer(name)),
  };
}

function mount(app) {
  if (!app || app.__xjwFinalApprovedAssetsMounted) return;
  Object.defineProperty(app, "__xjwFinalApprovedAssetsMounted", { value: true });
  app.get(`${ROUTE_PREFIX}/healthz`, async (_req, res) => {
    const names = POSTS.filter((post) => post.imageName).map((post) => post.imageName);
    const assets = await Promise.all(names.map(assetInfo));
    res.json({
      ok: assets.every((item) => item.ok),
      version: VERSION,
      contentVersion: CONTENT_VERSION,
      targetSize: TARGET_IMAGE_SIZE,
      careCount: names.length,
      totalPosts: POSTS.length,
      highresSourceCount: assets.filter((item) => item.highresSource).length,
      assets,
    });
  });
  app.get(`${ROUTE_PREFIX}/:name`, async (req, res) => {
    try {
      const name = path.basename(String(req.params.name || ""));
      const buffer = await assetBuffer(name);
      if (!buffer) return res.status(404).send("not found");
      return res.type("image/jpeg")
        .set("Cache-Control", "public, max-age=604800, immutable")
        .set("X-XJW-Asset-Version", CONTENT_VERSION)
        .send(buffer);
    } catch (error) {
      console.error("approved social asset failed", error.message);
      return res.status(500).send("asset failed");
    }
  });
}

function historyEntry(action, detail, createdAt = nowIso()) {
  return { id: `social-${Date.now().toString(36)}-${Math.random().toString(16).slice(2, 8)}`, action, detail, createdAt };
}

function desiredPost(template, previous = {}, updatedAt = nowIso()) {
  const weatherTemplate = Boolean(template.conditionalWeather);
  const weatherActivated = weatherTemplate
    && previous.oneTimeWeatherPost === true
    && ["approved", "publishing", "failed", "partial", "published"].includes(previous.status);
  const preserveManual = previous.manualContentOverride === true;
  const preserveTime = previous.manualScheduleOverride === true;
  const preserveReview = ["draft", "rejected"].includes(previous.status) && previous.manualReviewPending === true;
  const content = preserveManual ? {} : {
    title: template.title,
    category: template.category,
    sequenceRole: template.sequenceRole,
    instagramCaption: template.instagramCaption,
    facebookCaption: template.facebookCaption,
    imageUrl: template.imageUrl || assetUrl(template.imageName),
    sourceImageFile: template.sourceImageFile || template.imageName,
  };
  const next = {
    ...previous,
    ...template,
    ...content,
    id: template.id,
    campaignId: CAMPAIGN_ID,
    campaignVersion: VERSION,
    contentVersion: CONTENT_VERSION,
    publishInstagram: true,
    publishFacebook: true,
    autoManaged: true,
    result: previous.result || {},
    platformStatus: previous.platformStatus || {},
    createdAt: previous.createdAt || updatedAt,
    updatedAt: previous.updatedAt || updatedAt,
  };

  if (weatherTemplate && !weatherActivated) {
    Object.assign(next, {
      scheduledAt: "",
      conditionalWeather: true,
      automationStandby: true,
      oneTimeWeatherPost: false,
      status: "paused",
      assetLocked: true,
      approvedAt: previous.approvedAt || updatedAt,
      lastError: "等待符合萬華實際氣候後，自動安排上午10:00例外加發",
    });
  } else if (preserveReview) {
    Object.assign(next, {
      scheduledAt: preserveTime ? previous.scheduledAt : (previous.scheduledAt || template.scheduledAt),
      status: previous.status,
      assetLocked: false,
      approvedAt: "",
      lastError: previous.lastError || "等待重新審核",
    });
  } else {
    Object.assign(next, {
      scheduledAt: preserveTime ? previous.scheduledAt : (weatherActivated ? previous.scheduledAt : template.scheduledAt),
      conditionalWeather: weatherTemplate,
      automationStandby: false,
      status: ["publishing", "failed", "partial"].includes(previous.status) ? previous.status : "approved",
      assetLocked: true,
      approvedAt: previous.approvedAt || updatedAt,
      lastError: ["failed", "partial"].includes(previous.status) ? previous.lastError : "",
    });
  }
  const history = Array.isArray(previous.history) ? previous.history.slice(-49) : [];
  if (!previous.id) history.push(historyEntry("建立正式社群貼文", "使用1080×1080以上已核准完整成品圖", updatedAt));
  next.history = history;
  const previousComparable = { ...previous };
  const nextComparable = { ...next };
  delete previousComparable.updatedAt;
  delete nextComparable.updatedAt;
  if (JSON.stringify(previousComparable) !== JSON.stringify(nextComparable)) next.updatedAt = updatedAt;
  return next;
}

function reconcileStore(store, updatedAt = nowIso()) {
  const original = Array.isArray(store.posts) ? store.posts : [];
  const byId = new Map(original.map((post) => [String(post.id || ""), post]));
  let changed = 0;
  const posts = [];
  for (const post of original) {
    if (post.status === "published") {
      posts.push(post);
      continue;
    }
    if (!CANONICAL_IDS.has(String(post.id || ""))) {
      posts.push({
        ...post,
        status: "cancelled",
        assetLocked: false,
        approvedAt: "",
        lastError: "已由正式5篇關心＋6篇產品社群圖文取代",
        updatedAt,
      });
      changed += 1;
    }
  }
  for (const template of POSTS) {
    const previous = byId.get(template.id) || {};
    if (previous.status === "published") continue;
    const next = desiredPost(template, previous, updatedAt);
    const existingIndex = posts.findIndex((post) => post.id === template.id);
    if (existingIndex >= 0) posts[existingIndex] = next;
    else posts.push(next);
    if (JSON.stringify(next) !== JSON.stringify(previous)) changed += 1;
  }
  return {
    store: {
      ...store,
      posts,
      publicationLedger: store.publicationLedger || {},
      socialFinalApprovedBatchVersion: VERSION,
      socialFinalApprovedContentVersion: CONTENT_VERSION,
      socialFinalApprovedUpdatedAt: updatedAt,
    },
    changed,
  };
}

function reconcile(readStore, writeStore) {
  const current = readStore();
  const result = reconcileStore(current);
  if (result.changed || current.socialFinalApprovedBatchVersion !== VERSION) writeStore(result.store);
  const active = result.store.posts.filter((post) => CANONICAL_IDS.has(String(post.id || "")) && post.status !== "cancelled");
  return {
    version: VERSION,
    contentVersion: CONTENT_VERSION,
    changed: result.changed,
    active: active.length,
    approved: active.filter((post) => post.status === "approved").length,
    standby: active.filter((post) => post.automationStandby === true).length,
    care: active.filter((post) => post.sequenceRole === "care").length,
    other: active.filter((post) => post.sequenceRole !== "care").length,
  };
}

function taipeiParts(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return Object.fromEntries(new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date).filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
}

function dateKey(value = new Date()) {
  const parts = taipeiParts(value);
  return parts ? `${parts.year}-${parts.month}-${parts.day}` : "";
}

function addDays(key, days) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(key || ""));
  if (!match) return "";
  return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]) + Number(days || 0))).toISOString().slice(0, 10);
}

function tenAt(key) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(key || ""));
  if (!match) return "";
  return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 2, 0, 0, 0)).toISOString();
}

function nextWeatherDate(now = new Date()) {
  const parts = taipeiParts(now);
  if (!parts) return "";
  const today = `${parts.year}-${parts.month}-${parts.day}`;
  const minutes = Number(parts.hour) * 60 + Number(parts.minute);
  return minutes < 9 * 60 + 30 ? today : addDays(today, 1);
}

function weatherUrl() {
  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.searchParams.set("latitude", String(WEATHER_LATITUDE));
  url.searchParams.set("longitude", String(WEATHER_LONGITUDE));
  url.searchParams.set("timezone", "Asia/Taipei");
  url.searchParams.set("forecast_days", "3");
  url.searchParams.set("daily", "weather_code,temperature_2m_max,temperature_2m_min,apparent_temperature_max,precipitation_sum,precipitation_probability_max");
  return url;
}

function selectWeather(daily, key) {
  const index = Array.isArray(daily?.time) ? daily.time.indexOf(key) : -1;
  if (index < 0) return null;
  const number = (name) => Number(daily?.[name]?.[index]);
  const code = number("weather_code");
  const max = number("temperature_2m_max");
  const min = number("temperature_2m_min");
  const apparent = number("apparent_temperature_max");
  const rain = number("precipitation_sum");
  const probability = number("precipitation_probability_max");
  if (code >= 51 || probability >= 60 || rain >= 5) return { trigger: "rain", summary: `降雨機率${probability}%／預估雨量${rain}mm` };
  if (apparent >= 34 || max >= 32) return { trigger: "hot", summary: `最高${max}°C／體感最高${apparent}°C` };
  if (max - min >= 8) return { trigger: "temperature-gap", summary: `高低溫差${(max - min).toFixed(1)}°C` };
  return null;
}

function weekKey(value) {
  const parts = taipeiParts(value);
  if (!parts) return "";
  const date = new Date(Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day)));
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() - day + 1);
  return date.toISOString().slice(0, 10);
}

function activateWeatherPost(store, selection, publishDate, checkedAt) {
  const schedule = tenAt(publishDate);
  const week = weekKey(schedule);
  const activeStatuses = new Set(["approved", "publishing", "published", "failed", "partial"]);
  const weekPosts = (store.posts || []).filter((post) => activeStatuses.has(post.status) && weekKey(post.scheduledAt) === week);
  if (weekPosts.some((post) => post.oneTimeWeatherPost === true)) {
    return { activated: false, reason: "本週已有氣候例外貼文" };
  }
  const target = (store.posts || []).find((post) => post.automationStandby === true && post.weatherTrigger === selection.trigger && post.status === "paused");
  if (!target) return { activated: false, reason: "找不到尚未使用的對應氣候素材" };
  Object.assign(target, {
    status: "approved",
    assetLocked: true,
    automationStandby: false,
    oneTimeWeatherPost: true,
    scheduledAt: schedule,
    approvedAt: target.approvedAt || checkedAt,
    weatherActivatedAt: checkedAt,
    weatherSummary: selection.summary,
    lastError: "",
    updatedAt: checkedAt,
  });
  target.history = [...(target.history || []).slice(-49), historyEntry("依實際氣候例外加發", selection.summary, checkedAt)];
  return { activated: true, id: target.id, scheduledAt: schedule, fixedPostsPreserved: true };
}

async function checkWeather(readStore, writeStore) {
  if (weatherChecking || typeof fetch !== "function") return { skipped: true };
  weatherChecking = true;
  try {
    const publishDate = nextWeatherDate();
    const response = await fetch(weatherUrl(), { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(12000) });
    if (!response.ok) throw new Error(`weather HTTP ${response.status}`);
    const data = await response.json();
    const selection = selectWeather(data.daily, publishDate);
    const store = readStore();
    const checkedAt = nowIso();
    let activation = { activated: false, reason: "目前沒有需要啟用的氣候貼文" };
    if (selection) activation = activateWeatherPost(store, selection, publishDate, checkedAt);
    store.weatherAutomation = {
      version: VERSION,
      checkedAt,
      publishDate,
      selectedTrigger: selection?.trigger || "",
      summary: selection?.summary || "目前沒有需要啟用的氣候貼文",
      activation,
    };
    writeStore(store);
    return { skipped: false, selection, activation };
  } catch (error) {
    console.error("Social weather automation failed", error.message);
    return { skipped: false, error: error.message };
  } finally {
    weatherChecking = false;
  }
}

function startWeatherAutomation(readStore, writeStore) {
  if (weatherTimer) return weatherTimer;
  setTimeout(() => checkWeather(readStore, writeStore), 3000).unref?.();
  weatherTimer = setInterval(() => checkWeather(readStore, writeStore), WEATHER_INTERVAL_MS);
  weatherTimer.unref?.();
  return weatherTimer;
}

addApprovedHost();
let installed = false;
let socialHookAttached = false;
let reconcileTimer = null;

function install() {
  if (installed) return;
  installed = true;
  const originalLoad = Module._load;
  Module._load = function patchedLoad(request, parent, isMain) {
    const loaded = originalLoad.apply(this, arguments);
    if (request === "./server" && loaded?.app) mount(loaded.app);
    if (request === "./social-server" && loaded?.readStore && loaded?.writeStore && !socialHookAttached) {
      socialHookAttached = true;
      setImmediate(() => {
        try {
          const result = reconcile(loaded.readStore, loaded.writeStore);
          console.log("Final approved social schedule reconciliation", result);
          startWeatherAutomation(loaded.readStore, loaded.writeStore);
        } catch (error) {
          console.error("Final approved social schedule setup failed", error.message);
        }
      });
      if (!reconcileTimer) {
        reconcileTimer = setInterval(() => {
          try { reconcile(loaded.readStore, loaded.writeStore); }
          catch (error) { console.error("Final approved social reconciliation failed", error.message); }
        }, 30 * 1000);
        reconcileTimer.unref?.();
      }
    }
    return loaded;
  };
}

install();

module.exports = {
  VERSION,
  CONTENT_VERSION,
  CAMPAIGN_ID,
  ROUTE_PREFIX,
  TARGET_IMAGE_SIZE,
  POSTS,
  CANONICAL_IDS,
  addApprovedHost,
  decodeBase64File,
  highresAvifBuffer,
  legacyAvifBuffer,
  careAvifBuffer,
  assetBuffer,
  assetInfo,
  mount,
  desiredPost,
  reconcileStore,
  reconcile,
  taipeiParts,
  dateKey,
  addDays,
  tenAt,
  nextWeatherDate,
  weatherUrl,
  selectWeather,
  weekKey,
  activateWeatherPost,
  checkWeather,
  startWeatherAutomation,
  install,
};
