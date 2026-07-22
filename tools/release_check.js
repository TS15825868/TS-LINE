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
const schedulePolicy = require("../social-schedule-policy");
const batch = require("../social-final-approved-batch");

function fail(message) {
  throw new Error(message);
}

function verifyRequiredFiles() {
  for (const file of [
    "internal-entry.js",
    "internal-app.js",
    "social-server.js",
    "social-final-posts.js",
    "social-final-approved-batch.js",
    "social-final-approved-batch.test.js",
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
    [
      "guilu-gao",
      "guilu-drink-30",
      "guilu-drink-180",
      "guilu-tangkuai",
      "guilu-jiao",
      "luerong-fen",
    ],
    "產品順序或品項不正確"
  );

  for (const product of data.products) {
    for (const field of [
      "name",
      "displayName",
      "spec",
      "price",
      "unit",
      "image",
      "dmImage",
      "page",
      "usage",
      "ingredients",
    ]) {
      assert.notStrictEqual(product[field], undefined, `${product.id} 缺少 ${field}`);
      assert.notStrictEqual(product[field], null, `${product.id} 缺少 ${field}`);
      assert.notStrictEqual(product[field], "", `${product.id} 缺少 ${field}`);
    }
    assert.ok(String(product.image).startsWith("images/products-v3/"), `${product.id} 未使用正式產品原圖`);
    assert.ok(String(product.dmImage).startsWith("images/dm-final/"), `${product.id} 未使用正式 DM`);
    assert.ok(String(product.page).endsWith(".html"), `${product.id} 產品頁連結不正確`);
  }

  assert.match(String(pkg.version || ""), /^\d+\.\d+\.\d+$/, "package.json 版本必須為 SemVer");
  assert.strictEqual(pkg.version, "6.0.2", "正式版版本必須為 6.0.2");
  assert.strictEqual(lock.version, pkg.version, "package-lock.json 與 package.json 版本不一致");
  assert.strictEqual(lock.packages?.[""]?.version, pkg.version, "package-lock 根套件版本不一致");

  const start = String(pkg.scripts?.start || "");
  for (const token of [
    "social-final-approved-batch.js",
    "social-schedule-policy.js",
    "social-manual-schedule-override.js",
    "social-review-center.js",
    "disable-auto-knowledge-cards.js",
    "internal-social-upload-approved-patch.js",
    "facebook-page-token-bridge.js",
    "line-image-safety.js",
    "internal-entry.js",
  ]) {
    assert.ok(start.includes(token), `正式啟動程式缺少：${token}`);
  }

  for (const token of [
    "social-first-batch-assets.js",
    "social-approved-mascot-assets.js",
    "social-first-batch-202607.js",
    "social-final-reconcile.js",
    "social-approved-originals.js",
  ]) {
    assert.ok(!start.includes(token), `正式啟動不可再載入舊流程：${token}`);
  }

  const test = String(pkg.scripts?.test || "");
  for (const token of [
    "social-final-approved-batch.test.js",
    "social-schedule-policy.test.js",
  ]) {
    assert.ok(test.includes(token), `npm test 缺少：${token}`);
  }

  if (/channelAccessToken\s*:\s*["'][^"']{20,}/.test(server)) fail("server.js 疑似含硬編碼 access token");
  if (/channelSecret\s*:\s*["'][^"']{10,}/.test(server)) fail("server.js 疑似含硬編碼 channel secret");
}

function verifyFinalSchedule() {
  const posts = batch.POSTS;
  assert.strictEqual(posts.length, 10, "正式排程必須剛好 10 篇");
  assert.strictEqual(posts.filter((post) => post.sequenceRole === "care").length, 5, "關心貼文必須剛好 5 篇");
  assert.strictEqual(posts.filter((post) => post.sequenceRole !== "care").length, 5, "其他／產品貼文必須剛好 5 篇");
  assert.strictEqual(new Set(posts.map((post) => post.id)).size, 10, "正式貼文 ID 不可重複");

  const fixed = posts.filter((post) => !post.conditionalWeather);
  const weather = posts.filter((post) => post.conditionalWeather);
  assert.strictEqual(fixed.length, 7, "固定排程應為 7 篇（2 篇一般關心＋5 篇產品）");
  assert.strictEqual(weather.length, 3, "氣候待命素材必須剛好 3 篇");
  assert.strictEqual(new Set(fixed.map((post) => post.scheduledAt)).size, fixed.length, "固定排程時間不可重複");
  assert.ok(weather.every((post) => !post.scheduledAt), "氣候待命貼文上線前不可預先占用時段");
  assert.deepStrictEqual(
    new Set(weather.map((post) => post.weatherTrigger)),
    new Set(["temperature-gap", "hot", "rain"]),
    "氣候待命條件不完整"
  );

  for (const post of fixed) {
    assert.ok(schedulePolicy.validScheduledAt(post.scheduledAt, post), `${post.id} 排程時間不符合關心 10:00／其他 20:00 規則`);
  }

  const careImages = posts.filter((post) => post.imageName);
  const products = posts.filter((post) => post.imageUrl);
  assert.strictEqual(careImages.length, 5, "完整關心成品圖必須剛好 5 張");
  assert.strictEqual(products.length, 5, "正式產品 DM 必須剛好 5 張");
  assert.strictEqual(new Set(careImages.map((post) => post.imageName)).size, 5, "關心成品圖不可重複");
  assert.ok(
    products.every((post) => String(post.imageUrl).startsWith("https://ts15825868.github.io/xianjiawei/images/dm-final/")),
    "產品貼文必須使用仙加味官網正式 DM"
  );
}

function verifyReconciliation() {
  const legacy = {
    posts: [
      { id: "published-keep", title: "既有已發布紀錄", status: "published" },
      { id: "old-duplicate", title: "舊重複貼文", status: "approved" },
      { id: batch.POSTS[0].id, title: "舊內容", status: "paused", imageUrl: "https://example.com/old.jpg" },
    ],
  };

  const result = batch.reconcileStore(legacy, "2026-07-22T00:00:00.000Z");
  const active = result.store.posts.filter((post) => batch.CANONICAL_IDS.has(String(post.id || "")) && post.status !== "cancelled");
  assert.strictEqual(result.store.posts.find((post) => post.id === "published-keep").status, "published", "已發布紀錄必須保留");
  assert.strictEqual(result.store.posts.find((post) => post.id === "old-duplicate").status, "cancelled", "舊未發布重複資料必須取消");
  assert.strictEqual(active.length, 10, "清理後必須只保留 10 篇正式貼文");
  assert.strictEqual(active.filter((post) => post.automationStandby === true).length, 3, "氣候待命貼文必須剛好 3 篇");
  assert.strictEqual(active.filter((post) => post.status === "approved").length, 7, "固定排程貼文必須有 7 篇可發布");
  assert.ok(active.every((post) => post.assetLocked === true), "所有正式素材必須鎖定");
}

function verifyWeatherReplacementLimit() {
  const templates = batch.POSTS.map((post) => batch.desiredPost(post, {}, "2026-07-22T00:00:00.000Z"));
  const store = { posts: templates };
  const selection = { trigger: "hot", summary: "最高33°C／體感最高36°C" };
  const result = batch.activateWeatherPost(store, selection, "2026-07-22", "2026-07-22T00:30:00.000Z");
  assert.strictEqual(result.activated, true, "符合氣候時應啟用對應待命素材");

  const activeWeek = store.posts.filter((post) =>
    ["approved", "publishing", "published", "failed", "partial"].includes(post.status) &&
    batch.taipeiParts(post.scheduledAt)?.year === "2026" &&
    batch.taipeiParts(post.scheduledAt)?.month === "07" &&
    batch.taipeiParts(post.scheduledAt)?.day >= "20" &&
    batch.taipeiParts(post.scheduledAt)?.day <= "26"
  );
  assert.ok(activeWeek.length <= 2, "氣候貼文啟用後同週不可超過 2 篇");
  assert.strictEqual(activeWeek.filter((post) => post.oneTimeWeatherPost === true).length, 1, "同週只能啟用 1 篇氣候貼文");
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
  verifyFinalSchedule();
  verifyReconciliation();
  verifyWeatherReplacementLimit();
  verifyCopySafety();
  console.log(
    `PASS 仙加味正式版 ${pkg.version}：10 篇正式社群排程、5 篇關心＋5 篇其他、關心 10:00／其他 20:00、3 種萬華氣候待命、每週最多 2 篇、保留已發布並取消舊重複未發布資料。`
  );
} catch (error) {
  console.error(`仙加味正式上線檢查失敗：${error.message}`);
  process.exit(1);
}
