"use strict";

const path = require("path");
const Module = require("module");
const sharp = require("sharp");
const { POSTS, validatePosts } = require("./social-final-posts");

const VERSION = "6.0.0";
const CONTENT_VERSION = "approved-website-qboss-exact-products-v1";
const CAMPAIGN_ID = "xjw-social-first-batch-10-v1";
const PUBLIC_BASE = String(process.env.RENDER_EXTERNAL_URL || "https://ts-line.onrender.com").replace(/\/$/, "");
const ROUTE_PREFIX = "/social-approved-assets";
const TARGET_IMAGE_SIZE = 1254;
const WEATHER_INTERVAL_MS = Number(process.env.SOCIAL_WEATHER_CHECK_INTERVAL_MS || 60 * 60 * 1000);
const WEATHER_LATITUDE = Number(process.env.SOCIAL_WEATHER_LATITUDE || 25.038);
const WEATHER_LONGITUDE = Number(process.env.SOCIAL_WEATHER_LONGITUDE || 121.499);
const FIXED_WEEKDAYS = new Set(["Wed", "Fri"]);
const WEBSITE_ASSET_BASE = "https://raw.githubusercontent.com/TS15825868/xianjiawei/main/images/brand/approved-v405";

const CARE_SCENES = Object.freeze({
  "care-work-rest.jpg": { source: `${WEBSITE_ASSET_BASE}/guide-how-to-use.webp`, badge: "仙加味日常關心", title: "工作再忙，也別忘了休息一下", footer: "把日常節奏放穩，慢慢來也很好。" },
  "care-work-rest-clear.jpg": { source: `${WEBSITE_ASSET_BASE}/guide-how-to-use.webp`, badge: "仙加味日常關心", title: "工作再忙，也別忘了休息一下", footer: "把日常節奏放穩，慢慢來也很好。" },
  "care-family.jpg": { source: `${WEBSITE_ASSET_BASE}/home-brand.webp`, badge: "仙加味日常關心", title: "照顧自己，也別忘了關心家人", footer: "陪伴，往往就是最溫柔的照顧。" },
  "care-temperature-gap.jpg": { source: `${WEBSITE_ASSET_BASE}/choose.webp`, badge: "仙加味氣候關心", title: "早晚溫差大，出門多帶一件薄外套", footer: "依當下溫度調整穿著，日常更安心。" },
  "care-hot-hydration.jpg": { source: `${WEBSITE_ASSET_BASE}/contact-line.webp`, badge: "仙加味氣候關心", title: "天氣炎熱，記得分次補充水分", footer: "外出帶水，忙碌時也記得休息一下。" },
  "care-rainy-day.jpg": { source: `${WEBSITE_ASSET_BASE}/brand-story.webp`, badge: "仙加味氣候關心", title: "下雨天在家，也別忘了留一點暖暖的時間", footer: "天氣有變化，也記得照顧自己與家人。" },
});

const PRODUCT_SCENES = Object.freeze({
  "product-guilu-gao-100g.jpg": [`${WEBSITE_ASSET_BASE}/product-guilu-gao-100g.webp`],
  "product-guilu-drink-combined.jpg": [`${WEBSITE_ASSET_BASE}/product-guilu-drink-30cc.webp`, `${WEBSITE_ASSET_BASE}/product-guilu-drink-180cc.webp`],
  "product-lurongfen-75g.jpg": [`${WEBSITE_ASSET_BASE}/product-luerong-fen-75g.webp`],
  "product-guilu-tangkuai-75g.jpg": [`${WEBSITE_ASSET_BASE}/product-guilu-tangkuai-75g.webp`],
  "product-guilu-jiao-600g.jpg": [`${WEBSITE_ASSET_BASE}/product-guilu-jiao-600g.webp`],
});

const CANONICAL_IDS = new Set(POSTS.map((post) => post.id));
const IMAGE_CACHE = new Map();
const REMOTE_CACHE = new Map();
let weatherTimer = null;
let weatherChecking = false;
let installed = false;
let socialHookAttached = false;
let reconcileTimer = null;
const nowIso = () => new Date().toISOString();
const assetUrl = (name) => `${PUBLIC_BASE}${ROUTE_PREFIX}/${encodeURIComponent(name)}?v=${CONTENT_VERSION}`;

function esc(value) {
  return String(value || "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" }[char]));
}

function addApprovedHost() {
  const hosts = new Set(String(process.env.SOCIAL_APPROVED_IMAGE_HOSTS || "raw.githubusercontent.com,ts15825868.github.io,ts-line.onrender.com").split(",").map((v) => v.trim()).filter(Boolean));
  try { hosts.add(new URL(PUBLIC_BASE).hostname); } catch {}
  process.env.SOCIAL_APPROVED_IMAGE_HOSTS = [...hosts].join(",");
}

async function fetchRemoteBuffer(url) {
  if (!REMOTE_CACHE.has(url)) {
    REMOTE_CACHE.set(url, (async () => {
      if (typeof fetch !== "function") throw new Error("目前環境不支援遠端圖片讀取");
      const response = await fetch(url, { headers: { Accept: "image/webp,image/*,*/*" }, signal: AbortSignal.timeout(20000) });
      if (!response.ok) throw new Error(`正式圖片讀取失敗：HTTP ${response.status}`);
      const buffer = Buffer.from(await response.arrayBuffer());
      if (buffer.length < 100000) throw new Error("正式圖片檔案過小");
      return buffer;
    })());
  }
  return REMOTE_CACHE.get(url);
}

async function containScene(buffer, width, height) {
  return sharp(buffer).resize({ width, height, fit: "contain", background: "#f7f4ed", withoutEnlargement: false }).flatten({ background: "#f7f4ed" }).png().toBuffer();
}

async function careAssetBuffer(name) {
  const config = CARE_SCENES[name];
  if (!config) return null;
  const source = await fetchRemoteBuffer(config.source);
  const scene = await containScene(source, 1170, 878);
  const top = Buffer.from(`<svg width="1254" height="190" xmlns="http://www.w3.org/2000/svg"><style>text{font-family:'Noto Sans CJK TC','PingFang TC','Microsoft JhengHei',sans-serif}</style><rect x="32" y="22" width="1190" height="146" rx="38" fill="#f7f4ed" fill-opacity=".96" stroke="#c58c38" stroke-width="5"/><rect x="72" y="48" width="330" height="92" rx="46" fill="#0b2e52"/><text x="237" y="107" text-anchor="middle" font-size="37" font-weight="900" fill="#fff4d8">${esc(config.badge)}</text><text x="782" y="111" text-anchor="middle" font-size="52" font-weight="900" fill="#0b2e52">${esc(config.title)}</text></svg>`);
  const bottom = Buffer.from(`<svg width="1254" height="120" xmlns="http://www.w3.org/2000/svg"><style>text{font-family:'Noto Sans CJK TC','PingFang TC','Microsoft JhengHei',sans-serif}</style><rect x="80" y="12" width="1094" height="92" rx="46" fill="#0b2e52" stroke="#c58c38" stroke-width="4"/><text x="627" y="73" text-anchor="middle" font-size="37" font-weight="900" fill="#fff4d8">${esc(config.footer)}</text></svg>`);
  return sharp({ create: { width: TARGET_IMAGE_SIZE, height: TARGET_IMAGE_SIZE, channels: 4, background: "#f7f4ed" } })
    .composite([{ input: top, left: 0, top: 0 }, { input: scene, left: 42, top: 184 }, { input: bottom, left: 0, top: 1128 }])
    .jpeg({ quality: 96, chromaSubsampling: "4:4:4", mozjpeg: true }).toBuffer();
}

async function productAssetBuffer(name) {
  const urls = PRODUCT_SCENES[name];
  if (!urls) return null;
  const sources = await Promise.all(urls.map(fetchRemoteBuffer));
  if (sources.length === 1) {
    const scene = await containScene(sources[0], 1170, 878);
    return sharp({ create: { width: TARGET_IMAGE_SIZE, height: TARGET_IMAGE_SIZE, channels: 4, background: "#f7f4ed" } })
      .composite([{ input: scene, left: 42, top: 188 }])
      .jpeg({ quality: 96, chromaSubsampling: "4:4:4", mozjpeg: true }).toBuffer();
  }
  const [small, large] = await Promise.all(sources.map((buffer) => containScene(buffer, 582, 437)));
  const heading = Buffer.from(`<svg width="1254" height="210" xmlns="http://www.w3.org/2000/svg"><style>text{font-family:'Noto Sans CJK TC','PingFang TC','Microsoft JhengHei',sans-serif}</style><rect x="36" y="26" width="1182" height="152" rx="38" fill="#0b2e52" stroke="#c58c38" stroke-width="5"/><text x="627" y="96" text-anchor="middle" font-size="56" font-weight="900" fill="#fff4d8">龜鹿飲 30cc／180cc</text><text x="627" y="145" text-anchor="middle" font-size="29" font-weight="700" fill="#f7dba8">兩種真實包裝完整呈現，依生活情境安排</text></svg>`);
  const labels = Buffer.from(`<svg width="1254" height="90" xmlns="http://www.w3.org/2000/svg"><style>text{font-family:'Noto Sans CJK TC','PingFang TC','Microsoft JhengHei',sans-serif}</style><rect x="90" y="8" width="460" height="68" rx="34" fill="#9f1f1e"/><text x="320" y="54" text-anchor="middle" font-size="34" font-weight="900" fill="#fff">30cc 玻璃小瓶</text><rect x="704" y="8" width="460" height="68" rx="34" fill="#9f1f1e"/><text x="934" y="54" text-anchor="middle" font-size="34" font-weight="900" fill="#fff">180cc 鋁袋</text></svg>`);
  return sharp({ create: { width: TARGET_IMAGE_SIZE, height: TARGET_IMAGE_SIZE, channels: 4, background: "#f7f4ed" } })
    .composite([{ input: heading, left: 0, top: 0 }, { input: labels, left: 0, top: 205 }, { input: small, left: 22, top: 300 }, { input: large, left: 650, top: 300 }])
    .jpeg({ quality: 96, chromaSubsampling: "4:4:4", mozjpeg: true }).toBuffer();
}

async function assetBuffer(name) {
  const safeName = path.basename(String(name || ""));
  if (!IMAGE_CACHE.has(safeName)) IMAGE_CACHE.set(safeName, PRODUCT_SCENES[safeName] ? productAssetBuffer(safeName) : careAssetBuffer(safeName));
  return IMAGE_CACHE.get(safeName);
}

async function assetInfo(name) {
  try {
    const buffer = await assetBuffer(name);
    if (!buffer) return { name, ok: false, error: "找不到正式圖片" };
    const metadata = await sharp(buffer).metadata();
    return { name, ok: metadata.width === TARGET_IMAGE_SIZE && metadata.height === TARGET_IMAGE_SIZE, width: metadata.width || 0, height: metadata.height || 0, bytes: buffer.length, approvedWebsiteQBoss: true, deerPartner: true, turtlePartner: true, productPresentationLocked: Boolean(PRODUCT_SCENES[name]), productSpecLocked: Boolean(PRODUCT_SCENES[name]), sourceScenes: PRODUCT_SCENES[name] || [CARE_SCENES[name]?.source].filter(Boolean) };
  } catch (error) {
    return { name, ok: false, error: error.message };
  }
}

function historyEntry(action, detail, createdAt = nowIso()) {
  return { id: `social-${Date.now().toString(36)}-${Math.random().toString(16).slice(2, 8)}`, action, detail, createdAt };
}

function desiredPost(template, previous = {}, updatedAt = nowIso()) {
  const weatherTemplate = Boolean(template.conditionalWeather);
  const weatherActivated = weatherTemplate && previous.oneTimeWeatherPost === true && ["approved", "publishing", "failed", "partial", "published"].includes(previous.status);
  const next = {
    ...previous,
    ...template,
    id: template.id,
    campaignId: CAMPAIGN_ID,
    campaignVersion: VERSION,
    contentVersion: CONTENT_VERSION,
    title: template.title,
    category: template.category,
    sequenceRole: template.sequenceRole,
    instagramCaption: template.instagramCaption,
    facebookCaption: template.facebookCaption,
    imageUrl: assetUrl(template.imageName),
    sourceImageFile: template.sourceImageFile || template.imageName,
    publishInstagram: true,
    publishFacebook: true,
    autoManaged: true,
    result: previous.result || {},
    platformStatus: previous.platformStatus || {},
    createdAt: previous.createdAt || updatedAt,
    updatedAt,
  };
  if (weatherTemplate && !weatherActivated) Object.assign(next, { scheduledAt: "", conditionalWeather: true, automationStandby: true, oneTimeWeatherPost: false, status: "paused", assetLocked: true, approvedAt: previous.approvedAt || updatedAt, lastError: "等待符合萬華實際氣候後，自動安排非週三、週五上午10:00例外加發" });
  else Object.assign(next, { scheduledAt: weatherActivated ? previous.scheduledAt : template.scheduledAt, conditionalWeather: weatherTemplate, automationStandby: false, status: ["publishing", "failed", "partial"].includes(previous.status) ? previous.status : "approved", assetLocked: true, approvedAt: previous.approvedAt || updatedAt, lastError: ["failed", "partial"].includes(previous.status) ? previous.lastError : "" });
  const history = Array.isArray(previous.history) ? previous.history.slice(-49) : [];
  if (!previous.id) history.push(historyEntry("建立第一批正式貼文", "文案與圖片已完成重複檢查；使用網站核准小老闆與真實產品原圖", updatedAt));
  next.history = history;
  return next;
}

function reconcileStore(store, updatedAt = nowIso()) {
  validatePosts(POSTS);
  const original = Array.isArray(store.posts) ? store.posts : [];
  const byId = new Map(original.map((post) => [String(post.id || ""), post]));
  const published = original.filter((post) => post.status === "published");
  const publishedIds = new Set(published.map((post) => String(post.id || "")));
  const canonical = POSTS.filter((template) => !publishedIds.has(template.id)).map((template) => desiredPost(template, byId.get(template.id) || {}, updatedAt));
  const posts = [...published, ...canonical].slice(-500);
  const changed = JSON.stringify(posts) !== JSON.stringify(original);
  return { store: { ...store, posts, publicationLedger: store.publicationLedger || {}, socialFinalApprovedBatchVersion: VERSION, socialFinalApprovedContentVersion: CONTENT_VERSION, socialFinalApprovedUpdatedAt: updatedAt }, changed: changed ? 1 : 0 };
}

function reconcile(readStore, writeStore) {
  const current = readStore();
  const result = reconcileStore(current);
  if (result.changed || current.socialFinalApprovedBatchVersion !== VERSION) writeStore(result.store);
  const active = result.store.posts.filter((post) => CANONICAL_IDS.has(String(post.id || "")) && post.status !== "cancelled");
  return { version: VERSION, changed: result.changed, active: active.length, approved: active.filter((post) => post.status === "approved").length, standby: active.filter((post) => post.automationStandby === true).length };
}

function taipeiParts(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Taipei", year: "numeric", month: "2-digit", day: "2-digit", weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(date).filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
}

function dateKey(value = new Date()) { const parts = taipeiParts(value); return parts ? `${parts.year}-${parts.month}-${parts.day}` : ""; }
function addDays(key, days) { const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(key || "")); return match ? new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]) + Number(days || 0))).toISOString().slice(0, 10) : ""; }
function tenAt(key) { const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(key || "")); return match ? new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 2, 0, 0, 0)).toISOString() : ""; }
function weekdayForKey(key) { return taipeiParts(tenAt(key))?.weekday || ""; }
function isFixedPublishDate(key) { return FIXED_WEEKDAYS.has(weekdayForKey(key)); }
function nextWeatherDate(now = new Date()) {
  const parts = taipeiParts(now); if (!parts) return "";
  const today = `${parts.year}-${parts.month}-${parts.day}`;
  const minutes = Number(parts.hour) * 60 + Number(parts.minute);
  for (let offset = 0; offset < 5; offset += 1) { const key = addDays(today, offset); if (isFixedPublishDate(key)) continue; if (offset === 0 && minutes >= 570) continue; return key; }
  return "";
}

function weatherUrl() {
  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.searchParams.set("latitude", String(WEATHER_LATITUDE)); url.searchParams.set("longitude", String(WEATHER_LONGITUDE)); url.searchParams.set("timezone", "Asia/Taipei"); url.searchParams.set("forecast_days", "5"); url.searchParams.set("daily", "weather_code,temperature_2m_max,temperature_2m_min,apparent_temperature_max,precipitation_sum,precipitation_probability_max"); return url;
}

function selectWeather(daily, key) {
  const index = Array.isArray(daily?.time) ? daily.time.indexOf(key) : -1; if (index < 0) return null;
  const number = (name) => Number(daily?.[name]?.[index]);
  const code = number("weather_code"), max = number("temperature_2m_max"), min = number("temperature_2m_min"), apparent = number("apparent_temperature_max"), rain = number("precipitation_sum"), probability = number("precipitation_probability_max");
  if (code >= 51 || probability >= 60 || rain >= 5) return { trigger: "rain", summary: `降雨機率${probability}%／預估雨量${rain}mm` };
  if (apparent >= 34 || max >= 32) return { trigger: "hot", summary: `最高${max}°C／體感最高${apparent}°C` };
  if (max - min >= 8) return { trigger: "temperature-gap", summary: `高低溫差${(max - min).toFixed(1)}°C` };
  return null;
}

function weekKey(value) { const parts = taipeiParts(value); if (!parts) return ""; const date = new Date(Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day))); const day = date.getUTCDay() || 7; date.setUTCDate(date.getUTCDate() - day + 1); return date.toISOString().slice(0, 10); }

function activateWeatherPost(store, selection, publishDate, checkedAt) {
  if (!publishDate || isFixedPublishDate(publishDate)) return { activated: false, reason: "氣候貼文不可與週三、週五固定貼文同日" };
  const schedule = tenAt(publishDate), week = weekKey(schedule), activeStatuses = new Set(["approved", "publishing", "published", "failed", "partial"]);
  const weekPosts = (store.posts || []).filter((post) => activeStatuses.has(post.status) && weekKey(post.scheduledAt) === week);
  if (weekPosts.some((post) => post.oneTimeWeatherPost === true)) return { activated: false, reason: "本週已有氣候條件貼文" };
  if (weekPosts.some((post) => post.scheduledAt === schedule)) return { activated: false, reason: "該時段已有貼文" };
  const target = (store.posts || []).find((post) => post.automationStandby === true && post.weatherTrigger === selection.trigger && post.status === "paused");
  if (!target) return { activated: false, reason: "找不到尚未使用的對應氣候素材" };
  Object.assign(target, { status: "approved", assetLocked: true, automationStandby: false, oneTimeWeatherPost: true, scheduledAt: schedule, scheduleTimePolicy: "weather-condition-non-wed-fri-10:00", approvedAt: target.approvedAt || checkedAt, weatherActivatedAt: checkedAt, weatherSummary: selection.summary, lastError: "", updatedAt: checkedAt });
  target.history = [...(target.history || []).slice(-49), historyEntry("依萬華實際氣候自動加發", selection.summary, checkedAt)];
  return { activated: true, id: target.id, scheduledAt: schedule, fixedPostsPreserved: true };
}

async function checkWeather(readStore, writeStore) {
  if (weatherChecking || typeof fetch !== "function") return { skipped: true };
  weatherChecking = true;
  try {
    const publishDate = nextWeatherDate(); if (!publishDate) return { skipped: true, reason: "未找到可用的非固定發布日" };
    const response = await fetch(weatherUrl(), { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(12000) }); if (!response.ok) throw new Error(`weather HTTP ${response.status}`);
    const data = await response.json(), selection = selectWeather(data.daily, publishDate), store = readStore(), checkedAt = nowIso();
    const activation = selection ? activateWeatherPost(store, selection, publishDate, checkedAt) : { activated: false, reason: "目前沒有需要啟用的氣候貼文" };
    store.weatherAutomation = { version: VERSION, checkedAt, publishDate, selectedTrigger: selection?.trigger || "", summary: selection?.summary || "目前沒有需要啟用的氣候貼文", activation };
    writeStore(store); return { skipped: false, selection, activation };
  } catch (error) { console.error("Social weather automation failed", error.message); return { skipped: false, error: error.message }; }
  finally { weatherChecking = false; }
}

function startWeatherAutomation(readStore, writeStore) { if (weatherTimer) return weatherTimer; setTimeout(() => checkWeather(readStore, writeStore), 3000).unref?.(); weatherTimer = setInterval(() => checkWeather(readStore, writeStore), WEATHER_INTERVAL_MS); weatherTimer.unref?.(); return weatherTimer; }

function mount(app) {
  if (!app || app.__xjwFirstBatchAssetsMounted) return;
  Object.defineProperty(app, "__xjwFirstBatchAssetsMounted", { value: true });
  app.get(`${ROUTE_PREFIX}/:name`, async (req, res) => { const name = path.basename(String(req.params.name || "")); if (!CARE_SCENES[name] && !PRODUCT_SCENES[name]) return res.status(404).send("not found"); try { const buffer = await assetBuffer(name); return res.type("image/jpeg").set("Cache-Control", "public, max-age=604800, immutable").set("X-XJW-Asset-Version", CONTENT_VERSION).set("X-XJW-Image-Size", "1254x1254").send(buffer); } catch (error) { console.error("approved social asset failed", name, error.message); return res.status(500).send("asset failed"); } });
  app.get("/social/automation-healthz", async (_req, res) => { const assets = await Promise.all(POSTS.map((post) => assetInfo(post.imageName))); const result = { ok: assets.every((item) => item.ok) && validatePosts(POSTS), version: VERSION, contentVersion: CONTENT_VERSION, totalPosts: POSTS.length, fixedPosts: POSTS.filter((post) => !post.conditionalWeather).length, weatherStandbyPosts: POSTS.filter((post) => post.conditionalWeather).length, fixedRule: "週三、週五10:00", weatherRule: "依實際氣候於非週三、週五10:00加發；每週最多1篇", appButtonCodeChanged: false, assets }; res.status(result.ok ? 200 : 503).json(result); });
}

function install() {
  if (installed) return; installed = true; addApprovedHost(); validatePosts(POSTS);
  const originalLoad = Module._load;
  Module._load = function patchedLoad(request, parent, isMain) {
    const loaded = originalLoad.apply(this, arguments);
    if (request === "./server" && loaded?.app) mount(loaded.app);
    if (request === "./social-server" && loaded?.readStore && loaded?.writeStore && !socialHookAttached) {
      socialHookAttached = true;
      setImmediate(() => { try { console.log("First batch social schedule reconciliation", reconcile(loaded.readStore, loaded.writeStore)); startWeatherAutomation(loaded.readStore, loaded.writeStore); } catch (error) { console.error("First batch social setup failed", error.message); } });
      if (!reconcileTimer) { reconcileTimer = setInterval(() => { try { reconcile(loaded.readStore, loaded.writeStore); } catch (error) { console.error("First batch social reconciliation failed", error.message); } }, 30000); reconcileTimer.unref?.(); }
    }
    return loaded;
  };
}

install();

module.exports = { VERSION, CONTENT_VERSION, CAMPAIGN_ID, ROUTE_PREFIX, TARGET_IMAGE_SIZE, POSTS, CANONICAL_IDS, CARE_SCENES, PRODUCT_SCENES, assetUrl, fetchRemoteBuffer, careAssetBuffer, productAssetBuffer, assetBuffer, assetInfo, desiredPost, reconcileStore, reconcile, taipeiParts, dateKey, addDays, tenAt, weekdayForKey, isFixedPublishDate, nextWeatherDate, weatherUrl, selectWeather, weekKey, activateWeatherPost, checkWeather, startWeatherAutomation, mount, install };
