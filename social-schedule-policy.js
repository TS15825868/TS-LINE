"use strict";

const fs = require("fs");
const path = require("path");
const Module = require("module");

const VERSION = "1.0.0";
const STORE_PATH = path.resolve(process.env.SOCIAL_DATA_PATH || "/tmp/xianjiawei-social-posts.json");
const ACTIVE_DAYS = new Set(["Wed", "Fri"]);
const CARE_HOUR = "10";
const STANDARD_HOUR = "20";
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

function isCarePost(post = {}) {
  if (post.oneTimeWeatherPost === true) return true;
  if (String(post.sequenceRole || "").toLowerCase() === "care") return true;
  if (CARE_CATEGORY.test(String(post.category || ""))) return true;
  const subject = `${post.knowledgeTopic || ""}\n${post.title || ""}`;
  return CARE_TITLE.test(subject);
}

function expectedHour(post = {}) {
  return isCarePost(post) ? CARE_HOUR : STANDARD_HOUR;
}

function validScheduledAt(value, post = {}) {
  const parts = taipeiParts(value);
  if (!parts || parts.minute !== "00") return false;
  const hasPostContext = Boolean(post && Object.keys(post).length);
  if (post?.oneTimeWeatherPost === true) return parts.hour === CARE_HOUR;
  if (!ACTIVE_DAYS.has(parts.weekday)) return false;
  if (!hasPostContext) return [CARE_HOUR, STANDARD_HOUR].includes(parts.hour);
  return parts.hour === expectedHour(post);
}

function scheduleError(post = {}) {
  if (post.oneTimeWeatherPost === true || isCarePost(post)) {
    return "關心／氣候貼文必須安排於台灣時間上午 10:00";
  }
  return "產品、使用方式、品牌與其他貼文必須安排於台灣時間晚上 20:00";
}

function setTaipeiHour(value, hour) {
  const parts = taipeiParts(value);
  if (!parts) return value;
  const utc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(hour) - 8,
    0,
    0,
    0
  );
  return new Date(utc).toISOString();
}

function normalizePostSchedule(post) {
  if (!post || ["published", "cancelled"].includes(post.status)) return post;
  const parts = taipeiParts(post.scheduledAt);
  if (!parts) return post;
  if (post.oneTimeWeatherPost !== true && !ACTIVE_DAYS.has(parts.weekday)) return post;
  const target = setTaipeiHour(post.scheduledAt, expectedHour(post));
  if (target === post.scheduledAt && post.scheduleTimePolicy) return post;
  return {
    ...post,
    scheduledAt: target,
    scheduleTimePolicy: isCarePost(post) ? "care-10:00" : "standard-20:00",
    updatedAt: new Date().toISOString(),
  };
}

function normalizeStore(store) {
  if (!store || !Array.isArray(store.posts)) return store;
  let changed = false;
  let posts = store.posts.map((post) => {
    const next = normalizePostSchedule(post);
    if (next !== post) changed = true;
    return next;
  });

  const weatherWeeks = new Set(
    posts
      .filter((post) => post?.oneTimeWeatherPost === true && post.status !== "cancelled")
      .map((post) => weekKey(post.scheduledAt))
      .filter(Boolean)
  );
  if (weatherWeeks.size) {
    posts = posts.map((post) => {
      if (
        !post ||
        post.oneTimeWeatherPost === true ||
        ["published", "cancelled"].includes(post.status) ||
        !isCarePost(post) ||
        !weatherWeeks.has(weekKey(post.scheduledAt))
      ) return post;
      changed = true;
      return {
        ...post,
        status: "cancelled",
        assetLocked: false,
        lastError: "已由本週即時氣候關心貼文替換",
        scheduleTimePolicy: "replaced-by-weather",
        updatedAt: new Date().toISOString(),
      };
    });
  }

  if (!changed && store.socialScheduleTimePolicyVersion === VERSION) return store;
  return {
    ...store,
    posts,
    socialScheduleTimePolicyVersion: VERSION,
    socialScheduleTimePolicyUpdatedAt: new Date().toISOString(),
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
  if (base === "today-hot-weather-post.js") {
    source = source.replace('const VERSION = "1.0.0";', 'const VERSION = "1.0.1";');
    source = source.replace('const SCHEDULED_AT = "2026-07-21T12:00:00.000Z"; // Asia/Taipei 20:00', 'const SCHEDULED_AT = "2026-07-21T02:00:00.000Z"; // Asia/Taipei 10:00; past due publishes immediately');
  }
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
      'scheduleRule: "關心貼文 10:00；其他貼文 20:00（Asia/Taipei；每週三、週五）",'
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
      '固定每週 2 篇：週三、週五 20:00。',
      '固定每週 2 篇：關心貼文上午 10:00；其他貼文晚上 20:00。'
    );
    source = source.replaceAll(
      '固定排程為週三、週五晚上 20:00；',
      '固定排程：關心貼文上午 10:00；其他貼文晚上 20:00；'
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
  const targets = new Set(["social-server.js", "social-review-center.js", "internal-social-review-safety.js", "today-hot-weather-post.js"]);
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
  taipeiParts,
  weekKey,
  isCarePost,
  expectedHour,
  validScheduledAt,
  scheduleError,
  setTaipeiHour,
  normalizePostSchedule,
  normalizeStore,
  transformSource,
};
