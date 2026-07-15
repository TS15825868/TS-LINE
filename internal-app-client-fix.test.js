"use strict";

const assert = require("assert");
const vm = require("vm");
const {
  shellScript,
  runtimeScript,
  uploadControllerScript,
  formControllerScript,
  safeExtrasScript,
  orderEntryScript,
  socialRetryScript,
  socialFilterScript,
  postbootScript,
  fixGeneratedHtml,
} = require("./internal-app-client-fix");

const shell = shellScript();
assert.ok(shell.includes("function showView"));
assert.ok(shell.includes("unhandledrejection"));
new vm.Script(shell);

const runtime = runtimeScript();
assert.ok(runtime.includes("async function loadAll"));
assert.ok(runtime.includes("function renderInventory"));
assert.ok(runtime.includes("function renderSocial"));
new vm.Script(runtime);

const upload = uploadControllerScript();
assert.ok(upload.includes("/internal/api/v2/social/upload"));
assert.ok(upload.includes("file.addEventListener"));
new vm.Script(upload);

const forms = formControllerScript();
assert.ok(forms.includes("草稿已更新，表單已清空"));
assert.ok(forms.includes("event.stopImmediatePropagation"));
new vm.Script(forms);

const extras = safeExtrasScript();
assert.ok(extras.includes("installToolsView"));
assert.ok(extras.includes("xjwSaveAllInventory"));
assert.ok(extras.includes("data-xjw-social-edit"));
assert.ok(!extras.includes("MutationObserver"));
new vm.Script(extras);

const orderEntry = orderEntryScript();
[
  "orderLines",
  "單價",
  "數量",
  "折扣",
  "運費",
  "已收金額",
  "未收餘額",
  "付款狀態",
  "預計送貨日",
  "待送貨",
  "可用庫存",
].forEach((token) => assert.ok(orderEntry.includes(token), `order entry missing ${token}`));
assert.ok(!orderEntry.includes("MutationObserver"));
new vm.Script(orderEntry);

const retry = socialRetryScript();
assert.ok(retry.includes("重試失敗平台"));
assert.ok(retry.includes("data-social-action"));
assert.ok(retry.includes('["approved", "failed", "partial"]'));
assert.ok(!retry.includes("MutationObserver"));
new vm.Script(retry);

const filter = socialFilterScript();
["待審核", "已審核", "已發佈", "未發佈", "data-social-filter"].forEach((token) => assert.ok(filter.includes(token)));
assert.ok(!filter.includes("MutationObserver"));
new vm.Script(filter);

const postboot = postbootScript();
assert.ok(postboot.includes("window.loadAll"));
assert.ok(postboot.includes("xjwAppReady"));
new vm.Script(postboot);

const broken = '<html><head><title>仙加味內部管理 App</title></head><body><script>broken(</script><script src="/old.js"></script></body></html>';
const fixed = fixGeneratedHtml(broken);
assert.ok(fixed.includes("/internal/app-shell.js"));
assert.ok(fixed.includes("/internal/app-runtime.js"));
assert.ok(fixed.includes("/internal/app-upload-controller.js"));
assert.ok(fixed.includes("/internal/app-form-controller.js"));
assert.ok(fixed.includes("/internal/app-safe-extras.js"));
assert.ok(fixed.includes("/internal/order-entry-controller.js"));
assert.ok(fixed.includes("/internal/app-social-retry.js"));
assert.ok(fixed.includes("/internal/app-social-filter.js"));
assert.ok(fixed.includes("/internal/app-postboot.js"));
assert.ok(!fixed.includes("broken("));
assert.ok(!fixed.includes("/old.js"));
assert.ok(!fixed.includes("/internal/app-order-calculator.js"));
assert.strictEqual(fixGeneratedHtml("plain response"), "plain response");

console.log("PASS stable internal app shell, core, upload, forms, itemized order entry, social retry, filters and postboot");
