"use strict";

const fs = require("fs");
const path = require("path");
const Module = require("module");

const VERSION = "2026-07-25-weekly-once-v1";
const FIXED_SCHEDULES = Object.freeze([
  "2026-07-29T12:00:00.000Z",
  "2026-08-05T12:00:00.000Z",
  "2026-08-12T12:00:00.000Z",
  "2026-08-19T12:00:00.000Z",
  "2026-08-26T12:00:00.000Z",
  "2026-09-02T12:00:00.000Z",
  "2026-09-09T12:00:00.000Z",
]);

const OLD_SCHEDULES = Object.freeze([
  "2026-07-24T02:00:00.000Z",
  "2026-07-29T02:00:00.000Z",
  "2026-07-31T02:00:00.000Z",
  "2026-08-05T02:00:00.000Z",
  "2026-08-07T02:00:00.000Z",
  "2026-08-12T02:00:00.000Z",
  "2026-08-14T02:00:00.000Z",
]);

function transformFinalPosts(source) {
  OLD_SCHEDULES.forEach((oldValue, index) => {
    source = source.replaceAll(oldValue, FIXED_SCHEDULES[index]);
  });
  return source;
}

function transformClearRepublish(source) {
  source = source.replaceAll('const VERSION = "2.0.0";', 'const VERSION = "3.0.0";');
  source = source.replaceAll('const SCHEDULED_AT = "2026-07-24T02:00:00.000Z"; // 台灣時間 2026/7/24 10:00', 'const SCHEDULED_AT = "2026-07-29T12:00:00.000Z"; // 台灣時間 2026/7/29 20:00，人工核准後才啟用');
  source = source.replaceAll("找不到7/24上午首發的日常關心貼文", "找不到待重新發布的日常關心貼文");
  source = source.replaceAll('scheduleTimePolicy: "fixed-wed-fri-10:00"', 'scheduleTimePolicy: "fixed-wed-20:00"');
  source = source.replaceAll("7/24上午10:00開始正式發布；", "建議於週三晚上8:00重新發布；人工核准後才啟用；");
  source = source.replaceAll("已由7/24上午10:00單一正式首發排程取代", "已由單一修正版待審貼文取代");
  return source;
}

function transformApprovedBatch(source) {
  source = source.replaceAll('const FIXED_WEEKDAYS = new Set(["Wed", "Fri"]);', 'const FIXED_WEEKDAYS = new Set(["Wed"]);');
  source = source.replaceAll("非週三、週五上午10:00", "非週三的平日晚上8:00");
  source = source.replaceAll("非週三、週五10:00", "非週三平日20:00");
  source = source.replaceAll("週三、週五固定貼文", "週三固定貼文");
  source = source.replaceAll("週三、週五10:00", "週三20:00");
  source = source.replaceAll("非週三、週五10:00加發", "其他平日20:00加發");
  source = source.replaceAll('scheduleTimePolicy: "weather-condition-non-wed-fri-10:00"', 'scheduleTimePolicy: "weather-condition-weekday-non-wed-20:00"');
  source = source.replace(
    /function tenAt\(key\) \{ const match = \/\^\(\\d\{4\}\)-\(\\d\{2\}\)-\(\\d\{2\}\)\$\/\.exec\(String\(key \|\| ""\)\); return match \? new Date\(Date\.UTC\(Number\(match\[1\]\), Number\(match\[2\]\) - 1, Number\(match\[3\]\), 2, 0, 0, 0\)\)\.toISOString\(\) : ""; \}/,
    'function tenAt(key) { const match = /^(\\d{4})-(\\d{2})-(\\d{2})$/.exec(String(key || "")); return match ? new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12, 0, 0, 0)).toISOString() : ""; }'
  );
  source = source.replace("if (offset === 0 && minutes >= 570) continue; return key;", "if ([\"Sat\", \"Sun\"].includes(weekdayForKey(key))) continue; if (offset === 0 && minutes >= 1170) continue; return key;");
  source = source.replaceAll('fixedRule: "週三、週五10:00"', 'fixedRule: "每週1篇，週三20:00"');
  source = source.replaceAll('weatherRule: "依實際氣候於非週三、週五10:00加發；每週最多1篇"', 'weatherRule: "依實際氣候於其他平日20:00加發；每週最多1篇；週末不發布"');
  return source;
}

function transformRepair(source) {
  source = source.replaceAll('const VERSION = "2026-07-24-v5";', 'const VERSION = "2026-07-25-v6";');
  source = source.replaceAll("2026/7/24上午10:00開始；固定週三、週五10:00；", "2026/7/29晚上20:00開始；固定每週三20:00；");
  source = source.replaceAll("非固定日10:00加發", "其他平日20:00加發，週末不發布");
  source = source.replaceAll("if (count > 2) issues.push(`${week} 這週固定貼文共有${count}篇，超過每週2篇`);", "if (count > 1) issues.push(`${week} 這週固定貼文共有${count}篇，超過每週1篇`);");
  source = source.replaceAll('fixed: "每週三、週五 10:00"', 'fixed: "每週1篇，週三 20:00"');
  source = source.replaceAll('weatherException: "符合萬華實際氣候時，於非週三、週五的上午10:00額外發布；每週最多1篇"', 'weatherException: "符合萬華實際氣候時，於其他平日晚上20:00額外發布；每週最多1篇；週末不發布"');
  return source;
}

function transformSource(filename, source) {
  switch (path.basename(filename)) {
    case "social-final-posts.js": return transformFinalPosts(source);
    case "social-clear-republish-policy.js": return transformClearRepublish(source);
    case "social-final-approved-batch.js": return transformApprovedBatch(source);
    case "social-schedule-repair-20260722.js": return transformRepair(source);
    default: return source;
  }
}

function install() {
  if (Module._extensions[".js"].__xjwWeeklyOnceSchedule) return;
  const previous = Module._extensions[".js"];
  const targets = new Set([
    "social-final-posts.js",
    "social-clear-republish-policy.js",
    "social-final-approved-batch.js",
    "social-schedule-repair-20260722.js",
  ]);
  const wrapped = function loadWithWeeklyOnceSchedule(module, filename) {
    if (!targets.has(path.basename(filename))) return previous(module, filename);
    return module._compile(transformSource(filename, fs.readFileSync(filename, "utf8")), filename);
  };
  Object.defineProperty(wrapped, "__xjwWeeklyOnceSchedule", { value: true });
  Module._extensions[".js"] = wrapped;
}

install();

module.exports = { VERSION, FIXED_SCHEDULES, OLD_SCHEDULES, transformFinalPosts, transformClearRepublish, transformApprovedBatch, transformRepair, transformSource, install };
