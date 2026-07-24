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

const required = [
  "internal-entry.js",
  "internal-app-client-fix.js",
  "internal-app-shell.js",
  "internal-app-review-only.js",
  "internal-app-social-retry.js",
  "internal-app-social-filter.js",
  "internal-app-facebook-health.js",
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
assert(!start.includes("-r ./social-incomplete-auto-retry.js"), "不可載入失敗平台自動補發模組");
assert(!start.includes("line-approved-mascot-runtime.js"), "損壞的 LINE 小老闆圖片流程不可載入");
for (const token of [
  "social-review-only-mode.js",
  "social-final-approved-batch.js",
  "social-final-release-20260724.js",
  "social-final-release-remote-assets.js",
  "social-schedule-policy.js",
  "social-manual-immediate-publish.js",
  "internal-entry.js",
]) assert(start.includes(token), `正式啟動程式缺少：${token}`);

const gate = read("social-review-only-mode.js");
assert(gate.includes('VERSION = "2026-07-24-review-gate-v3"'));
assert(gate.includes('!previouslyReviewed && fromApp && incoming.status === "approved"'));
assert(gate.includes("reviewApprovedAt"));
assert(gate.includes("automaticSchedulingEnabled: true"));
assert(gate.includes("automaticSchedulingRequiresReview: true"));
assert(gate.includes("automaticRetryEnabled: false"));
assert(gate.includes("這篇尚未通過人工審核，不能發布"));
assert(gate.includes("請先按『審核通過・啟用自動發布』"));
assert(gate.includes("nextAvailableFixedSlot"));
assert(gate.includes("move-to-next-free-wed-fri-10:00"));

const clientFix = read("internal-app-client-fix.js");
const shell = read("internal-app-shell.js");
const reviewUi = read("internal-app-review-only.js");
const retry = read("internal-app-social-retry.js");
const filter = read("internal-app-social-filter.js");
const facebookHealth = read("internal-app-facebook-health.js");
const immediate = read("social-manual-immediate-publish.js");
assert(clientFix.includes('RUNTIME_VERSION = "20260724-ipad-touch-4"'));
assert(clientFix.includes("internal/app-recovery"));
assert(clientFix.includes("no-store, no-cache, must-revalidate"));
assert(clientFix.includes("touch-action:manipulation"));
assert(clientFix.indexOf("/internal/app-review-only.js") < clientFix.indexOf("/internal/app-social-retry.js"));
assert(shell.includes('VERSION = "20260724-shell-ipad-touch-4"'));
assert(shell.includes("installTapRecovery"));
assert(shell.includes("document.elementsFromPoint"));
assert(shell.includes("lastClickControl"));
assert(shell.includes("setTimeout(() =>"));
assert(shell.includes("> 28"));
assert(shell.includes("if (!nativeClickArrived) activateFallback(control)"));
assert(!shell.includes("event.preventDefault();\n      state.control.click()"), "不可再攔截原生 touchend 後立即合成 click");
assert(reviewUi.includes("人工審核閘門已開啟"));
assert(reviewUi.includes("審核通過・啟用自動發布"));
assert(reviewUi.includes("未審核內容不會發布"));
assert(reviewUi.includes("等待萬華實際氣候"));
assert(reviewUi.includes("自動改排下一個空白的週三／週五上午10:00"));
assert(!reviewUi.includes("new MutationObserver"), "審核介面不可再用全頁 MutationObserver");
assert(retry.includes("立即發布"));
assert(retry.includes("已成功的平台不會重複發布"));
assert(filter.includes("週三、週五上午 10:00"));
assert(facebookHealth.includes('setBoolean(button, "disabled", false)'));
assert(!facebookHealth.includes("new MutationObserver"), "Facebook 狀態介面不可再用全頁 MutationObserver");
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

const batch = read("social-final-approved-batch.js");
assert(batch.includes("api.open-meteo.com"));
assert(batch.includes("weatherTrigger"));
assert(batch.includes("本週已有氣候條件貼文"));

const guard = read("social-publish-guard.js");
assert(guard.includes('VERSION = "2.0.0"'));
assert(guard.includes("withPostLock"));
assert(guard.includes("findPublishedMatch"));
assert(guard.includes("recordPublication"));

console.log("仙加味正式檢查通過：iPad 原生點擊優先，Safari 未產生 click 時才延遲補送；觸控位移容許值已放寬；全頁 MutationObserver 已移除；10篇圖文先進 App 草稿，人工審核後才啟用自動發布；未審核與失敗平台不自動補發；防止重複發布");