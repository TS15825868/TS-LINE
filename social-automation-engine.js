"use strict";

const Module = require("module");
const schedulePolicy = require("./social-schedule-policy");
const firstBatch = require("./social-first-batch-202607");
const { requireSignedIn } = require("./internal-app-security-patch");

const VERSION = "1.0.0";
const CAMPAIGN_ID = "xjw-social-automation-v1";
const MIN_READY_PER_ROLE = Math.max(1, Number(process.env.SOCIAL_MIN_READY_PER_ROLE || 5));
const RECONCILE_MS = Math.max(60_000, Number(process.env.SOCIAL_AUTOMATION_RECONCILE_MS || 5 * 60_000));
const WEATHER_CHECK_MS = Math.max(15 * 60_000, Number(process.env.SOCIAL_WEATHER_CHECK_MS || 30 * 60_000));
const WEATHER_START_MS = new Date(process.env.SOCIAL_WEATHER_AUTOMATION_START_AT || "2026-07-22T00:00:00+08:00").getTime();
const WANHUA_LAT = Number(process.env.SOCIAL_WEATHER_LATITUDE || 25.0354);
const WANHUA_LON = Number(process.env.SOCIAL_WEATHER_LONGITUDE || 121.4997);
const LEGACY_HOT_POST_ID = "weather-hot-care-20260721";
const ACTIVE = new Set(["draft", "approved", "paused", "publishing", "failed", "partial"]);
const READY = new Set(["approved", "failed", "partial"]);

const GENERAL_CARE_TEMPLATES = firstBatch.POSTS.filter(
  (post) => post.sequenceRole === "care" && post.category === "日常關心"
);
const PRODUCT_TEMPLATES = firstBatch.POSTS.filter((post) => post.sequenceRole !== "care");
const WEATHER_TEMPLATES = Object.freeze({
  hot: firstBatch.POSTS.find((post) => /hydration|炎熱|補充水分/.test(`${post.id} ${post.title}`)),
  rain: firstBatch.POSTS.find((post) => /rainy|下雨/.test(`${post.id} ${post.title}`)),
  gap: firstBatch.POSTS.find((post) => /temperature-gap|溫差/.test(`${post.id} ${post.title}`)),
});
const WEATHER_TEMPLATE_IDS = new Set(Object.values(WEATHER_TEMPLATES).filter(Boolean).map((post) => post.id));

let installed = false;
let socialLoaded = null;
let reconcileTimer = null;
let weatherTimer = null;
let reconciling = false;
let weatherChecking = false;
let lastWeather = null;
let lastWeatherError = "";
let lastWeatherCheckedAt = "";
let lastReconciledAt = "";

const nowIso = () => new Date().toISOString();

function dateKeyInTaipei(value = Date.now()) {
  const date = new Date(value);
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Taipei",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    })
      .formatToParts(date)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value])
  );
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function scheduledIso(dateKey, hour) {
  const [year, month, day] = String(dateKey).split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day, Number(hour) - 8, 0, 0, 0)).toISOString();
}

function addDays(dateKey, days) {
  const [year, month, day] = String(dateKey).split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + Number(days));
  return date.toISOString().slice(0, 10);
}

function weekday(dateKey) {
  const [year, month, day] = String(dateKey).split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

function nextDateForWeekday(fromDateKey, targetDay, includeToday = true) {
  const current = weekday(fromDateKey);
  let distance = (targetDay - current + 7) % 7;
  if (!includeToday && distance === 0) distance = 7;
  return addDays(fromDateKey, distance);
}

function roleOf(post = {}) {
  return schedulePolicy.isCarePost(post) ? "care" : "product";
}

function isFuture(post, nowMs = Date.now()) {
  const time = new Date(post?.scheduledAt).getTime();
  return Number.isFinite(time) && time > nowMs;
}

function isActiveReady(post, nowMs = Date.now()) {
  return Boolean(
    post &&
      !post.automationStandby &&
      ACTIVE.has(post.status) &&
      post.status !== "cancelled" &&
      isFuture(post, nowMs)
  );
}

function classifyForecast(payload, dayIndex = 0) {
  const daily = payload?.daily || {};
  const value = (name) => Number(Array.isArray(daily[name]) ? daily[name][dayIndex] : NaN);
  const temperatureMax = value("temperature_2m_max");
  const temperatureMin = value("temperature_2m_min");
  const apparentMax = value("apparent_temperature_max");
  const precipitation = value("precipitation_sum");
  const precipitationProbability = value("precipitation_probability_max");
  const weatherCode = value("weather_code");
  const temperatureGap = temperatureMax - temperatureMin;

  let type = "";
  if (
    precipitationProbability >= 65 ||
    precipitation >= 8 ||
    (weatherCode >= 51 && weatherCode <= 99)
  ) type = "rain";
  else if (apparentMax >= 34 || temperatureMax >= 33) type = "hot";
  else if (temperatureGap >= 8) type = "gap";

  return {
    type,
    date: Array.isArray(daily.time) ? String(daily.time[dayIndex] || "") : "",
    temperatureMax,
    temperatureMin,
    apparentMax,
    precipitation,
    precipitationProbability,
    weatherCode,
    temperatureGap,
  };
}

async function fetchWeatherForecast() {
  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.searchParams.set("latitude", String(WANHUA_LAT));
  url.searchParams.set("longitude", String(WANHUA_LON));
  url.searchParams.set(
    "daily",
    "temperature_2m_max,temperature_2m_min,apparent_temperature_max,precipitation_sum,precipitation_probability_max,weather_code"
  );
  url.searchParams.set("timezone", "Asia/Taipei");
  url.searchParams.set("forecast_days", "3");

  const response = await fetch(url, {
    headers: { Accept: "application/json", "User-Agent": "XianJiaWei-Social-Automation/1.0" },
    signal: AbortSignal.timeout(8_000),
  });
  if (!response.ok) throw new Error(`天氣資料 HTTP ${response.status}`);
  const data = await response.json();
  if (!Array.isArray(data?.daily?.time)) throw new Error("天氣資料格式不完整");
  return data;
}

function history(action, detail = "") {
  return [{
    id: `auto-${Date.now().toString(36)}-${Math.random().toString(16).slice(2, 8)}`,
    action,
    detail,
    createdAt: nowIso(),
  }];
}

function templateInstance(template, dateKey, role, sequence = 0) {
  const hour = role === "care" ? 10 : 20;
  const scheduledAt = scheduledIso(dateKey, hour);
  return {
    ...template,
    id: `auto-${role}-${dateKey}-${sequence}`,
    campaignId: CAMPAIGN_ID,
    campaignVersion: VERSION,
    contentVersion: `approved-template-${firstBatch.CONTENT_VERSION}`,
    sequenceRole: role,
    scheduledAt,
    publishInstagram: true,
    publishFacebook: true,
    assetLocked: true,
    status: "approved",
    approvedAt: nowIso(),
    result: {},
    lastError: "",
    automationManaged: true,
    manualScheduleOverride: false,
    autoTemplateId: template.id,
    history: history("自動補入排程", `${role === "care" ? "關心貼文 10:00" : "其他貼文 20:00"}；使用已核准正式素材`),
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
}

function weatherInstance(template, forecast, scheduledAt) {
  const dateKey = dateKeyInTaipei(scheduledAt);
  return {
    ...template,
    id: `auto-weather-${forecast.type}-${dateKey}`,
    campaignId: CAMPAIGN_ID,
    campaignVersion: VERSION,
    contentVersion: `weather-${forecast.type}-${dateKey}`,
    sequenceRole: "care",
    category: "氣候關心",
    scheduledAt,
    publishInstagram: true,
    publishFacebook: true,
    assetLocked: true,
    status: "approved",
    approvedAt: nowIso(),
    result: {},
    lastError: "",
    automationManaged: true,
    manualScheduleOverride: false,
    oneTimeWeatherPost: true,
    weatherTriggerType: forecast.type,
    weatherForecast: forecast,
    history: history("依氣候自動排程", `萬華氣候判定：${forecast.type}；上午 10:00 發布並替換本週一般關心貼文`),
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
}

function sameSlot(a, b) {
  const at = new Date(a).getTime();
  const bt = new Date(b).getTime();
  return Number.isFinite(at) && at === bt;
}

function cancelLegacyHotPost(store) {
  const post = store.posts.find((item) => item.id === LEGACY_HOT_POST_ID);
  if (!post || ["published", "cancelled"].includes(post.status)) return 0;
  Object.assign(post, {
    status: "cancelled",
    assetLocked: false,
    approvedAt: "",
    lastError: "已停止固定發送；改由萬華實際氣候變化自動判斷",
    updatedAt: nowIso(),
  });
  return 1;
}

function prepareFirstBatch(store, nowMs = Date.now()) {
  let changed = 0;
  for (const template of firstBatch.POSTS) {
    const post = store.posts.find((item) => item.id === template.id);
    if (!post || ["published", "cancelled"].includes(post.status)) continue;

    if (WEATHER_TEMPLATE_IDS.has(post.id)) {
      if (post.status !== "paused" || post.automationStandby !== true || post.assetLocked !== false) {
        Object.assign(post, {
          status: "paused",
          assetLocked: false,
          approvedAt: "",
          automationStandby: true,
          weatherTemplateOnly: true,
          lastError: "氣候待命素材：只有符合萬華實際氣候時才會自動建立發文",
          updatedAt: nowIso(),
        });
        changed += 1;
      }
      continue;
    }

    if (new Date(post.scheduledAt).getTime() <= nowMs) continue;
    if (post.status !== "approved" || post.assetLocked !== true || post.automationManaged !== true) {
      Object.assign(post, {
        status: "approved",
        assetLocked: true,
        approvedAt: post.approvedAt || nowIso(),
        automationManaged: true,
        manualScheduleOverride: Boolean(post.manualScheduleOverride),
        lastError: "",
        updatedAt: nowIso(),
      });
      changed += 1;
    }
  }
  return changed;
}

function occupiedSlot(store, scheduledAt) {
  return store.posts.some(
    (post) => !post.automationStandby && post.status !== "cancelled" && sameSlot(post.scheduledAt, scheduledAt)
  );
}

function futureReady(store, role, nowMs = Date.now()) {
  return store.posts
    .filter((post) => isActiveReady(post, nowMs) && roleOf(post) === role)
    .sort((a, b) => new Date(a.scheduledAt) - new Date(b.scheduledAt));
}

function ensureRoleQueue(store, role, nowMs = Date.now()) {
  const templates = role === "care" ? GENERAL_CARE_TEMPLATES : PRODUCT_TEMPLATES;
  if (!templates.length) return 0;

  let ready = futureReady(store, role, nowMs);
  let changed = 0;
  let cursor = dateKeyInTaipei(nowMs + 60 * 60 * 1000);
  const targetWeekday = role === "care" ? 3 : 5;
  cursor = nextDateForWeekday(cursor, targetWeekday, true);
  let safety = 0;

  while (ready.length < MIN_READY_PER_ROLE && safety < 80) {
    safety += 1;
    const scheduledAt = scheduledIso(cursor, role === "care" ? 10 : 20);
    const scheduledMs = new Date(scheduledAt).getTime();
    if (scheduledMs > nowMs && !occupiedSlot(store, scheduledAt)) {
      const sequence = store.posts.filter((post) => post.campaignId === CAMPAIGN_ID && roleOf(post) === role).length;
      const template = templates[sequence % templates.length];
      const post = templateInstance(template, cursor, role, sequence);
      store.posts.push(post);
      ready.push(post);
      changed += 1;
    }
    cursor = addDays(cursor, 7);
  }
  return changed;
}

function automationSummary(store, nowMs = Date.now()) {
  const care = futureReady(store, "care", nowMs);
  const product = futureReady(store, "product", nowMs);
  const standby = store.posts.filter((post) => post.automationStandby && post.status === "paused").length;
  return {
    ok: true,
    version: VERSION,
    mode: "full-auto",
    careRule: "關心貼文上午 10:00",
    productRule: "其他貼文晚上 20:00",
    weeklyRule: "每週最多 2 篇；氣候貼文替換當週關心篇，不額外增加",
    careReady: care.length,
    productReady: product.length,
    weatherStandby: standby,
    nextCareAt: care[0]?.scheduledAt || "",
    nextProductAt: product[0]?.scheduledAt || "",
    lastWeather,
    lastWeatherError,
    lastWeatherCheckedAt,
    lastReconciledAt,
    checkedAt: nowIso(),
  };
}

function reconcileStore(loaded, nowMs = Date.now()) {
  const store = loaded.readStore();
  store.posts = Array.isArray(store.posts) ? store.posts : [];
  let changed = 0;
  changed += cancelLegacyHotPost(store);
  changed += prepareFirstBatch(store, nowMs);
  changed += ensureRoleQueue(store, "care", nowMs);
  changed += ensureRoleQueue(store, "product", nowMs);
  lastReconciledAt = nowIso();
  store.socialAutomationVersion = VERSION;
  store.socialAutomationMode = "full-auto";
  store.socialAutomationUpdatedAt = lastReconciledAt;
  store.socialAutomationSummary = automationSummary(store, nowMs);
  if (changed) loaded.writeStore(store);
  return { changed, summary: automationSummary(store, nowMs) };
}

function targetWeatherSlot(nowMs = Date.now()) {
  const parts = schedulePolicy.taipeiParts(nowMs);
  const minutes = Number(parts.hour) * 60 + Number(parts.minute);
  const useTomorrow = minutes >= 9 * 60 + 40;
  const dateKey = addDays(dateKeyInTaipei(nowMs), useTomorrow ? 1 : 0);
  return {
    dayIndex: useTomorrow ? 1 : 0,
    dateKey,
    scheduledAt: scheduledIso(dateKey, 10),
  };
}

function hasCareInWeek(store, week, statuses = ["approved", "publishing", "published", "failed", "partial"]) {
  const allowed = new Set(statuses);
  return store.posts.some(
    (post) =>
      !post.automationStandby &&
      allowed.has(post.status) &&
      roleOf(post) === "care" &&
      schedulePolicy.weekKey(post.scheduledAt) === week
  );
}

function installWeatherPost(loaded, forecast, slot) {
  const template = WEATHER_TEMPLATES[forecast.type];
  if (!template) return { changed: 0, reason: "沒有對應氣候素材" };

  const store = loaded.readStore();
  store.posts = Array.isArray(store.posts) ? store.posts : [];
  const week = schedulePolicy.weekKey(slot.scheduledAt);
  const id = `auto-weather-${forecast.type}-${slot.dateKey}`;
  if (store.posts.some((post) => post.id === id && post.status !== "cancelled")) {
    return { changed: 0, reason: "同一氣候貼文已存在" };
  }
  if (hasCareInWeek(store, week, ["publishing", "published"])) {
    return { changed: 0, reason: "本週關心貼文已發布" };
  }

  let changed = 0;
  for (const post of store.posts) {
    if (
      post.status !== "cancelled" &&
      !post.automationStandby &&
      roleOf(post) === "care" &&
      schedulePolicy.weekKey(post.scheduledAt) === week
    ) {
      Object.assign(post, {
        status: "cancelled",
        assetLocked: false,
        approvedAt: "",
        lastError: "已由本週即時氣候關心貼文替換",
        updatedAt: nowIso(),
      });
      changed += 1;
    }
  }

  const weatherPost = weatherInstance(template, forecast, slot.scheduledAt);
  store.posts.push(weatherPost);
  changed += 1;
  store.lastWeatherAutomation = {
    type: forecast.type,
    scheduledAt: slot.scheduledAt,
    forecast,
    createdAt: nowIso(),
  };
  loaded.writeStore(store);
  reconcileStore(loaded);
  return { changed, post: weatherPost };
}

async function checkWeatherAndSchedule(loaded, nowMs = Date.now()) {
  if (weatherChecking) return { skipped: true, reason: "running" };
  if (nowMs < WEATHER_START_MS) return { skipped: true, reason: "not-started" };
  weatherChecking = true;
  try {
    const slot = targetWeatherSlot(nowMs);
    const forecastPayload = await fetchWeatherForecast();
    const forecast = classifyForecast(forecastPayload, slot.dayIndex);
    lastWeather = forecast;
    lastWeatherError = "";
    lastWeatherCheckedAt = nowIso();
    if (!forecast.type) return { skipped: true, reason: "no-trigger", forecast };
    return { skipped: false, forecast, ...installWeatherPost(loaded, forecast, slot) };
  } catch (error) {
    lastWeatherError = error.message || "天氣檢查失敗";
    lastWeatherCheckedAt = nowIso();
    console.error("social weather automation failed", lastWeatherError);
    return { skipped: true, reason: "error", error: lastWeatherError };
  } finally {
    weatherChecking = false;
  }
}

async function runAutomation(loaded = socialLoaded) {
  if (!loaded || reconciling) return { skipped: true };
  reconciling = true;
  try {
    const reconciled = reconcileStore(loaded);
    const weather = await checkWeatherAndSchedule(loaded);
    return { skipped: false, reconciled, weather };
  } finally {
    reconciling = false;
  }
}

const CLIENT = String.raw`(() => {
  "use strict";
  async function refreshAutomation() {
    try {
      const response = await fetch("/internal/api/v2/social/automation", {
        cache: "no-store",
        headers: { "X-XJW-Requested-With": "internal-app-v2" },
      });
      if (!response.ok) return;
      const data = await response.json();
      const list = document.getElementById("socialList");
      if (!list) return;
      let panel = document.getElementById("xjwSocialAutomationPanel");
      if (!panel) {
        panel = document.createElement("section");
        panel.id = "xjwSocialAutomationPanel";
        panel.style.cssText = "margin:12px 0;padding:14px;border:1px solid #c8a24d;border-radius:14px;background:#fffaf0;line-height:1.7";
        list.parentElement?.insertBefore(panel, list);
      }
      const weather = data.lastWeather?.type
        ? ({ hot: "炎熱／補水", rain: "降雨", gap: "溫差" }[data.lastWeather.type] || data.lastWeather.type)
        : "目前沒有觸發";
      panel.innerHTML =
        "<strong>社群全自動化已啟用</strong><br>" +
        "關心貼文：上午 10:00｜其他貼文：晚上 20:00<br>" +
        "待發布庫存：關心 " + data.careReady + " 篇｜其他 " + data.productReady + " 篇<br>" +
        "氣候判定：" + weather + "｜氣候素材待命 " + data.weatherStandby + " 篇<br>" +
        "<small>仍可使用「編輯／改時間」與「立即發文」；手動修改時間會優先採用。</small>";
    } catch {}
  }

  function enableManualScheduleOverride() {
    const form = document.getElementById("socialForm");
    if (!form || form.querySelector('[name="manualScheduleOverride"]')) return;
    const hidden = document.createElement("input");
    hidden.type = "hidden";
    hidden.name = "manualScheduleOverride";
    hidden.value = "false";
    form.appendChild(hidden);
    form.elements.scheduledAt?.addEventListener("change", () => { hidden.value = "true"; });
  }

  const scan = () => { refreshAutomation(); enableManualScheduleOverride(); };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", scan, { once: true });
  else scan();
  new MutationObserver(enableManualScheduleOverride).observe(document.documentElement, { childList: true, subtree: true });
  setInterval(refreshAutomation, 60_000).unref?.();
})();`;

function mountInternalAutomation(app) {
  app.get("/internal/api/v2/social/automation", requireSignedIn, (_req, res) => {
    const store = socialLoaded?.readStore?.() || { posts: [] };
    res.set("Cache-Control", "no-store").json(automationSummary(store));
  });
  app.post("/internal/api/v2/social/automation/reconcile", requireSignedIn, async (_req, res) => {
    const result = await runAutomation();
    res.set("Cache-Control", "no-store").json({ ok: true, result });
  });
  app.get("/internal-social-automation-ui.js", requireSignedIn, (_req, res) => {
    res.type("application/javascript").set("Cache-Control", "no-store").send(CLIENT);
  });
  app.use("/internal/app", (_req, res, next) => {
    const originalSend = res.send.bind(res);
    res.send = (body) => {
      if (typeof body === "string" && body.includes("</body>") && !body.includes("/internal-social-automation-ui.js")) {
        body = body.replace("</body>", '<script src="/internal-social-automation-ui.js?v=20260721-1"></script></body>');
      }
      return originalSend(body);
    };
    next();
  });
}

function setupSocial(loaded) {
  if (socialLoaded === loaded) return;
  socialLoaded = loaded;
  loaded.app?.get?.("/social/automation-healthz", (_req, res) => {
    const store = loaded.readStore();
    res.set("Cache-Control", "no-store").json(automationSummary(store));
  });
  setTimeout(() => runAutomation(loaded).catch((error) => console.error("social automation startup failed", error)), 1_800).unref?.();
  if (!reconcileTimer) {
    reconcileTimer = setInterval(() => {
      try { reconcileStore(loaded); }
      catch (error) { console.error("social automation reconcile failed", error); }
    }, RECONCILE_MS);
    reconcileTimer.unref?.();
  }
  if (!weatherTimer) {
    weatherTimer = setInterval(() => {
      checkWeatherAndSchedule(loaded).catch((error) => console.error("social weather timer failed", error));
    }, WEATHER_CHECK_MS);
    weatherTimer.unref?.();
  }
}

function install() {
  if (installed) return;
  installed = true;
  const previousLoad = Module._load;
  Module._load = function loadWithSocialAutomation(request, parent, isMain) {
    const loaded = previousLoad.apply(this, arguments);
    if (request === "./social-server" && parent?.filename?.endsWith("internal-entry.js") && loaded?.readStore && loaded?.writeStore) {
      setupSocial(loaded);
    }
    if (
      request === "./internal-app" &&
      parent?.filename?.endsWith("internal-entry.js") &&
      loaded &&
      !loaded.__xjwSocialAutomationWrapped
    ) {
      const originalMount = loaded.mountInternalApp;
      loaded.mountInternalApp = function mountWithSocialAutomation(app) {
        mountInternalAutomation(app);
        return originalMount.apply(this, arguments);
      };
      Object.defineProperty(loaded, "__xjwSocialAutomationWrapped", { value: true });
    }
    return loaded;
  };
}

install();

module.exports = {
  VERSION,
  CAMPAIGN_ID,
  MIN_READY_PER_ROLE,
  GENERAL_CARE_TEMPLATES,
  PRODUCT_TEMPLATES,
  WEATHER_TEMPLATES,
  dateKeyInTaipei,
  scheduledIso,
  addDays,
  nextDateForWeekday,
  roleOf,
  classifyForecast,
  templateInstance,
  weatherInstance,
  cancelLegacyHotPost,
  prepareFirstBatch,
  ensureRoleQueue,
  futureReady,
  automationSummary,
  reconcileStore,
  targetWeatherSlot,
  installWeatherPost,
  checkWeatherAndSchedule,
  runAutomation,
  install,
};