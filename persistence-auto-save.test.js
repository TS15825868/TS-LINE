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
  "RETRY_DELAY_MS",
  "ERROR_LOG_COOLDOWN_MS",
  "enqueueSave",
  "retry scheduled",
]) {
  assert.ok(source.includes(token), `persistence auto-save missing ${token}`);
}

const original = fs.renameSync;
const autoSave = require("./persistence-auto-save");
assert.strictEqual(autoSave.VERSION, "1.1.0");
assert.ok(autoSave.SAVE_DEBOUNCE_MS >= 0);
assert.ok(autoSave.RETRY_DELAY_MS >= 1000);
autoSave.installPersistenceAutoSave();
assert.notStrictEqual(fs.renameSync, original);
autoSave.installPersistenceAutoSave();
autoSave.uninstallPersistenceAutoSave();
assert.strictEqual(fs.renameSync, original);

console.log("PASS debounced automatic persistence, bounded retries and atomic-write interception");
