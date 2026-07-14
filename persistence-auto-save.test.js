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
  "setImmediate",
]) {
  assert.ok(source.includes(token), `persistence auto-save missing ${token}`);
}

const original = fs.renameSync;
const autoSave = require("./persistence-auto-save");
autoSave.installPersistenceAutoSave();
assert.notStrictEqual(fs.renameSync, original);
autoSave.installPersistenceAutoSave();
autoSave.uninstallPersistenceAutoSave();
assert.strictEqual(fs.renameSync, original);

console.log("PASS automatic persistence installation and atomic-write interception");
