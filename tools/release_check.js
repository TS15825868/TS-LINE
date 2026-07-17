"use strict";

const fs = require("fs");
const path = require("path");
const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const exists = (file) => fs.existsSync(path.join(root, file));
const data = JSON.parse(read("data.json"));
const server = read("server.js");
const pkg = JSON.parse(read("package.json"));
const internalEntry = read("internal-entry.js");
const internalApp = read("internal-app.js");
const socialServer = read("social-server.js");
const socialRebuild = read("social-official-rebuild.js");
const approvedZipImporter = read("social-approved-zip-import.js");
const disableAutoCards = read("disable-auto-knowledge-cards.js");
const supabaseBridge = read("supabase-state-bridge.js");
const persistenceAutoSave = read("persistence-auto-save.js");
const errors = [];

const requiredProducts = [
  "guilu-gao",
  "guilu-drink-30",
  "guilu-drink-180",
  "guilu-tangkuai",
  "guilu-jiao",
  "luerong-fen",
];

if (data.lineId !== "@762jybnm") errors.push("LINE ID 不正確");
if (!Array.isArray(data.products)) errors.push("products 必須是陣列");
if ((data.products || []).length !== 6) errors.push("正式產品規格必須為六項");
if (data.catalogVersion !== "408.7") errors.push("官網產品目錄版本必須為 408.7");

for (const id of requiredProducts) {
  const product = (data.products || []).find((item) => item.id === id);
  if (!product) {
    errors.push(`缺少產品：${id}`);
    continue;
  }
  for (const field of ["name", "displayName", "spec", "price", "unit", "image", "dmImage", "page", "usage", "ingredients"]) {
    if (product[field] === undefined || product[field] === null || product[field] === "") {
      errors.push(`${id} 缺少 ${field}`);
    }
  }
  if (!String(product.image || "").startsWith("images/products-v3/")) errors.push(`${id} 未使用正式產品原圖`);
  if (!String(product.dmImage || "").startsWith("images/dm-final/")) errors.push(`${id} 未使用正式 DM`);
  if (!String(product.page || "").endsWith(".html")) errors.push(`${id} 產品頁連結不正確`);
}

for (const token of [
  'const VERSION = "v401.6"',
  "process.env.CHANNEL_ACCESS_TOKEN",
  "process.env.CHANNEL_SECRET",
  "process.env.CRM_URL",
  'app.post("/webhook"',
  'app.get("/healthz"',
  "productCarousel()",
  "priceCarousel()",
  "cartFlex(state)",
  "startCheckout(state)",
  "doctorReferralReply()",
  "mascotWelcomeReply()",
  "beginWebhookEvent",
  "finishWebhookEvent",
]) {
  if (!server.includes(token)) errors.push(`server.js 缺少必要功能：${token}`);
}

if (/channelAccessToken\s*:\s*["'][^"']{20,}/.test(server)) errors.push("server.js 疑似含硬編碼 access token");
if (/channelSecret\s*:\s*["'][^"']{10,}/.test(server)) errors.push("server.js 疑似含硬編碼 channel secret");
if (!data.richMenu?.areas || data.richMenu.areas.length !== 6) errors.push("Rich Menu 設定未整合");
if (!data.mascotAssets?.images || Object.keys(data.mascotAssets.images).length !== 9) errors.push("小老闆素材清單未整合");

if (pkg.version !== "5.9.2") errors.push("package.json 版本必須為 5.9.2");
const startScript = String(pkg.scripts?.start || "");
for (const token of [
  "disable-auto-knowledge-cards.js",
  "internal-social-upload-approved-patch.js",
  "social-approved-zip-import.test.js",
  "internal-entry.js",
]) {
  if (!startScript.includes(token)) errors.push(`正式啟動程式缺少：${token}`);
}
if (!String(pkg.scripts?.test || "").includes("internal-app.test.js")) errors.push("內部 App 測試未納入 npm test");
if (!String(pkg.scripts?.test || "").includes("supabase-state-bridge.test.js")) errors.push("Supabase 持久化測試未納入 npm test");
if (!String(pkg.scripts?.test || "").includes("persistence-auto-save.test.js")) errors.push("即時自動保存測試未納入 npm test");
if (!String(pkg.scripts?.test || "").includes("social-approved-zip-import.test.js")) errors.push("核准 ZIP 匯入測試未納入 npm test");

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
  if (!exists(file)) errors.push(`缺少正式檔案：${file}`);
}

for (const token of ["restoreAll()", "startWatching()", "syncAll()", "installPersistenceAutoSave()", "mountInternalApp(app)", 'app.get("/internal/db-healthz"', "rebuildOfficialSocialSchedule("]) {
  if (!internalEntry.includes(token)) errors.push(`internal-entry.js 缺少：${token}`);
}
for (const token of ["/internal/login", "/internal/app", "/internal/api/state", "/internal/api/orders", "/internal/api/customers", "/internal/api/inventory", "/internal/api/reminders", "/internal/api/staff"]) {
  if (!internalApp.includes(token)) errors.push(`internal-app.js 缺少功能：${token}`);
}
for (const token of ["/social-review", "/social-login", "/social-post", "/social/healthz"]) {
  if (!socialServer.includes(token)) errors.push(`social-server.js 缺少功能：${token}`);
}
for (const token of ["TOPICS", "nextScheduleSlots", "approvedMascotAssets", "status === \"published\"", "Wednesday", "Friday"]) {
  if (!socialRebuild.includes(token)) errors.push(`20 篇正式排程重建缺少：${token}`);
}
for (const token of ["EXPECTED_WIDTH = 1254", "EXPECTED_HEIGHT = 1254", "selectApprovedEntries", "validateOriginalImage", "/internal/api/v2/social/import-approved-zip", "approvedMascotAssets"]) {
  if (!approvedZipImporter.includes(token)) errors.push(`核准 ZIP 原圖匯入缺少：${token}`);
}
for (const token of ["disabledGeneratedKnowledgeCards", "disabledStaticKnowledgeCards"]) {
  if (!disableAutoCards.includes(token)) errors.push(`自動圖卡停用保護缺少：${token}`);
}
for (const token of ["SUPABASE_SECRET_KEY", "SUPABASE_SERVICE_ROLE_KEY", "xjw_app_state", "writeRemote", "restoreAll", "startWatching", "saveState", "syncAll"]) {
  if (!supabaseBridge.includes(token)) errors.push(`Supabase 持久化缺少：${token}`);
}
for (const token of ["fs.renameSync", "bridge.saveFile", "INTERNAL_DATA_PATH", "SOCIAL_DATA_PATH", "setImmediate"]) {
  if (!persistenceAutoSave.includes(token)) errors.push(`即時自動保存缺少：${token}`);
}

if (errors.length) {
  console.error("仙加味正式上線檢查失敗：\n- " + errors.join("\n- "));
  process.exit(1);
}

console.log(
  `PASS 仙加味正式版 v5.9.2：LINE OA v401.6、${data.products.length} 項產品、官網目錄 ${data.catalogVersion}、核准 ZIP 原始 20 圖匯入、保留已發布紀錄、清除錯誤未發布草稿、週三週五 20:00 待審排程、內部 PWA 與 Supabase 持久化均已整合。`
);
