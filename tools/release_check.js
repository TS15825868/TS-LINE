"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const exists = (file) => fs.existsSync(path.join(root, file));
const decodeBundle = (file) => zlib.gunzipSync(Buffer.from(read(file).replace(/\s+/g, ""), "base64")).toString("utf8");
const data = JSON.parse(read("data.json"));
const pkg = JSON.parse(read("package.json"));
const lock = JSON.parse(read("package-lock.json"));

const required = [
  "internal-entry.js",
  "internal-app-client-fix.js",
  "internal-social-site.js",
  "internal-social-site/index.html.gz.b64",
  "internal-social-site/site.css.gz.b64",
  "internal-social-site/site.js.gz.b64",
  "social-static-asset-bridge.js",
  "social-server.js",
  "social-review-only-mode.js",
  "social-review-only-mode.test.js",
  "social-publish-guard.js",
  "social-publication-ledger-backfill.js",
  "social-final-posts.js",
  "social-clear-republish-policy.js",
  "social-original-asset-override.js",
  "social-final-approved-batch.js",
  "social-final-release-20260724.js",
  "social-final-release-remote-assets.js",
  "social-schedule-repair-20260722.js",
  "social-schedule-policy.js",
  "social-manual-schedule-override.js",
  "social-manual-immediate-publish.js",
  "supabase-state-bridge.js",
  "persistence-auto-save.js",
];
for (const file of required) assert(exists(file), `缺少正式檔案：${file}`);

assert.strictEqual(data.lineId, "@762jybnm");
assert.strictEqual(data.catalogVersion, "408.7");
assert.strictEqual(data.products.length, 6);
assert.strictEqual(pkg.version, "6.0.5");
assert.strictEqual(lock.version, pkg.version);
assert.strictEqual(lock.packages?.[""]?.version, pkg.version);

const start = String(pkg.scripts?.start || "");
assert(start.includes("node -r ./social-review-only-mode.js"), "審核閘門必須是正式啟動的第一個 preload");
assert(start.includes("-r ./social-static-asset-bridge.js"), "缺少繁體中文光柵圖片橋接器");
assert(start.indexOf("social-static-asset-bridge.js") < start.indexOf("social-final-approved-batch.js"), "圖片橋接器必須先於舊圖片產生器載入");
assert(!start.includes("-r ./social-incomplete-auto-retry.js"), "不可載入失敗平台自動補發模組");
assert(!start.includes("line-approved-mascot-runtime.js"), "損壞的 LINE 小老闆圖片流程不可載入");

const gate = read("social-review-only-mode.js");
assert(gate.includes('VERSION = "2026-07-24-review-gate-v3"'));
assert(gate.includes("automaticSchedulingRequiresReview: true"));
assert(gate.includes("automaticRetryEnabled: false"));
assert(gate.includes("這篇尚未通過人工審核，不能發布"));
assert(gate.includes("nextAvailableFixedSlot"));

const clientFix = read("internal-app-client-fix.js");
assert(clientFix.includes('RUNTIME_VERSION = "20260724-inventory-split-1"'));
assert(clientFix.includes("mountInternalSocialSite(app)"));
assert(clientFix.includes("/internal/social-center"));
assert(clientFix.includes("社群網站"));
assert(clientFix.includes("socialSection.remove"));
assert(clientFix.includes("no-store, no-cache, must-revalidate"));
const appScripts = (clientFix.match(/const scripts = \[([\s\S]*?)\]\.map/) || [])[1] || "";
for (const legacySocialUi of ["app-review-only.js", "app-social-retry.js", "app-social-filter.js", "app-facebook-health.js"]) {
  assert(!appScripts.includes(legacySocialUi), `進銷存 App 不可再載入社群前端：${legacySocialUi}`);
}

const socialSiteServer = read("internal-social-site.js");
assert(socialSiteServer.includes('VERSION = "2026-07-24-social-site-v3"'));
assert(socialSiteServer.includes('require("./internal-app-security-patch")'));
assert(socialSiteServer.includes("requirePage"));
assert(socialSiteServer.includes("/internal/social-center"));
assert(socialSiteServer.includes("/internal/social-center-healthz"));
assert(socialSiteServer.includes('mode: "independent-website"'));
assert(socialSiteServer.includes("reviewRequiredBeforePublish: true"));
assert(socialSiteServer.includes("automaticRetryEnabled: false"));

const socialHtml = decodeBundle("internal-social-site/index.html.gz.b64");
const socialCss = decodeBundle("internal-social-site/site.css.gz.b64");
const socialJs = decodeBundle("internal-social-site/site.js.gz.b64");
assert(socialHtml.includes("社群管理中心"));
assert(socialHtml.includes("貼文先審核，通過後才進入自動排程"));
assert(socialHtml.includes('id="imageFile"'));
assert(socialHtml.includes('href="/internal/app"'));
assert(socialCss.includes(".post-card"));
assert(socialCss.includes(".upload-row"));
assert(socialJs.includes('RASTER_VERSION = "social-raster-tc-v1"'));
assert(socialJs.includes("/internal/api/v2/social/upload"));
assert(socialJs.includes("ensureRasterPost"));
assert(socialJs.includes("審核通過"));
assert(!socialJs.includes("MutationObserver"), "獨立社群網站不可使用全頁 MutationObserver");

const raster = read("social-static-asset-bridge.js");
assert(raster.includes('VERSION = "2026-07-24-raster-tc-v1"'));
assert(raster.includes('CONTENT_VERSION = "social-raster-tc-v1"'));
assert(raster.includes("NotoSansTC-VF.ttf"));
assert(raster.includes("fontfile: font.path"));
assert(raster.includes("sharp({"));
assert(raster.includes("無法載入繁體中文字型，已停止產生貼文圖片以避免亂碼"));
assert(raster.includes("patchBatch"));
assert(raster.includes("patchSocialServer"));
assert(raster.includes("mountHealth"));
assert(raster.includes("/social/raster-healthz"));
assert(raster.includes("繁體中文測試｜龜鹿膏100g｜30cc／180cc"));
assert(raster.includes("preventsGibberish: true"));

const immediate = read("social-manual-immediate-publish.js");
assert(immediate.includes("post.manualImmediatePublish = true"));
const postSource = read("social-final-posts.js");
const postIds = [...postSource.matchAll(/id:\s*"(first-batch-[^"]+)"/g)].map((match) => match[1]);
assert.strictEqual(postIds.length, 10, `正式貼文應為10篇，目前找到${postIds.length}篇`);
assert.strictEqual(new Set(postIds).size, 10, "正式貼文 ID 不可重複");
assert(postSource.includes("validatePosts();"));
assert(postSource.includes('assertUnique(posts, "instagramCaption", "Instagram文案"'));
assert(postSource.includes('assertUnique(posts, "facebookCaption", "Facebook文案"'));
assert(postSource.includes('assertUnique(posts, "imageName", "圖片"'));

const schedule = read("social-schedule-policy.js");
assert(schedule.includes('FIXED_DAYS = Object.freeze(["Wed", "Fri"])'));
assert(schedule.includes('FIXED_HOUR = "10"'));
assert(schedule.includes("氣候條件貼文必須依實際氣候安排於非週三、週五"));
const guard = read("social-publish-guard.js");
assert(guard.includes('VERSION = "2.0.0"'));
assert(guard.includes("withPostLock"));
assert(guard.includes("findPublishedMatch"));
assert(guard.includes("recordPublication"));

console.log("仙加味正式檢查通過：進銷存保留原內部 App；社群貼文改為獨立網站；圖片可上傳與預覽；繁體中文以指定字型光柵化避免亂碼；10篇圖文不重複；未審核不排程、不發布、不補發；審核後才啟用固定排程或氣候條件發布");
