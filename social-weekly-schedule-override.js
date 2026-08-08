"use strict";

const fs = require("fs");
const path = require("path");
const Module = require("module");

const VERSION = "2026-08-08-tue-sat-v3";
// Asia/Taipei：週二19:30、週六09:30；此批七篇依兩個固定時段輪替。
const FIXED_SCHEDULES = Object.freeze([
  "2026-08-11T11:30:00.000Z",
  "2026-08-15T01:30:00.000Z",
  "2026-08-18T11:30:00.000Z",
  "2026-08-22T01:30:00.000Z",
  "2026-08-25T11:30:00.000Z",
  "2026-08-29T01:30:00.000Z",
  "2026-09-01T11:30:00.000Z",
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
  OLD_SCHEDULES.forEach((oldValue, index) => { source = source.replaceAll(oldValue, FIXED_SCHEDULES[index]); });
  const staleWed = [
    "2026-07-29T12:00:00.000Z","2026-08-05T12:00:00.000Z","2026-08-12T12:00:00.000Z",
    "2026-08-19T12:00:00.000Z","2026-08-26T12:00:00.000Z","2026-09-02T12:00:00.000Z","2026-09-09T12:00:00.000Z",
  ];
  staleWed.forEach((oldValue,index)=>{source=source.replaceAll(oldValue,FIXED_SCHEDULES[index]);});
  return source;
}

function transformClearRepublish(source) {
  return source
    .replaceAll('scheduleTimePolicy: "fixed-wed-fri-10:00"', 'scheduleTimePolicy: "fixed-tue-19:30-sat-09:30"')
    .replaceAll('scheduleTimePolicy: "fixed-wed-20:00"', 'scheduleTimePolicy: "fixed-tue-19:30-sat-09:30"')
    .replaceAll("週三晚上8:00", "週二19:30或週六09:30")
    .replaceAll("週三20:00", "週二19:30、週六09:30")
    .replaceAll("週三、週五10:00", "週二19:30、週六09:30");
}

function transformApprovedBatch(source) {
  source = source.replace('const FIXED_WEEKDAYS = new Set(["Wed"]);', 'const FIXED_WEEKDAYS = new Set(["Tue", "Sat"]);');
  source = source.replace('const FIXED_WEEKDAYS = new Set(["Wed", "Fri"]);', 'const FIXED_WEEKDAYS = new Set(["Tue", "Sat"]);');
  source = source.replace(
    'const WEBSITE_ASSET_BASE = "https://raw.githubusercontent.com/TS15825868/xianjiawei/main/images/brand/approved-v405";',
    'const WEBSITE_ASSET_BASE = "https://raw.githubusercontent.com/TS15825868/xianjiawei/main/images/brand/approved-v405";\nconst WEBSITE_PRODUCT_BASE = "https://raw.githubusercontent.com/TS15825868/xianjiawei/main/images/products-v3";'
  );
  const productSources = {
    '${WEBSITE_ASSET_BASE}/product-guilu-gao-100g.webp':'${WEBSITE_PRODUCT_BASE}/guilu-gao.jpg',
    '${WEBSITE_ASSET_BASE}/product-guilu-drink-30cc.webp':'${WEBSITE_PRODUCT_BASE}/guilu-drink-30.jpg',
    '${WEBSITE_ASSET_BASE}/product-guilu-drink-180cc.webp':'${WEBSITE_PRODUCT_BASE}/guilu-drink-180.jpg',
    '${WEBSITE_ASSET_BASE}/product-luerong-fen-75g.webp':'${WEBSITE_PRODUCT_BASE}/luerong-fen.jpg',
    '${WEBSITE_ASSET_BASE}/product-guilu-tangkuai-75g.webp':'${WEBSITE_PRODUCT_BASE}/guilu-tangkuai.jpg',
    '${WEBSITE_ASSET_BASE}/product-guilu-jiao-600g.webp':'${WEBSITE_PRODUCT_BASE}/guilu-jiao.jpg',
  };
  for(const [from,to] of Object.entries(productSources))source=source.replaceAll(from,to);
  return source
    .replaceAll("30cc 玻璃小瓶", "30cc 小玻璃罐")
    .replaceAll("每週1篇，週三20:00", "每週2篇，週二19:30、週六09:30")
    .replaceAll("週三固定貼文", "週二／週六固定貼文")
    .replaceAll("非週三平日發布日", "非固定排程日的平日發布日")
    .replaceAll("非週三平日20:00", "非固定排程日的平日20:00")
    .replaceAll("氣候貼文只能安排於非週三平日20:00，週末不發布", "氣候貼文只在人工審核後依當日情況安排，並避開固定排程時段")
    .replaceAll('scheduleTimePolicy: "weather-condition-weekday-non-wed-20:00-no-weekend"', 'scheduleTimePolicy: "weather-live-check-non-fixed-slot"');
}

function transformReviewGate(source) {
  source = source.replace(
    'return Boolean(parts && parts.weekday === "Wed" && parts.hour === "20" && parts.minute === "00");',
    'return Boolean(parts && ((parts.weekday === "Tue" && parts.hour === "19" && parts.minute === "30") || (parts.weekday === "Sat" && parts.hour === "09" && parts.minute === "30")));'
  );
  source = source.replace(
    /function nextAvailableFixedSlot\(store = \{\}, postId = "", afterMs = Date\.now\(\)\) \{[\s\S]*?\n\}\n\nfunction clearPublishState/,
    `function nextAvailableFixedSlot(store = {}, postId = "", afterMs = Date.now()) {
  const occupied = new Set((store.posts || [])
    .filter((post) => String(post.id || "") !== String(postId || "") && post.scheduledAt && ["approved", "publishing", "published", "partial", "failed"].includes(String(post.status || "")))
    .map((post) => new Date(post.scheduledAt).toISOString()));
  const local = taipeiParts(new Date(afterMs));
  if (!local) return "";
  for (let offset = 0; offset < 740; offset += 1) {
    const localDate = new Date(Date.UTC(Number(local.year), Number(local.month) - 1, Number(local.day) + offset));
    const weekday = localDate.getUTCDay();
    if (weekday !== 2 && weekday !== 6) continue;
    const candidate = weekday === 2
      ? new Date(Date.UTC(localDate.getUTCFullYear(), localDate.getUTCMonth(), localDate.getUTCDate(), 11, 30, 0, 0))
      : new Date(Date.UTC(localDate.getUTCFullYear(), localDate.getUTCMonth(), localDate.getUTCDate(), 1, 30, 0, 0));
    if (candidate.getTime() <= afterMs + 60 * 1000) continue;
    if (occupied.has(candidate.toISOString())) continue;
    return candidate.toISOString();
  }
  return "";
}

function clearPublishState`
  );
  return source
    .replaceAll("找不到可用的週三晚上8:00排程，請先調整其他貼文時間", "找不到可用的週二19:30或週六09:30排程，請先調整其他貼文時間")
    .replaceAll('overdueApprovalPolicy: "move-to-next-free-wed-20:00"', 'overdueApprovalPolicy: "move-to-next-free-tue-19:30-or-sat-09:30"')
    .replaceAll("週三20:00", "週二19:30、週六09:30")
    .replaceAll("週三晚上8:00", "週二19:30或週六09:30");
}

function transformRepair(source) {
  return source
    .replaceAll('fixed: "每週1篇，週三 20:00"', 'fixed: "每週2篇，週二19:30、週六09:30"')
    .replaceAll('fixed: "每週三、週五 10:00"', 'fixed: "每週2篇，週二19:30、週六09:30"')
    .replaceAll("固定每週三20:00", "固定週二19:30、週六09:30")
    .replaceAll("固定週三、週五10:00", "固定週二19:30、週六09:30");
}

function transformSource(filename, source) {
  switch (path.basename(filename)) {
    case "social-final-posts.js": return transformFinalPosts(source);
    case "social-clear-republish-policy.js": return transformClearRepublish(source);
    case "social-final-approved-batch.js": return transformApprovedBatch(source);
    case "social-review-only-mode.js": return transformReviewGate(source);
    case "social-schedule-repair-20260722.js": return transformRepair(source);
    default: return source;
  }
}

function install() {
  if (Module._extensions[".js"].__xjwCurrentSchedule) return;
  const previous = Module._extensions[".js"];
  const targets = new Set([
    "social-final-posts.js",
    "social-clear-republish-policy.js",
    "social-final-approved-batch.js",
    "social-review-only-mode.js",
    "social-schedule-repair-20260722.js",
  ]);
  const wrapped = function loadWithCurrentSchedule(module, filename) {
    if (!targets.has(path.basename(filename))) return previous(module, filename);
    return module._compile(transformSource(filename, fs.readFileSync(filename, "utf8")), filename);
  };
  Object.defineProperty(wrapped, "__xjwCurrentSchedule", { value: true });
  Module._extensions[".js"] = wrapped;
}

install();
const EARLY_CLEAR_POLICY = require("./social-clear-republish-policy");

module.exports = { VERSION, FIXED_SCHEDULES, OLD_SCHEDULES, EARLY_CLEAR_POLICY, transformFinalPosts, transformClearRepublish, transformApprovedBatch, transformReviewGate, transformRepair, transformSource, install };
