"use strict";

const Module = require("module");

const VERSION = "1.0.0";
const TAIPEI_TIME_ZONE = "Asia/Taipei";
const CHECK_INTERVAL_MS = Number(process.env.SOCIAL_WEATHER_CHECK_INTERVAL_MS || 60 * 60 * 1000);
const WEATHER_LATITUDE = Number(process.env.SOCIAL_WEATHER_LATITUDE || 25.038);
const WEATHER_LONGITUDE = Number(process.env.SOCIAL_WEATHER_LONGITUDE || 121.499);
const MASCOT_BASE = "https://raw.githubusercontent.com/TS15825868/TS-LINE/main/public/mascot";
const MASCOT_VERSION = "401.6-20260714";
const HOT_POST_ID = "weather-hot-care-20260721";

const CARE_IMAGES = new Map([
  ["first-batch-v2-care-work-rest-20260729", `${MASCOT_BASE}/faq.jpg?v=${MASCOT_VERSION}`],
  ["first-batch-v2-care-family-20260805", `${MASCOT_BASE}/brand.jpg?v=${MASCOT_VERSION}`],
  ["first-batch-v2-care-temperature-gap-20260812", `${MASCOT_BASE}/recommend.jpg?v=${MASCOT_VERSION}`],
  ["first-batch-v2-care-hydration-20260819", `${MASCOT_BASE}/usage.jpg?v=${MASCOT_VERSION}`],
  ["first-batch-v2-care-rainy-day-20260826", `${MASCOT_BASE}/welcome.jpg?v=${MASCOT_VERSION}`],
]);

const WEATHER_TRIGGERS = new Map([
  ["first-batch-v2-care-temperature-gap-20260812", "temperature-gap"],
  ["first-batch-v2-care-hydration-20260819", "hot"],
  ["first-batch-v2-care-rainy-day-20260826", "rain"],
]);

const FIRST_BATCH_IDS = new Set([
  "first-batch-v2-product-guilu-gao-20260724",
  "first-batch-v2-care-work-rest-20260729",
  "first-batch-v2-product-guilu-yin-30cc-20260731",
  "first-batch-v2-care-family-20260805",
  "first-batch-v2-product-lurongfen-75g-20260807",
  "first-batch-v2-care-temperature-gap-20260812",
  "first-batch-v2-product-tangkuai-75g-20260814",
  "first-batch-v2-care-hydration-20260819",
  "first-batch-v2-product-guilu-jiao-600g-20260821",
  "first-batch-v2-care-rainy-day-20260826",
]);

let installed = false;
let checking = false;
let timer = null;
let socialApi = null;

const nowIso = () => new Date().toISOString();

function taipeiParts(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: TAIPEI_TIME_ZONE,
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

function localDateKey(value = new Date()) {
  const parts = taipeiParts(value);
  return parts ? `${parts.year}-${parts.month}-${parts.day}` : "";
}

function weekKey(value) {
  const parts = taipeiParts(value);
  if (!parts) return "";
  const date = new Date(Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day)));
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() - day + 1);
  return date.toISOString().slice(0, 10);
}

function taipeiTenAt(dateKey) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateKey || ""));
  if (!match) return "";
  return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 2, 0, 0, 0)).toISOString();
}

function addDays(dateKey, days) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateKey || ""));
  if (!match) return "";
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]) + Number(days || 0)));
  return date.toISOString().slice(0, 10);
}

function nextWeatherPublishDate(now = new Date()) {
  const parts = taipeiParts(now);
  if (!parts) return "";
  const today = `${parts.year}-${parts.month}-${parts.day}`;
  const minutes = Number(parts.hour) * 60 + Number(parts.minute);
  return minutes < 9 * 60 + 45 ? today : addDays(today, 1);
}

function cancelOldHotPost(post, updatedAt) {
  if (String(post?.id || "") !== HOT_POST_ID || ["published", "cancelled"].includes(post.status)) return post;
  return {
    ...post,
    status: "cancelled",
    assetLocked: false,
    approvedAt: "",
    lastError: "已依指示取消；天氣貼文改由氣候條件自動啟用",
    updatedAt,
  };
}

function normalizeBatchStore(store, updatedAt = nowIso()) {
  store.posts = Array.isArray(store.posts) ? store.posts : [];
  let changed = 0;
  store.posts = store.posts.map((original) => {
    let post = cancelOldHotPost(original, updatedAt);
    if (post !== original) changed += 1;
    if (!FIRST_BATCH_IDS.has(String(post.id || "")) || post.status === "published") return post;

    const weatherTrigger = WEATHER_TRIGGERS.get(post.id) || "";
    const imageUrl = CARE_IMAGES.get(post.id) || post.imageUrl;
    const desired = {
      ...post,
      imageUrl,
      publishInstagram: true,
      publishFacebook: true,
      autoManaged: true,
      automationVersion: VERSION,
      contentVersion: "first-batch-full-auto-v1",
      updatedAt,
    };

    if (weatherTrigger) {
      Object.assign(desired, {
        conditionalWeather: true,
        weatherTrigger,
        oneTimeWeatherPost: false,
        status: "paused",
        assetLocked: true,
        approvedAt: desired.approvedAt || updatedAt,
        lastError: "等待符合氣候條件後自動安排上午10:00發文",
      });
    } else {
      Object.assign(desired, {
        conditionalWeather: false,
        status: ["failed", "partial"].includes(post.status) ? post.status : "approved",
        assetLocked: true,
        approvedAt: desired.approvedAt || updatedAt,
        lastError: ["failed", "partial"].includes(post.status) ? post.lastError : "",
      });
    }

    if (JSON.stringify(desired) !== JSON.stringify(post)) changed += 1;
    return desired;
  });

  store.socialFirstBatchFullAutoVersion = VERSION;
  store.socialFirstBatchFullAutoUpdatedAt = updatedAt;
  return { store, changed };
}

function reconcile(loaded = socialApi) {
  if (!loaded?.readStore || !loaded?.writeStore) return { changed: 0, count: 0 };
  const current = loaded.readStore();
  const result = normalizeBatchStore(current);
  if (result.changed || current.socialFirstBatchFullAutoVersion !== VERSION) loaded.writeStore(result.store);
  return {
    changed: result.changed,
    count: result.store.posts.filter((post) => FIRST_BATCH_IDS.has(String(post.id || ""))).length,
  };
}

function weatherUrl() {
  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.searchParams.set("latitude", String(WEATHER_LATITUDE));
  url.searchParams.set("longitude", String(WEATHER_LONGITUDE));
  url.searchParams.set("timezone", TAIPEI_TIME_ZONE);
  url.searchParams.set("forecast_days", "2");
  url.searchParams.set(
    "daily",
    "weather_code,temperature_2m_max,temperature_2m_min,apparent_temperature_max,precipitation_sum,precipitation_probability_max"
  );
  return url;
}

async function fetchForecast(fetchImpl = global.fetch) {
  if (typeof fetchImpl !== "function") throw new Error("fetch unavailable");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);
  timeout.unref?.();
  try {
    const response = await fetchImpl(weatherUrl(), { signal: controller.signal, headers: { Accept: "application/json" } });
    if (!response.ok) throw new Error(`weather HTTP ${response.status}`);
    const data = await response.json();
    if (!Array.isArray(data?.daily?.time)) throw new Error("weather response invalid");
    return data.daily;
  } finally {
    clearTimeout(timeout);
  }
}

function forecastDay(daily, dateKey) {
  const index = daily?.time?.indexOf(dateKey) ?? -1;
  if (index < 0) return null;
  const value = (key) => Number(daily?.[key]?.[index]);
  return {
    date: dateKey,
    weatherCode: value("weather_code"),
    temperatureMax: value("temperature_2m_max"),
    temperatureMin: value("temperature_2m_min"),
    apparentMax: value("apparent_temperature_max"),
    precipitationSum: value("precipitation_sum"),
    precipitationProbability: value("precipitation_probability_max"),
  };
}

function chooseWeatherTrigger(day) {
  if (!day) return null;
  const rainCode = Number(day.weatherCode) >= 51;
  if (rainCode || day.precipitationProbability >= 60 || day.precipitationSum >= 5) {
    return { trigger: "rain", summary: `降雨機率${day.precipitationProbability}%／預估雨量${day.precipitationSum}mm` };
  }
  if (day.apparentMax >= 34 || day.temperatureMax >= 32) {
    return { trigger: "hot", summary: `最高${day.temperatureMax}°C／體感最高${day.apparentMax}°C` };
  }
  if (day.temperatureMax - day.temperatureMin >= 8) {
    return { trigger: "temperature-gap", summary: `高低溫差${(day.temperatureMax - day.temperatureMin).toFixed(1)}°C` };
  }
  return null;
}

function hasWeatherPostThisWeek(posts, scheduledAt, currentId = "") {
  const targetWeek = weekKey(scheduledAt);
  return posts.some((post) =>
    post.id !== currentId &&
    post.oneTimeWeatherPost === true &&
    ["approved", "publishing", "published", "failed", "partial"].includes(post.status) &&
    weekKey(post.scheduledAt) === targetWeek
  );
}

function activateWeatherPost(store, selection, scheduledAt, updatedAt = nowIso()) {
  const index = store.posts.findIndex((post) => post.weatherTrigger === selection.trigger && post.conditionalWeather === true);
  if (index < 0) return { changed: false, post: null };
  const current = store.posts[index];
  if (current.status === "published" || hasWeatherPostThisWeek(store.posts, scheduledAt, current.id)) {
    return { changed: false, post: current };
  }
  store.posts[index] = {
    ...current,
    status: "approved",
    assetLocked: true,
    approvedAt: current.approvedAt || updatedAt,
    scheduledAt,
    oneTimeWeatherPost: true,
    weatherActivatedAt: updatedAt,
    weatherConditionSummary: selection.summary,
    lastError: "",
    updatedAt,
  };
  return { changed: true, post: store.posts[index] };
}

async function checkWeather(loaded = socialApi, options = {}) {
  if (checking || !loaded?.readStore || !loaded?.writeStore) return { skipped: true };
  checking = true;
  try {
    reconcile(loaded);
    const publishDate = nextWeatherPublishDate(options.now || new Date());
    const daily = options.daily || await fetchForecast(options.fetchImpl || global.fetch);
    const day = forecastDay(daily, publishDate);
    const selection = chooseWeatherTrigger(day);
    const store = loaded.readStore();
    const checkedAt = nowIso();
    store.weatherAutomation = {
      version: VERSION,
      checkedAt,
      publishDate,
      day,
      selectedTrigger: selection?.trigger || "",
      summary: selection?.summary || "目前沒有需要啟用的氣候貼文",
    };
    if (!selection) {
      loaded.writeStore(store);
      return { skipped: false, activated: false, publishDate, day };
    }
    const scheduledAt = taipeiTenAt(publishDate);
    const activated = activateWeatherPost(store, selection, scheduledAt, checkedAt);
    loaded.writeStore(store);
    return { skipped: false, activated: activated.changed, postId: activated.post?.id || "", scheduledAt, selection };
  } catch (error) {
    console.error("Social weather automation failed", error.message);
    return { skipped: false, activated: false, error: error.message };
  } finally {
    checking = false;
  }
}

function install() {
  if (installed) return;
  installed = true;
  const previousLoad = Module._load;
  Module._load = function patchedLoad(request, parent, isMain) {
    const loaded = previousLoad.apply(this, arguments);
    if (request === "./social-server" && parent?.filename?.endsWith("internal-entry.js") && loaded?.readStore && loaded?.writeStore) {
      socialApi = loaded;
      setTimeout(() => {
        try {
          const result = reconcile(loaded);
          console.log("First social batch full automation reconciled", result);
        } catch (error) {
          console.error("First social batch full automation setup failed", error);
        }
      }, 1800).unref?.();
      setTimeout(() => checkWeather(loaded), 5000).unref?.();
      if (!timer) {
        timer = setInterval(() => checkWeather(loaded), CHECK_INTERVAL_MS);
        timer.unref?.();
      }
      loaded.app?.get?.("/internal/social-full-auto-healthz", (_req, res) => {
        const store = loaded.readStore();
        const batch = store.posts.filter((post) => FIRST_BATCH_IDS.has(String(post.id || "")));
        res.json({
          ok: true,
          version: VERSION,
          count: batch.length,
          approved: batch.filter((post) => post.status === "approved").length,
          conditional: batch.filter((post) => post.conditionalWeather).length,
          published: batch.filter((post) => post.status === "published").length,
          weatherAutomation: store.weatherAutomation || null,
          checkedAt: nowIso(),
        });
      });
    }
    return loaded;
  };
}

install();

module.exports = {
  VERSION,
  CARE_IMAGES,
  WEATHER_TRIGGERS,
  FIRST_BATCH_IDS,
  taipeiParts,
  localDateKey,
  weekKey,
  taipeiTenAt,
  addDays,
  nextWeatherPublishDate,
  normalizeBatchStore,
  reconcile,
  weatherUrl,
  forecastDay,
  chooseWeatherTrigger,
  activateWeatherPost,
  checkWeather,
  install,
};
