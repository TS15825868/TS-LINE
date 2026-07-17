"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const exists = (file) => fs.existsSync(path.join(root, file));
const data = JSON.parse(read("data.json"));
const pkg = JSON.parse(read("package.json"));
const server = read("server.js");
const {
  CAMPAIGN_ID,
  ASSET_STORE_KEY,
  TOPICS,
  nextScheduleSlots,
  rebuildOfficialSocialSchedule,
} = require("../social-official-rebuild");
const { selectApprovedEntries } = require("../social-approved-zip-import");

function fail(message) {
  throw new Error(message);
}

function verifyRequiredFiles() {
  for (const file of [
    "internal-entry.js",
    "internal-app.js",
    "social-server.js",
    "social-official-rebuild.js",
    "social-approved-zip-import.js",
    "social-approved-zip-import.test.js",
    "internal-social-upload-approved-patch.js",
    "disable-auto-knowledge-cards.js",
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

  const expectedIds = [
    "guilu-gao",
    "guilu-drink-30",
    "guilu-drink-180",
    "guilu-tangkuai",
    "guilu-jiao",
    "luerong-fen",
  ];
  assert.deepStrictEqual(data.products.map((item) => item.id), expectedIds, "產品順序或品項不正確");

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
  const start = String(pkg.scripts?.start || "");
  for (const token of [
    "disable-auto-knowledge-cards.js",
    "internal-social-upload-approved-patch.js",
    "line-image-safety.js",
    "internal-entry.js",
  ]) {
    assert.ok(start.includes(token), `正式啟動程式缺少：${token}`);
  }
  const test = String(pkg.scripts?.test || "");
  for (const token of [
    "social-official-rebuild.test.js",
    "social-approved-zip-import.test.js",
    "internal-app.test.js",
    "supabase-state-bridge.test.js",
    "persistence-auto-save.test.js",
  ]) {
    assert.ok(test.includes(token), `npm test 缺少：${token}`);
  }

  if (/channelAccessToken\s*:\s*["'][^"']{20,}/.test(server)) fail("server.js 疑似含硬編碼 access token");
  if (/channelSecret\s*:\s*["'][^"']{10,}/.test(server)) fail("server.js 疑似含硬編碼 channel secret");
}

function verifyApprovedZipContract() {
  assert.strictEqual(TOPICS.length, 20, "正式社群圖片必須剛好 20 張");
  assert.strictEqual(new Set(TOPICS.map((topic) => topic.file.toUpperCase())).size, 20, "正式圖片檔名不可重複");
  assert.strictEqual(new Set(TOPICS.map((topic) => topic.number)).size, 20, "正式貼文編號不可重複");
  assert.ok(TOPICS.every((topic) => /^[A-F0-9-]+\.PNG$/i.test(topic.file)), "正式圖片必須使用核准 PNG 檔名");

  const entries = TOPICS.map((topic) => ({ name: `社群排程/${topic.file}` }));
  const selected = selectApprovedEntries(entries);
  assert.strictEqual(selected.size, 20, "ZIP 必須一一選出 20 張正式圖片");

  assert.throws(
    () => selectApprovedEntries([...entries, { name: "社群排程/extra.png" }]),
    /非正式圖片/,
    "ZIP 含額外圖片時必須拒絕"
  );
  assert.throws(
    () => selectApprovedEntries(entries.slice(1)),
    /缺少 1 張正式圖片/,
    "ZIP 缺圖時必須拒絕"
  );
}

function makePublishedPost() {
  return {
    id: "published-keep-1",
    title: "龜鹿膏只能冬天吃嗎？",
    status: "published",
    scheduledAt: "2026-07-15T20:25:00.000Z",
    result: { instagram: { ok: true }, facebook: { ok: true } },
  };
}

function verifyRebuildBehavior() {
  const published = makePublishedPost();
  const wrongDrafts = Array.from({ length: 30 }, (_, index) => ({
    id: `wrong-auto-${index + 1}`,
    title: `錯誤自動圖卡 ${index + 1}`,
    status: "draft",
  }));

  let writtenWithoutAssets = null;
  const awaiting = rebuildOfficialSocialSchedule(
    () => ({ posts: [published, ...wrongDrafts] }),
    (store) => { writtenWithoutAssets = store; },
    { nowMs: Date.UTC(2026, 6, 17, 12, 30, 0) }
  );
  assert.strictEqual(awaiting.awaitingApprovedZip, true, "尚未匯入 ZIP 時必須等待正式圖");
  assert.strictEqual(awaiting.preservedPublished, 1, "必須保留 1 篇已發布紀錄");
  assert.strictEqual(awaiting.removedUnpublished, 30, "必須清除 30 篇錯誤未發布草稿");
  assert.strictEqual(writtenWithoutAssets.posts.length, 1, "等待 ZIP 時只能留下已發布紀錄");
  assert.strictEqual(writtenWithoutAssets.posts[0].id, published.id, "已發布紀錄不可被替換");

  const files = {};
  for (const topic of TOPICS) {
    const url = `https://approved.example/${topic.file}`;
    files[topic.file] = url;
    files[topic.slug] = url;
  }
  const source = {
    posts: [published, ...wrongDrafts],
    [ASSET_STORE_KEY]: {
      campaignId: CAMPAIGN_ID,
      sourceName: "社群排程.zip",
      originalCount: 20,
      files,
    },
  };
  let writtenWithAssets = null;
  const result = rebuildOfficialSocialSchedule(
    () => source,
    (store) => { writtenWithAssets = store; },
    { nowMs: Date.UTC(2026, 6, 17, 12, 30, 0) }
  );

  assert.strictEqual(result.awaitingApprovedZip, false, "正式 ZIP 資產齊全後必須建立排程");
  assert.strictEqual(result.preservedPublished, 1, "重建後仍須保留已發布紀錄");
  assert.strictEqual(result.pendingReview, 20, "必須建立 20 篇待審貼文");
  assert.strictEqual(result.activeTotal, 20, "正式活動貼文必須剛好 20 篇");
  assert.strictEqual(writtenWithAssets.posts.length, 21, "總數必須是 1 篇已發布＋20 篇待審");

  const drafts = writtenWithAssets.posts.filter((post) => post.status === "draft");
  assert.strictEqual(drafts.length, 20, "待審草稿必須剛好 20 篇");
  assert.strictEqual(new Set(drafts.map((post) => post.sourceImageFile)).size, 20, "圖片與貼文必須一一對應");

  for (const draft of drafts) {
    const topic = TOPICS.find((item) => item.file === draft.sourceImageFile);
    assert.ok(topic, `出現非核准圖片：${draft.sourceImageFile}`);
    assert.strictEqual(draft.imageUrl, files[topic.file], `${topic.file} 必須使用原圖網址`);
    assert.strictEqual(draft.publishInstagram, true, "IG 必須納入待審");
    assert.strictEqual(draft.publishFacebook, true, "FB 必須納入待審");
    const taipei = new Date(Date.parse(draft.scheduledAt) + 8 * 60 * 60 * 1000);
    assert.ok([3, 5].includes(taipei.getUTCDay()), "排程必須是週三或週五");
    assert.strictEqual(taipei.getUTCHours(), 20, "排程必須是台北時間晚上 8:00");
    assert.strictEqual(taipei.getUTCMinutes(), 0, "排程分鐘必須為 00");
  }

  const slots = nextScheduleSlots(20, Date.UTC(2026, 6, 17, 12, 30, 0));
  assert.deepStrictEqual(drafts.map((post) => post.scheduledAt), slots, "20 篇排程順序必須固定");
}

try {
  verifyRequiredFiles();
  verifyCatalogAndRuntime();
  verifyApprovedZipContract();
  verifyRebuildBehavior();
  console.log(
    "PASS 仙加味正式版 v5.9.2：核准 ZIP 20 張原始 PNG、一圖一文、保留 1 篇已發布、清除 30 篇錯誤未發布、重建 20 篇週三週五 20:00 待審排程，且不啟用自動替代圖流程。"
  );
} catch (error) {
  console.error(`仙加味正式上線檢查失敗：${error.message}`);
  process.exit(1);
}
