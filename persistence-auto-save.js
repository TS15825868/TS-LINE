"use strict";

const fs = require("fs");
const path = require("path");
const bridge = require("./supabase-state-bridge");

const VERSION = "1.1.0";
const SAVE_DEBOUNCE_MS = Number(process.env.SUPABASE_SAVE_DEBOUNCE_MS || 1200);
const RETRY_DELAY_MS = Number(process.env.SUPABASE_SAVE_RETRY_DELAY_MS || 15000);
const ERROR_LOG_COOLDOWN_MS = Number(process.env.SUPABASE_ERROR_LOG_COOLDOWN_MS || 5 * 60 * 1000);

let installed = false;
let originalRenameSync = null;
const timers = new Map();
const chains = new Map();
const retryCounts = new Map();
const lastErrorLogAt = new Map();

function targets() {
  return new Map([
    [path.resolve(process.env.INTERNAL_DATA_PATH || "/tmp/xianjiawei-internal.json"), bridge.INTERNAL_KEY],
    [path.resolve(process.env.SOCIAL_DATA_PATH || "/tmp/xianjiawei-social-posts.json"), bridge.SOCIAL_KEY],
  ]);
}

function throttledError(key, message) {
  const now = Date.now();
  const previous = Number(lastErrorLogAt.get(key) || 0);
  if (now - previous < ERROR_LOG_COOLDOWN_MS) return;
  lastErrorLogAt.set(key, now);
  console.error(message);
}

function enqueueSave(key, destination, delayMs = SAVE_DEBOUNCE_MS) {
  const existing = timers.get(key);
  if (existing) clearTimeout(existing);
  const timer = setTimeout(() => {
    timers.delete(key);
    const previous = chains.get(key) || Promise.resolve();
    const next = previous
      .catch(() => {})
      .then(async () => {
        const saved = await bridge.saveFile(key, destination);
        if (saved) {
          retryCounts.set(key, 0);
          return true;
        }
        if (!bridge.health().enabled) return false;
        const count = Number(retryCounts.get(key) || 0) + 1;
        retryCounts.set(key, count);
        throttledError(key, `Automatic Supabase save did not complete for ${key}; retry scheduled`);
        if (count <= 3) enqueueSave(key, destination, RETRY_DELAY_MS * count);
        return false;
      })
      .finally(() => {
        if (chains.get(key) === next) chains.delete(key);
      });
    chains.set(key, next);
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
  chains.clear();
  retryCounts.clear();
}

module.exports = {
  VERSION,
  SAVE_DEBOUNCE_MS,
  RETRY_DELAY_MS,
  ERROR_LOG_COOLDOWN_MS,
  installPersistenceAutoSave,
  uninstallPersistenceAutoSave,
  scheduleSave,
  enqueueSave,
};
