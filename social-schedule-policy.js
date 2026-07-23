"use strict";

const fs = require("fs");
const path = require("path");
const Module = require("module");

const VERSION = "3.0.0";
const STORE_PATH = path.resolve(process.env.SOCIAL_DATA_PATH || "/tmp/xianjiawei-social-posts.json");
const FIXED_DAYS = Object.freeze(["Wed", "Fri"]);
const FIXED_HOUR = "10";
const FIXED_MINUTE = "00";
const WEATHER_HOUR = "10";
const WEATHER_MINUTE = "00";
const CARE_HOUR = FIXED_HOUR;
const STANDARD_HOUR = FIXED_HOUR;
const REGULAR_CARE_HOUR = FIXED_HOUR;
const REGULAR_CARE_MINUTE = FIXED_MINUTE;
const STANDARD_MINUTE = FIXED_MINUTE;
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
  return CARE_TITLE.test(`${post.knowledgeTopic || ""}\n${post.title || ""}`);
}

function isFixedDay(weekday) {
  return FIXED_DAYS.includes(String(weekday || ""));
}

function expectedTime(post = {}) {
  if (isWeatherPost(post)) {
    return { weekday: "non-fixed", hour: WEATHER_HOUR, minute: WEATHER_MINUTE, policy: "weather-condition-non-wed-fri-10:00" };
  }
  return { weekday: "Wed/Fri", hour: FIXED_HOUR, minute: FIXED_MINUTE, policy: "fixed-wed-fri-10:00" };
}

function expectedHour(post = {}) {
  return expectedTime(post).hour;
}

function validScheduledAt(value, post = {}) {
  const parts = taipeiParts(value);
  if (!parts) return false;
  const timeMatches = parts.hour === FIXED_HOUR && parts.minute === FIXED_MINUTE;
  if (!timeMatches) return false;
  if (!post || !Object.keys(post).length) return true;
  if (isWeatherPost(post)) return !isFixedDay(parts.weekday);
  return isFixedDay(parts.weekday);
}

function scheduleError(post = {}) {
  if (isWeatherPost(post)) return "氣候條件貼文必須依實際氣候安排於非週三、週五的台灣時間上午10:00，且每週最多加發1篇";
  return "固定貼文必須安排於每週三或週五台灣時間上午10:00";
}

function setTaipeiTime(value, hour, minute = "00") {
  const parts = taipeiParts(value);
  if (!parts) return value;
  return new Date(Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(hour) - 8,
    Number(minute),
    0,
    0
  )).toISOString();
}

function setTaipeiHour(value, hour) {
  return setTaipeiTime(value, hour, "00");
}

function normalizePostSchedule(post) {
  if (!post || ["published", "cancelled"].includes(post.status) || !post.scheduledAt) return post;
  const expected = expectedTime(post);
  const target = setTaipeiTime(post.scheduledAt, expected.hour, expected.minute);
  if (target === post.scheduledAt && post.scheduleTimePolicy === expected.policy) return post;
  return { ...post, scheduledAt: target, scheduleTimePolicy: expected.policy, updatedAt: new Date().toISOString() };
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
    socialScheduleRule: "固定貼文每週三、週五10:00；氣候與補水依條件於非週三、週五10:00例外加發，每週最多1篇",
  };
}

function installStoreNormalizer() {
  if (fs.renameSync.__xjwScheduleTimePolicy) return;
  const previousRename = fs.renameSync.bind(fs);
  const wrapped = function normalizeSocialStoreBeforeRename(source, destination) {
    try {
      if (path.resolve(String(destination)) === STORE_PATH && fs.existsSync(source)) {
        const parsed = JSON.parse(fs.readFileSync(source, "utf8"));
        fs.writeFileSync(source, JSON.stringify(normalizeStore(parsed), null, 2), { mode: 0o600 });
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
      /scheduleRule: "[^"]*",/,
      'scheduleRule: "固定貼文週三、週五10:00；氣候條件於非週三、週五10:00例外加發（Asia/Taipei）",'
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
      /if \(!validSchedule\(post\?\.scheduledAt\)\) \{\n    errors\.push\("[^"]*"\);/,
      'if (!validSchedule(post?.scheduledAt, post)) {\n    errors.push(schedulePolicy.scheduleError(post));'
    );
    source = source.replaceAll("固定每週 2 篇：週三、週五 20:00。", "固定每週2篇：週三、週五上午10:00。");
    source = source.replaceAll("固定排程為週三、週五晚上 20:00；", "固定排程為週三、週五上午10:00；");
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
      /if \(!validSchedule\(candidate\.scheduledAt\)\) \{\n    errors\.push\("[^"]*"\);/,
      'if (!validSchedule(candidate.scheduledAt, candidate)) {\n    errors.push(schedulePolicy.scheduleError(candidate));'
    );
    source = source.replace(
      /if \(!validSchedule\(post\.scheduledAt\)\) errors\.push\("[^"]*"\);/,
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
    return module._compile(transformSource(filename, fs.readFileSync(filename, "utf8")), filename);
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
  FIXED_DAYS,
  FIXED_HOUR,
  FIXED_MINUTE,
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
  isFixedDay,
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
