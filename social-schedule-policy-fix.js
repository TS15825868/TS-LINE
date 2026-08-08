"use strict";

/**
 * 仙加味社群排程唯一政策｜2026-08-08
 * - 固定排程：週二 19:30、週六 09:30（Asia/Taipei）
 * - 天氣／即時型內容保留 10:00 例外，但發布前仍需人工確認
 * - 立即發布不受固定排程限制
 *
 * 這個 preload 在載入 social-server / social-official-rebuild 前修正歷史核心，
 * 避免舊的週三／週五規則重新寫回 runtime。
 */
const fs = require("fs");
const Module = require("module");

const VERSION = "20260808-tue1930-sat0930-v1";
const originalLoader = Module._extensions[".js"];

function replaceRequired(source, from, to, label) {
  if (!source.includes(from)) throw new Error(`社群排程政策修正失敗：找不到 ${label}`);
  return source.replace(from, to);
}

function patchSocialServer(source) {
  let next = source;
  next = replaceRequired(
    next,
    'if (isCarePost(post)) return parts.weekday === "Wed" && parts.hour === "19" && parts.minute === "30";',
    'if (isCarePost(post)) return parts.weekday === "Tue" && parts.hour === "19" && parts.minute === "30";',
    "social-server care schedule"
  );
  next = replaceRequired(
    next,
    'return parts.weekday === "Fri" && parts.hour === "20" && parts.minute === "00";',
    'return parts.weekday === "Sat" && parts.hour === "09" && parts.minute === "30";',
    "social-server product schedule"
  );
  next = next.replaceAll(
    "排程時間不符合週三19:30、週五20:00或氣候例外10:00規則",
    "排程時間不符合週二19:30、週六09:30或氣候例外10:00規則"
  );
  next = next.replaceAll(
    'scheduleRule: "週三19:30關心文、週五20:00產品文、氣候符合時10:00例外加發"',
    'scheduleRule: "週二19:30、週六09:30固定排程；氣候符合時10:00例外內容仍需發布前人工確認"'
  );
  return next;
}

function patchOfficialRebuild(source) {
  let next = source;
  next = replaceRequired(
    next,
    "function taipeiSlotUtc(year, month, date) {\n  return Date.UTC(year, month, date, 20, 0, 0) - TAIPEI_OFFSET_MS;\n}",
    "function taipeiSlotUtc(year, month, date) {\n  const day = new Date(Date.UTC(year, month, date)).getUTCDay();\n  const hour = day === 2 ? 19 : 9;\n  const minute = 30;\n  return Date.UTC(year, month, date, hour, minute, 0) - TAIPEI_OFFSET_MS;\n}",
    "official rebuild slot time"
  );
  next = replaceRequired(
    next,
    "if (day !== 3 && day !== 5) continue;",
    "if (day !== 2 && day !== 6) continue;",
    "official rebuild weekdays"
  );
  next = replaceRequired(
    next,
    "scheduledAt: previous.scheduledAt || desired.scheduledAt,",
    "scheduledAt: desired.scheduledAt,",
    "official rebuild stale schedule migration"
  );
  return next;
}

function patchSource(filename, source) {
  const normalized = String(filename || "").replace(/\\/g, "/");
  if (normalized.endsWith("/social-server.js")) return patchSocialServer(source);
  if (normalized.endsWith("/social-official-rebuild.js")) return patchOfficialRebuild(source);
  return source;
}

if (!Module._extensions.__xjwSchedulePolicyInstalled) {
  Module._extensions[".js"] = function xjwSchedulePolicyLoader(module, filename) {
    const normalized = String(filename || "").replace(/\\/g, "/");
    if (normalized.endsWith("/social-server.js") || normalized.endsWith("/social-official-rebuild.js")) {
      const source = fs.readFileSync(filename, "utf8");
      return module._compile(patchSource(filename, source), filename);
    }
    return originalLoader(module, filename);
  };
  Object.defineProperty(Module._extensions, "__xjwSchedulePolicyInstalled", { value: true });
}

global.__XJW_SOCIAL_SCHEDULE_POLICY__ = Object.freeze({
  version: VERSION,
  timezone: "Asia/Taipei",
  weekly: ["星期二 19:30", "星期六 09:30"],
  immediatePublishBypassesSchedule: true,
});

module.exports = { VERSION, patchSource, patchSocialServer, patchOfficialRebuild };
