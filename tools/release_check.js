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
const approvedAssets = require("../social-approved-originals");
const finalSocial = require("../social-final-reconcile");

function fail(message) { throw new Error(message); }

function verifyRequiredFiles() {
  for (const file of [
    "internal-entry.js", "internal-app.js", "social-server.js",
    "social-approved-originals.js", "social-final-reconcile.js",
    "social-approved-originals.test.js", "social-final-reconcile.test.js",
    "social-schedule-policy.js", "social-review-center.js",
    "internal-social-review-safety.js", "internal-social-upload-approved-patch.js",
    "disable-auto-knowledge-cards.js", "supabase-state-bridge.js",
    "persistence-auto-save.js", "supabase/schema.sql",
    ".github/workflows/catalog-sync.yml", ".github/workflows/ci.yml",
    ".github/workflows/verify-line-and-website-catalog.yml",
  ]) if (!exists(file)) fail(`缺少正式檔案：${file}`);
}

function verifyCatalogAndRuntime() {
  assert.strictEqual(data.lineId, "@762jybnm", "LINE ID 不正確");
  assert.strictEqual(data.catalogVersion, "408.7", "官網產品目錄版本不正確");
  assert.ok(Array.isArray(data.products), "products 必須是陣列");
  assert.strictEqual(data.products.length, 6, "正式產品規格必須為六項");
  assert.deepStrictEqual(data.products.map((item) => item.id), [
    "guilu-gao", "guilu-drink-30", "guilu-drink-180",
    "guilu-tangkuai", "guilu-jiao", "luerong-fen",
  ], "產品順序或品項不正確");
  for (const product of data.products) {
    for (const field of ["name", "displayName", "spec", "price", "unit", "image", "dmImage", "page", "usage", "ingredients"]) {
      assert.notStrictEqual(product[field], undefined, `${product.id} 缺少 ${field}`);
      assert.notStrictEqual(product[field], null, `${product.id} 缺少 ${field}`);
      assert.notStrictEqual(product[field], "", `${product.id} 缺少 ${field}`);
    }
    assert.ok(String(product.image).startsWith("images/products-v3/"), `${product.id} 未使用正式產品原圖`);
    assert.ok(String(product.dmImage).startsWith("images/dm-final/"), `${product.id} 未使用正式 DM`);
    assert.ok(String(product.page).endsWith(".html"), `${product.id} 產品頁連結不正確`);
  }
  assert.strictEqual(pkg.version, "5.9.2", "package.json 版本必須為 5.9.2");
  assert.strictEqual(lock.version, pkg.version, "package-lock.json 與 package.json 版本不一致");
  assert.strictEqual(lock.packages?.[""]?.version, pkg.version, "package-lock 根套件版本不一致");

  const start = String(pkg.scripts?.start || "");
  for (const token of [
    "social-approved-originals.js", "social-final-reconcile.js", "social-schedule-policy.js",
    "social-review-center.js", "internal-social-review-safety.js",
    "disable-auto-knowledge-cards.js", "internal-social-upload-approved-patch.js",
    "line-image-safety.js", "internal-entry.js",
  ]) assert.ok(start.includes(token), `正式啟動程式缺少：${token}`);
  for (const token of [
    "social-first-batch-assets.js", "social-approved-mascot-assets.js",
    "approved-social-one-time-import.js", "social-product-content-bootstrap.js",
    "social-first-batch-202607.js", "social-official-asset-reconciler.js",
    "social-automation-engine.js",
  ]) assert.ok(!start.includes(token), `正式啟動不可再載入舊自動產生流程：${token}`);

  const test = String(pkg.scripts?.test || "");
  for (const token of [
    "tools/release_check.js", "social-approved-originals.test.js",
    "social-final-reconcile.test.js", "internal-app.test.js",
    "supabase-state-bridge.test.js", "persistence-auto-save.test.js",
  ]) assert.ok(test.includes(token), `npm test 缺少：${token}`);
  if (/channelAccessToken\s*:\s*["'][^"']{20,}/.test(server)) fail("server.js 疑似含硬編碼 access token");
  if (/channelSecret\s*:\s*["'][^"']{10,}/.test(server)) fail("server.js 疑似含硬編碼 channel secret");
}

function verifyApprovedAssets() {
  const entries = Object.entries(approvedAssets.ASSETS);
  assert.strictEqual(entries.length, 13, "正式社群素材必須是 10 張固定排程＋3 張氣候替換，共 13 張");
  assert.strictEqual(new Set(entries.map(([key]) => key)).size, 13, "正式素材代號不可重複");
  assert.strictEqual(entries.filter(([key]) => key.startsWith("care-")).length, 5, "一般關心素材必須剛好 5 張");
  assert.strictEqual(entries.filter(([key]) => key.startsWith("product-")).length, 5, "產品素材必須剛好 5 張");
  assert.strictEqual(entries.filter(([key]) => key.startsWith("weather-")).length, 3, "氣候替換素材必須剛好 3 張");
  for (const [key, item] of entries) {
    assert.ok(String(item.sourceFile || "").trim(), `${key} 缺少來源檔名`);
    assert.match(approvedAssets.assetUrl(key), /^https:\/\//, `${key} 必須產生公開 HTTPS 圖片網址`);
    if (key.startsWith("product-")) {
      assert.match(approvedAssets.assetUrl(key), /ts15825868\.github\.io\/xianjiawei\/images\/dm-final\//, `${key} 必須使用正式產品 DM`);
    } else {
      assert.match(approvedAssets.assetUrl(key), /raw\.githubusercontent\.com\/TS15825868\/TS-LINE\/main\/public\/mascot\//, `${key} 必須使用核准小老闆素材`);
    }
  }
}

function verifyFinalSchedule() {
  const entries = [...finalSocial.CANONICAL.entries()];
  assert.strictEqual(entries.length, 10, "正式排程必須剛好 10 篇");
  assert.strictEqual(entries.filter(([, item]) => item.sequenceRole === "care").length, 5, "關心貼文必須剛好 5 篇");
  assert.strictEqual(entries.filter(([, item]) => item.sequenceRole === "product").length, 5, "產品貼文必須剛好 5 篇");
  assert.strictEqual(new Set(entries.map(([, item]) => item.scheduledAt)).size, 10, "正式排程時間不可重複");
  assert.strictEqual(new Set(entries.map(([, item]) => item.assetKey)).size, 10, "固定排程圖片不可重複");
  for (const [id, item] of entries) {
    assert.ok(approvedAssets.ASSETS[item.assetKey], `${id} 找不到核准圖片 ${item.assetKey}`);
    const post = finalSocial.buildCanonicalPost(id, item, null, "2026-07-21T00:00:00.000Z");
    assert.strictEqual(post.status, "approved", `${id} 必須可排程發布`);
    assert.strictEqual(post.assetLocked, true, `${id} 正式素材必須鎖定`);
    assert.strictEqual(post.publishInstagram, true, `${id} 必須發布 Instagram`);
    assert.strictEqual(post.publishFacebook, true, `${id} 必須發布 Facebook`);
    assert.ok(schedulePolicy.validScheduledAt(post.scheduledAt, post), `${id} 排程時間不符合關心 10:00／產品 20:00 規則`);
  }
  assert.strictEqual(Object.keys(finalSocial.WEATHER_REPLACEMENTS).length, 3, "氣候替換素材必須剛好 3 張");
}

function verifyReconciliation() {
  const source = { posts: [
    { id: "published-keep", status: "published", title: "既有已發布紀錄" },
    { id: "duplicate-old", campaignId: "xjw-approved-zip-202607-v1", status: "paused" },
    { id: "first-batch-v2-care-work-rest-20260729", status: "paused", scheduledAt: "2026-07-29T02:00:00.000Z" },
  ] };
  const result = finalSocial.reconcileStore(source, "2026-07-21T00:00:00.000Z");
  const active = result.store.posts.filter((post) => post.status !== "published");
  assert.strictEqual(result.store.posts.filter((post) => post.status === "published").length, 1, "已發布紀錄必須保留");
  assert.strictEqual(active.length, 10, "清理重複資料後必須只剩 10 篇固定排程");
  assert.strictEqual(result.removedUnpublished, 1, "舊重複未發布資料必須移除");
  assert.ok(active.every((post) => finalSocial.CANONICAL.has(post.id)), "不可保留非正式未發布貼文");
  assert.ok(active.every((post) => post.assetLocked === true), "所有正式素材必須鎖定");
  const care = active.find((post) => post.sequenceRole === "care");
  const beforeCount = result.store.posts.length;
  assert.strictEqual(finalSocial.updateWeatherReplacement(result.store, care.id, { trigger: "rain", summary: "測試降雨" }, "2026-07-21T01:00:00.000Z"), true);
  const replaced = result.store.posts.find((post) => post.id === care.id);
  assert.strictEqual(result.store.posts.length, beforeCount, "氣候內容只能替換，不可額外增加貼文");
  assert.strictEqual(replaced.scheduledAt, care.scheduledAt, "氣候替換不可改變固定排程時段");
  assert.strictEqual(replaced.weatherTrigger, "rain", "下雨條件未套用氣候替換");
  assert.match(replaced.imageUrl, /public\/mascot\/welcome\.jpg/, "下雨條件未使用核准待命素材");
}

function verifyCopySafety() {
  const blocked = /改善|治療|關節|卡卡|疲勞|精神不濟|補氣|生津|膠原蛋白|鈣質/;
  for (const [id, config] of finalSocial.CANONICAL) {
    const post = finalSocial.buildCanonicalPost(id, config, null, "2026-07-21T00:00:00.000Z");
    assert.ok(String(post.title || "").trim(), `${id} 缺少標題`);
    assert.ok(String(post.instagramCaption || "").trim(), `${id} 缺少 Instagram 文案`);
    assert.ok(String(post.facebookCaption || "").trim(), `${id} 缺少 Facebook 文案`);
    assert.ok(!blocked.test(`${post.title}\n${post.instagramCaption}\n${post.facebookCaption}`), `${id} 含社群禁用字詞`);
  }
}

try {
  verifyRequiredFiles();
  verifyCatalogAndRuntime();
  verifyApprovedAssets();
  verifyFinalSchedule();
  verifyReconciliation();
  verifyCopySafety();
  console.log(`PASS 仙加味正式版 ${pkg.version}：13 張正式核准素材、10 篇固定排程（關心 10:00／產品 20:00）、3 張氣候條件同篇替換、保留已發布紀錄並清除舊重複未發布資料。`);
} catch (error) {
  console.error(`仙加味正式上線檢查失敗：${error.message}`);
  process.exit(1);
}
