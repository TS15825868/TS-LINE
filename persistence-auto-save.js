"use strict";

const fs = require("fs");
const path = require("path");
const bridge = require("./supabase-state-bridge");

let installed = false;
let originalRenameSync = null;

function targets() {
  return new Map([
    [path.resolve(process.env.INTERNAL_DATA_PATH || "/tmp/xianjiawei-internal.json"), bridge.INTERNAL_KEY],
    [path.resolve(process.env.SOCIAL_DATA_PATH || "/tmp/xianjiawei-social-posts.json"), bridge.SOCIAL_KEY],
  ]);
}

function scheduleSave(destination) {
  const resolvedDestination = path.resolve(String(destination));
  const key = targets().get(resolvedDestination);
  if (!key) return;
  setImmediate(async () => {
    const saved = await bridge.saveFile(key, resolvedDestination);
    if (!saved && bridge.health().enabled) {
      console.error(`Automatic Supabase save did not complete for ${key}`);
    }
  });
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
}

module.exports = {
  installPersistenceAutoSave,
  uninstallPersistenceAutoSave,
  scheduleSave,
};
