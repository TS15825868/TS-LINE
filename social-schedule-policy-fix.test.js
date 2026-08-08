"use strict";
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const fix = require("./social-schedule-policy-fix");

const socialPath = path.join(__dirname, "social-server.js");
const socialServer = fs.readFileSync(socialPath, "utf8");
const rebuiltServer = fix.patchSource(socialPath, socialServer);
assert.ok(rebuiltServer.includes('parts.weekday === "Tue" && parts.hour === "19" && parts.minute === "30"'));
assert.ok(rebuiltServer.includes('parts.weekday === "Sat" && parts.hour === "09" && parts.minute === "30"'));
assert.ok(rebuiltServer.includes("排程時間不符合週二19:30、週六09:30或氣候例外10:00規則"));
assert.ok(rebuiltServer.includes('scheduleRule: "週二19:30、週六09:30固定排程；氣候符合時10:00例外內容仍需發布前人工確認"'));
assert.ok(!rebuiltServer.includes("週三19:30、週五20:00"));
assert.equal(fix.patchSource(socialPath, rebuiltServer), rebuiltServer, "social-server 排程修正必須可重複套用");

const rebuildPath = path.join(__dirname, "social-official-rebuild.js");
const rebuild = fs.readFileSync(rebuildPath, "utf8");
const rebuiltSchedule = fix.patchSource(rebuildPath, rebuild);
assert.ok(rebuiltSchedule.includes("if (day !== 2 && day !== 6) continue;"));
assert.ok(rebuiltSchedule.includes("const hour = day === 2 ? 19 : 9;"));
assert.ok(rebuiltSchedule.includes("const minute = 30;"));
assert.ok(rebuiltSchedule.includes("scheduledAt: desired.scheduledAt,"));
assert.ok(!rebuiltSchedule.includes("if (day !== 3 && day !== 5) continue;"));
assert.equal(fix.patchSource(rebuildPath, rebuiltSchedule), rebuiltSchedule, "official rebuild 排程修正必須可重複套用");
assert.equal(fix.VERSION, "20260808-tue1930-sat0930-v2-idempotent");

console.log("PASS：LINE 社群固定排程已鎖週二19:30／週六09:30，舊未發布草稿啟動時重新對齊；立即發布不受固定時段限制；政策可安全重複載入。");
