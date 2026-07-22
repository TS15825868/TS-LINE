"use strict";

const fs = require("fs");
const path = require("path");
const Module = require("module");

const VERSION = "2.0.0";
const STORE_PATH = path.resolve(process.env.SOCIAL_DATA_PATH || "/tmp/xianjiawei-social-posts.json");
const REGULAR_CARE_DAY = "Wed";
const PRODUCT_DAY = "Fri";
const REGULAR_CARE_HOUR = "19";
const REGULAR_CARE_MINUTE = "30";
const WEATHER_HOUR = "10";
const WEATHER_MINUTE = "00";
const STANDARD_HOUR = "20";
const STANDARD_MINUTE = "00";
const CARE_HOUR = REGULAR_CARE_HOUR;
const CARE_CATEGORY = /(?:氣候關心|節氣關心|生活關心|日常關心)/;
const CARE_TITLE = /(?:天氣|節氣|高溫|悶熱|寒流|豪雨|颱風|防曬|補水|保暖|日常提醒|關心客人)/;

function taipeiParts(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return Object.fromEntries(
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
}

function weekKey(value) {
  const parts = taipeiParts(value);
  if (!parts) return "";
  const date = new Date(Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day)));
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() - day + 1);
  return date.toISOString().slice(0, 10);
}

function isWeatherPost(post = {}) {
  return post.oneTimeWeatherPost === true || post.conditionalWeather === true || Boolean(post.weatherTrigger);
}

function isCarePost(post = {}) {
  if (isWeatherPost(post)) return true;
  if (String(post.sequenceRole || "").toLowerCase() === "care") return true;
  if (CARE_CATEGORY.test(String(post.category || ""))) return true;
  const subject = `${post.knowledgeTopic || ""}\n${post.title || ""}`;
  return CARE_TITLE.test(subject);
}

function expectedTime(post = {}) {
  if (isWeatherPost(post)) return { weekday: "", hour: WEATHER_HOUR, minute: WEATHER_MINUTE, policy: "weather-exception-10:00" };
  if (isCarePost(post)) return { weekday: REGULAR_CARE_DAY, hour: REGULAR_CARE_HOUR, minute: REGULAR_CARE_MINUTE, policy: "regular-care-wed-19:30" };
  return { weekday: PRODUCT_DAY, hour: STANDARD_HOUR, minute: STANDARD_MINUTE, policy: "product-fri-20:00" };
}

function expectedHour(post = {}) {
  return expectedTime(post).hour;
}

function validScheduledAt(value, post = {}) {
  const parts = taipeiParts(value);
  if (!parts) return false;
  const hasPostContext = Boolean(post && Object.keys(post).length);
  if (!hasPostContext) {
    return (
      (parts.weekday === REGULAR_CARE_DAY && parts.hour === REGULAR_CARE_HOUR && parts.minute === REGULAR_CARE_MINUTE) ||
      (parts.weekday === PRODUCT_DAY && parts.hour === STANDARD_HOUR && parts.minute === STANDARD_MINUTE) ||
      (parts.hour === WEATHER_HOUR && parts.minute === WEATHER_MINUTE)
    );
  }
  const expected = expectedTime(post);
  if (isWeatherPost(post)) return parts.hour === expected.hour && parts.minute === expected.minute;
  return parts.weekday === expected.weekday && parts.hour === expected.hour && parts.minute === expected.minute;
}

function scheduleError(post = {}) {
  if (isWeatherPost(post)) return "氣候例外貼文必須安排於台灣時間上午 10:00，可在符合萬華實際氣候的當日額外發布";
  if (isCarePost(post)) return "固定關心貼文建議安排於每週三台灣時間晚上 19:30";
  return "產品、使用方式、品牌與其他貼文建議安排於每週五台灣時間晚上 20:00";
}

function setTaipeiTime(value, hour, minute = "00") {
  const parts = taipeiParts(value);
  if (!parts) return value;
  const utc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(hour) - 8,
    Number(minute),
    0,
    0
  );
  return new Date(utc).toISOString();
}

function setTaipeiHour(value, hour) {
  return setTaipeiTime(value, hour, "00");
}

function normalizePostSchedule(post) {
  if (!post || ["published", "cancelled"].includes(post.status) || !post.scheduledAt) return post;
  const expected = expectedTime(post);
  const target = setTaipeiTime(post.scheduledAt, expected.hour, expected.minute);
  if (target === post.scheduledAt && post.scheduleTimePolicy === expected.policy) return post;
  return {
    ...post,
    scheduledAt: target,
    scheduleTimePolicy: expected.policy,
    updatedAt: new Date().toISOString(),
  };
}

function normalizeStore(store) {
  if (!store || !Array.isArray(store.posts)) return store;
  let changed = false;
  const posts = store.posts.map((post) => {
    const next = normalizePostSchedule(post);
    if (next !== post) changed = true;
    return next;
  });
  if (!changed && store.socialScheduleTimePolicyVersion === VERSION) return store;
  return {
    ...store,
    posts,
    socialScheduleTimePolicyVersion: VERSION,
    socialScheduleTimePolicyUpdatedAt: new Date().toISOString(),
    socialScheduleRule: "固定關心週三19:30；產品週五20:00；氣候符合時10:00例外加發",
  };
}

function installStoreNormalizer() {
  if (fs.renameSync.__xjwScheduleTimePolicy) return;
  const previousRename = fs.renameSync.bind(fs);
  const wrapped = function normalizeSocialStoreBeforeRename(source, destination) {
    try {
      if (path.resolve(String(destination)) === STORE_PATH && fs.existsSync(source)) {
        const parsed = JSON.parse(fs.readFileSync(source, "utf8"));
        const normalized = normalizeStore(parsed);
        fs.writeFileSync(source, JSON.stringify(normalized, null, 2), { mode: 0o600 });
      }
    } catch (error) {
      console.error("social schedule time normalization failed", error.message);
    }
    return previousRename(source, destination);
  };
  Object.defineProperty(wrapped, "__xjwScheduleTimePolicy", { value: true });
  fs.renameSync = wrapped;
}

function transformSource(filename, source) {
  const base = path.basename(filename);
  if (base === "social-server.js") {
    source = source.replace(
      'const { app, VERSION } = require("./server");',
      'const { app, VERSION } = require("./server");\nconst schedulePolicy = require("./social-schedule-policy");'
    );
    source = source.replace(
      /function validOfficialSchedule\(value\) \{[\s\S]*?\n\}/,
      'function validOfficialSchedule(value, post = {}) {\n  return schedulePolicy.validScheduledAt(value, post);\n}'
    );
    source = source.replace(
      'if (!validOfficialSchedule(post.scheduledAt)) errors.push("排程必須是週三或週五 20:00");',
      'if (!validOfficialSchedule(post.scheduledAt, post)) errors.push(schedulePolicy.scheduleError(post));'
    );
    source = source.replace(
      'scheduleRule: "每週三、週五 20:00（Asia/Taipei）",',
      'scheduleRule: "固定關心週三19:30；產品週五20:00；氣候符合時10:00例外加發（Asia/Taipei）",'
    );
  }

  if (base === "social-review-center.js") {
    source = source.replace(
      'const { app } = require("./server");',
      'const { app } = require("./server");\nconst schedulePolicy = require("./social-schedule-policy");'
    );
    source = source.replace(
      /function validSchedule\(value\) \{[\s\S]*?\n\}/,
      'function validSchedule(value, post = {}) {\n  return schedulePolicy.validScheduledAt(value, post);\n}'
    );
    source = source.replace(
      'if (!validSchedule(post?.scheduledAt)) {\n    errors.push("排程固定為每週三或週五晚上 20:00。");',
      'if (!validSchedule(post?.scheduledAt, post)) {\n    errors.push(schedulePolicy.scheduleError(post));'
    );
    source = source.replaceAll(
      "固定每週 2 篇：週三、週五 20:00。",
      "固定貼文：週三19:30關心、週五20:00產品；氣候符合時上午10:00例外加發。"
    );
    source = source.replaceAll(
      "固定排程為週三、週五晚上 20:00；",
      "固定排程：週三19:30關心、週五20:00產品；氣候符合時上午10:00例外加發；"
    );
  }

  if (base === "internal-social-review-safety.js") {
    source = source.replace(
      'const review = require("./social-review-center");',
      'const review = require("./social-review-center");\nconst schedulePolicy = require("./social-schedule-policy");'
    );
    source = source.replace(
      /function validSchedule\(value\) \{[\s\S]*?\n\}/,
      'function validSchedule(value, post = {}) {\n  return schedulePolicy.validScheduledAt(value, post);\n}'
    );
    source = source.replace(
      'if (!validSchedule(candidate.scheduledAt)) {\n    errors.push("社群排程固定為每週三、週五晚上 20:00");',
      'if (!validSchedule(candidate.scheduledAt, candidate)) {\n    errors.push(schedulePolicy.scheduleError(candidate));'
    );
    source = source.replace(
      'if (!validSchedule(post.scheduledAt)) errors.push("排程不是週三或週五 20:00");',
      'if (!validSchedule(post.scheduledAt, post)) errors.push(schedulePolicy.scheduleError(post));'
    );
  }
  return source;
}

function installSourceTransforms() {
  if (Module._extensions[".js"].__xjwScheduleTimePolicy) return;
  const previousLoader = Module._extensions[".js"];
  const targets = new Set(["social-server.js", "social-review-center.js", "internal-social-review-safety.js"]);
  const wrapped = function loadWithScheduleTimePolicy(module, filename) {
    if (!targets.has(path.basename(filename))) return previousLoader(module, filename);
    const source = transformSource(filename, fs.readFileSync(filename, "utf8"));
    return module._compile(source, filename);
  };
  Object.defineProperty(wrapped, "__xjwScheduleTimePolicy", { value: true });
  Module._extensions[".js"] = wrapped;
}

function installLiveMigrationHook() {
  const previousLoad = Module._load;
  Module._load = function patchedLoad(request, parent, isMain) {
    const loaded = previousLoad.apply(this, arguments);
    if (request === "./social-server" && loaded?.readStore && loaded?.writeStore) {
      setImmediate(() => {
        try {
          const current = loaded.readStore();
          const normalized = normalizeStore(current);
          if (normalized !== current) loaded.writeStore(normalized);
        } catch (error) {
          console.error("social schedule live migration failed", error.message);
        }
      });
    }
    return loaded;
  };
}

installStoreNormalizer();
installSourceTransforms();
installLiveMigrationHook();

module.exports = {
  VERSION,
  CARE_HOUR,
  STANDARD_HOUR,
  REGULAR_CARE_HOUR,
  REGULAR_CARE_MINUTE,
  WEATHER_HOUR,
  WEATHER_MINUTE,
  STANDARD_MINUTE,
  taipeiParts,
  weekKey,
  isWeatherPost,
  isCarePost,
  expectedTime,
  expectedHour,
  validScheduledAt,
  scheduleError,
  setTaipeiTime,
  setTaipeiHour,
  normalizePostSchedule,
  normalizeStore,
  transformSource,
};
