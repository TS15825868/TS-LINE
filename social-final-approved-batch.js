"use strict";

const fs = require("fs");
const path = require("path");
const Module = require("module");

const VERSION = "4.0.0";
const CONTENT_VERSION = "approved-complete-graphics-v4";
const CAMPAIGN_ID = "xjw-social-final-10-v4";
const PUBLIC_BASE = String(process.env.RENDER_EXTERNAL_URL || "https://ts-line.onrender.com").replace(/\/$/, "");
const ROUTE_PREFIX = "/social-approved-assets";
const ASSET_DIR = path.join(__dirname, "assets", "social-approved");
const CARE_CHUNK_DIR = path.join(ASSET_DIR, "care-chunks");
const WEATHER_INTERVAL_MS = Number(process.env.SOCIAL_WEATHER_CHECK_INTERVAL_MS || 60 * 60 * 1000);
const WEATHER_LATITUDE = Number(process.env.SOCIAL_WEATHER_LATITUDE || 25.038);
const WEATHER_LONGITUDE = Number(process.env.SOCIAL_WEATHER_LONGITUDE || 121.499);

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
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean)
  );
  try { hosts.add(new URL(PUBLIC_BASE).hostname); } catch {}
  process.env.SOCIAL_APPROVED_IMAGE_HOSTS = [...hosts].join(",");
}

function careAvifBuffer(name) {
  const stem = path.basename(String(name || ""), ".jpg");
  const prefix = `${stem}.avif.`;
  const chunks = fs.readdirSync(CARE_CHUNK_DIR)
    .filter((file) => file.startsWith(prefix) && file.endsWith(".b64"))
    .sort();
  if (!chunks.length) return null;
  const encoded = chunks.map((file) => fs.readFileSync(path.join(CARE_CHUNK_DIR, file), "utf8").trim()).join("");
  return Buffer.from(encoded, "base64");
}

async function assetBuffer(name) {
  if (!String(name || "").startsWith("care-")) return null;
  if (!IMAGE_CACHE.has(name)) {
    const avif = careAvifBuffer(name);
    if (!avif) return null;
    IMAGE_CACHE.set(name, require("sharp")(avif).jpeg({ quality: 91, chromaSubsampling: "4:4:4" }).toBuffer());
  }
  return IMAGE_CACHE.get(name);
}

function mount(app) {
  if (!app || app.__xjwFinalApprovedAssetsMounted) return;
  Object.defineProperty(app, "__xjwFinalApprovedAssetsMounted", { value: true });
  app.get(`${ROUTE_PREFIX}/healthz`, async (_req, res) => {
    const names = POSTS.filter((post) => post.imageName).map((post) => post.imageName);
    const buffers = await Promise.all(names.map((name) => assetBuffer(name)));
    res.json({ ok: buffers.every(Boolean), version: VERSION, careCount: names.length, totalPosts: POSTS.length, names });
  });
  app.get(`${ROUTE_PREFIX}/:name`, async (req, res) => {
    try {
      const name = path.basename(String(req.params.name || ""));
      const buffer = await assetBuffer(name);
      if (!buffer) return res.status(404).send("not found");
      return res.type("image/jpeg").set("Cache-Control", "public, max-age=604800, immutable").send(buffer);
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
  const isWeatherStandby = Boolean(template.conditionalWeather);
  const weatherActivated = isWeatherStandby && previous.oneTimeWeatherPost === true && ["approved", "publishing", "failed", "partial"].includes(previous.status);
  const preserveManual = previous.manualContentOverride === true;
  const preserveTime = previous.manualScheduleOverride === true;
  const preserveReview = ["draft", "rejected"].includes(previous.status) && previous.manualReviewPending === true;

  const content = preserveManual
    ? {}
    : {
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
    ...(template.imageName ? { imageName: template.imageName } : {}),
    publishInstagram: true,
    publishFacebook: true,
    autoManaged: true,
    result: previous.result || {},
    createdAt: previous.createdAt || updatedAt,
    updatedAt: previous.updatedAt || updatedAt,
  };

  if (isWeatherStandby && !weatherActivated) {
    Object.assign(next, {
      scheduledAt: "",
      conditionalWeather: true,
      automationStandby: true,
      oneTimeWeatherPost: false,
      status: "paused",
      assetLocked: true,
      approvedAt: previous.approvedAt || updatedAt,
      lastError: "等待符合萬華實際氣候後，自動安排上午10:00發文",
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
      conditionalWeather: isWeatherStandby,
      automationStandby: false,
      status: ["publishing", "failed", "partial"].includes(previous.status) ? previous.status : "approved",
      assetLocked: true,
      approvedAt: previous.approvedAt || updatedAt,
      lastError: ["failed", "partial"].includes(previous.status) ? previous.lastError : "",
    });
  }

  const history = Array.isArray(previous.history) ? previous.history.slice(-49) : [];
  if (!previous.id) history.push(historyEntry("建立正式社群貼文", "使用已核准完整成品圖，未經程式拼湊", updatedAt));
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
        lastError: "已由正式5篇關心＋5篇其他社群圖文取代",
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

  const nextStore = {
    ...store,
    posts,
    socialFinalApprovedBatchVersion: VERSION,
    socialFinalApprovedContentVersion: CONTENT_VERSION,
    socialFinalApprovedUpdatedAt: updatedAt,
  };
  return { store: nextStore, changed };
}

function reconcile(readStore, writeStore) {
  const current = readStore();
  const result = reconcileStore(current);
  if (result.changed || current.socialFinalApprovedBatchVersion !== VERSION) writeStore(result.store);
  const active = result.store.posts.filter((post) => CANONICAL_IDS.has(String(post.id || "")) && post.status !== "cancelled");
  return {
    version: VERSION,
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
  const weekPosts = store.posts.filter((post) => activeStatuses.has(post.status) && weekKey(post.scheduledAt) === week);
  const alreadyWeather = weekPosts.some((post) => post.oneTimeWeatherPost === true);
  if (alreadyWeather) return { activated: false, reason: "本週已有氣候關心貼文" };

  const replaceableCare = weekPosts.find((post) => post.sequenceRole === "care" && post.status !== "published");
  if (replaceableCare) {
    replaceableCare.status = "cancelled";
    replaceableCare.assetLocked = false;
    replaceableCare.lastError = "已由本週實際氣候關心貼文替換";
    replaceableCare.updatedAt = checkedAt;
  } else if (weekPosts.length >= 2) {
    return { activated: false, reason: "本週已有2篇貼文，未額外增加" };
  }

  const target = store.posts.find((post) => post.automationStandby === true && post.weatherTrigger === selection.trigger && post.status === "paused");
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
  target.history = [...(target.history || []).slice(-49), historyEntry("依實際氣候啟用", selection.summary, checkedAt)];
  return { activated: true, id: target.id, scheduledAt: schedule };
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
  POSTS,
  CANONICAL_IDS,
  addApprovedHost,
  assetBuffer,
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
  activateWeatherPost,
  checkWeather,
  startWeatherAutomation,
  install,
};
