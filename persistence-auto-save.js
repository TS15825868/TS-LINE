"use strict";

// internal-entry 會先載入此模組；在任何 social-server 實例建立前安裝正式十篇待審穩定器。
require("./runtime-social-stabilizer");

const fs = require("fs");
const path = require("path");
const bridge = require("./supabase-state-bridge");

const VERSION = "1.2.1";
const SAVE_DEBOUNCE_MS = Number(process.env.SUPABASE_SAVE_DEBOUNCE_MS || 1500);

let installed = false;
let originalRenameSync = null;
const timers = new Map();

function targets() {
  return new Map([
    [path.resolve(process.env.INTERNAL_DATA_PATH || "/tmp/xianjiawei-internal.json"), bridge.INTERNAL_KEY],
    [path.resolve(process.env.SOCIAL_DATA_PATH || "/tmp/xianjiawei-social-posts.json"), bridge.SOCIAL_KEY],
  ]);
}

function enqueueSave(key, destination, delayMs = SAVE_DEBOUNCE_MS) {
  const existing = timers.get(key);
  if (existing) clearTimeout(existing);
  const timer = setTimeout(() => {
    timers.delete(key);
    bridge.saveFile(key, destination).catch((error) => {
      console.error(`Supabase centralized save queue failed for ${key}`, error.message);
    });
  }, Math.max(0, delayMs));
  timer.unref?.();
  timers.set(key, timer);
}

function scheduleSave(destination) {
  const resolvedDestination = path.resolve(String(destination));
  const key = targets().get(resolvedDestination);
  if (!key) return;
  enqueueSave(key, resolvedDestination);
}

function installPersistenceAutoSave() {
  if (installed) return;
  installed = true;
  originalRenameSync = fs.renameSync;
  fs.renameSync = function patchedRenameSync(oldPath, newPath) {
    const result = originalRenameSync.call(fs, oldPath, newPath);
    scheduleSave(newPath);
    return result;
  };
}

function uninstallPersistenceAutoSave() {
  if (!installed || !originalRenameSync) return;
  fs.renameSync = originalRenameSync;
  originalRenameSync = null;
  installed = false;
  for (const timer of timers.values()) clearTimeout(timer);
  timers.clear();
}

module.exports = {
  VERSION,
  SAVE_DEBOUNCE_MS,
  installPersistenceAutoSave,
  uninstallPersistenceAutoSave,
  scheduleSave,
  enqueueSave,
};