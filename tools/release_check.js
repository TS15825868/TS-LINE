"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const exists = (file) => fs.existsSync(path.join(root, file));
const data = JSON.parse(read("data.json"));
const pkg = JSON.parse(read("package.json"));
const lock = JSON.parse(read("package-lock.json"));
const server = read("server.js");
const clientFix = read("internal-app-client-fix.js");
const formController = read("internal-app-form-controller.js");
const socialFilter = read("internal-app-social-filter.js");
require("../social-recommended-schedule");
const schedulePolicy = require("../social-schedule-policy");
const batch = require("../social-final-approved-batch");

function fail(message) {
  throw new Error(message);
}

function verifyRequiredFiles() {
  for (const file of [
    "internal-entry.js",
    "internal-app.js",
    "internal-app-client-fix.js",
    "internal-app-form-controller.js",
    "internal-app-social-filter.js",
    "social-server.js",
    "social-recommended-schedule.js",
    "social-final-posts.js",
    "social-final-approved-batch.js",
    "social-final-approved-batch.test.js",
    "social-schedule-repair-20260722.js",
    "social-schedule-repair-20260722.test.js",
    "social-schedule-policy.js",
    "social-schedule-policy.test.js",
    "social-manual-schedule-override.js",
    "social-review-center.js",
    "disable-auto-knowledge-cards.js",
    "internal-social-upload-approved-patch.js",
    "facebook-page-token-bridge.js",
    "line-image-safety.js",
    "supabase-state-bridge.js",
    "persistence-auto-save.js",
    "supabase/schema.sql",
    ".github/workflows/catalog-sync.yml",
    ".github/workflows/ci.yml",
    ".github/workflows/verify-line-and-website-catalog.yml",
  ]) {
    if (!exists(file)) fail(`缺少正式檔案：${file}`);
  }
}

function verifyCatalogAndRuntime() {
  assert.strictEqual(data.lineId, "@762jybnm", "LINE ID 不正確");
  assert.strictEqual(data.catalogVersion, "408.7", "官網產品目錄版本不正確");
  assert.ok(Array.isArray(data.products), "products 必須是陣列");
  assert.strictEqual(data.products.length, 6, "正式產品規格必須為六項");
  assert.deepStrictEqual(
    data.products.map((item) => item.id),
    ["guilu-gao", "guilu-drink-30", "guilu-drink-180", "guilu-tangkuai", "guilu-jiao", "luerong-fen"],
    "產品順序或品項不正確"
  );
  assert.strictEqual(pkg.version, "6.0.2", "正式版版本必須為 6.0.2");
  assert.strictEqual(lock.version, pkg.version, "package-lock.json 與 package.json 版本不一致");
  assert.strictEqual(lock.packages?.[""]?.version, pkg.version, "package-lock 根套件版本不一致");

  const start = String(pkg.scripts?.start || "");
  for (const token of [
    "social-recommended-schedule.js",
    "social-final-approved-batch.js",
    "social-schedule-repair-20260722.js",
    "social-schedule-policy.js",
    "social-manual-schedule-override.js",
    "social-review-center.js",
    "internal-app-client-fix.js",
    "internal-app-form-controller.js",
    "internal-app-social-filter.js",
    "internal-entry.js",
  ]) assert.ok(start.includes(token), `正式啟動程式缺少：${token}`);
  assert.ok(
    start.indexOf("social-recommended-schedule.js") < start.indexOf("social-final-approved-batch.js"),
    "建議排程模組必須先於正式貼文模組載入"
  );
  assert.ok(String(pkg.scripts?.test || "").includes("tools/release_check.js"), "npm test 必須包含完整上線檢查");
  if (/channelAccessToken\s*:\s*["'][^"']{20,}/.test(server)) fail("server.js 疑似含硬編碼 access token");
  if (/channelSecret\s*:\s*["'][^"']{10,}/.test(server)) fail("server.js 疑似含硬編碼 channel secret");
}

function verifyInternalAppScheduleUi() {
  assert.ok(clientFix.includes('RUNTIME_VERSION = "20260722-social-5"'), "內部 App 快取版本尚未更新");
  assert.ok(clientFix.includes("/internal/app-form-controller.js"), "內部 App 未載入表單排程控制器");
  assert.ok(clientFix.includes("/internal/app-social-filter.js"), "內部 App 未載入社群排程介面");
  assert.ok(formController.includes('VERSION = "20260722-form-stable-3"'), "社群表單控制器版本不正確");
  assert.ok(formController.includes("day === 3 ? 19 : 20"), "社群表單未區分週三與週五時間");
  assert.ok(formController.includes("day === 3 ? 30 : 0"), "社群表單未設定週三19:30");
  assert.ok(!formController.includes("Date.now() + 24 * 60 * 60 * 1000"), "社群表單仍使用任意明天時間");
  assert.ok(socialFilter.includes('VERSION = "20260722-social-review-3"'), "社群排程介面版本不正確");
  for (const text of [
    "週三 19:30 關心文",
    "週五 20:00 產品文",
    "氣候文符合萬華實際天氣時",
    "不占固定篇數",
    "固定排程",
    "氣候例外",
    "氣候待命",
    "排程檢查正常",
  ]) {
    assert.ok(socialFilter.includes(text), `內部 App 排程介面缺少：${text}`);
  }
  assert.ok(!socialFilter.includes("週三、週五 20:00"), "內部 App 仍含舊的週三、週五20:00說明");
  assert.ok(!socialFilter.includes("5 篇日期不合規"), "內部 App 仍寫死舊的日期錯誤數量");
  assert.ok(socialFilter.includes('parts.weekday === "Wed" && parts.hour === "19" && parts.minute === "30"'), "週三19:30驗證未實作");
  assert.ok(socialFilter.includes('parts.weekday === "Fri" && parts.hour === "20" && parts.minute === "00"'), "週五20:00驗證未實作");
  assert.ok(socialFilter.includes('parts.hour === "10" && parts.minute === "00"'), "氣候文10:00驗證未實作");
}

function verifySchedule() {
  const posts = batch.POSTS;
  assert.strictEqual(posts.length, 11, "正式貼文必須剛好 11 篇");
  assert.strictEqual(posts.filter((post) => post.sequenceRole === "care").length, 5, "關心貼文必須剛好 5 篇");
  assert.strictEqual(posts.filter((post) => post.sequenceRole !== "care").length, 6, "產品貼文必須剛好 6 篇");
  assert.strictEqual(new Set(posts.map((post) => post.id)).size, 11, "貼文 ID 不可重複");

  const fixed = posts.filter((post) => !post.conditionalWeather);
  const weather = posts.filter((post) => post.conditionalWeather);
  assert.strictEqual(fixed.length, 8, "固定排程應為 8 篇");
  assert.strictEqual(weather.length, 3, "氣候待命素材應為 3 篇");
  assert.ok(weather.every((post) => !post.scheduledAt), "氣候待命素材不可預先占用日期");

  for (const post of fixed) {
    assert.ok(schedulePolicy.validScheduledAt(post.scheduledAt, post), `${post.id} 排程時間不符合新規則`);
  }
  const workRest = posts.find((post) => post.id === "first-batch-v2-care-work-rest-20260729");
  const family = posts.find((post) => post.id === "first-batch-v2-care-family-20260805");
  assert.strictEqual(workRest.scheduledAt, "2026-07-22T11:30:00.000Z", "今天關心文必須改為台灣時間 19:30");
  assert.strictEqual(family.scheduledAt, "2026-07-29T11:30:00.000Z", "下週關心文必須改為台灣時間 19:30");

  const drink30 = posts.find((post) => post.id === "first-batch-v2-product-guilu-yin-30cc-20260731");
  const drink180 = posts.find((post) => post.id === "first-batch-v2-product-guilu-yin-180cc-20260828");
  assert(drink30 && drink180, "龜鹿飲30cc與180cc必須各有一篇");
  assert.strictEqual(drink30.scheduledAt, "2026-07-31T12:00:00.000Z", "30cc應安排7/31晚上20:00");
  assert.strictEqual(drink180.scheduledAt, "2026-08-28T12:00:00.000Z", "180cc應安排8/28晚上20:00");
  assert(!drink30.title.includes("180cc"), "30cc標題不可混入180cc");
  assert(!drink180.title.includes("30cc"), "180cc標題不可混入30cc");
}

function verifyWeatherIsExtra() {
  const store = { posts: batch.POSTS.map((post) => batch.desiredPost(post, {}, "2026-07-22T00:00:00.000Z")) };
  const beforeFixed = store.posts.filter((post) => !post.conditionalWeather && post.status === "approved").length;
  const result = batch.activateWeatherPost(
    store,
    { trigger: "hot", summary: "最高33°C／體感最高36°C" },
    "2026-07-22",
    "2026-07-22T00:30:00.000Z"
  );
  assert.strictEqual(result.activated, true, "符合氣候時應啟用對應待命素材");
  assert.strictEqual(
    store.posts.filter((post) => !post.conditionalWeather && post.status === "approved").length,
    beforeFixed,
    "氣候例外貼文不可取消固定貼文"
  );
  const activeWeek = store.posts.filter((post) => {
    if (!["approved", "publishing", "published", "failed", "partial"].includes(post.status)) return false;
    const parts = batch.taipeiParts(post.scheduledAt);
    return parts?.year === "2026" && parts?.month === "07" && parts?.day >= "20" && parts?.day <= "26";
  });
  assert.strictEqual(activeWeek.length, 3, "本週應保留兩篇固定貼文並額外加入一篇氣候文");
  assert.strictEqual(activeWeek.filter((post) => post.oneTimeWeatherPost === true).length, 1, "同週氣候例外應最多一篇");
}

function verifyCopySafety() {
  const blocked = /改善|治療|關節|卡卡|疲勞|精神不濟|補氣|生津|膠原蛋白|鈣質/;
  for (const post of batch.POSTS) {
    assert.ok(String(post.title || "").trim(), `${post.id} 缺少標題`);
    assert.ok(String(post.instagramCaption || "").trim(), `${post.id} 缺少 Instagram 文案`);
    assert.ok(String(post.facebookCaption || "").trim(), `${post.id} 缺少 Facebook 文案`);
    assert.ok(!blocked.test(`${post.title}\n${post.instagramCaption}\n${post.facebookCaption}`), `${post.id} 含社群禁用字詞`);
  }
}

try {
  verifyRequiredFiles();
  verifyCatalogAndRuntime();
  verifyInternalAppScheduleUi();
  verifySchedule();
  verifyWeatherIsExtra();
  verifyCopySafety();
  console.log(
    `PASS 仙加味正式版 ${pkg.version}：內部App摘要、表單預設與驗證已同步；龜鹿飲30cc與180cc分開發文；固定關心週三19:30、產品週五20:00；萬華氣候符合時上午10:00例外加發。`
  );
} catch (error) {
  console.error(`仙加味正式上線檢查失敗：${error.message}`);
  process.exit(1);
}
