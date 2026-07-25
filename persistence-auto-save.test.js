"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const source = fs.readFileSync(path.join(__dirname, "persistence-auto-save.js"), "utf8");
for (const token of [
  "installPersistenceAutoSave",
  "uninstallPersistenceAutoSave",
  "fs.renameSync",
  "bridge.saveFile",
  "INTERNAL_DATA_PATH",
  "SOCIAL_DATA_PATH",
  "SAVE_DEBOUNCE_MS",
  "enqueueSave",
  "centralized save queue",
  'require("./runtime-social-stabilizer")',
]) {
  assert.ok(source.includes(token), `persistence auto-save missing ${token}`);
}
assert.ok(!source.includes("retryCounts"), "retry ownership must stay in the central Supabase bridge");
assert.ok(!source.includes("RETRY_DELAY_MS"), "auto-save must not start a competing retry loop");

const original = fs.renameSync;
const autoSave = require("./persistence-auto-save");
assert.strictEqual(autoSave.VERSION, "1.2.1");
assert.ok(autoSave.SAVE_DEBOUNCE_MS >= 0);
autoSave.installPersistenceAutoSave();
assert.notStrictEqual(fs.renameSync, original);
autoSave.installPersistenceAutoSave();
autoSave.uninstallPersistenceAutoSave();
assert.strictEqual(fs.renameSync, original);

console.log("PASS centralized Supabase queue and early ten-post review stabilizer installation");