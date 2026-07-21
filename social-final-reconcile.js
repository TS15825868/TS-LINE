"use strict";

const Module = require("module");

const VERSION = "3.0.0";
const CAMPAIGN_ID = "xjw-social-first-batch-202607-v2";
const CARE_BASE = "https://raw.githubusercontent.com/TS15825868/TS-LINE/main/public/social/first-batch";
const CHECK_INTERVAL_MS = 60 * 60 * 1000;
const RECONCILE_INTERVAL_MS = 20 * 1000;
const HOT_POST_ID = "weather-hot-care-20260721";

const CANONICAL = new Map([
  ["first-batch-v2-care-work-rest-20260729", {
    scheduledAt: "2026-07-22T02:00:00.000Z",
    imageUrl: `${CARE_BASE}/care-work-rest-2026-07-29.jpg?v=final-approved-v1`,
    weatherTrigger: "",
  }],
  ["first-batch-v2-product-guilu-gao-20260724", {
    scheduledAt: "2026-07-24T12:00:00.000Z",
  }],
  ["first-batch-v2-care-family-20260805", {
    scheduledAt: "2026-07-29T02:00:00.000Z",
    imageUrl: `${CARE_BASE}/care-family-2026-08-05.jpg?v=final-approved-v1`,
    weatherTrigger: "",
  }],
  ["first-batch-v2-product-guilu-yin-30cc-20260731", {
    scheduledAt: "2026-07-31T12:00:00.000Z",
  }],
  ["first-batch-v2-care-temperature-gap-20260812", {
    scheduledAt: "2026-08-05T02:00:00.000Z",
    imageUrl: `${CARE_BASE}/care-temperature-gap-2026-08-12.jpg?v=final-approved-v1`,
    weatherTrigger: "temperature-gap",
  }],
  ["first-batch-v2-product-lurongfen-75g-20260807", {
    scheduledAt: "2026-08-07T12:00:00.000Z",
  }],
  ["first-batch-v2-care-hydration-20260819", {
    scheduledAt: "2026-08-12T02:00:00.000Z",
    imageUrl: `${CARE_BASE}/care-hydration-2026-08-19.jpg?v=final-approved-v1`,
    weatherTrigger: "hot",
  }],
  ["first-batch-v2-product-tangkuai-75g-20260814", {
    scheduledAt: "2026-08-14T12:00:00.000Z",
  }],
  ["first-batch-v2-care-rainy-day-20260826", {
    scheduledAt: "2026-08-19T02:00:00.000Z",
    imageUrl: `${CARE_BASE}/care-rainy-day-2026-08-26.jpg?v=final-approved-v1`,
    weatherTrigger: "rain",
  }],
  ["first-batch-v2-product-guilu-jiao-600g-20260821", {
    scheduledAt: "2026-08-21T12:00:00.000Z",
  }],
]);

const TITLES = new Set([
  "工作再忙，也別忘了休息一下",
  "龜鹿膏100g｜依日常節奏慢慢安排",
  "照顧自己，也別忘了關心家人",
  "龜鹿飲30cc｜輕巧瓶裝，外出攜帶方便",
  "早晚溫差大，出門多帶一件薄外套",
  "鹿茸粉75g｜依自己的飲食習慣搭配",
  "天氣炎熱，記得分次補充水分",
  "龜鹿湯塊75g｜8塊裝，沖泡料理都方便",
  "下雨天在家，也別忘了留一點暖身時間",
  "龜鹿膠600g｜家庭規格，依日常慢慢安排",
]);
const TITLE_KEYS = new Set([...TITLES].map((value) => value.replace(/\s+/g, "")));
const OLD_CAMPAIGNS = new Set([
  "xjw-approved-zip-202607-v1",
  "xjw-social-first-batch-202607-v1",
  "xjw-official-social-v1",
]);

let installed = false;
let socialApi = null;
let reconciling = false;
let weatherChecking = false;
let reconcileTimer = null;
let weatherTimer = null;

const nowIso = () => new Date().toISOString();
const titleKey = (value) => String(value || "").replace(/\s+/g, "");
const isPublished = (post) => String(post?.status || "") === "published";

function isDuplicate(post) {
  if (!post || isPublished(post) || CANONICAL.has(String(post.id || ""))) return false;
  const id = String(post.id || "");
  const campaign = String(post.campaignId || "");
  return id === HOT_POST_ID ||
    OLD_CAMPAIGNS.has(campaign) ||
    (campaign === CAMPAIGN_ID && !CANONICAL.has(id)) ||
    /^(?:approved-mascot-original-|social-v2-|official-social-|first-batch-(?!v2-)|auto-knowledge-)/.test(id) ||
    TITLE_KEYS.has(titleKey(post.title));
}

function cancelled(post, updatedAt) {
  return {
    ...post,
    status: "cancelled",
    assetLocked: false,
    approvedAt: "",
    lastError: "已由正式5篇關心＋5篇產品社群排程取代",
    updatedAt,
  };
}

function reconcileStore(store, updatedAt = nowIso()) {
  store.posts = Array.isArray(store.posts) ? store.posts : [];
  let changed = 0;

  store.posts = store.posts.map((original) => {
    if (isDuplicate(original)) {
      changed += 1;
      return cancelled(original, updatedAt);
    }

    const config = CANONICAL.get(String(original?.id || ""));
    if (!config || isPublished(original)) return original;

    const activatedWeather = Boolean(
      config.weatherTrigger &&
      original.oneTimeWeatherPost === true &&
      ["approved", "publishing", "failed", "partial"].includes(String(original.status || ""))
    );

    const desired = {
      ...original,
      campaignId: CAMPAIGN_ID,
      campaignVersion: VERSION,
      contentVersion: "final-ten-approved-images-v3",
      scheduledAt: activatedWeather ? original.scheduledAt : config.scheduledAt,
      imageUrl: config.imageUrl || original.imageUrl,
      publishInstagram: true,
      publishFacebook: true,
      autoManaged: true,
      automationVersion: VERSION,
      assetLocked: true,
      approvedAt: original.approvedAt || updatedAt,
      updatedAt,
    };

    if (config.weatherTrigger && !activatedWeather) {
      Object.assign(desired, {
        conditionalWeather: true,
        weatherTrigger: config.weatherTrigger,
        oneTimeWeatherPost: false,
        status: "paused",
        lastError: "氣候待命素材：符合萬華實際氣候時，才會自動安排上午10:00發文",
      });
    } else {
      Object.assign(desired, {
        conditionalWeather: Boolean(config.weatherTrigger),
        status: ["failed", "partial", "publishing"].includes(String(original.status || ""))
          ? original.status
          : "approved",
        lastError: ["failed", "partial"].includes(String(original.status || ""))
          ? original.lastError
          : "",
      });
    }

    if (JSON.stringify(desired) !== JSON.stringify(original)) changed += 1;
    return desired;
  });

  store.socialFinalReconcileVersion = VERSION;
  store.socialFinalReconcileUpdatedAt = updatedAt;
  store.socialFinalCanonicalCount = CANONICAL.size;
  return { store, changed };
}

function reconcile(loaded = socialApi) {
  if (reconciling || !loaded?.readStore || !loaded?.writeStore) return { skipped: true };
  reconciling = true;
  try {
    const store = loaded.readStore();
    const oldVersion = store.socialFinalReconcileVersion;
    const result = reconcileStore(store);
    if (result.changed || oldVersion !== VERSION) loaded.writeStore(result.store);
    return {
      skipped: false,
      changed: result.changed,
      canonical: result.store.posts.filter((post) => CANONICAL.has(String(post.id || "")) && post.status !== "cancelled").length,
      approved: result.store.posts.filter((post) => CANONICAL.has(String(post.id || "")) && post.status === "approved").length,
      paused: result.store.posts.filter((post) => CANONICAL.has(String(post.id || "")) && post.status === "paused").length,
    };
  } finally {
    reconciling = false;
  }
}

function taipeiParts(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return Object.fromEntries(new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date).filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
}

function addDays(dateKey, days) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateKey || ""));
  if (!match) return "";
  return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]) + Number(days || 0))).toISOString().slice(0, 10);
}

function nextPublishDate(now = new Date()) {
  const parts = taipeiParts(now);
  if (!parts) return "";
  const today = `${parts.year}-${parts.month}-${parts.day}`;
  return Number(parts.hour) * 60 + Number(parts.minute) < 585 ? today : addDays(today, 1);
}

function tenAt(dateKey) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateKey || ""));
  if (!match) return "";
  return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 2, 0, 0, 0)).toISOString();
}

function weatherUrl() {
  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.searchParams.set("latitude", "25.038");
  url.searchParams.set("longitude", "121.499");
  url.searchParams.set("timezone", "Asia/Taipei");
  url.searchParams.set("forecast_days", "2");
  url.searchParams.set("daily", "weather_code,temperature_2m_max,temperature_2m_min,apparent_temperature_max,precipitation_sum,precipitation_probability_max");
  return url;
}

function selectWeather(daily, dateKey) {
  const index = daily?.time?.indexOf(dateKey) ?? -1;
  if (index < 0) return null;
  const num = (key) => Number(daily?.[key]?.[index]);
  const code = num("weather_code");
  const max = num("temperature_2m_max");
  const min = num("temperature_2m_min");
  const apparent = num("apparent_temperature_max");
  const rain = num("precipitation_sum");
  const probability = num("precipitation_probability_max");
  if (code >= 51 || probability >= 60 || rain >= 5) return { trigger: "rain", summary: `降雨機率${probability}%／預估雨量${rain}mm` };
  if (apparent >= 34 || max >= 32) return { trigger: "hot", summary: `最高${max}°C／體感最高${apparent}°C` };
  if (max - min >= 8) return { trigger: "temperature-gap", summary: `高低溫差${(max - min).toFixed(1)}°C` };
  return null;
}

async function checkWeather(loaded = socialApi) {
  if (weatherChecking || !loaded?.readStore || !loaded?.writeStore || typeof fetch !== "function") return { skipped: true };
  weatherChecking = true;
  try {
    reconcile(loaded);
    const publishDate = nextPublishDate();
    const response = await fetch(weatherUrl(), { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(12000) });
    if (!response.ok) throw new Error(`weather HTTP ${response.status}`);
    const data = await response.json();
    const selection = selectWeather(data.daily, publishDate);
    const store = loaded.readStore();
    const checkedAt = nowIso();
    store.weatherAutomation = {
      version: VERSION,
      checkedAt,
      publishDate,
      selectedTrigger: selection?.trigger || "",
      summary: selection?.summary || "目前沒有需要啟用的氣候貼文",
    };
    if (selection) {
      const index = store.posts.findIndex((post) => post.conditionalWeather === true && post.weatherTrigger === selection.trigger && post.status === "paused");
      if (index >= 0) {
        store.posts[index] = {
          ...store.posts[index],
          status: "approved",
          assetLocked: true,
          approvedAt: store.posts[index].approvedAt || checkedAt,
          scheduledAt: tenAt(publishDate),
          oneTimeWeatherPost: true,
          weatherActivatedAt: checkedAt,
          weatherConditionSummary: selection.summary,
          lastError: "",
          updatedAt: checkedAt,
        };
      }
    }
    loaded.writeStore(store);
    return { skipped: false, activated: Boolean(selection), selection };
  } catch (error) {
    console.error("Social weather check failed", error.message);
    return { skipped: false, activated: false, error: error.message };
  } finally {
    weatherChecking = false;
  }
}

function officialRebuildNoop() {
  return {
    campaignId: CAMPAIGN_ID,
    imageVersion: "final-approved-v1",
    preservedPublished: 0,
    removedUnpublished: 0,
    inserted: 0,
    updated: 0,
    pendingReview: 0,
    activeTotal: CANONICAL.size,
    firstAt: "2026-07-22T02:00:00.000Z",
    lastAt: "2026-08-21T12:00:00.000Z",
    signature: `social-final-${VERSION}`,
  };
}

function install() {
  if (installed) return;
  installed = true;
  const previousLoad = Module._load;
  Module._load = function finalSocialLoader(request, parent, isMain) {
    const loaded = previousLoad.apply(this, arguments);
    if (request === "./social-official-rebuild" && loaded?.rebuildOfficialSocialSchedule) {
      loaded.rebuildOfficialSocialSchedule = officialRebuildNoop;
    }
    if (request === "./social-server" && loaded?.readStore && loaded?.writeStore) {
      socialApi = loaded;
      setImmediate(() => {
        try { console.log("Final social reconciliation", reconcile(loaded)); }
        catch (error) { console.error("Final social reconciliation failed", error.message); }
        checkWeather(loaded).then((result) => console.log("Weather social automation", result));
      });
      setTimeout(() => {
        try { reconcile(loaded); }
        catch (error) { console.error("Delayed social reconciliation failed", error.message); }
      }, 1800).unref?.();
      if (!reconcileTimer) {
        reconcileTimer = setInterval(() => {
          try { reconcile(loaded); }
          catch (error) { console.error("Social reconciliation retry failed", error.message); }
        }, RECONCILE_INTERVAL_MS);
        reconcileTimer.unref?.();
      }
      if (!weatherTimer) {
        weatherTimer = setInterval(() => checkWeather(loaded), CHECK_INTERVAL_MS);
        weatherTimer.unref?.();
      }
    }
    return loaded;
  };
}

install();

module.exports = {
  VERSION,
  CANONICAL,
  reconcileStore,
  reconcile,
  selectWeather,
  checkWeather,
  officialRebuildNoop,
  install,
};
