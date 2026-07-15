"use strict";

const assert = require("assert");
const fs = require("fs");

const shell = fs.readFileSync(require.resolve("./internal-app-shell"), "utf8");
const runtime = fs.readFileSync(require.resolve("./internal-app-runtime"), "utf8");
const upload = fs.readFileSync(require.resolve("./internal-app-upload-controller"), "utf8");
const forms = fs.readFileSync(require.resolve("./internal-app-form-controller"), "utf8");
const extras = fs.readFileSync(require.resolve("./internal-app-safe-extras"), "utf8");
const retry = fs.readFileSync(require.resolve("./internal-app-social-retry"), "utf8");

[
  "[data-view]",
  "重新整理",
  "更新中…",
  "已更新",
  "更新失敗",
  "dataset.refreshApp",
  "button[data-refresh-app='true']",
  "window.xjwRefreshApp",
  "unhandledrejection",
].forEach((token) => assert.ok(shell.includes(token), `shell missing ${token}`));

[
  "data-order-edit",
  "data-order-status",
  "data-order-delete",
  "data-customer-edit",
  "data-customer-delete",
  "data-inventory-save",
  "data-inventory-adjust",
  "data-reminder-edit",
  "data-reminder-toggle",
  "data-reminder-delete",
  "data-social-action",
  "window.loadAll",
  "window.renderReports",
  "window.resetOrderForm",
  "window.resetCustomerForm",
  "window.resetReminderForm",
].forEach((token) => assert.ok(runtime.includes(token), `runtime missing ${token}`));

[
  "orderForm",
  "customerForm",
  "reminderForm",
  "socialForm",
  "staffForm",
  "restoreForm",
  "PATCH",
  "POST",
  "表單已清空",
].forEach((token) => assert.ok(forms.includes(token), `form controller missing ${token}`));

[
  "/internal/api/v2/social/upload",
  "socialImageFile",
  "socialImagePreview",
  "form.requestSubmit",
].forEach((token) => assert.ok(upload.includes(token), `upload controller missing ${token}`));

[
  "營運工具",
  "跨功能搜尋",
  "xjwSaveAllInventory",
  "data-xjw-order-duplicate",
  "data-xjw-order-print",
  "data-xjw-order-copy",
  "data-xjw-customer-order",
  "data-xjw-customer-reminder",
  "data-xjw-social-edit",
  "data-xjw-social-duplicate",
  "data-xjw-social-copy",
  "/internal/api/v2/ops/sync",
  "/internal/api/v2/export/backup",
].forEach((token) => assert.ok(extras.includes(token), `safe extras missing ${token}`));

[
  "data-social-action",
  "publish",
  "partial",
  "重試失敗平台",
  "重新發布",
  "立即發布",
  "needsRetryFromCard",
  "Access Token 已過期",
  "data-xjw-social-duplicate",
].forEach((token) => assert.ok(retry.includes(token), `social retry missing ${token}`));

assert.ok(!extras.includes("MutationObserver"), "safe extras must not use MutationObserver");
assert.ok(!retry.includes("MutationObserver"), "social retry must not use MutationObserver");
console.log("PASS all internal app button contracts including reliable refresh and partial social retry");
